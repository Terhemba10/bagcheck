import { NextResponse } from "next/server";
import { getKeyInfo } from "@/lib/cmc/api";
import { planSummary } from "@/lib/cmc/planLabel";
import { LIMITS, rateLimit } from "@/lib/ratelimit";

/** The sidebar's plan + credits pill. /v1/key/info costs 0 credits; cached 5 min at the CDN. */
export async function GET(req: Request) {
  const limited = await rateLimit(req, LIMITS.evidence);
  if (limited) return limited;
  const info = await getKeyInfo();
  const summary = planSummary(info?.plan?.credit_limit_monthly, info?.usage?.current_month?.credits_left);
  return NextResponse.json(summary, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
