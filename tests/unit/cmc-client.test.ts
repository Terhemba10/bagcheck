import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setKV, memoryKV } from "@/lib/store/kv";
import { __resetClientState, cmcRequest } from "@/lib/cmc/client";
import { getCapability } from "@/lib/cmc/capabilities";
import { listEvidence } from "@/lib/cmc/evidence";
import { CmcError } from "@/lib/cmc/errors";
import { rankMatches, flattenData, looksLikeContract } from "@/lib/cmc/api";

const KEY = "test-key-should-never-appear-123";
const noSleep = async () => {};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const ok = (data: unknown, credit = 1) =>
  jsonResponse(200, { status: { error_code: 0, error_message: null, credit_count: credit, elapsed: 7, timestamp: "2026-11-19T10:00:00Z" }, data });

beforeEach(() => {
  __setKV(memoryKV());
  __resetClientState();
  vi.stubEnv("CMC_API_KEY", KEY);
  vi.stubEnv("CMC_FORCE_PLAN", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("cmcRequest", () => {
  it("sends the key as a header, caches, and records evidence without the key", async () => {
    const fetchImpl = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)["X-CMC_PRO_API_KEY"]).toBe(KEY);
      return ok({ btc_dominance: 55 });
    });
    const a = await cmcRequest("globalMetrics", { convert: "USD" }, { fetchImpl: fetchImpl as typeof fetch });
    const b = await cmcRequest("globalMetrics", { convert: "USD" }, { fetchImpl: fetchImpl as typeof fetch });
    expect(a.source).toBe("live");
    expect(b.source).toBe("cache");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const ev = await listEvidence();
    expect(ev).toHaveLength(1);
    expect(ev[0]?.creditCount).toBe(1);
    expect(JSON.stringify(ev)).not.toContain(KEY);
    expect(String(fetchImpl.mock.calls[0]?.[0])).not.toContain(KEY);
  });

  it("marks an endpoint plan_blocked on 1006 and stops calling it", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(403, { status: { error_code: 1006, error_message: "plan" } }));
    await expect(cmcRequest("trendingGainersLosers", {}, { fetchImpl: fetchImpl as typeof fetch })).rejects.toMatchObject({ kind: "plan_blocked" });
    expect((await getCapability("trendingGainersLosers")).state).toBe("plan_blocked");
    await expect(cmcRequest("trendingGainersLosers", {}, { fetchImpl: fetchImpl as typeof fetch, fresh: true })).rejects.toBeInstanceOf(CmcError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("serves the last good copy when CMC later refuses", async () => {
    let call = 0;
    const fetchImpl = vi.fn(async () => (call++ === 0 ? ok({ v: 1 }) : jsonResponse(429, { status: { error_code: 1009, error_message: "daily" } })));
    await cmcRequest("globalMetrics", {}, { fetchImpl: fetchImpl as typeof fetch });
    const r = await cmcRequest("globalMetrics", {}, { fetchImpl: fetchImpl as typeof fetch, fresh: true, sleep: noSleep });
    expect(r.source).toBe("stale");
    expect(r.staleReason).toBe("credits_exhausted");
    expect(r.data).toEqual({ v: 1 });
  });

  it("retries 5xx then succeeds", async () => {
    let call = 0;
    const fetchImpl = vi.fn(async () => (call++ < 2 ? jsonResponse(502, {}) : ok({ v: 2 })));
    const r = await cmcRequest("globalMetrics", {}, { fetchImpl: fetchImpl as typeof fetch, sleep: noSleep });
    expect(r.data).toEqual({ v: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("retries a per-minute rate limit once, then gives a friendly error", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(429, { status: { error_code: 1008, error_message: "minute" } }));
    const err = await cmcRequest("globalMetrics", {}, { fetchImpl: fetchImpl as typeof fetch, sleep: noSleep }).catch((e) => e);
    expect(err).toBeInstanceOf(CmcError);
    expect(err.kind).toBe("rate_limited");
    expect(err.userMessage).toMatch(/try again/i);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("CMC_FORCE_PLAN=basic blocks Startup-only endpoints without calling CMC", async () => {
    vi.stubEnv("CMC_FORCE_PLAN", "basic");
    const fetchImpl = vi.fn(async () => ok({}));
    await expect(cmcRequest("trendingMostVisited", {}, { fetchImpl: fetchImpl as typeof fetch })).rejects.toMatchObject({ kind: "plan_blocked" });
    await cmcRequest("globalMetrics", {}, { fetchImpl: fetchImpl as typeof fetch });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fails clearly when no key is configured", async () => {
    vi.stubEnv("CMC_API_KEY", "");
    await expect(cmcRequest("globalMetrics", {})).rejects.toMatchObject({ kind: "auth" });
  });
});

describe("search helpers", () => {
  const coins = [
    { id: 1, name: "Bitcoin", symbol: "BTC", slug: "bitcoin", rank: 1 },
    { id: 2, name: "Bitcoin Cash", symbol: "BCH", slug: "bitcoin-cash", rank: 15 },
    { id: 3, name: "Fake BTC", symbol: "BTC", slug: "fake-btc", rank: 4000 },
    { id: 4, name: "Pepe", symbol: "PEPE", slug: "pepe", rank: 30 },
  ];

  it("ranks exact symbol matches by CMC rank", () => {
    expect(rankMatches(coins, "btc").map((c) => c.id)).toEqual([1, 3]);
  });
  it("matches name prefixes", () => {
    expect(rankMatches(coins, "bitc").map((c) => c.id)).toEqual([1, 2]);
  });
  it("detects contract addresses", () => {
    expect(looksLikeContract("0x6982508145454Ce325dDbE47a25d4ec3d2311933")).toBe(true);
    expect(looksLikeContract("pepe")).toBe(false);
  });
  it("flattens array, keyed and keyed-array data shapes", () => {
    expect(flattenData([{ id: 1 }])).toEqual([{ id: 1 }]);
    expect(flattenData({ "1": { id: 1 } })).toEqual([{ id: 1 }]);
    expect(flattenData({ BTC: [{ id: 1 }, { id: 3 }] })).toEqual([{ id: 1 }, { id: 3 }]);
  });
});
