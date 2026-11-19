import { describe, expect, it } from "vitest";
import { countsAsLiquidity, isMajorAsset, MAJOR_QUOTE_ASSETS, sidesOf } from "@/lib/core/pools";

const PEPE = { contract: "0x6982508145454ce325ddbe47a25d4ec3d2311933", symbol: "PEPE" };

describe("major quote assets (one config list)", () => {
  it.each(["WETH", "eth", "WBTC", "cbBTC", "USDC", "USDT", "DAI", "SOL", "wSOL", "BNB", "WBNB"])("%s counts", (s) => expect(isMajorAsset(s)).toBe(true));
  it.each(["ARRKY", "PEPE0.5", "LOOP", "MEME", "", null])("%s doesn't", (s) => expect(isMajorAsset(s)).toBe(false));
  it("has no duplicates", () => {
    expect(new Set(MAJOR_QUOTE_ASSETS).size).toBe(MAJOR_QUOTE_ASSETS.length);
  });
});

describe("which pools count (real Pepe pairs, 19 Nov)", () => {
  const pool = (a: string, b: string, addrA?: string, addrB?: string) => ({ t0: { sym: a, addr: addrA }, t1: { sym: b, addr: addrB } });
  it("counts PEPE/WETH and ETH/PEPE", () => {
    expect(countsAsLiquidity(pool("PEPE", "WETH", PEPE.contract), PEPE)).toBe(true);
    expect(countsAsLiquidity(pool("ETH", "PEPE", undefined, PEPE.contract), PEPE)).toBe(true);
  });
  it("doesn't count lookalike pairs like ARRKY/PEPE or PEPE0.5/PEPE", () => {
    expect(countsAsLiquidity(pool("ARRKY", "PEPE", "0xarrky", PEPE.contract), PEPE)).toBe(false);
    expect(countsAsLiquidity(pool("PEPE0.5", "PEPE", "0xpepe05", PEPE.contract), PEPE)).toBe(false);
  });
  it("finds our side by address first, then symbol", () => {
    expect(sidesOf(pool("X", "Y", "0xother", PEPE.contract.toUpperCase()), PEPE)!.other.sym).toBe("X");
    expect(sidesOf(pool("PEPE", "USDC"), PEPE)!.other.sym).toBe("USDC");
    expect(sidesOf(pool("A", "B"), PEPE)).toBeNull(); // not our pool at all
  });
});
