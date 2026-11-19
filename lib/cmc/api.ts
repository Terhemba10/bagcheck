import "server-only";
import { z } from "zod";
import { kv } from "@/lib/store/kv";
import { cmcRequest, type CmcResult } from "./client";
import { CmcError } from "./errors";
import type { KeyInfo } from "./budget";
import { CoinInfo, CoinQuote, GlobalMetrics, MapEntry, MarketPairs } from "./types";

/**
 * Typed wrappers around cmcRequest. Each returns `Sourced<T>` so the UI can
 * say "live", "cached 2 min ago" or "saved copy from <date>".
 */
export interface Sourced<T> {
  value: T;
  source: CmcResult<unknown>["source"];
  fetchedAt: string;
  staleReason?: CmcResult<unknown>["staleReason"];
}

function sourced<T>(r: CmcResult<unknown>, value: T): Sourced<T> {
  return { value, source: r.source, fetchedAt: r.fetchedAt, staleReason: r.staleReason };
}

/** Validate each item separately so one odd coin doesn't sink the whole response. */
function parseEach<S extends z.ZodTypeAny>(schema: S, items: unknown[], label: string): z.infer<S>[] {
  const out: z.infer<S>[] = [];
  for (const item of items) {
    const r = schema.safeParse(item);
    if (r.success) out.push(r.data);
    else console.warn(`[cmc] dropped invalid ${label}`, r.error.issues.slice(0, 3));
  }
  return out;
}

/** CMC returns data as an array, an object keyed by id, or an object of arrays. Flatten all of them. */
export function flattenData(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object")
    return Object.values(data as Record<string, unknown>).flatMap((v) => (Array.isArray(v) ? v : [v]));
  return [];
}

// ─── Search (map) ────────────────────────────────────────────────────────────

export interface CoinRef {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  rank: number | null;
}

const MAP_COMPACT_KEY = "cmc:map:compact";
let mapMemory: { at: number; coins: CoinRef[] } | null = null;

/** The full active id map, cached compactly (the raw map is several MB). Costs 0 credits. */
export async function getCoinMap(): Promise<CoinRef[]> {
  if (mapMemory && Date.now() - mapMemory.at < 6 * 3600_000) return mapMemory.coins;
  const cached = await kv().get<CoinRef[]>(MAP_COMPACT_KEY).catch(() => null);
  if (cached?.length) {
    mapMemory = { at: Date.now(), coins: cached };
    return cached;
  }
  const r = await cmcRequest("map", { listing_status: "active", aux: "is_active" }, { sharedCache: false });
  const coins: CoinRef[] = parseEach(MapEntry, flattenData(r.data), "map entry").map((c) => ({
    id: c.id,
    name: c.name,
    symbol: c.symbol,
    slug: c.slug,
    rank: c.rank ?? null,
  }));
  mapMemory = { at: Date.now(), coins };
  await kv().set(MAP_COMPACT_KEY, coins, 24 * 3600).catch(() => undefined);
  return coins;
}

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function looksLikeContract(q: string): boolean {
  return EVM_ADDRESS.test(q) || BASE58_ADDRESS.test(q);
}

/** Rank map entries against a query. Pure, unit-tested. */
export function rankMatches(coins: CoinRef[], query: string, limit = 8): CoinRef[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { c: CoinRef; s: number }[] = [];
  for (const c of coins) {
    const sym = c.symbol.toLowerCase();
    const name = c.name.toLowerCase();
    let s = 0;
    // Exact slug/name beats exact symbol: "bitcoin" must find Bitcoin, not a token whose ticker is BITCOIN.
    if (c.slug === q || name === q) s = 100;
    else if (sym === q) s = 90;
    else if (name.startsWith(q)) s = 60;
    else if (sym.startsWith(q)) s = 50;
    else if (name.includes(q)) s = 30;
    if (s) scored.push({ c, s });
  }
  const rankOf = (c: CoinRef) => c.rank ?? 1e9;
  scored.sort((a, b) => b.s - a.s || rankOf(a.c) - rankOf(b.c));
  return scored.slice(0, limit).map((x) => x.c);
}

export async function searchCoins(query: string): Promise<CoinRef[]> {
  const q = query.trim();
  if (looksLikeContract(q)) {
    try {
      const r = await cmcRequest("info", { address: q, skip_invalid: true });
      return parseEach(CoinInfo, flattenData(r.data), "info").map((c) => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol,
        slug: c.slug,
        rank: null,
      }));
    } catch (e) {
      if (e instanceof CmcError && (e.kind === "bad_request" || e.kind === "not_found")) return [];
      throw e;
    }
  }
  return rankMatches(await getCoinMap(), q);
}

// ─── Metadata, quotes, pairs, market ─────────────────────────────────────────

export async function getInfo(ids: number[]): Promise<Sourced<Record<number, CoinInfo>>> {
  const r = await cmcRequest("info", { id: [...ids].sort((a, b) => a - b).join(","), skip_invalid: true });
  const list = parseEach(CoinInfo, flattenData(r.data), "info");
  return sourced(r, Object.fromEntries(list.map((c) => [c.id, c])));
}

/** v3 first (current docs), v2 as fallback. Batches up to 100 ids per call. */
export async function getQuotes(ids: number[]): Promise<Sourced<Record<number, CoinQuote>>> {
  const idParam = [...new Set(ids)].sort((a, b) => a - b).join(",");
  let r: CmcResult<unknown>;
  try {
    r = await cmcRequest("quotesV3", { id: idParam, convert: "USD" });
  } catch (e) {
    if (!(e instanceof CmcError) || !["bad_request", "not_found", "plan_blocked"].includes(e.kind)) throw e;
    r = await cmcRequest("quotesV2", { id: idParam, convert: "USD", skip_invalid: true });
  }
  const list = parseEach(CoinQuote, flattenData(r.data), "quote");
  return sourced(r, Object.fromEntries(list.map((c) => [c.id, c])));
}

export async function getMarketPairs(id: number, limit = 100): Promise<Sourced<MarketPairs>> {
  const r = await cmcRequest("marketPairs", {
    id,
    limit,
    category: "spot",
    sort: "cmc_rank_advanced",
    aux: "effective_liquidity,market_score,market_reputation,num_market_pairs,market_url",
    convert: "USD",
  });
  return sourced(r, MarketPairs.parse(r.data));
}

export async function getGlobalMetrics(): Promise<Sourced<GlobalMetrics>> {
  const r = await cmcRequest("globalMetrics", { convert: "USD" });
  return sourced(r, GlobalMetrics.parse(r.data));
}

export async function getPricePerformance(ids: number[]): Promise<Sourced<unknown[]>> {
  const r = await cmcRequest("pricePerformance", {
    id: [...ids].sort((a, b) => a - b).join(","),
    time_period: "24h,7d,30d,90d,all_time",
    convert: "USD",
  });
  return sourced(r, flattenData(r.data));
}

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  marketCap: number;
  timeOpen: string;
  timeClose: string;
}

/** v5 returns each candle as a 10-value array. Pure, unit-tested. */
export function parseCandles(data: unknown): Candle[] {
  if (!Array.isArray(data)) return [];
  const out: Candle[] = [];
  for (const row of data) {
    if (!Array.isArray(row) || row.length < 10) continue;
    const [open, high, low, close, volume, marketCap, timeOpen, , , timeClose] = row;
    if ([open, high, low, close].some((v) => typeof v !== "number")) continue;
    out.push({
      open, high, low, close,
      volume: Number(volume) || 0,
      marketCap: Number(marketCap) || 0,
      timeOpen: String(timeOpen),
      timeClose: String(timeClose),
    });
  }
  return out;
}

/** Daily candles. Note: v5 rejects `convert` (USD only). */
export async function getDailyHistory(id: number, days = 90): Promise<Sourced<Candle[]>> {
  const r = await cmcRequest("ohlcvHistorical", { id, interval: "1d", count: days });
  return sourced(r, parseCandles(r.data));
}

export async function getTrending(): Promise<Sourced<unknown[]>> {
  const r = await cmcRequest("trendingGainersLosers", { time_period: "24h", limit: 20, convert: "USD" });
  return sourced(r, flattenData(r.data));
}

/** Top coins by market cap with quotes (1 credit per 250). Used for "worth a check" on Basic. */
export async function getListings(limit = 200): Promise<Sourced<CoinQuote[]>> {
  const r = await cmcRequest("listings", { start: 1, limit, convert: "USD" });
  return sourced(r, parseEach(CoinQuote, flattenData(r.data), "listing"));
}

// ─── DEX (contract tokens) ───────────────────────────────────────────────────

export async function getDexSecurity(platformName: string, address: string): Promise<Sourced<unknown>> {
  const r = await cmcRequest("dexSecurity", { platformName, address });
  return sourced(r, r.data);
}

export async function getDexPools(platform: string, address: string): Promise<Sourced<unknown>> {
  const r = await cmcRequest("dexPools", { platform, address, size: 20 });
  return sourced(r, r.data);
}

export async function getDexLiquidityHistory(platform: string, address: string): Promise<Sourced<unknown>> {
  const r = await cmcRequest("dexLiquidity", { platform, address, interval: "1d", limit: 30 });
  return sourced(r, r.data);
}

// ─── Key info (credit governor) ──────────────────────────────────────────────

export async function getKeyInfo(): Promise<KeyInfo | null> {
  try {
    const r = await cmcRequest<KeyInfo>("keyInfo", {}, { fresh: true });
    return r.data;
  } catch (e) {
    console.warn("[cmc] key info unavailable", e instanceof Error ? e.message : e);
    return null;
  }
}
