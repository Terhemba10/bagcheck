import "server-only";
import { getDailyHistory, getKeyInfo, getListings } from "@/lib/cmc/api";
import { dailyCapFor, guardConfig } from "@/lib/cmc/guard";
import type { CoinQuote } from "@/lib/cmc/types";
import { kv } from "@/lib/store/kv";
import { readSummaries } from "./boardSummaries";
import { isMeme, quickVerdict, withFullVerdict, type BoardRow, type RiskBoard } from "./riskBoard";

/**
 * Builds the Risk board, cached 15 min and only when someone opens it.
 * Credits per build: 1 for listings (top 200; the client also caches it 15 min) plus
 * sparklines: one daily-candle call per coin, top 100 only, each cached 24 h, and only
 * while under 60% of the day's credit cap. On a Basic key, only the top 50 get sparklines.
 */
const BOARD_KEY = "riskboard:v2"; // v2: the warning column shows only amber/red warnings
const BOARD_TTL = 900;
const SPARKS_KEY = "board:sparks:v1";
const SPARK_TTL_MS = 24 * 3600 * 1000;
const SPARK_DAYS = 8;

interface SparkRec {
  at: string;
  closes: number[];
}

/** The cached board only (no CMC calls): lets the page render real rows on first paint. */
export async function readCachedBoard(): Promise<RiskBoard | null> {
  return kv().get<RiskBoard>(BOARD_KEY).catch(() => null);
}

export async function buildRiskBoard(): Promise<RiskBoard & { freshness: "live" | "cache" }> {
  const cached = await kv().get<RiskBoard>(BOARD_KEY).catch(() => null);
  if (cached) return { ...cached, freshness: "cache" };

  const listings = (await getListings(200)).value.filter((c) => c.quote?.USD);
  const btc = listings.find((c) => c.id === 1) ?? null;
  const [{ verdicts, promises }, sparks] = await Promise.all([readSummaries(), kv().get<Record<string, SparkRec>>(SPARKS_KEY).catch(() => null)]);
  const sparkMap: Record<string, SparkRec> = sparks ?? {};
  const sparkNote = await refreshSparks(listings, sparkMap);

  const now = new Date();
  const rows: BoardRow[] = listings.map((c) => {
    const usd = c.quote.USD!;
    const { verdict, topSign } = quickVerdict(c, btc, now);
    const p = promises[c.id];
    const row: BoardRow = {
      id: c.id,
      name: c.name,
      symbol: c.symbol,
      rank: c.cmc_rank ?? null,
      price: usd.price ?? null,
      change24h: usd.percent_change_24h ?? null,
      change7d: usd.percent_change_7d ?? null,
      marketCap: usd.market_cap ?? null,
      meme: isMeme((c as { tags?: unknown }).tags),
      spark: sparkMap[c.id]?.closes ?? null,
      verdict,
      topSign,
      promises: p ? { delivered: p.delivered, datePassed: p.datePassed, upcoming: p.upcoming } : null,
    };
    return withFullVerdict(row, verdicts[c.id]);
  });
  const board: RiskBoard = { rows, generatedAt: now.toISOString(), sparkNote };
  await kv().set(BOARD_KEY, board, BOARD_TTL).catch(() => undefined);
  return { ...board, freshness: "live" };
}

/** Fill missing/stale sparklines within the credit budget. Returns a note when some were skipped. */
async function refreshSparks(listings: CoinQuote[], map: Record<string, SparkRec>): Promise<string | null> {
  const info = await getKeyInfo();
  const cap = dailyCapFor(info, guardConfig());
  const usedToday = info?.usage?.current_day?.credits_used ?? 0;
  const basic = (info?.plan?.credit_limit_monthly ?? 0) <= 20_000;
  const top = listings.filter((c) => (c.cmc_rank ?? 1e9) <= (basic ? 50 : 100));
  const stale = top.filter((c) => !map[c.id] || Date.now() - Date.parse(map[c.id]!.at) > SPARK_TTL_MS);
  if (!stale.length) return null;
  if (usedToday >= cap * 0.6) return "Some sparklines are paused to save CoinMarketCap credits today.";

  // budget for this build: stay under 60% of the daily cap
  const allowance = Math.max(0, Math.floor(cap * 0.6 - usedToday));
  const todo = stale.slice(0, allowance);
  const queue = [...todo];
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      try {
        const candles = (await getDailyHistory(c.id, SPARK_DAYS)).value;
        const closes = candles.map((k) => k.close).filter((n) => Number.isFinite(n));
        if (closes.length >= 2) map[c.id] = { at: new Date().toISOString(), closes };
      } catch {
        /* leave it for the next build */
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  await kv().set(SPARKS_KEY, map, 3 * 24 * 3600).catch(() => undefined);
  return todo.length < stale.length ? "Some sparklines are paused to save CoinMarketCap credits today." : null;
}
