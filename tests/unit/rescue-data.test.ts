import { describe, expect, it } from "vitest";
import { lessonsFrom } from "@/lib/rescue/lessons";
import { poolSides } from "@/lib/rescue/build";
import type { Report } from "@/lib/core/report";
import type { Alert, Snapshot } from "@/lib/monitor/store";

const report = {
  coin: { id: 9, name: "Test", symbol: "TST" },
  signals: [
    { id: "dilution", title: "Dilution", level: "concern", meaning: "Only 28% of tokens exist today.", why: "", source: { kind: "live" }, scored: true },
    { id: "liquidity", title: "Liquidity", level: "ok", meaning: "$14.5M in pools.", why: "", source: { kind: "live" }, scored: true },
    { id: "concentration", title: "Exchange concentration", level: "unknown", meaning: "Needs a paid plan.", why: "", source: { kind: "paid-plan" }, scored: false },
  ],
} as unknown as Report;

const snap = (at: string, over: Partial<Snapshot> = {}): Snapshot => ({ at, price: 1, marketCap: 1e8, volume24h: 1e6, circulating: 1e6, numPairs: 50, change7d: 0, btcChange7d: 0, deep: false, ...over });

describe("lessons for next time", () => {
  it("says plainly when there's no history, and never invents dates", () => {
    const l = lessonsFrom({ snapshots: [], alerts: [], report });
    expect(l.hasHistory).toBe(false);
    expect(l.summary).toMatch(/hasn't been watching Test/);
    expect(l.timeline).toEqual([]);
    expect(l.signsToday.map((s) => s.title)).toEqual(["Dilution"]); // only real warning signs, today
    expect(JSON.stringify(l)).not.toMatch(/20\d\d-\d\d-\d\d/); // no dates at all without history
  });

  it("one check is not enough history", () => {
    const l = lessonsFrom({ snapshots: [snap("2026-11-19T10:00:00Z")], alerts: [], report });
    expect(l.hasHistory).toBe(false);
    expect(l.summary).toContain("only checked Test once (on 19 Nov 2026)");
  });

  it("uses only measured values and real alert dates when history exists", () => {
    const alerts = [{ at: "2026-11-15T08:00:00Z", title: "Trading volume fell 3 checks in a row", severity: "concern" } as Alert];
    const l = lessonsFrom({
      snapshots: [snap("2026-11-20T10:00:00Z", { price: 0.5, volume24h: 4e5, deep: true, liqMethod: "major", dexLiquidityUsd: 2e5 }), snap("2026-11-10T10:00:00Z", { deep: true, liqMethod: "major", dexLiquidityUsd: 1e6 })],
      alerts,
      report,
    });
    expect(l.hasHistory).toBe(true);
    expect(l.summary).toBe("Bag checked Test 2 times between 10 Nov 2026 and 20 Nov 2026. It raised 1 alert in that time.");
    expect(l.changes).toEqual([
      "Price: -50.0% ($1.00 → $0.500)",
      "24h volume: -60.0% ($1.0M → $400.0K)",
      "DEX liquidity: -80.0% ($1.0M → $200.0K)",
    ]);
    expect(l.timeline[0]!.at).toBe("2026-11-15T08:00:00Z");
    expect(l.takeaways[0]).toMatch(/still locked/);
  });
});

describe("pool sides", () => {
  const C = "0xabc0000000000000000000000000000000000001";
  it("uses our token's side, counts only major-asset pools, and lists the rest separately", () => {
    const { counted, other } = poolSides(
      [
        { exn: "Uniswap v2", liqUsd: "200000", t0: { addr: C.toUpperCase(), sym: "TST", liqUsd: "120000" }, t1: { addr: "0xweth", sym: "WETH", liqUsd: "80000" } },
        { exn: "Uniswap v3", liqUsd: "10000", t0: { addr: "0xusdc", sym: "USDC", liqUsd: "6000" }, t1: { addr: C, sym: "TST", liqUsd: "4000" } },
        { exn: "Uniswap v2", liqUsd: "60000", t0: { addr: "0xjunk", sym: "TST0.5", liqUsd: "30000" }, t1: { addr: C, sym: "TST", liqUsd: "30000" } },
        { exn: "Dust", liqUsd: "600", t0: { addr: C, sym: "TST", liqUsd: "300" }, t1: { sym: "WETH" } },
      ],
      C,
      "TST",
    );
    expect(counted.map((s) => [s.dex, s.tokenSideUsd])).toEqual([
      ["Uniswap v2", 120000],
      ["Uniswap v3", 4000],
    ]);
    expect(other.map((s) => s.pair)).toEqual(["TST0.5/TST"]); // shown collapsed, not counted; dust dropped
  });
  it("matches our side by symbol when addresses are missing", () => {
    expect(poolSides([{ exn: "DEX", liqUsd: "10000", t0: { sym: "TST", liqUsd: "5000" }, t1: { sym: "USDT", liqUsd: "5000" } }], C, "TST").counted[0]!.tokenSideUsd).toBe(5000);
  });
});
