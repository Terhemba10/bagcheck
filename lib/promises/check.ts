import "server-only";
import { z } from "zod";
import { getInfo } from "@/lib/cmc/api";
import { llm, LlmError } from "@/lib/llm";
import { safeFetch, UnsafeUrlError } from "@/lib/net/safeFetch";
import { kv } from "@/lib/store/kv";
import { EXTRACT_PROMISES_SCHEMA, EXTRACT_PROMISES_SYSTEM, extractPromisesPrompt } from "@/prompts/extractPromises";
import { findRoadmapLinks, focusOnRoadmap, htmlToText, normalizeDue, promiseStatus, quoteShowsDone, verifyQuote } from "./extract";
import type { PromiseStatus } from "@/components/ui/PromiseItem";

/**
 * Promise check: read the project's own website + roadmap/docs pages,
 * let the AI extract commitments, then keep only items whose quote appears
 * word-for-word in the cited page. Dates and status are computed in code.
 */
export interface CheckedPromise {
  promise: string;
  dueDate: string | null;
  sourceUrl: string;
  quote: string;
  status: PromiseStatus;
}

export interface PageRead {
  url: string;
  ok: boolean;
  chars: number;
  note?: string;
}

export interface PromiseCheck {
  coinId: number;
  promises: CheckedPromise[];
  pages: PageRead[];
  /** AI items dropped because their quote wasn't found word-for-word, or the source wasn't a page we read. */
  dropped: number;
  generatedAt: string;
  /** Why the list is empty, in plain English (null if not empty). */
  emptyReason: string | null;
}

const TTL = 24 * 3600;
/** Cache key for a coin's promise check (bump the version when extraction logic changes). */
export const promisesKey = (id: number) => `promises:v4:${id}`;
const MAX_PAGE_CHARS = 12_000;
const MIN_USEFUL_CHARS = 400;

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

async function readPage(url: string): Promise<{ read: PageRead; html: string; text: string }> {
  try {
    const r = await safeFetch(url, { timeoutMs: 8000 });
    if (r.status >= 400) return { read: { url, ok: false, chars: 0, note: `HTTP ${r.status}` }, html: "", text: "" };
    if (/pdf/i.test(r.contentType)) return { read: { url, ok: false, chars: 0, note: "PDF (not read yet)" }, html: "", text: "" };
    const full = /html|xml/i.test(r.contentType) ? htmlToText(r.body, 80_000) : r.body.slice(0, 80_000);
    const text = focusOnRoadmap(full, MAX_PAGE_CHARS);
    const note = text.length < MIN_USEFUL_CHARS ? "Very little text (the page may need JavaScript to show its content)" : undefined;
    return { read: { url: r.url, ok: text.length >= MIN_USEFUL_CHARS, chars: text.length, note }, html: r.body, text };
  } catch (e) {
    const note = e instanceof UnsafeUrlError ? e.message : e instanceof Error && e.name === "TimeoutError" ? "Timed out" : "Couldn't connect";
    return { read: { url, ok: false, chars: 0, note }, html: "", text: "" };
  }
}

export async function runPromiseCheck(id: number, opts: { fresh?: boolean; now?: Date } = {}): Promise<PromiseCheck> {
  const key = promisesKey(id);
  if (!opts.fresh) {
    const cached = await kv().get<PromiseCheck>(key).catch(() => null);
    if (cached) return refreshStatuses(cached, opts.now);
  }
  const now = opts.now ?? new Date();
  const info = (await getInfo([id])).value[id];
  const base = { coinId: id, generatedAt: now.toISOString(), dropped: 0 };
  const website = info?.urls?.website?.[0];
  if (!info || !website) {
    return save(key, { ...base, promises: [], pages: [], emptyReason: "CoinMarketCap lists no official website for this coin, so there's nothing to read." });
  }

  // 1. the website, then up to 2 roadmap/docs pages it links to (+ the CMC whitepaper link if it's a web page)
  const home = await readPage(website);
  const extra = new Set<string>(home.html ? findRoadmapLinks(home.html, home.read.url, 2) : []);
  // many sites have a /roadmap page that isn't linked from the home page HTML (JS menus)
  if (extra.size === 0 && home.read.ok !== undefined) {
    try {
      extra.add(new URL("/roadmap", home.read.url).toString());
    } catch {
      /* ignore */
    }
  }
  const doc = info.urls?.technical_doc?.[0];
  if (doc && !/\.pdf(\?|$)/i.test(doc) && extra.size < 3) extra.add(doc);
  const more = await Promise.all([...extra].slice(0, 3).map(readPage));
  const all = [home, ...more];
  // a guessed /roadmap that doesn't exist isn't worth listing as a failed page
  const pages = all.filter((p) => p.read.ok || !p.read.url.endsWith("/roadmap") || p.read.chars > 0).map((p) => p.read);
  const readable = all.filter((p) => p.read.ok);
  if (!readable.length) {
    return save(key, { ...base, promises: [], pages, emptyReason: "We couldn't read any text on the project's website or docs (they may load content with JavaScript, block automated readers, or be offline)." });
  }

  // 2. AI extraction
  const out = await llm().json({
    system: EXTRACT_PROMISES_SYSTEM,
    prompt: extractPromisesPrompt({ name: info.name, symbol: info.symbol }, readable.map((p) => ({ url: p.read.url, text: p.text })), now.toISOString().slice(0, 10)),
    schema: AiOutput,
    jsonSchema: EXTRACT_PROMISES_SCHEMA as unknown as Record<string, unknown>,
    temperature: 0.1,
  });

  // 3. verify every item in code
  const key2 = (u: string) => u.trim().replace(/\/+$/, "").toLowerCase();
  const textByUrl = new Map(readable.map((p) => [key2(p.read.url), { url: p.read.url, text: p.text }]));
  const promises: CheckedPromise[] = [];
  let dropped = 0;
  for (const p of out.promises) {
    if (p.kind === "existing") continue; // features that already exist aren't promises
    const page = textByUrl.get(key2(p.sourceUrl));
    if (page) p.sourceUrl = page.url; // link to the exact page we read
    const text = page?.text;
    const quote = text ? verifyQuote(p.quote, text) : null;
    if (!quote) {
      dropped++;
      continue;
    }
    const dueDate = normalizeDue(p.dueDate);
    // "delivered" needs evidence in the quote itself; the AI's own claim isn't enough
    const done = Boolean(p.alreadyDone) && quoteShowsDone(quote);
    promises.push({ promise: p.promise.trim(), dueDate, sourceUrl: p.sourceUrl, quote, status: promiseStatus(dueDate, now, done) });
  }
  promises.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));

  return save(key, {
    ...base,
    promises: promises.slice(0, 12),
    pages,
    dropped,
    emptyReason: promises.length ? null : "The pages we read don't contain specific, dated commitments.",
  });
}

async function save(key: string, v: PromiseCheck): Promise<PromiseCheck> {
  await kv().set(key, v, TTL).catch(() => undefined);
  return v;
}

/** Status depends on today's date, so recompute it for cached results. */
function refreshStatuses(c: PromiseCheck, now = new Date()): PromiseCheck {
  return { ...c, promises: c.promises.map((p) => (p.status === "delivered" ? p : { ...p, status: promiseStatus(p.dueDate, now) })) };
}

export { LlmError };
