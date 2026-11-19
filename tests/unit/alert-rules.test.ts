import { describe, expect, it } from "vitest";
import {
  evaluateRules,
  liquidityDraining,
  pairsDropping,
  promisesOverdue,
  quoteKey,
  supplyJump,
  underperforming,
  volumeFalling,
  websiteDown,
} from "@/lib/monitor/rules";
import type { Snapshot } from "@/lib/monitor/store";
import type { CheckedPromise } from "@/lib/promises/pages";

const NOW = new Date("2026-11-20T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const snap = (over: Partial<Snapshot> = {}, h = 0): Snapshot => ({
  at: hoursAgo(h),
  price: 1,
  marketCap: 1e8,
  volume24h: 1e6,
  circulating: 1e6,
  numPairs: 50,
  change7d: 0,
  btcChange7d: 0,
  deep: false,
  ...over,
});
const BANNED = /\b(buy|sell now|scam|rug pull)\b/i;

describe("volume falling", () => {
  it("fires after 3 consecutive drops totalling 30%+", () => {
    const h = [snap({ volume24h: 600e3 }, 0), snap({ volume24h: 700e3 }, 12), snap({ volume24h: 850e3 }, 24), snap({ volume24h: 1e6 }, 36)];
    const a = volumeFalling(h)!;
    expect(a.rule).toBe("volume_falling");
    expect(a.before).toBe("$1.0M");
    expect(a.after).toBe("$600.0K");
    expect(a.meaning).not.toMatch(BANNED);
  });
  it("needs every step to fall", () => {
    const h = [snap({ volume24h: 500e3 }), snap({ volume24h: 900e3 }, 12), snap({ volume24h: 800e3 }, 24), snap({ volume24h: 1e6 }, 36)];
    expect(volumeFalling(h)).toBeNull();
  });
  it("ignores small drifts", () => {
    const h = [snap({ volume24h: 950e3 }), snap({ volume24h: 970e3 }, 12), snap({ volume24h: 990e3 }, 24), snap({ volume24h: 1e6 }, 36)];
    expect(volumeFalling(h)).toBeNull();
  });
});

describe("pairs dropping", () => {
  it("compares with the 7-day max", () => {
    const a = pairsDropping([snap({ numPairs: 30 }), snap({ numPairs: 50 }, 48), snap({ numPairs: 45 }, 24)], NOW)!;
    expect(a.severity).toBe("concern");
    expect([a.before, a.after]).toEqual(["50 markets", "30 markets"]);
  });
  it("ignores markets older than a week", () => {
    expect(pairsDropping([snap({ numPairs: 30 }), snap({ numPairs: 50 }, 24 * 9)], NOW)).toBeNull();
  });
  it("halving is danger", () => {
    expect(pairsDropping([snap({ numPairs: 20 }), snap({ numPairs: 50 }, 24)], NOW)!.severity).toBe("danger");
  });
});

describe("liquidity draining", () => {
  it("ignores older snapshots measured with every pool (no false alert after the method change)", () => {
    // before: $1M counting junk pools; now: $600K counting major-asset pools only
    expect(liquidityDraining([snap({ deep: true, liqMethod: "major", dexLiquidityUsd: 600e3 }), snap({ deep: true, dexLiquidityUsd: 1e6 }, 12)])).toBeNull();
  });
  it("compares deep checks only", () => {
    const h = [snap({ deep: true, liqMethod: "major", dexLiquidityUsd: 400e3 }), snap({}, 6), snap({ deep: true, liqMethod: "major", dexLiquidityUsd: 1e6 }, 12)];
    expect(liquidityDraining(h)!.severity).toBe("danger"); // -60%
  });
  it("crossing the $50K floor is danger even if the % drop is small", () => {
    expect(liquidityDraining([snap({ deep: true, liqMethod: "major", dexLiquidityUsd: 45e3 }), snap({ deep: true, liqMethod: "major", dexLiquidityUsd: 55e3 }, 12)])!.severity).toBe("danger");
  });
  it("stays quiet on small moves", () => {
    expect(liquidityDraining([snap({ deep: true, liqMethod: "major", dexLiquidityUsd: 900e3 }), snap({ deep: true, liqMethod: "major", dexLiquidityUsd: 1e6 }, 12)])).toBeNull();
  });
});

describe("supply jump", () => {
  it("fires at +5% and is danger at +20%", () => {
    expect(supplyJump([snap({ circulating: 1.06e6 }), snap({ circulating: 1e6 }, 12)])!.severity).toBe("concern");
    expect(supplyJump([snap({ circulating: 1.3e6 }), snap({ circulating: 1e6 }, 12)])!.severity).toBe("danger");
    expect(supplyJump([snap({ circulating: 1.01e6 }), snap({ circulating: 1e6 }, 12)])).toBeNull();
  });
  it("keys the cooldown on the new supply, so a second unlock alerts again", () => {
    const a = supplyJump([snap({ circulating: 1.1e6 }), snap({ circulating: 1e6 }, 12)])!;
    const b = supplyJump([snap({ circulating: 1.3e6 }), snap({ circulating: 1.1e6 }, 12)])!;
    expect(a.key).not.toBe(b.key);
  });
});

describe("website down", () => {
  it("needs two failed deep checks in a row", () => {
    expect(websiteDown([snap({ deep: true, websiteUp: false }), snap({ deep: true, websiteUp: false }, 12)])).not.toBeNull();
    expect(websiteDown([snap({ deep: true, websiteUp: false }), snap({ deep: true, websiteUp: true }, 12)])).toBeNull();
  });
});

describe("underperforming", () => {
  it("compares the 7-day change with Bitcoin's", () => {
    expect(underperforming([snap({ change7d: -40, btcChange7d: -5 })], 99)!.severity).toBe("concern"); // -35 pts
    expect(underperforming([snap({ change7d: -60, btcChange7d: 2 })], 99)!.severity).toBe("danger");
    expect(underperforming([snap({ change7d: -20, btcChange7d: -5 })], 99)).toBeNull();
  });
  it("never fires for Bitcoin itself", () => {
    expect(underperforming([snap({ change7d: -40, btcChange7d: 0 })], 1)).toBeNull();
  });
});

describe("promise date passed", () => {
  const p = (dueDate: string, status: CheckedPromise["status"] = "overdue"): CheckedPromise => ({ promise: "Launch mainnet", dueDate, sourceUrl: "https://x.io/roadmap", quote: `Mainnet launches ${dueDate}.`, status });
  it("alerts for dates that passed recently", () => {
    const a = promisesOverdue([p("2026-10")], NOW);
    expect(a).toHaveLength(1);
    expect(a[0]!.meaning).toContain("can't confirm whether it was delivered");
    expect(a[0]!.quote).toBe("Mainnet launches 2026-10.");
  });
  it("doesn't alert for long-past dates (they're in the report)", () => {
    expect(promisesOverdue([p("2025-Q4")], NOW)).toHaveLength(0);
  });
  it("respects 'delivered' marks", () => {
    const pr = p("2026-10");
    expect(promisesOverdue([pr], NOW, [quoteKey(pr.quote)])).toHaveLength(0);
  });
  it("ignores promises that aren't overdue", () => {
    expect(promisesOverdue([p("2027-Q1", "upcoming")], NOW)).toHaveLength(0);
  });
});

describe("evaluateRules", () => {
  it("returns nothing for a steady coin", () => {
    const h = [snap({}, 0), snap({}, 12), snap({}, 24), snap({}, 36)];
    expect(evaluateRules({ coinId: 99, history: h, promises: null, now: NOW })).toEqual([]);
  });
  it("never uses banned words in any alert", () => {
    const h = [
      snap({ volume24h: 300e3, numPairs: 10, circulating: 2e6, change7d: -70, btcChange7d: 0, deep: true, liqMethod: "major", dexLiquidityUsd: 10e3, websiteUp: false }),
      snap({ volume24h: 500e3, numPairs: 50, circulating: 1e6, deep: true, liqMethod: "major", dexLiquidityUsd: 1e6, websiteUp: false }, 12),
      snap({ volume24h: 700e3 }, 24),
      snap({ volume24h: 1e6 }, 36),
    ];
    const all = evaluateRules({ coinId: 99, history: h, promises: [{ promise: "Audit", dueDate: "2026-11-01", sourceUrl: "https://x.io", quote: "Audit by 1 November.", status: "overdue" }], now: NOW });
    expect(all.map((a) => a.rule).sort()).toEqual(["liquidity_draining", "pairs_dropping", "promise_overdue", "supply_jump", "underperforming", "volume_falling", "website_down"]);
    for (const a of all) for (const t of [a.title, a.meaning, ...a.next]) expect(t).not.toMatch(BANNED);
  });
});
