import { describe, expect, it } from "vitest";
import { amountForImpact, estimateImpact, impactForPool, isThin } from "@/lib/rescue/impact";
import { EXCHANGE_SUPPORT, IC3, isOfficial, REVOKE_CHECKERS, revokeCheckerFor, SCAM_SHIELD, WALLET_HELP } from "@/lib/rescue/links";

describe("price impact estimate (constant-product model)", () => {
  it("is A/(X+A)", () => {
    expect(impactForPool(1000, 99_000)).toBeCloseTo(0.01, 6);
    expect(impactForPool(100_000, 100_000)).toBeCloseTo(0.5, 6);
  });
  it("returns null without usable data instead of guessing", () => {
    expect(impactForPool(0, 1e6)).toBeNull();
    expect(impactForPool(1000, 0)).toBeNull();
  });
  it("compares the deepest pool alone with spreading across all pools", () => {
    const e = estimateImpact(10_000, [
      { dex: "Uniswap v2", pair: "T/WETH", tokenSideUsd: 90_000, totalUsd: 180_000, volume24h: 1 },
      { dex: "Uniswap v3", pair: "T/USDC", tokenSideUsd: 10_000, totalUsd: 20_000, volume24h: 1 },
    ]);
    expect(e.deepestPool!.impact).toBeCloseTo(0.1, 6); // 10k into 90k
    expect(e.acrossPools!.impact).toBeCloseTo(10_000 / 110_000, 6); // 10k into 100k
    expect(e.acrossPools!.impact).toBeLessThan(e.deepestPool!.impact);
    expect(e.inParts!.impactPerPart).toBeLessThan(e.acrossPools!.impact); // smaller parts move the price less each
  });
  it("handles no pools", () => {
    expect(estimateImpact(1000, [])).toEqual({ amountUsd: 1000, deepestPool: null, acrossPools: null, inParts: null });
  });
  it("finds the amount for a 2% move, and flags thin liquidity", () => {
    expect(amountForImpact(98_000, 0.02)).toBeCloseTo(2000, 6);
    expect(isThin(40_000)).toBe(true); // $1,000 moves it ~2.4%
    expect(isThin(1_000_000)).toBe(false);
  });
});

describe("official links allowlist", () => {
  it("only contains https links on known official domains", () => {
    const all = [...Object.values(REVOKE_CHECKERS), ...WALLET_HELP, IC3, ...EXCHANGE_SUPPORT];
    for (const l of all) {
      expect(l.url).toMatch(/^https:\/\//);
      expect(new URL(l.url).hostname).toMatch(/(etherscan\.io|bscscan\.com|basescan\.org|arbiscan\.io|metamask\.com|phantom\.com|trustwallet\.com|ic3\.gov|binance\.com|coinbase\.com|kraken\.com|okx\.com|bybit\.com)$/);
    }
  });
  it("rejects anything not on the list, including lookalikes", () => {
    expect(isOfficial("https://etherscan.io/tokenapprovalchecker")).toBe(true);
    expect(isOfficial("https://etherscan-revoke.io/tokenapprovalchecker")).toBe(false);
    expect(isOfficial("https://revoke.cash/")).toBe(false); // not on our allowlist
    expect(isOfficial("https://www.pepe.vip/")).toBe(false); // project links are never used
  });
  it("only gives approval checkers for chains we verified", () => {
    expect(revokeCheckerFor("ethereum")?.url).toBe("https://etherscan.io/tokenapprovalchecker");
    expect(revokeCheckerFor("polygon")).toBeNull();
    expect(revokeCheckerFor(null)).toBeNull();
  });
  it("uses the exact scam-shield wording", () => {
    expect(SCAM_SHIELD).toBe("Anyone who guarantees to recover your crypto for an upfront fee is running a scam. Real authorities never charge recovery fees.");
  });
});
