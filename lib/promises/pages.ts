/**
 * Deterministic, cached promise extraction per page.
 *
 *  - Same page text → same result: results are stored in Redis under
 *    URL + SHA-256 of the page text for 7 days. Gemini is only called again
 *    when the page changes or the entry expires.
 *  - Each run is as repeatable as we can make it: temperature 0, fixed page
 *    order, fixed chunk size, chunk-by-chunk extraction in order, then merge,
 *    de-duplicate and sort with fixed rules.
 *
 * Dependencies (LLM, store, clock) are passed in so tests can run it twice on
 * saved page text and compare.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import type { PromiseStatus } from "@/components/ui/PromiseItem";
import type { KV } from "@/lib/store/kv";
import type { LlmProvider } from "@/lib/llm/types";
import { EXTRACT_PROMISES_SCHEMA, EXTRACT_PROMISES_SYSTEM, extractPromisesPrompt } from "@/prompts/extractPromises";
import { canonicalQuote, dueEnd, normalizeDue, promiseStatus, quoteShowsDone, verifyQuote } from "./extract";

export const CHUNK_SIZE = 6000;
export const PAGE_CACHE_TTL = 7 * 24 * 3600;
const PAGE_CACHE_VERSION = "v5"; // bump when the prompt or verification rules change
export const MAX_PROMISES = 12;

export interface PageText {
  url: string;
  text: string;
}

/** A verified item from one page (quote found word-for-word in that page). */
export interface PageItem {
  promise: string;
  dueDate: string | null;
  quote: string;
  done: boolean;
  /** Line position on the page (stable tie-break for ordering). */
  pos: number;
}

export interface PageExtraction {
  url: string;
  textHash: string;
  items: PageItem[];
  /** AI items dropped (quote not found on the page). */
  dropped: number;
  /** When Bag read this exact page text. */
  extractedAt: string;
  /** true when this result came from the cache (no AI call). */
  cached?: boolean;
}

export interface CheckedPromise {
  promise: string;
  dueDate: string | null;
  sourceUrl: string;
  quote: string;
  status: PromiseStatus;
}

const AiOutput = z.object({
  promises: z
    .array(
      z.object({
        promise: z.string().min(3).max(200),
        dueDate: z.string().nullable(),
        sourceUrl: z.string(),
        quote: z.string().min(3),
        alreadyDone: z.boolean().optional(),
        kind: z.enum(["commitment", "existing"]).optional(),
      }),
    )
    .max(20),
});

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Split text into chunks of at most `size` characters, breaking at blank
 * lines, then line breaks, then spaces. Same input → same chunks.
 */
export function chunkText(text: string, size = CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > size) {
    const window = rest.slice(0, size);
    let cut = window.lastIndexOf("\n\n");
    if (cut < size * 0.5) cut = window.lastIndexOf("\n");
    if (cut < size * 0.5) cut = window.lastIndexOf(" ");
    if (cut < size * 0.5) cut = size;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** De-duplicate (same promise + same date, or the same quote) keeping the first. */
export function dedupe<T extends { promise: string; dueDate: string | null; quote: string }>(items: T[]): T[] {
  const seenPromise = new Set<string>();
  const seenQuote = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const pk = `${normKey(it.promise)}|${it.dueDate ?? ""}`;
    const qk = normKey(it.quote);
    if (seenPromise.has(pk) || seenQuote.has(qk)) continue;
    seenPromise.add(pk);
    seenQuote.add(qk);
    out.push(it);
  }
  return out;
}

/** Chronological sort key: the end of the due period (2026-Q3 → 30 Sep, 2026-12 → 31 Dec); undated last. */
const dueKey = (d: string | null) => (d ? dueEnd(d).getTime() : Number.POSITIVE_INFINITY);

/** Fixed ordering: by due date (chronological, undated last), then position on the page, then quote. */
export function sortPromises<T extends { dueDate: string | null; quote: string; pos?: number }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      dueKey(a.dueDate) - dueKey(b.dueDate) ||
      (a.pos ?? 0) - (b.pos ?? 0) ||
      normKey(a.quote).localeCompare(normKey(b.quote)),
  );
}

export interface ExtractDeps {
  llm: LlmProvider;
  kv: KV;
  now: Date;
}

export function pageCacheKey(page: PageText): string {
  return `promx:${PAGE_CACHE_VERSION}:${sha256(page.url).slice(0, 16)}:${sha256(page.text)}`;
}

/** Extract verified promise items from one page, using the cache when the text hasn't changed. */
export async function extractPage(page: PageText, coin: { name: string; symbol: string }, deps: ExtractDeps): Promise<PageExtraction> {
  const key = pageCacheKey(page);
  const cached = await deps.kv.get<PageExtraction>(key).catch(() => null);
  if (cached) return { ...cached, cached: true };

  const items: PageItem[] = [];
  let dropped = 0;
  // `today` is fixed per extraction day only for the prompt; status is computed later from the real date
  const today = deps.now.toISOString().slice(0, 10);
  for (const chunk of chunkText(page.text)) {
    const out = await deps.llm.json({
      system: EXTRACT_PROMISES_SYSTEM,
      prompt: extractPromisesPrompt(coin, [{ url: page.url, text: chunk }], today),
      schema: AiOutput,
      jsonSchema: EXTRACT_PROMISES_SCHEMA as unknown as Record<string, unknown>,
      temperature: 0,
    });
    for (const p of out.promises) {
      if (p.kind === "existing") continue; // things that already exist aren't promises
      // verify against the whole page (a quote may straddle a chunk edge only if it's in the page)
      const verified = verifyQuote(p.quote, page.text);
      // rebuild the quote from the page line so its length doesn't depend on the AI's cut
      const canon = verified ? canonicalQuote(verified, page.text) : null;
      if (!verified || !canon) {
        dropped++;
        continue;
      }
      // "delivered" needs evidence in the quote itself; the AI's own claim isn't enough
      items.push({ promise: p.promise.trim(), dueDate: normalizeDue(p.dueDate), quote: canon.quote, done: Boolean(p.alreadyDone) && quoteShowsDone(canon.quote), pos: canon.pos });
    }
  }

  const result: PageExtraction = {
    url: page.url,
    textHash: sha256(page.text),
    items: sortPromises(dedupe(items)),
    dropped,
    extractedAt: deps.now.toISOString(),
  };
  await deps.kv.set(key, result, PAGE_CACHE_TTL).catch(() => undefined);
  return result;
}

/** Merge pages (in their fixed order), de-duplicate, compute status for `now`, sort, cap. */
export function mergeExtractions(extractions: PageExtraction[], now: Date): CheckedPromise[] {
  // position = page order (home first) then line on the page, so ties sort the same way every time
  const all = extractions.flatMap((e, pageIndex) => e.items.map((it) => ({ ...it, pos: pageIndex * 1_000_000 + (it.pos ?? 0), sourceUrl: e.url })));
  return sortPromises(dedupe(all))
    .slice(0, MAX_PROMISES)
    .map((it) => ({ promise: it.promise, dueDate: it.dueDate, sourceUrl: it.sourceUrl, quote: it.quote, status: promiseStatus(it.dueDate, now, it.done) }));
}

/** "Read on 20 Nov 2026", or a range when pages were read on different days. */
export function readOnLabel(dates: string[]): string | null {
  const days = [...new Set(dates.map((d) => d.slice(0, 10)))].sort();
  if (!days.length) return null;
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return days.length === 1 ? `Read on ${fmt(days[0]!)}` : `Read between ${fmt(days[0]!)} and ${fmt(days.at(-1)!)}`;
}
