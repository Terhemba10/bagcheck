import { beforeEach, describe, expect, it } from "vitest";
import { checkSpend, dailyCapFor, guardConfig } from "@/lib/cmc/guard";
import { checkLimits, hashIp } from "@/lib/ratelimit";
import { __setKV, memoryKV } from "@/lib/store/kv";

const info = (usedToday: number, monthLeft: number, dayLeft?: number) => ({
  plan: {},
  usage: { current_day: { credits_used: usedToday, credits_left: dayLeft }, current_month: { credits_left: monthLeft } },
});
const cfg = { dailyCap: 400, monthlyReserve: 1000 };

describe("checkSpend", () => {
  it("allows normal spending", () => {
    expect(checkSpend(info(20, 14_000), cfg).allow).toBe(true);
  });
  it("stops at the daily cap", () => {
    expect(checkSpend(info(400, 14_000), cfg).allow).toBe(false);
  });
  it("uses the local tally when it's higher than CMC's", () => {
    expect(checkSpend(info(10, 14_000), cfg, 401).allow).toBe(false);
  });
  it("keeps the monthly reserve", () => {
    expect(checkSpend(info(0, 1000), cfg).allow).toBe(false);
  });
  it("stops when CMC says no credits left today", () => {
    expect(checkSpend(info(0, 9000, 0), cfg).allow).toBe(false);
  });
  it("reads caps from env with safe defaults", () => {
    expect(guardConfig({})).toEqual({ dailyCap: null, monthlyReserve: 1000 });
    expect(guardConfig({ CMC_DAILY_CREDIT_CAP: "50", CMC_MONTHLY_RESERVE: "x" })).toEqual({ dailyCap: 50, monthlyReserve: 1000 });
  });
});

describe("per-IP rate limits", () => {
  beforeEach(() => __setKV(memoryKV()));
  const req = (ip: string) => new Request("https://x.test/api/search", { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });

  it("allows up to the limit, then blocks with a retry time", async () => {
    const limits = [{ name: "t", max: 3, windowSec: 60 }];
    for (let i = 0; i < 3; i++) expect((await checkLimits(req("1.2.3.4"), limits)).ok).toBe(true);
    const r = await checkLimits(req("1.2.3.4"), limits);
    expect(r.ok).toBe(false);
    expect(r.retryAfter).toBeGreaterThan(0);
  });
  it("counts each IP separately", async () => {
    const limits = [{ name: "t2", max: 1, windowSec: 60 }];
    expect((await checkLimits(req("1.1.1.1"), limits)).ok).toBe(true);
    expect((await checkLimits(req("2.2.2.2"), limits)).ok).toBe(true);
  });
  it("never stores raw IPs", () => {
    expect(hashIp("1.2.3.4")).not.toContain("1.2.3.4");
    expect(hashIp("1.2.3.4")).toHaveLength(20);
  });
});

describe("plan-aware daily cap", () => {
  const plan = (limit: number) => ({ plan: { credit_limit_monthly: limit }, usage: { current_day: { credits_used: 500 }, current_month: { credits_left: limit - 600 } } });
  it("is 400 on the free Basic plan and 2,000 on a paid plan", () => {
    expect(dailyCapFor(plan(15_000) as never, { dailyCap: null, monthlyReserve: 1000 })).toBe(400);
    expect(dailyCapFor(plan(450_000) as never, { dailyCap: null, monthlyReserve: 1000 })).toBe(2000);
  });
  it("an explicit CMC_DAILY_CREDIT_CAP always wins", () => {
    expect(dailyCapFor(plan(450_000) as never, { dailyCap: 300, monthlyReserve: 1000 })).toBe(300);
  });
  it("500 used today blocks on Basic but not on a paid plan", () => {
    const cfg = { dailyCap: null, monthlyReserve: 1000 };
    expect(checkSpend(plan(15_000) as never, cfg).allow).toBe(false);
    expect(checkSpend(plan(450_000) as never, cfg).allow).toBe(true);
  });
});
