import { NextResponse } from "next/server";
import { flattenData, getListings, type Sourced } from "@/lib/cmc/api";
import { cmcRequest } from "@/lib/cmc/client";
import { CmcError } from "@/lib/cmc/errors";
import { CoinQuote } from "@/lib/cmc/types";
import { pickWorthACheck, type WorthACheck } from "@/lib/core/worthACheck";
import { errorResponse } from "@/lib/http";
import { LIMITS, rateLimit } from "@/lib/ratelimit";

/**
 * Home page "coins worth a check".
 *   Startup plan: CMC trending gainers/losers (a "Startup extra")
 *   Basic plan:   top 200 from listings/latest, filtered by our own warning-sign rules
 * Either way the picks and reasons are computed in code (lib/core/worthACheck.ts).
 */
export async function GET(req: Request) {
  const limited = await rateLimit(req, LIMITS.search);
  if (limited) return limited;
  try {
    let source: "trending" | "listings" = "trending";
    let r: Sourced<unknown[]> | null = null;
    try {
      const t = await cmcRequest("trendingGainersLosers", { time_period: "24h", limit: 50, convert: "USD" });
      r = { value: flattenData(t.data), source: t.source, fetchedAt: t.fetchedAt, staleReason: t.staleReason };
    } catch (e) {
      if (!(e instanceof CmcError) || e.kind !== "plan_blocked") throw e;
      source = "listings";
      r = await getListings(200);
    }
    const coins = r.value.map((c) => CoinQuote.safeParse(c)).flatMap((p) => (p.success ? [p.data] : []));
    const picks: WorthACheck[] = pickWorthACheck(coins, 6);
    return NextResponse.json(
      { source, picks, fetchedAt: r.fetchedAt, dataSource: r.source },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
