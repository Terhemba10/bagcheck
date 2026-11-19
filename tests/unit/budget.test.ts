import { describe, expect, it } from "vitest";
import { decideMode, estimateDailyCost, isRunDue, type KeyInfo } from "@/lib/cmc/budget";

const now = new Date("2026-12-12T12:00:00Z");
const resetIn = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();

function info(monthLeft: number, dayLeft: number | null, resetDays = 15, monthly = 15_000): KeyInfo {
  return {
    plan: { credit_limit_monthly: monthly, credit_limit_monthly_reset_timestamp: resetIn(resetDays), rate_limit_minute: 50 },
    usage: {
      current_month: { credits_used: monthly - monthLeft, credits_left: monthLeft },
      current_day: dayLeft === null ? undefined : { credits_used: 0, credits_left: dayLeft },
    },
  };
}

describe("credit governor", () => {
  it("default Startup watchlist costs far less than the old 290k/month estimate", () => {
    const perMonth = estimateDailyCost("full", 30) * 30;
    expect(perMonth).toBeLessThan(10_000);
  });

  it("runs full monitoring on Startup with plenty of credits", () => {
    const d = decideMode(info(400_000, null, 20, 450_000), 30, now);
    expect(d.mode).toBe("full");
  });

  it("drops to lean on a mid-size plan when full doesn't fit", () => {
    // 150k plan, 4,000 left over 15 days -> ~93 credits/day; full (~168/day for 30 coins) doesn't fit
    const d = decideMode(info(4_000, 500, 15, 150_000), 30, now);
    expect(d.mode).toBe("lean");
    // never plans to spend more than 35% of what's left, spread over the days to reset
    expect(estimateDailyCost(d.mode, 30)).toBeLessThanOrEqual((0.35 * 4_000) / 15);
  });

  it("caps a Basic key (15k/month) at the Basic schedule even with credits to spare", () => {
    const d = decideMode(info(14_957, null, 11), 30, now);
    expect(d.mode).toBe("basic");
    // a whole month of Basic monitoring stays tiny
    expect(estimateDailyCost("basic", 30) * 30).toBeLessThan(300);
  });

  it("keeps a daily reserve for live reports", () => {
    const d = decideMode(info(9_000, 160, 15, 150_000), 10, now);
    // only 10 credits/day available after the 150 reserve
    expect(d.perDayAllowance).toBeLessThanOrEqual(10);
    expect(estimateDailyCost(d.mode, 10)).toBeLessThanOrEqual(10);
  });

  it("pauses below the monthly floor", () => {
    expect(decideMode(info(250, 250), 10, now).mode).toBe("paused");
  });

  it("pauses when even the basic schedule would overspend today", () => {
    expect(decideMode(info(9_000, 150), 10, now).mode).toBe("paused");
  });

  it("is careful when key info is unavailable", () => {
    expect(decideMode(null, 10, now).mode).toBe("basic");
  });
});

describe("isRunDue", () => {
  it("runs immediately when never run", () => {
    expect(isRunDue("lean", null, now)).toBe(true);
  });
  it("waits for the interval, with 10 minutes slack", () => {
    const fiveH50 = new Date(now.getTime() - (5 * 60 + 50) * 60_000).toISOString();
    const fiveH = new Date(now.getTime() - 5 * 3_600_000).toISOString();
    expect(isRunDue("lean", fiveH50, now)).toBe(true);
    expect(isRunDue("lean", fiveH, now)).toBe(false);
  });
  it("never runs when paused", () => {
    expect(isRunDue("paused", null, now)).toBe(false);
  });
});
