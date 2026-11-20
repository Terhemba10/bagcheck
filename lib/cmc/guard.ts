/**
 * Credit guard: the hard backstop that stops the public site spending more
 * CMC credits than planned, whatever visitors do. Pure decision function,
 * unit-tested; the client feeds it live numbers from /v1/key/info.
 */
import type { KeyInfo } from "./budget";

export interface GuardConfig {
  /** Max credits per UTC day for all live calls together; null = plan-aware default (see dailyCapFor). */
  dailyCap: number | null;
  /** Credits always kept back each month (demo, judging, cron). */
  monthlyReserve: number;
}

export function guardConfig(env: Record<string, string | undefined> = process.env): GuardConfig {
  const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    dailyCap: env.CMC_DAILY_CREDIT_CAP && Number.isFinite(Number(env.CMC_DAILY_CREDIT_CAP)) ? Number(env.CMC_DAILY_CREDIT_CAP) : null,
    monthlyReserve: num(env.CMC_MONTHLY_RESERVE, 1000),
  };
}

/**
 * Daily cap: CMC_DAILY_CREDIT_CAP if set; otherwise 400 on the free Basic plan (15k/month)
 * and 2,000 on a paid plan (under 0.5% of a 450k month). Falls back to Basic automatically.
 */
export const BASIC_DAILY_CAP = 400;
export const PAID_DAILY_CAP = 2000;
export function dailyCapFor(info: KeyInfo | null, cfg: GuardConfig): number {
  if (cfg.dailyCap !== null) return cfg.dailyCap;
  return (info?.plan?.credit_limit_monthly ?? 0) > 20_000 ? PAID_DAILY_CAP : BASIC_DAILY_CAP;
}

export type GuardVerdict = { allow: true } | { allow: false; reason: string };

export function checkSpend(info: KeyInfo | null, cfg: GuardConfig, localUsedToday = 0): GuardVerdict {
  // Without key info we fall back to our own tally, which is per-instance but better than nothing.
  const usage = info?.usage;
  const usedToday = Math.max(usage?.current_day?.credits_used ?? 0, localUsedToday);
  const cap = dailyCapFor(info, cfg);
  if (usedToday >= cap) {
    return { allow: false, reason: `Daily credit cap reached (${usedToday}/${cap})` };
  }
  const dayLeft = usage?.current_day?.credits_left;
  if (typeof dayLeft === "number" && dayLeft <= 0) {
    return { allow: false, reason: "No CMC credits left today" };
  }
  const monthLeft = usage?.current_month?.credits_left;
  if (typeof monthLeft === "number" && monthLeft <= cfg.monthlyReserve) {
    return { allow: false, reason: `Monthly reserve reached (${monthLeft} left, ${cfg.monthlyReserve} kept back)` };
  }
  return { allow: true };
}
