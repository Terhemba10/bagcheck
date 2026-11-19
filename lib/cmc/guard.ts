/**
 * Credit guard: the hard backstop that stops the public site spending more
 * CMC credits than planned, whatever visitors do. Pure decision function,
 * unit-tested; the client feeds it live numbers from /v1/key/info.
 */
import type { KeyInfo } from "./budget";

export interface GuardConfig {
  /** Max credits per UTC day for all live calls together. */
  dailyCap: number;
  /** Credits always kept back each month (demo, judging, cron). */
  monthlyReserve: number;
}

export function guardConfig(env: Record<string, string | undefined> = process.env): GuardConfig {
  const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    dailyCap: num(env.CMC_DAILY_CREDIT_CAP, 400),
    monthlyReserve: num(env.CMC_MONTHLY_RESERVE, 1000),
  };
}

export type GuardVerdict = { allow: true } | { allow: false; reason: string };

export function checkSpend(info: KeyInfo | null, cfg: GuardConfig, localUsedToday = 0): GuardVerdict {
  // Without key info we fall back to our own tally, which is per-instance but better than nothing.
  const usage = info?.usage;
  const usedToday = Math.max(usage?.current_day?.credits_used ?? 0, localUsedToday);
  if (usedToday >= cfg.dailyCap) {
    return { allow: false, reason: `Daily credit cap reached (${usedToday}/${cfg.dailyCap})` };
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
