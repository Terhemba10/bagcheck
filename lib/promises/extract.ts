/**
 * Promise-check helpers. Pure (no network), unit-tested.
 *  - htmlToText: readable text from a project page
 *  - findRoadmapLinks: roadmap / docs / whitepaper links on that page
 *  - verifyQuote: the AI's quote must appear word-for-word in the page it cites
 *  - normalizeDue / dueEnd / promiseStatus: dates and status, computed in code
 */
import type { PromiseStatus } from "@/components/ui/PromiseItem";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+[0-9]*);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k.startsWith("#x")) return String.fromCodePoint(parseInt(k.slice(2), 16) || 32);
    if (k.startsWith("#")) return String.fromCodePoint(parseInt(k.slice(1), 10) || 32);
    return ENTITIES[k] ?? m;
  });
}

export function htmlToText(html: string, maxChars = 15_000): string {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|head)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer|blockquote|dd|dt)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, " ");
  s = decodeEntities(s)
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s.length > maxChars ? s.slice(0, maxChars) : s;
}

/**
 * Long pages (whitepapers): keep the window that holds the roadmap, i.e. the
 * first "roadmap"/"milestones" heading or quarter marker (Q3 2026 / 2026 Q3),
 * instead of just the first `max` characters.
 */
export function focusOnRoadmap(text: string, max: number): string {
  if (text.length <= max) return text;
  const m = /road\s*-?map|milestones|\bQ[1-4]\s*20\d{2}\b|\b20\d{2}\s*Q[1-4]\b/i.exec(text);
  if (!m) return text.slice(0, max);
  const start = Math.max(0, Math.min(m.index - 500, text.length - max));
  return text.slice(start, start + max);
}

/** Developer/API docs describe how to integrate, not what the project promises investors. */
export function isDevDocPath(pathname: string): boolean {
  return /(^|[/._-])(api|apis|auth|sdk|reference|developers?|integration|openapi|swagger)([/._-]|$)/i.test(pathname);
}

const ROADMAP_RE = /(road\s*-?map|milestone|white\s*-?paper|lite\s*-?paper|docs|documentation|tokenomics|gitbook)/i;
const DOC_HOSTS = /(gitbook\.io|notion\.site|github\.io|medium\.com|mirror\.xyz|substack\.com)$/i;

/** Up to `max` roadmap/docs links from a page, roadmap-like first. Same site or known docs hosts only. */
export function findRoadmapLinks(html: string, baseUrl: string, max = 2): string[] {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }
  const siteRoot = base.hostname.replace(/^www\./, "").split(".").slice(-2).join(".");
  const found: { url: string; rank: number }[] = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const href = m[1]!;
    const text = htmlToText(m[2] ?? "", 200);
    if (!ROADMAP_RE.test(`${href} ${text}`)) continue;
    let u: URL;
    try {
      u = new URL(decodeEntities(href), base);
    } catch {
      continue;
    }
    if (u.protocol !== "https:" && u.protocol !== "http:") continue;
    const host = u.hostname.replace(/^www\./, "");
    if (!(host === siteRoot || host.endsWith(`.${siteRoot}`) || DOC_HOSTS.test(host))) continue;
    if (/\.(pdf|png|jpe?g|zip)(\?|$)/i.test(u.pathname)) continue; // PDFs aren't read (yet)
    if (isDevDocPath(u.pathname)) continue;
    u.hash = "";
    const url = u.toString();
    if (url === base.toString() || found.some((f) => f.url === url)) continue;
    const hay = `${href} ${text}`;
    // roadmap pages first, then whitepaper/litepaper/tokenomics, plain "docs" only as a last resort
    const rank = /road\s*-?map|milestone/i.test(hay) ? 0 : /white\s*-?paper|lite\s*-?paper|tokenomics/i.test(hay) ? 1 : 2;
    found.push({ url, rank });
  }
  const sorted = found.sort((a, b) => a.rank - b.rank);
  const best = sorted.filter((f) => f.rank < 2);
  return (best.length ? best : sorted).slice(0, max).map((f) => f.url);
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

export const MAX_QUOTE_WORDS = 15;

/**
 * Returns the quote (cut to 15 words) if it appears word-for-word in the
 * source text, else null. This is what stops the AI putting words in a
 * founder's mouth.
 */
export function verifyQuote(quote: string, sourceText: string): string | null {
  const words = quote.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length < 3) return null;
  const cut = words.slice(0, MAX_QUOTE_WORDS).join(" ");
  return norm(sourceText).includes(norm(cut)) ? cut : null;
}

/**
 * Rebuild a verified quote from the page itself so it doesn't depend on where
 * the AI chose to cut it: take the page line that contains it and return up to
 * 15 words starting where the AI's quote starts. `pos` is the line's position
 * on the page (for a stable order). Returns null if the line can't be found.
 */
export function canonicalQuote(quote: string, pageText: string): { quote: string; pos: number } | null {
  const target = norm(quote);
  const lines = pageText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const words = lines[i]!.trim().split(/\s+/).filter(Boolean);
    const lineNorm = norm(words.join(" "));
    const at = lineNorm.indexOf(target);
    if (at < 0) continue;
    // word offset of the match inside the line
    const match = lineNorm.slice(0, at).split(" ").filter(Boolean).length;
    // widen to the whole sentence that contains the match (start → full stop), max 15 words,
    // so the result doesn't depend on where the AI started or stopped its quote
    const endsSentence = (w: string) => /[.!?]["')\]]?$/.test(w);
    let start = match;
    while (start > 0 && !endsSentence(words[start - 1]!)) start--;
    let end = start;
    while (end < words.length && end - start < MAX_QUOTE_WORDS) {
      end++;
      if (endsSentence(words[end - 1]!)) break;
    }
    // list bullets come from htmlToText, not from the page's words
    const quoteWords = words.slice(start, end);
    while (quoteWords.length && /^[•·▪◦\-–—*]+$/.test(quoteWords[0]!)) quoteWords.shift();
    return { quote: quoteWords.join(" "), pos: i * 1000 + start };
  }
  return null;
}

/** Accept 2026 · 2026-Q3 · 2026-H2 · 2026-09 · 2026-09-30; anything else → null. */
export function normalizeDue(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  let m: RegExpExecArray | null;
  if ((m = /^(20\d{2})$/.exec(s))) return m[1]!;
  if ((m = /^(20\d{2})-?Q([1-4])$/.exec(s)) || (m = /^Q([1-4])-?(20\d{2})$/.exec(s))) {
    return s.startsWith("Q") ? `${m[2]}-Q${m[1]}` : `${m[1]}-Q${m[2]}`;
  }
  if ((m = /^(20\d{2})-?H([12])$/.exec(s)) || (m = /^H([12])-?(20\d{2})$/.exec(s))) {
    const [y, h] = s.startsWith("H") ? [m[2], m[1]] : [m[1], m[2]];
    return `${y}-Q${h === "1" ? 2 : 4}`;
  }
  if ((m = /^(20\d{2})-(0[1-9]|1[0-2])$/.exec(s))) return `${m[1]}-${m[2]}`;
  if ((m = /^(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(s))) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/** The last moment a normalised due date covers (end of year / quarter / month / day), UTC. */
export function dueEnd(due: string): Date {
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})$/.exec(due))) return new Date(Date.UTC(+m[1]! + 1, 0, 1) - 1);
  if ((m = /^(\d{4})-Q([1-4])$/.exec(due))) return new Date(Date.UTC(+m[1]!, +m[2]! * 3, 1) - 1);
  if ((m = /^(\d{4})-(\d{2})$/.exec(due))) return new Date(Date.UTC(+m[1]!, +m[2]!, 1) - 1);
  return new Date(Date.parse(`${due}T23:59:59.999Z`));
}

/**
 * The AI may claim an item is done; we only believe it when the verified quote
 * itself says so ("live now", "launched", "completed", a check mark).
 * Otherwise the status comes from the date alone.
 */
export function quoteShowsDone(quote: string): boolean {
  return /\b(live now|is live|went live|launched|completed|complete|done|delivered|released|shipped|achieved)\b|✅|✔/i.test(quote);
}

export function promiseStatus(due: string | null, now = new Date(), delivered = false): PromiseStatus {
  if (delivered) return "delivered";
  if (!due) return "no-date";
  const end = dueEnd(due).getTime();
  if (end < now.getTime()) return "overdue";
  if (end - now.getTime() <= 60 * 86_400_000) return "due-soon";
  return "upcoming";
}
