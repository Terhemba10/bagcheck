import { savePromiseSummary } from "@/lib/core/boardSummaries";
import "server-only";
import { getInfo } from "@/lib/cmc/api";
import { llm, LlmError } from "@/lib/llm";
import { safeFetch, UnsafeUrlError } from "@/lib/net/safeFetch";
import { kv } from "@/lib/store/kv";
import { findRoadmapLinks, focusOnRoadmap, htmlToText, isDevDocPath, promiseStatus } from "./extract";
import { extractPage, mergeExtractions, readOnLabel, type CheckedPromise, type PageExtraction } from "./pages";

export type { CheckedPromise };

/**
 * Promise check: read the project's own website + roadmap/docs pages,
 * let the AI extract commitments, then keep only items whose quote appears
 * word-for-word in the cited page. Dates and status are computed in code.
 */
export interface PageRead {
  url: string;
  ok: boolean;
  chars: number;
  note?: string;
  /** When Covex read this page's current text (cached up to 7 days while the text is unchanged). */
  readAt?: string;
}

export interface PromiseCheck {
  coinId: number;
  promises: CheckedPromise[];
  pages: PageRead[];
  /** AI items dropped because their quote wasn't found word-for-word, or the source wasn't a page we read. */
  dropped: number;
  generatedAt: string;
  /** "Read on 20 Nov 2026" (or a range), from when the pages' current text was read. */
  readOn: string | null;
  /** Why the list is empty, in plain English (null if not empty). */
  emptyReason: string | null;
}

const TTL = 24 * 3600;
/** Cache key for a coin's promise check (bump the version when extraction logic changes). */
export const promisesKey = (id: number) => `promises:v12:${id}`;
const MAX_PAGE_CHARS = 12_000;
const MIN_USEFUL_CHARS = 400;

async function readPage(url: string, opts: { isHome?: boolean } = {}): Promise<{ read: PageRead; html: string; text: string }> {
  try {
    const r = await safeFetch(url, { timeoutMs: 8000 });
    if (r.status >= 400) return { read: { url, ok: false, chars: 0, note: `HTTP ${r.status}` }, html: "", text: "" };
    if (/pdf/i.test(r.contentType)) return { read: { url, ok: false, chars: 0, note: "PDF (not read yet)" }, html: "", text: "" };
    // developer/API docs (however we got there: link, redirect or CMC's doc link) aren't investor-facing promises
    if (!opts.isHome && isDevDocPath(safePath(r.url))) return { read: { url: r.url, ok: false, chars: 0, note: "Developer docs (skipped)" }, html: "", text: "" };
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
    if (cached) {
      const fresh = refreshStatuses(cached, opts.now);
      void savePromiseSummary(id, fresh.promises.map((p) => p.status)); // keeps the Risk board current
      return fresh;
    }
  }
  const now = opts.now ?? new Date();
  const info = (await getInfo([id])).value[id];
  const base = { coinId: id, generatedAt: now.toISOString(), dropped: 0, readOn: null };
  const website = info?.urls?.website?.[0];
  if (!info || !website) {
    return save(key, { ...base, promises: [], pages: [], emptyReason: "CoinMarketCap lists no official website for this coin, so there's nothing to read." });
  }

  // 1. the website, then up to 2 roadmap/docs pages it links to (+ the CMC whitepaper link if it's a web page)
  const home = await readPage(website, { isHome: true });
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
  if (doc && !/\.pdf(\?|$)/i.test(doc) && !isDevDocPath(safePath(doc)) && extra.size < 3) extra.add(doc);
  const more = await Promise.all([...extra].slice(0, 3).map((u) => readPage(u)));
  const all = [home, ...more];
  // a guessed /roadmap that doesn't exist isn't worth listing as a failed page
  const pages = all.filter((p) => p.read.ok || !p.read.url.endsWith("/roadmap") || p.read.chars > 0).map((p) => p.read);
  const readable = all.filter((p) => p.read.ok);
  if (!readable.length) {
    return save(key, { ...base, promises: [], pages, emptyReason: "We couldn't read any text on the project's website or docs (they may load content with JavaScript, block automated readers, or be offline)." });
  }

  // 2. AI extraction, page by page in a fixed order (home first), each cached by URL + text hash
  const extractions: PageExtraction[] = [];
  for (const p of readable) {
    extractions.push(await extractPage({ url: p.read.url, text: p.text }, { name: info.name, symbol: info.symbol }, { llm: llm(), kv: kv(), now }));
  }
  const readAt = new Map(extractions.map((e) => [e.url, e.extractedAt]));
  const promises = mergeExtractions(extractions, now);
  const dropped = extractions.reduce((n, e) => n + e.dropped, 0);

  return save(key, {
    ...base,
    promises,
    pages: pages.map((p) => (readAt.has(p.url) ? { ...p, readAt: readAt.get(p.url) } : p)),
    dropped,
    readOn: readOnLabel(extractions.map((e) => e.extractedAt)),
    emptyReason: promises.length ? null : "The pages we read don't contain specific, dated commitments.",
  });
}

function safePath(u: string): string {
  try {
    return new URL(u).pathname;
  } catch {
    return "";
  }
}

async function save(key: string, v: PromiseCheck): Promise<PromiseCheck> {
  await kv().set(key, v, TTL).catch(() => undefined);
  await savePromiseSummary(v.coinId, v.promises.map((p) => p.status)); // for the Risk board
  return v;
}

/** Status depends on today's date, so recompute it for cached results. */
function refreshStatuses(c: PromiseCheck, now = new Date()): PromiseCheck {
  return { ...c, promises: c.promises.map((p) => (p.status === "delivered" ? p : { ...p, status: promiseStatus(p.dueDate, now) })) };
}

export { LlmError };
