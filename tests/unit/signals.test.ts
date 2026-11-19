import { describe, expect, it } from "vitest";
import type { CoinQuote, MarketPairs } from "@/lib/cmc/types";
import {
  concentrationSignal,
  contractSignal,
  dilutionSignal,
  linksSignal,
  liquiditySignal,
  momentumSignal,
  volumeSignal,
  type Avail,
} from "@/lib/core/signals";
import { scoreReport, verdictText } from "@/lib/core/score";

const ok = <T>(value: T): Avail<T> => ({ status: "ok", value, source: "live" });
const quote = (over: Partial<CoinQuote> = {}, usd: Record<string, number | null> = {}): Avail<CoinQuote> =>
  ok({ id: 99, name: "Test", symbol: "TST", slug: "test", date_added: "2023-01-01T00:00:00Z", circulating_supply: 900, max_supply: 1000, total_supply: 1000, quote: { USD: { market_cap: 1e9, volume_24h: 5e7, fully_diluted_market_cap: 1.1e9, percent_change_30d: 5, ...usd } }, ...over } as CoinQuote);

describe("dilution", () => {
  it("is fine when most supply is out", () => {
    expect(dilutionSignal(quote()).level).toBe("ok");
  });
  it("matches the brief's example copy for 18% released", () => {
    const s = dilutionSignal(quote({ circulating_supply: 180, max_supply: 1000 }, { fully_diluted_market_cap: 5.5e9 }));
    expect(s.level).toBe("concern");
    expect(s.meaning).toBe("Only 18% of all tokens exist today. The other 82% can still be released, which often pushes the price down.");
  });
  it("is danger under 15% released or FDV ≥ 6× market cap", () => {
    expect(dilutionSignal(quote({ circulating_supply: 100, max_supply: 1000 })).level).toBe("danger");
    expect(dilutionSignal(quote({}, { fully_diluted_market_cap: 7e9 })).level).toBe("danger");
  });
  it("says so when supply data is missing, without guessing", () => {
    const s = dilutionSignal(quote({ circulating_supply: null, max_supply: null, total_supply: null }));
    expect(s.level).toBe("unknown");
    expect(s.scored).toBe(false);
  });
  it("flags uncapped supply as worth watching", () => {
    expect(dilutionSignal(quote({ infinite_supply: true })).level).toBe("watch");
  });
});

describe("volume sanity", () => {
  it.each([
    [2e9, "concern"], // more than its whole value
    [6e8, "watch"],
    [5e7, "ok"],
    [3e6, "concern"], // thin
    [5e5, "danger"], // almost none
  ] as const)("volume %d on a $1B coin → %s", (vol, level) => {
    expect(volumeSignal(quote({}, { volume_24h: vol })).level).toBe(level);
  });
});

describe("concentration (Startup extra)", () => {
  it("is not scored when the plan blocks market pairs", () => {
    const s = concentrationSignal({ status: "plan", reason: "1006" });
    expect(s.scored).toBe(false);
    expect(s.source.kind).toBe("paid-plan");
  });
  it("flags one exchange holding most volume", () => {
    const pair = (name: string, v: number) => ({ exchange: { name }, market_pair: "X/USDT", quote: { USD: { volume_24h: v } } });
    const s = concentrationSignal(ok({ id: 1, name: "T", symbol: "T", market_pairs: [pair("A", 90), pair("B", 10)] } as unknown as MarketPairs));
    expect(s.level).toBe("danger");
    expect(s.value).toBe("90%");
  });
});

describe("liquidity", () => {
  it("sums DEX pools (numbers arrive as strings) and grades the total", () => {
    const s = liquiditySignal(ok([{ exn: "Uniswap v2", liqUsd: "120000", t0: { sym: "T" }, t1: { sym: "WETH" } }, { exn: "Uniswap v3", liqUsd: "30000" }]), quote());
    expect(s.level).toBe("concern");
    expect(s.value).toBe("$150.0K");
  });
  it("is danger with no pools", () => {
    expect(liquiditySignal(ok([]), quote()).level).toBe("danger");
  });
  it("is not scored for native coins (no DEX pools on Basic)", () => {
    const s = liquiditySignal({ status: "none", reason: "Bitcoin isn't a token on a DEX chain." }, quote());
    expect(s.scored).toBe(false);
  });
});

describe("age and momentum", () => {
  const now = new Date("2026-11-19T00:00:00Z");
  const btc = quote({ id: 1 }, { percent_change_30d: -10 });
  it("is danger for a coin listed less than 30 days ago", () => {
    expect(momentumSignal(quote({ date_added: "2026-11-05T00:00:00Z" }), btc, { status: "none", reason: "" }, now).level).toBe("danger");
  });
  it("compares 30-day change with Bitcoin", () => {
    const s = momentumSignal(quote({}, { percent_change_30d: -45 }), btc, { status: "none", reason: "" }, now);
    expect(s.level).toBe("concern"); // 35 points worse than BTC
    expect(s.meaning).toContain("35 points worse");
  });
});

describe("links health", () => {
  it("is concern when the website is down, and ignores sites that block bots", () => {
    const s = linksSignal(ok([
      { kind: "website", url: "https://x.example", state: "down", reason: "Couldn't connect" },
      { kind: "social", url: "https://x.com/t", state: "skipped" },
    ]));
    expect(s.level).toBe("concern");
    expect(s.value).toBe("0/1");
  });
  it("is fine when everything responds", () => {
    expect(linksSignal(ok([{ kind: "website", url: "https://a.example", state: "up" }, { kind: "docs", url: "https://b.example", state: "blocked" }])).level).toBe("ok");
  });
});

describe("contract check", () => {
  it("is fine with no hits and no tax (live Pepe-like scan)", () => {
    expect(contractSignal(ok({ securityLevel: "safe", extra: { buyTax: "0", sellTax: "0" }, securityItems: [{ code: "Blacklist Restrictions Not Found", riskyLevel: "g", isHit: false }] })).level).toBe("ok");
  });
  it("one yellow flag is worth watching (Pepe's blacklist function)", () => {
    expect(contractSignal(ok({ extra: { buyTax: "0", sellTax: "0" }, securityItems: [{ code: "Blacklist Restrictions Found", riskyLevel: "y", isHit: true }] })).level).toBe("watch");
  });
  it("honeypot, red flags or a 25% tax are danger", () => {
    expect(contractSignal(ok({ evmDisplay: { honeypotStatus: "Yes" } })).level).toBe("danger");
    expect(contractSignal(ok({ securityItems: [{ code: "Owner Can Change Balance", riskyLevel: "r", isHit: true }] })).level).toBe("danger");
    expect(contractSignal(ok({ extra: { sellTax: "0.3" } })).level).toBe("danger"); // fraction → 30%
  });
  it("reads '1' as a 1% tax, not 100%", () => {
    const s = contractSignal(ok({ extra: { buyTax: "1", sellTax: "1" } }));
    expect(s.level).toBe("ok");
    expect(s.meaning).toContain("sell tax 1.0%");
  });
});

describe("score", () => {
  const sig = (level: "ok" | "watch" | "concern" | "danger" | "unknown", scored = true) =>
    ({ id: "volume", title: `T-${level}`, level, meaning: "", why: "", source: { kind: "live" }, scored }) as const;
  it("needs at least 3 scored signals", () => {
    expect(scoreReport([sig("danger"), sig("danger"), sig("unknown", false)]).concern).toBeNull();
  });
  it("low / medium / high", () => {
    expect(scoreReport([sig("ok"), sig("ok"), sig("watch"), sig("ok")]).concern).toBe("low");
    expect(scoreReport([sig("ok"), sig("danger"), sig("ok"), sig("ok")]).concern).toBe("medium");
    expect(scoreReport([sig("concern"), sig("concern"), sig("ok")]).concern).toBe("medium");
    expect(scoreReport([sig("danger"), sig("danger"), sig("ok")]).concern).toBe("high");
  });
  it("counts only scored signals", () => {
    const r = scoreReport([sig("ok"), sig("ok"), sig("ok"), sig("unknown", false)]);
    expect([r.scored, r.total]).toEqual([3, 4]);
  });
  it("mentions 'worth watching' items in a low-concern verdict", () => {
    const watch = { ...sig("watch"), title: "Contract check" };
    const v = verdictText("Pepe", scoreReport([sig("ok"), sig("ok"), watch, sig("ok")]));
    expect(v).toBe("Pepe: low concern. No major warning signs in the data we checked. Worth knowing about: contract check.");
  });
  it("says when there isn't enough data instead of scoring", () => {
    expect(verdictText("X", scoreReport([sig("ok"), sig("unknown", false)]))).toMatch(/isn't enough data/);
  });
  it("writes a verdict that matches the score and never says buy or sell", () => {
    const r = scoreReport([sig("danger"), sig("concern"), sig("ok")]);
    const v = verdictText("Test", r);
    expect(v).toMatch(/^Test: medium concern/);
    expect(v.toLowerCase()).not.toMatch(/\b(buy|sell|scam|rug)\b/);
  });
});
