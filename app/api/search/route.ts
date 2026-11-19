import { NextResponse } from "next/server";
import { searchCoins } from "@/lib/cmc/api";
import { errorResponse } from "@/lib/http";
import { LIMITS, rateLimit } from "@/lib/ratelimit";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1 || q.length > 64) return NextResponse.json({ results: [] });
  const limited = await rateLimit(req, LIMITS.search);
  if (limited) return limited;
  try {
    return NextResponse.json(
      { results: await searchCoins(q) },
      // identical searches are served from the CDN for a minute
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
