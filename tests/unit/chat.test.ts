import { describe, expect, it } from "vitest";
import { buildFacts, checkAnswer, fallbackAnswer } from "@/lib/chat/facts";
import type { Report } from "@/lib/core/report";

const report = {
  coin: { id: 1, name: "Test", symbol: "TST", slug: "t", logo: null, rank: 104, price: 0.95, change24h: 0.1, change7d: -15.1, marketCap: 267.9e6, platform: "Solana", contract: "x", website: null },
  signals: [
    { id: "dilution", title: "Dilution", level: "concern", value: "28%", valueLabel: "of all tokens in circulation", meaning: "Only 28% of all tokens exist today.", why: "Unlocks can push the price down.", source: { kind: "live" }, scored: true },
    { id: "liquidity", title: "Liquidity", level: "ok", value: "$14.5M", valueLabel: "across 20 DEX pools", meaning: "$14.5M sits in DEX pools.", why: "Thin liquidity makes selling hard.", source: { kind: "live" }, scored: true },
  ],
  score: { concern: "medium", points: 4, scored: 6, total: 7, dangers: 0, concerns: 2, drivers: ["Dilution"], watching: [] },
  verdict: "Test: medium concern. 2 warning signs worth a closer look: dilution and volume sanity.",
  links: [],
  generatedAt: "2026-11-19T00:00:00Z",
  freshness: "live",
} as unknown as Report;

const facts = buildFacts(report, null);

describe("ask Bag: answer checks", () => {
  it("accepts an answer that only uses numbers from the facts", () => {
    expect(checkAnswer("Only 28% of tokens are out, and $14.5M sits in DEX pools. It scored 6 of 7 signals.", facts)).toEqual({ ok: true });
  });
  it("rejects invented numbers", () => {
    const r = checkAnswer("About 40% of tokens unlock next month.", facts);
    expect(r).toMatchObject({ ok: false, reason: "unknown_number", detail: "40%" });
  });
  it.each(["You should sell now before the unlock.", "I'd recommend holding.", "Now is a good time to buy.", "Honestly it's a scam."])("rejects advice: %s", (a) => {
    expect(checkAnswer(a, facts)).toMatchObject({ ok: false, reason: "advice" });
  });
  it("allows talking about selling as a topic", () => {
    expect(checkAnswer("If you want to sell, liquidity matters: $14.5M sits in DEX pools.", facts)).toEqual({ ok: true });
  });
});

describe("ask Bag: fallback answers come from the report", () => {
  it("answers a liquidity question with the liquidity signal", () => {
    expect(fallbackAnswer("Can I still get out?", report, null)).toContain("$14.5M sits in DEX pools.");
  });
  it("answers an unlock question with the dilution signal", () => {
    expect(fallbackAnswer("Are there big unlocks coming?", report, null)).toContain("Only 28% of all tokens exist today.");
  });
  it("says when the promise check hasn't run", () => {
    expect(fallbackAnswer("What did they promise?", report, null)).toMatch(/hasn't run/);
  });
  it("falls back to the verdict", () => {
    expect(fallbackAnswer("Tell me about it", report, null)).toBe(report.verdict);
  });
});
