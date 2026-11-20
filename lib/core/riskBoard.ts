/**
 * Risk board rules. Pure and unit-tested; the server builder is lib/core/riskBoardBuild.ts.
 *
 * Code decides: a "quick check" verdict uses the three signals that listing data supports
 * (dilution, volume sanity, age and momentum) and the same scoring as full reports. When a
 * full report was run recently, its verdict (7 signals) replaces the quick one.
 * Wording follows the report ("Low / Medium / High concern"); never "safe" or "verified".
 */
import type { CoinQuote } from "@/lib/cmc/types";
import { scoreReport } from "./score";
import { dilutionSignal, momentumSignal, volumeSignal, type Avail, type Signal } from "./signals";
import type { Concern, Level } from "@/components/ui/status";

export interface BoardVerdict {
  concern: Concern | null;
  scored: number;
  total: number;
  /** "quick" = 3 signals from market data; "full" = a recent full report. */
  kind: "quick" | "full";
  at?: string;
}

export interface BoardSign {
  title: string;
  text: string;
  level: Level;
}

export interface BoardRow {
  id: number;
  name: string;
  symbol: string;
  rank: number | null;
  price: number | null;
  change24h: number | null;
  change7d: number | null;
  marketCap: number | null;
  meme: boolean;
  /** Daily closes, oldest first (7–8 points), or null when not loaded yet. */
  spark: number[] | null;
  verdict: BoardVerdict;
  topSign: BoardSign | null;
  /** From a cached promise check; null = not checked yet. */
  promises: { delivered: number; datePassed: number; upcoming: number } | null;
}

export interface RiskBoard {
  rows: BoardRow[];
  generatedAt: string;
  sparkNote: string | null;
}

/** Last full-report verdict, kept 7 days so the board can show it. */
export interface LastVerdict {
  concern: Concern | null;
  scored: number;
  total: number;
  drivers: { title: string; level: Level; text: string }[];
  at: string;
}

const ok = <T>(value: T): Avail<T> => ({ status: "ok", value, source: "live" });
const LEVEL_RANK: Record<string, number> = { danger: 4, concern: 3, watch: 2, ok: 0, unknown: -1, rescue: -1 };

/** Quick verdict from listing data alone (3 of 7 signals). */
export function quickSignals(c: CoinQuote, btc: CoinQuote | null, now = new Date()): Signal[] {
  const q = ok(c);
  const b: Avail<CoinQuote> = btc ? ok(btc) : { status: "error", reason: "no BTC quote" };
  return [dilutionSignal(q), volumeSignal(q), momentumSignal(q, b, { status: "none", reason: "listing" }, now)];
}

export function quickVerdict(c: CoinQuote, btc: CoinQuote | null, now = new Date()): { verdict: BoardVerdict; topSign: BoardSign | null } {
  const signals = quickSignals(c, btc, now);
  const s = scoreReport(signals);
  return { verdict: { concern: s.concern, scored: s.scored, total: 3, kind: "quick" }, topSign: topSign(signals) };
}

/** The most serious warning sign (watch or worse), or null when nothing stands out. */
export function topSign(signals: Pick<Signal, "title" | "level" | "value" | "valueLabel" | "meaning">[]): BoardSign | null {
  const worst = [...signals].filter((s) => (LEVEL_RANK[s.level] ?? -1) >= 2).sort((a, b) => (LEVEL_RANK[b.level] ?? 0) - (LEVEL_RANK[a.level] ?? 0))[0];
  if (!worst) return null;
  const text = worst.value ? `${worst.value}${worst.valueLabel ? ` ${worst.valueLabel}` : ""}` : worst.meaning;
  return { title: worst.title, text: text.length > 60 ? `${text.slice(0, 57)}…` : text, level: worst.level };
}

export const isMeme = (tags: unknown): boolean => Array.isArray(tags) && tags.some((t) => typeof t === "string" && /^memes?$/i.test(t));

// ── sorting + filtering (client and server) ──────────────────────────────────
export type BoardFilter = "all" | "memes" | "top100";
export type BoardSort = "concern" | "rank" | "price" | "change24h" | "name";

const CONCERN_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

export function concernRank(v: BoardVerdict): number {
  return v.concern ? CONCERN_RANK[v.concern]! : 0;
}

export function filterRows(rows: BoardRow[], f: BoardFilter): BoardRow[] {
  if (f === "memes") return rows.filter((r) => r.meme);
  if (f === "top100") return rows.filter((r) => r.rank !== null && r.rank <= 100);
  return rows;
}

/** Default: highest concern first, then the more serious top sign, then market-cap rank. */
export function sortRows(rows: BoardRow[], by: BoardSort = "concern", dir: "asc" | "desc" = "desc"): BoardRow[] {
  const sign = dir === "desc" ? -1 : 1;
  const rank = (r: BoardRow) => r.rank ?? 1e9;
  const cmp: Record<BoardSort, (a: BoardRow, b: BoardRow) => number> = {
    concern: (a, b) =>
      sign * (concernRank(a.verdict) - concernRank(b.verdict)) ||
      sign * ((LEVEL_RANK[a.topSign?.level ?? ""] ?? -1) - (LEVEL_RANK[b.topSign?.level ?? ""] ?? -1)) ||
      rank(a) - rank(b),
    rank: (a, b) => sign * (rank(a) - rank(b)),
    price: (a, b) => sign * ((a.price ?? -1) - (b.price ?? -1)) || rank(a) - rank(b),
    change24h: (a, b) => sign * ((a.change24h ?? -1e9) - (b.change24h ?? -1e9)) || rank(a) - rank(b),
    name: (a, b) => sign * a.name.localeCompare(b.name),
  };
  return [...rows].sort(cmp[by]);
}

/** Merge a recent full report into a row (it outranks the quick check). */
export function withFullVerdict(row: BoardRow, last: LastVerdict | undefined): BoardRow {
  if (!last) return row;
  const d = [...last.drivers].sort((a, b) => (LEVEL_RANK[b.level] ?? 0) - (LEVEL_RANK[a.level] ?? 0))[0];
  return {
    ...row,
    verdict: { concern: last.concern, scored: last.scored, total: last.total, kind: "full", at: last.at },
    topSign: d ? { title: d.title, text: d.text.length > 60 ? `${d.text.slice(0, 57)}…` : d.text, level: d.level } : row.topSign,
  };
}
