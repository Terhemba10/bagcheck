import { describe, expect, it } from "vitest";
import { CoinInfo, CoinQuote } from "@/lib/cmc/types";
import { parseCandles, rankMatches } from "@/lib/cmc/api";
import { trimJson } from "@/lib/cmc/trim";
import { classifyCmcResponse } from "@/lib/cmc/errors";

// Shapes below are trimmed from real responses recorded on 19 Nov 2026.

describe("v3 quotes", () => {
  it("accepts quote as an array (live v3 shape) and normalises to a record", () => {
    const q = CoinQuote.parse({
      id: 1, name: "Bitcoin", symbol: "BTC", slug: "bitcoin",
      circulating_supply: 20113903, total_supply: 20113903, max_supply: 21000000,
      quote: [{ id: 2781, symbol: "USD", price: 62886.78, volume_24h: 31765915804.25, market_cap: 1264898653543.33, fully_diluted_market_cap: 1320622443312.47 }],
    });
    expect(q.quote.USD?.price).toBeCloseTo(62886.78);
  });
  it("still accepts the v2 object shape", () => {
    const q = CoinQuote.parse({ id: 1, name: "Bitcoin", symbol: "BTC", slug: "bitcoin", quote: { USD: { price: 1 } } });
    expect(q.quote.USD?.price).toBe(1);
  });
});

describe("v2 info", () => {
  it("accepts platform.id as a string", () => {
    const i = CoinInfo.parse({
      id: 24478, name: "Pepe", symbol: "PEPE", slug: "pepe",
      platform: { id: "1027", name: "Ethereum", symbol: "ETH", slug: "ethereum", token_address: "0x6982508145454ce325ddbe47a25d4ec3d2311933" },
    });
    expect(i.platform?.token_address).toMatch(/^0x/);
  });
});

describe("v5 OHLCV", () => {
  it("parses 10-value candle arrays", () => {
    const c = parseCandles([
      [81853.53, 83287.8, 81107.23, 82941.0, 26999680268.16, 1667028961197.13, "2026-10-20T00:00:00.000Z", "2026-10-20T14:58:00.000Z", "2026-10-20T01:15:00.000Z", "2026-10-20T23:59:59.999Z"],
      ["bad"],
    ]);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ close: 82941.0, timeClose: "2026-10-20T23:59:59.999Z" });
  });
  it("classifies the v5 validation error and keeps its detail", () => {
    const p = classifyCmcResponse(400, { error_code: "4001", error_message: "Invalid parameter.", error_detail: "interval must be one of [15m, 1h, 4h, 1d, 1w, 1M]." });
    expect(p?.kind).toBe("bad_request");
    expect(p?.message).toContain("interval must be one of");
  });
});

describe("search ranking regression", () => {
  it('"bitcoin" finds Bitcoin, not the token with ticker BITCOIN', () => {
    const coins = [
      { id: 25220, name: "HarryPotterObamaSonic10Inu (ERC-20)", symbol: "BITCOIN", slug: "harrypotterobamasonic10inu-eth", rank: 868 },
      { id: 1, name: "Bitcoin", symbol: "BTC", slug: "bitcoin", rank: 1 },
    ];
    expect(rankMatches(coins, "bitcoin")[0]?.id).toBe(1);
  });
});

describe("evidence trimming", () => {
  it("keeps public fields like token_address", () => {
    expect(trimJson({ token_address: "0xabc" })).toEqual({ token_address: "0xabc" });
  });
});
