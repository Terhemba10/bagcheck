import { describe, expect, it } from "vitest";
import { pickWorthACheck, reasonsFor } from "@/lib/core/worthACheck";
import type { CoinQuote } from "@/lib/cmc/types";

const coin = (id: number, usd: Record<string, number | null>, extra: Partial<CoinQuote> = {}): CoinQuote =>
  ({ id, name: `Coin ${id}`, symbol: `C${id}`, slug: `coin-${id}`, cmc_rank: id, quote: { USD: usd }, ...extra }) as CoinQuote;

describe("worth a check", () => {
  it("flags big moves, dilution, thin and hot volume", () => {
    expect(reasonsFor(coin(1, { market_cap: 1e9, percent_change_24h: -22, volume_24h: 5e7, fully_diluted_market_cap: 1e9 })).map((r) => r.code)).toEqual(["big-move"]);
    expect(reasonsFor(coin(2, { market_cap: 1e8, percent_change_24h: 1, volume_24h: 1e7, fully_diluted_market_cap: 5e8 })).map((r) => r.code)).toEqual(["dilution"]);
    expect(reasonsFor(coin(3, { market_cap: 1e9, percent_change_24h: 0, volume_24h: 1e6 })).map((r) => r.code)).toEqual(["thin-volume"]);
    expect(reasonsFor(coin(4, { market_cap: 1e8, percent_change_24h: 0, volume_24h: 2e8 })).map((r) => r.code)).toEqual(["hot-volume"]);
  });
  it("explains dilution as the share of supply released", () => {
    expect(reasonsFor(coin(2, { market_cap: 1e8, fully_diluted_market_cap: 5e8, volume_24h: 1e7 }))[0]?.text).toBe("20% of supply released");
  });
  it("ignores tiny coins and stablecoins, and only lists coins with a reason", () => {
    const picks = pickWorthACheck([
      coin(1, { market_cap: 5e6, percent_change_24h: 80, volume_24h: 1e6 }), // too small
      coin(2, { market_cap: 1e9, percent_change_24h: 0.1, volume_24h: 5e7 }), // nothing to flag
      coin(3, { market_cap: 1e9, percent_change_24h: 0, volume_24h: 1e5 }, { tags: ["stablecoin"] } as Partial<CoinQuote>),
      coin(4, { market_cap: 1e9, percent_change_24h: -30, volume_24h: 5e7 }),
    ]);
    expect(picks.map((p) => p.id)).toEqual([4]);
  });
  it("ranks coins with more warning signs first", () => {
    const picks = pickWorthACheck([
      coin(1, { market_cap: 1e9, percent_change_24h: 40, volume_24h: 5e7 }),
      coin(2, { market_cap: 1e8, percent_change_24h: 16, volume_24h: 1e7, fully_diluted_market_cap: 1e9 }),
    ]);
    expect(picks[0]?.id).toBe(2);
  });
});
