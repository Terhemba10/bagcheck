/**
 * "Lessons for next time": which warning signs appeared and when, from
 * Covex's own snapshots and alerts. Pure, unit-tested. Dates only ever come
 * from snapshots/alerts that exist: never guessed. When there's no history,
 * it says so.
 */
import type { Report } from "@/lib/core/report";
import type { Alert, Snapshot } from "@/lib/monitor/store";
import { money, pct } from "@/lib/core/format";

export interface Lessons {
  /** Enough history to say how things moved (≥ 2 checks)? */
  hasHistory: boolean;
  /** Plain sentence about the history (or the lack of it). */
  summary: string;
  /** What changed between the first and last check (only measured values). */
  changes: string[];
  /** Alerts Covex raised, oldest first, with their real dates. */
  timeline: { at: string; title: string; severity: Alert["severity"] }[];
  /** Warning signs in today's report (no dates: they're as of now). */
  signsToday: { title: string; meaning: string }[];
  /** General, evergreen lessons tied to the signs that are actually present. */
  takeaways: string[];
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const TAKEAWAY: Record<string, string> = {
  dilution: "Check how much of the supply is still locked before buying: future unlocks add selling pressure.",
  volume: "Compare 24h volume with market cap: very high or very low ratios are both warning signs.",
  concentration: "Prefer coins that trade on several independent exchanges, so one delisting can't trap you.",
  liquidity: "Look at liquidity before buying: it's what lets you sell later without moving the price.",
  momentum: "New coins have little track record; a coin falling far behind the market usually has its own reasons.",
  links: "A project that stops maintaining its website and docs often stops building too.",
  contract: "Read the contract scan: taxes, blacklists and mint switches can stop or shrink a sale.",
};

export function lessonsFrom(input: { snapshots: Snapshot[]; alerts: Alert[]; report: Report }): Lessons {
  const snaps = [...input.snapshots].sort((a, b) => a.at.localeCompare(b.at)); // oldest first
  const timeline = [...input.alerts]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((a) => ({ at: a.at, title: a.title, severity: a.severity }));
  const signs = input.report.signals.filter((s) => s.scored && (s.level === "concern" || s.level === "danger"));
  const signsToday = signs.map((s) => ({ title: s.title, meaning: s.meaning }));
  const takeaways = [...new Set(signs.map((s) => TAKEAWAY[s.id]).filter((t): t is string => !!t))];
  if (!takeaways.length) takeaways.push("Before buying, check supply, liquidity and the contract scan, and read what the team actually promised.");

  if (snaps.length < 2) {
    return {
      hasHistory: false,
      summary:
        snaps.length === 1
          ? `Covex has only checked ${input.report.coin.name} once (on ${day(snaps[0]!.at)}), so there isn't enough history to show what changed over time yet.`
          : `Covex hasn't been watching ${input.report.coin.name}, so there's no history to show when warning signs appeared. Today's report is below; watching the coin starts a history.`,
      changes: [],
      timeline,
      signsToday,
      takeaways,
    };
  }

  const first = snaps[0]!;
  const last = snaps.at(-1)!;
  const changes: string[] = [];
  const delta = (a: number | null | undefined, b: number | null | undefined) => (typeof a === "number" && typeof b === "number" && a !== 0 ? ((b - a) / a) * 100 : null);
  const p = delta(first.price, last.price);
  if (p !== null) changes.push(`Price: ${pct(p)} (${money(first.price)} → ${money(last.price)})`);
  const v = delta(first.volume24h, last.volume24h);
  if (v !== null) changes.push(`24h volume: ${pct(v)} (${money(first.volume24h)} → ${money(last.volume24h)})`);
  const deep = snaps.filter((s) => s.deep && s.liqMethod === "major" && typeof s.dexLiquidityUsd === "number");
  if (deep.length >= 2) {
    const l = delta(deep[0]!.dexLiquidityUsd, deep.at(-1)!.dexLiquidityUsd);
    if (l !== null) changes.push(`DEX liquidity: ${pct(l)} (${money(deep[0]!.dexLiquidityUsd)} → ${money(deep.at(-1)!.dexLiquidityUsd)})`);
  }
  const mk = delta(first.numPairs, last.numPairs);
  if (mk !== null && first.numPairs !== last.numPairs) changes.push(`Markets tracked: ${first.numPairs} → ${last.numPairs}`);
  const supply = delta(first.circulating, last.circulating);
  if (supply !== null && Math.abs(supply) >= 0.5) changes.push(`Circulating supply: ${pct(supply)}`);

  return {
    hasHistory: true,
    summary: `Covex checked ${input.report.coin.name} ${snaps.length} times between ${day(first.at)} and ${day(last.at)}.${timeline.length ? ` It raised ${timeline.length} alert${timeline.length === 1 ? "" : "s"} in that time.` : " No alerts were raised in that time."}`,
    changes,
    timeline,
    signsToday,
    takeaways,
  };
}
