/**
 * Credit governor. Pure functions, unit-tested.
 *
 * Reads the numbers from /v1/key/info (free to call) and decides how much
 * background monitoring we can afford, so the key never runs dry while
 * judges are using the app on the Basic plan (15k credits/month).
 */

export interface KeyInfo {
  plan: {
    credit_limit_monthly?: number | null;
    credit_limit_monthly_reset_timestamp?: string | null;
    rate_limit_minute?: number | null;
  };
  usage: {
    current_minute?: { requests_made?: number; requests_left?: number | null };
    current_day?: { credits_used?: number; credits_left?: number | null };
    current_month?: { credits_used?: number; credits_left?: number | null };
  };
}

export type MonitorMode = "full" | "lean" | "basic" | "paused";

export interface ModeSettings {
  /** Minimum hours between watchlist runs. */
  intervalHours: number;
  /** Max coins checked per run. */
  maxCoins: number;
  /** Deep checks (market pairs + DEX liquidity) every Nth run; flagged coins every run. */
  deepEvery: number;
  /** Max deep-checked coins per run, regardless of deepEvery. */
  maxDeepPerRun: number;
}

export const MODE_SETTINGS: Record<MonitorMode, ModeSettings> = {
  full: { intervalHours: 3, maxCoins: 30, deepEvery: 3, maxDeepPerRun: 30 },
  lean: { intervalHours: 6, maxCoins: 15, deepEvery: 4, maxDeepPerRun: 5 },
  basic: { intervalHours: 12, maxCoins: 10, deepEvery: 1, maxDeepPerRun: 1 },
  paused: { intervalHours: Infinity, maxCoins: 0, deepEvery: Infinity, maxDeepPerRun: 0 },
};

export const GOVERNOR = {
  /** Share of remaining monthly credits background monitoring may use. */
  monitorShare: 0.35,
  /** Credits per day always kept back for live user reports. */
  dailyReserve: 150,
  /** Below this many monthly credits left, monitoring stops. */
  pauseFloor: 300,
};

/** Rough credits one run costs in a mode, for N watched coins. */
export function estimateRunCost(mode: MonitorMode, coins: number): number {
  const s = MODE_SETTINGS[mode];
  const n = Math.min(coins, s.maxCoins);
  if (n === 0) return 0;
  const quotes = Math.ceil(n / 250); // batched
  const deepCoins = Math.min(n, s.maxDeepPerRun) / s.deepEvery;
  return quotes + deepCoins * 2; // pairs + DEX liquidity per deep coin
}

export function estimateDailyCost(mode: MonitorMode, coins: number): number {
  const s = MODE_SETTINGS[mode];
  if (!Number.isFinite(s.intervalHours)) return 0;
  return estimateRunCost(mode, coins) * (24 / s.intervalHours);
}

export interface GovernorDecision {
  mode: MonitorMode;
  settings: ModeSettings;
  perDayAllowance: number;
  monthLeft: number | null;
  dayLeft: number | null;
  daysUntilReset: number;
  reason: string;
}

export function decideMode(info: KeyInfo | null, watchedCoins: number, now = new Date()): GovernorDecision {
  if (!info) {
    // No key info: assume the smallest plan and be careful.
    return finish("basic", 0, null, null, 30, "Key info unavailable, so we're assuming the Basic plan");
  }

  const monthLeft = numOr(info.usage.current_month?.credits_left, null);
  const dayLeft = numOr(info.usage.current_day?.credits_left, null);
  const resetTs = info.plan.credit_limit_monthly_reset_timestamp;
  const resetAt = resetTs ? Date.parse(resetTs) : NaN;
  const daysUntilReset = Number.isFinite(resetAt)
    ? Math.max(1, (resetAt - now.getTime()) / 86_400_000)
    : daysLeftInMonth(now);

  if (monthLeft !== null && monthLeft < GOVERNOR.pauseFloor) {
    return finish("paused", 0, monthLeft, dayLeft, daysUntilReset, `Only ${monthLeft} credits left this month`);
  }

  let allowance =
    monthLeft === null ? Infinity : (GOVERNOR.monitorShare * monthLeft) / daysUntilReset;
  if (dayLeft !== null) allowance = Math.min(allowance, Math.max(0, dayLeft - GOVERNOR.dailyReserve));
  if (!Number.isFinite(allowance)) allowance = 1000;

  const order: MonitorMode[] = ["full", "lean", "basic"];
  for (const mode of order) {
    if (estimateDailyCost(mode, watchedCoins) <= allowance) {
      return finish(mode, allowance, monthLeft, dayLeft, daysUntilReset, `Allowance ${Math.floor(allowance)} credits/day`);
    }
  }
  return finish("paused", allowance, monthLeft, dayLeft, daysUntilReset, "Even the Basic schedule would overspend today");
}

/** Is a run due, given the mode and the last run time? */
export function isRunDue(mode: MonitorMode, lastRunAt: string | null, now = new Date()): boolean {
  const s = MODE_SETTINGS[mode];
  if (!Number.isFinite(s.intervalHours)) return false;
  if (!lastRunAt) return true;
  const elapsedH = (now.getTime() - Date.parse(lastRunAt)) / 3_600_000;
  // 10 min slack so a slightly early hourly trigger still counts.
  return elapsedH >= s.intervalHours - 1 / 6;
}

function finish(
  mode: MonitorMode,
  perDayAllowance: number,
  monthLeft: number | null,
  dayLeft: number | null,
  daysUntilReset: number,
  reason: string,
): GovernorDecision {
  return { mode, settings: MODE_SETTINGS[mode], perDayAllowance, monthLeft, dayLeft, daysUntilReset, reason };
}

function numOr<T>(v: unknown, fallback: T): number | T {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function daysLeftInMonth(now: Date) {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return Math.max(1, (end - now.getTime()) / 86_400_000);
}
