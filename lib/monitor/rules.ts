/**
 * Alert rules. Pure functions over snapshots (newest first), unit-tested.
 * Code decides; each alert explains what changed, what it means and what to
 * check next. Never "buy"/"sell", never "scam".
 */
import { createHash } from "node:crypto";
import type { CheckedPromise } from "@/lib/promises/pages";
import { dueEnd } from "@/lib/promises/extract";
import { money, pct } from "@/lib/core/format";
import type { Alert, AlertRule, Snapshot } from "./store";

export const ALERT_RULES = {
  volumeFallingSteps: 3, // consecutive drops
  volumeFallingTotal: 0.3, // and at least -30% over those steps
  pairsDropConcern: 0.2, // -20% vs the 7-day max
  pairsDropDanger: 0.5,
  liquidityDropConcern: 0.3, // -30% vs the previous deep check
  liquidityDropDanger: 0.6,
  liquidityFloor: 50_000,
  supplyJumpConcern: 0.05, // +5% circulating supply
  supplyJumpDanger: 0.2,
  underperformConcern: -25, // 7-day change minus Bitcoin's, in points
  underperformDanger: -50,
  promiseWindowDays: 45, // only alert for dates that passed recently (older ones are in the report)
};

export interface AlertCandidate extends Omit<Alert, "id" | "at" | "coinId" | "coinName" | "coinSymbol"> {
  /** Cooldown key + days: the same key won't fire again for this coin until it expires. */
  key: string;
  cooldownDays: number;
}

const R = ALERT_RULES;
const pctChange = (from: number, to: number) => (to - from) / from;
const fmtN = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${Math.round(n)}`);

export function volumeFalling(h: Snapshot[]): AlertCandidate | null {
  const v = h.slice(0, R.volumeFallingSteps + 1).map((s) => s.volume24h);
  if (v.length < R.volumeFallingSteps + 1 || v.some((x) => x === null || !(x > 0))) return null;
  const vals = v as number[];
  for (let i = 0; i < R.volumeFallingSteps; i++) if (!(vals[i]! < vals[i + 1]!)) return null;
  const oldest = vals[R.volumeFallingSteps]!;
  const drop = pctChange(oldest, vals[0]!);
  if (drop > -R.volumeFallingTotal) return null;
  return {
    rule: "volume_falling",
    severity: drop <= -0.6 ? "danger" : "concern",
    title: `Trading volume fell ${R.volumeFallingSteps} checks in a row`,
    before: money(oldest),
    after: money(vals[0]),
    meaning: `Daily trading dropped ${pct(drop * 100, 0)} across the last ${R.volumeFallingSteps} checks. Falling volume can mean interest is fading, and it makes selling harder.`,
    next: ["Check whether there was news, a delisting or a team announcement.", "Look at the liquidity in the report: is it falling too?"],
    metric: "volume24h",
    key: "volume_falling",
    cooldownDays: 3,
  };
}

export function pairsDropping(h: Snapshot[], now: Date): AlertCandidate | null {
  const cur = h[0]?.numPairs;
  if (!cur) return null;
  const week = h.filter((s) => s.numPairs && now.getTime() - Date.parse(s.at) <= 7 * 86_400_000).map((s) => s.numPairs as number);
  if (week.length < 2) return null;
  const max = Math.max(...week);
  const drop = pctChange(max, cur);
  if (drop > -R.pairsDropConcern) return null;
  return {
    rule: "pairs_dropping",
    severity: drop <= -R.pairsDropDanger ? "danger" : "concern",
    title: "Fewer places to trade it",
    before: `${max} markets`,
    after: `${cur} markets`,
    meaning: `CoinMarketCap now tracks ${cur} markets for this coin, down from ${max} this week (${pct(drop * 100, 0)}). Exchanges dropping a coin can be an early sign of delistings.`,
    next: ["Check the official announcements of the exchanges you use.", "Open the rescue plan to see where it can still be sold."],
    metric: "numPairs",
    key: "pairs_dropping",
    cooldownDays: 3,
  };
}

export function liquidityDraining(h: Snapshot[]): AlertCandidate | null {
  const deep = h.filter((s) => s.deep && typeof s.dexLiquidityUsd === "number");
  if (deep.length < 2) return null;
  const cur = deep[0]!.dexLiquidityUsd as number;
  const prev = deep[1]!.dexLiquidityUsd as number;
  if (!(prev > 0)) return null;
  const drop = pctChange(prev, cur);
  const crossedFloor = prev >= R.liquidityFloor && cur < R.liquidityFloor;
  if (drop > -R.liquidityDropConcern && !crossedFloor) return null;
  return {
    rule: "liquidity_draining",
    severity: drop <= -R.liquidityDropDanger || crossedFloor ? "danger" : "concern",
    title: "DEX liquidity is draining",
    before: money(prev),
    after: money(cur),
    meaning: `The money in this token's DEX pools fell ${pct(drop * 100, 0)} since the last check. When liquidity leaves, selling moves the price more, and a large sudden drop can mean liquidity was pulled.`,
    next: ["Open the rescue plan: \"Can I still sell?\" shows where liquidity is now.", "Check the project's official channels for an explanation."],
    metric: "dexLiquidityUsd",
    key: "liquidity_draining",
    cooldownDays: 2,
  };
}

export function supplyJump(h: Snapshot[]): AlertCandidate | null {
  const withSupply = h.filter((s) => typeof s.circulating === "number" && (s.circulating as number) > 0);
  if (withSupply.length < 2) return null;
  const cur = withSupply[0]!.circulating as number;
  const prev = withSupply[1]!.circulating as number;
  const jump = pctChange(prev, cur);
  if (jump < R.supplyJumpConcern) return null;
  return {
    rule: "supply_jump",
    severity: jump >= R.supplyJumpDanger ? "danger" : "concern",
    title: "Circulating supply jumped",
    before: fmtN(prev),
    after: fmtN(cur),
    meaning: `${pct(jump * 100, 1)} more tokens are in circulation than at the last check. That usually means an unlock or new minting, and new tokens can add selling pressure.`,
    next: ["Check the project's token unlock schedule.", "See the Dilution signal in the report for how much is still to come."],
    metric: "circulating",
    key: `supply_jump:${Math.round(cur)}`,
    cooldownDays: 7,
  };
}

export function websiteDown(h: Snapshot[]): AlertCandidate | null {
  const deep = h.filter((s) => s.deep && typeof s.websiteUp === "boolean");
  if (deep.length < 2 || deep[0]!.websiteUp !== false || deep[1]!.websiteUp !== false) return null;
  return {
    rule: "website_down",
    severity: "concern",
    title: "The official website isn't responding",
    before: "Online",
    after: "Not responding (2 checks)",
    meaning: "The project's official website has failed two checks in a row. Projects that stop maintaining their site often stop building too, but it can also be a temporary outage.",
    next: ["Try the website yourself and check the project's social accounts.", "Be careful with lookalike sites: only use links from CoinMarketCap or the project's verified accounts."],
    key: "website_down",
    cooldownDays: 3,
  };
}

export function underperforming(h: Snapshot[], coinId: number): AlertCandidate | null {
  const s = h[0];
  if (!s || coinId === 1 || s.change7d === null || s.btcChange7d === null) return null;
  const gap = s.change7d - s.btcChange7d;
  if (gap > R.underperformConcern) return null;
  return {
    rule: "underperforming",
    severity: gap <= R.underperformDanger ? "danger" : "concern",
    title: "Falling much harder than the market",
    before: `Bitcoin ${pct(s.btcChange7d, 1)} (7d)`,
    after: `This coin ${pct(s.change7d, 1)} (7d)`,
    meaning: `Over 7 days this coin did ${Math.round(-gap)} points worse than Bitcoin. A gap that big usually has a coin-specific cause rather than the whole market moving.`,
    next: ["Look for project news, unlocks or exchange announcements this week.", "Check the warning signs in the report."],
    metric: "change7d",
    key: "underperforming",
    cooldownDays: 7,
  };
}

export function quoteKey(quote: string): string {
  return createHash("sha256").update(quote.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex").slice(0, 16);
}

/** One alert per promise whose date passed recently (within the window), unless marked delivered. */
export function promisesOverdue(promises: CheckedPromise[] | null, now: Date, delivered: string[] = []): AlertCandidate[] {
  if (!promises) return [];
  const out: AlertCandidate[] = [];
  for (const p of promises) {
    if (p.status !== "overdue" || !p.dueDate) continue;
    const qk = quoteKey(p.quote);
    if (delivered.includes(qk)) continue;
    const passedDays = (now.getTime() - dueEnd(p.dueDate).getTime()) / 86_400_000;
    if (passedDays < 0 || passedDays > R.promiseWindowDays) continue;
    out.push({
      rule: "promise_overdue",
      severity: "concern",
      title: `Promise date passed: ${p.promise}`,
      before: `Due ${p.dueDate}`,
      after: "Date passed, no delivery confirmed",
      meaning: `The project said: "${p.quote}". That date has now passed. Bagcheck can't confirm whether it was delivered, so check the source.`,
      next: [`Read the source: ${p.sourceUrl}`, "If it was delivered, mark it as delivered in your watchlist and Bagcheck won't remind you again."],
      quote: p.quote,
      key: `promise:${qk}`,
      cooldownDays: 365,
    });
  }
  return out;
}

/** Run every rule. `history` is newest first and includes the snapshot just taken. */
export function evaluateRules(input: {
  coinId: number;
  history: Snapshot[];
  promises: CheckedPromise[] | null;
  now: Date;
}): AlertCandidate[] {
  const { coinId, history: h, promises, now } = input;
  return [
    volumeFalling(h),
    pairsDropping(h, now),
    liquidityDraining(h),
    supplyJump(h),
    websiteDown(h),
    underperforming(h, coinId),
    ...promisesOverdue(promises, now),
  ].filter((a): a is AlertCandidate => a !== null);
}

export const ALL_RULES: AlertRule[] = ["promise_overdue", "volume_falling", "pairs_dropping", "liquidity_draining", "supply_jump", "website_down", "underperforming"];
