/**
 * "Ask Covex": the facts the AI may use, and the checks its answer must pass.
 * Pure, unit-tested.
 */
import type { Report } from "@/lib/core/report";
import type { PromiseCheck } from "@/lib/promises/check";
import { money, pct } from "@/lib/core/format";

/** A compact, plain-text fact sheet built from the computed report. */
export function buildFacts(r: Report, promises: PromiseCheck | null): string {
  const c = r.coin;
  const lines = [
    `Coin: ${c.name} (${c.symbol})${c.rank ? `, rank #${c.rank}` : ""}${c.platform ? `, token on ${c.platform}` : ""}.`,
    `Price ${money(c.price)}; 24h ${pct(c.change24h)}; 7d ${pct(c.change7d)}; market cap ${money(c.marketCap)}.`,
    `Overall: ${r.score.concern ? `${r.score.concern} concern` : "not enough data to score"}, scored on ${r.score.scored} of ${r.score.total} signals.`,
    `Verdict: ${r.verdict}`,
    "Signals:",
    ...r.signals.map((s) => `- ${s.title} [${s.level === "unknown" ? "no data" : s.level}]${s.value ? ` ${s.value} ${s.valueLabel ?? ""}` : ""}: ${s.meaning} Why it matters: ${s.why}`),
  ];
  if (promises) {
    if (promises.promises.length) {
      lines.push("Promises found on the project's own pages (status computed by Covex; 'overdue' only means the date passed):");
      for (const p of promises.promises) lines.push(`- ${p.dueDate ?? "no date"} [${p.status}]: ${p.promise} (quote: "${p.quote}")`);
    } else lines.push(`Promise check: ${promises.emptyReason ?? "no commitments found"}`);
  } else lines.push("Promise check: not run yet for this coin.");
  return lines.join("\n");
}

const ADVICE_RE =
  /\b(you should|you shouldn't|i(?: would|'d|’d)? (recommend|suggest|advise)|good (time|idea) to|consider (buying|selling)|(buy|sell|hold|ape) (now|it|more|this)|time to (buy|sell)|it[’']?s a (scam|rug))\b/i;

/** Numbers like 28%, $14.5M, 1.19, 2026, 6 of 7. */
const NUMBER_RE = /\$?\d[\d,]*(?:\.\d+)?\s*(?:%|[KMBT]\b)?/g;

const normNum = (s: string) => s.replace(/[\s,]/g, "").toUpperCase();

export type AnswerCheck = { ok: true } | { ok: false; reason: "advice" | "unknown_number" | "empty"; detail?: string };

/** The answer may not give advice and may not contain any number that isn't in the facts. */
export function checkAnswer(answer: string, facts: string): AnswerCheck {
  const a = answer.trim();
  if (a.length < 2) return { ok: false, reason: "empty" };
  if (ADVICE_RE.test(a)) return { ok: false, reason: "advice" };
  const factNums = new Set((facts.match(NUMBER_RE) ?? []).map(normNum));
  const factsNorm = normNum(facts);
  for (const m of a.match(NUMBER_RE) ?? []) {
    const n = normNum(m);
    // small counting words ("2 warning signs", "one of 7") are fine if they appear anywhere in the facts
    if (factNums.has(n) || factsNorm.includes(n)) continue;
    return { ok: false, reason: "unknown_number", detail: m.trim() };
  }
  return { ok: true };
}

const TOPICS: { re: RegExp; id: string }[] = [
  { re: /dilut|unlock|supply|release|circulat|fdv|fully diluted/i, id: "dilution" },
  { re: /volume|wash|fake trad|trading/i, id: "volume" },
  { re: /exchange|concentrat|delist/i, id: "concentration" },
  { re: /liquid|sell|exit|get out|pool|slippage|price impact/i, id: "liquidity" },
  { re: /age|old|new|momentum|bitcoin|market|perform/i, id: "momentum" },
  { re: /website|link|social|twitter|docs|offline/i, id: "links" },
  { re: /contract|honeypot|tax|blacklist|mint|scan|security/i, id: "contract" },
];

/** Deterministic answer from the report itself (used when the AI is unavailable or fails a check). */
export function fallbackAnswer(question: string, r: Report, promises: PromiseCheck | null): string {
  if (/promise|roadmap|deliver|deadline|plan/i.test(question)) {
    if (!promises) return "The promise check hasn't run for this coin yet. Scroll to the Promise check section and it will load.";
    if (!promises.promises.length) return `Promise check: ${promises.emptyReason ?? "no specific commitments found."}`;
    const passed = promises.promises.filter((p) => p.status === "overdue").length;
    return `We found ${promises.promises.length} commitment${promises.promises.length === 1 ? "" : "s"} on the project's own pages${passed ? `, and ${passed} of them have dates that have passed (check the source to see if they were delivered)` : ""}.`;
  }
  const topic = TOPICS.find((t) => t.re.test(question));
  const s = topic ? r.signals.find((x) => x.id === topic.id) : null;
  if (s) return `${s.title}: ${s.meaning} ${s.why}`;
  return r.verdict;
}
