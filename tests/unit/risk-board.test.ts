import { describe, expect, it } from "vitest";
import type { CoinQuote } from "@/lib/cmc/types";
import { filterRows, isMeme, quickVerdict, sortRows, topSign, withFullVerdict, type BoardRow } from "@/lib/core/riskBoard";

const NOW = new Date("2026-11-20T12:00:00Z");
const coin = (over: Partial<{ id: number; circ: number; max: number; vol: number; mcap: number; ch30: number; added: string; tags: string[] }> = {}) =>
  ({
    id: over.id ?? 99,
    name: "Test",
    symbol: "TST",
    slug: "test",
    cmc_rank: 50,
    circulating_supply: over.circ ?? 1_000_000,
    total_supply: over.max ?? 1_000_000,
    max_supply: over.max ?? 1_000_000,
    date_added: over.added ?? "2021-01-01T00:00:00Z",
    tags: over.tags ?? [],
    quote: {
      USD: {
        price: 1,
        market_cap: over.mcap ?? 1e9,
        fully_diluted_market_cap: (over.mcap ?? 1e9) * ((over.max ?? 1_000_000) / (over.circ ?? 1_000_000)),
        volume_24h: over.vol ?? 5e7,
        percent_change_24h: 1,
        percent_change_7d: 2,
        percent_change_30d: over.ch30 ?? 0,
      },
    },
  }) as unknown as CoinQuote;
const btc = coin({ id: 1, ch30: 0 });

const row = (over: Partial<BoardRow>): BoardRow => ({
  id: 1,
  name: "A",
  symbol: "A",
  rank: 10,
  price: 1,
  change24h: 0,
  change7d: 0,
  marketCap: 1,
  meme: false,
  spark: null,
  verdict: { concern: "low", scored: 3, total: 3, kind: "quick" },
  topSign: null,
  promises: null,
  ...over,
});

describe("risk board quick check", () => {
  it("scores a healthy coin from 3 market-data signals", () => {
    const { verdict, topSign: sign } = quickVerdict(coin(), btc, NOW);
    expect(verdict).toMatchObject({ kind: "quick", scored: 3, total: 3, concern: "low" });
    expect(sign).toBeNull();
  });
  it("raises concern for heavy dilution and names it as the top warning sign", () => {
    const { verdict, topSign: sign } = quickVerdict(coin({ circ: 100_000, max: 1_000_000 }), btc, NOW);
    expect(verdict.concern).not.toBe("low");
    expect(sign?.title).toBe("Dilution");
  });
  it("never uses 'safe' or 'verified' wording", () => {
    const text = JSON.stringify(quickVerdict(coin({ vol: 1e5 }), btc, NOW));
    expect(text).not.toMatch(/\b(safe|verified|scam|buy|sell)\b/i);
  });
});

describe("risk board helpers", () => {
  it("detects meme coins from CMC tags", () => {
    expect(isMeme(["memes", "solana-ecosystem"])).toBe(true);
    expect(isMeme(["defi"])).toBe(false);
    expect(isMeme(undefined)).toBe(false);
  });
  it("filters Memes and Top 100", () => {
    const rows = [row({ id: 1, meme: true, rank: 150 }), row({ id: 2, rank: 20 })];
    expect(filterRows(rows, "memes").map((r) => r.id)).toEqual([1]);
    expect(filterRows(rows, "top100").map((r) => r.id)).toEqual([2]);
    expect(filterRows(rows, "all")).toHaveLength(2);
  });
  it("sorts highest concern first by default, then by the top sign, then rank", () => {
    const rows = [
      row({ id: 1, rank: 1, verdict: { concern: "low", scored: 3, total: 3, kind: "quick" } }),
      row({ id: 2, rank: 5, verdict: { concern: "high", scored: 3, total: 3, kind: "quick" } }),
      row({ id: 3, rank: 3, verdict: { concern: "medium", scored: 3, total: 3, kind: "quick" }, topSign: { title: "Dilution", text: "", level: "danger" } }),
      row({ id: 4, rank: 2, verdict: { concern: "medium", scored: 3, total: 3, kind: "quick" }, topSign: { title: "Volume", text: "", level: "watch" } }),
      row({ id: 5, rank: 4, verdict: { concern: null, scored: 1, total: 3, kind: "quick" } }),
    ];
    expect(sortRows(rows).map((r) => r.id)).toEqual([2, 3, 4, 1, 5]);
    expect(sortRows(rows, "rank", "asc").map((r) => r.id)).toEqual([1, 4, 3, 5, 2]);
  });
  it("a recent full report replaces the quick check", () => {
    const merged = withFullVerdict(row({}), {
      concern: "medium",
      scored: 6,
      total: 7,
      drivers: [{ title: "Contract check", level: "concern", text: "1 risk flag" }],
      at: "2026-11-20T10:00:00Z",
    });
    expect(merged.verdict).toMatchObject({ kind: "full", concern: "medium", scored: 6, total: 7 });
    expect(merged.topSign?.title).toBe("Contract check");
  });
  it("picks the worst signal as the top sign", () => {
    expect(
      topSign([
        { title: "A", level: "watch", meaning: "a" },
        { title: "B", level: "danger", meaning: "b", value: "12%" },
        { title: "C", level: "ok", meaning: "c" },
      ])?.title,
    ).toBe("B");
  });
});
