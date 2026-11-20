import { NextResponse } from "next/server";
import { buildRiskBoard } from "@/lib/core/riskBoardBuild";
import { errorResponse } from "@/lib/http";
import { LIMITS, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

/** The Risk board: top 200 by market cap with quick checks (cached 15 min; see riskBoardBuild). */
export async function GET(req: Request) {
  const limited = await rateLimit(req, LIMITS.evidence);
  if (limited) return limited;
  try {
    const board = await buildRiskBoard();
    return NextResponse.json(board, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (err) {
    return errorResponse(err);
  }
}
