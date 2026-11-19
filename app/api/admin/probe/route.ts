import { NextResponse } from "next/server";
import {
  getDailyHistory,
  getDexLiquidityHistory,
  getDexPools,
  getDexSecurity,
  getGlobalMetrics,
  getInfo,
  getMarketPairs,
  getPricePerformance,
  getQuotes,
  getTrending,
  searchCoins,
} from "@/lib/cmc/api";
import { CmcError } from "@/lib/cmc/errors";
import { isAuthorized } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Calls every endpoint once for a coin so we can see real responses, check
 * plan access and fill the evidence log. Protected by CRON_SECRET.
 *
 *   POST /api/admin/probe?q=pepe
 */
export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") ?? "bitcoin";

  const results: Record<string, unknown> = {};
  const run = async (name: string, fn: () => Promise<unknown>) => {
    try {
      const r = await fn();
      results[name] = { ok: true, sample: summarize(r) };
      return r;
    } catch (e) {
      results[name] = { ok: false, error: e instanceof CmcError ? { kind: e.kind, code: e.code, message: e.message } : String(e) };
      return null;
    }
  };

  const matches = (await run("map (search)", () => searchCoins(q))) as Awaited<ReturnType<typeof searchCoins>> | null;
  const coin = matches?.[0];
  if (!coin) return NextResponse.json({ q, results });

  const info = (await run("info", () => getInfo([coin.id]))) as Awaited<ReturnType<typeof getInfo>> | null;
  await run("quotes", () => getQuotes([coin.id, 1]));
  await run("marketPairs", () => getMarketPairs(coin.id, 20));
  await run("globalMetrics", () => getGlobalMetrics());
  await run("pricePerformance", () => getPricePerformance([coin.id]));
  await run("ohlcvHistorical", () => getDailyHistory(coin.id, 30));
  await run("trending", () => getTrending());

  const meta = info?.value[coin.id];
  const contract = meta?.contract_address?.[0];
  if (contract) {
    const platform = (contract.platform?.name ?? "").toLowerCase();
    results.dexInput = { platform, address: contract.contract_address };
    await run("dexSecurity", () => getDexSecurity(platform, contract.contract_address));
    await run("dexPools", () => getDexPools(platform, contract.contract_address));
    await run("dexLiquidity", () => getDexLiquidityHistory(platform, contract.contract_address));
  }

  return NextResponse.json({ q, coin, results });
}

function summarize(r: unknown): unknown {
  const s = JSON.stringify(r);
  return s.length > 1500 ? `${s.slice(0, 1500)}…` : r;
}
