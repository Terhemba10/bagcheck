import { NextResponse } from "next/server";
import { errorResponse, isAuthorized } from "@/lib/http";
import { runMonitor } from "@/lib/monitor/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduler entry point. Protected by CRON_SECRET (Bearer).
 *  - GitHub Actions calls it hourly (POST)
 *  - Vercel Cron calls it daily as a backup (GET, sends the same Bearer header)
 * The credit governor decides whether a run is actually due.
 * `?force=1` runs even if not due (still respects the governor's limits).
 */
async function handle(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const force = new URL(req.url).searchParams.get("force") === "1";
  try {
    const r = await runMonitor({ force });
    return NextResponse.json({
      ran: r.ran,
      reason: r.reason,
      mode: r.decision.mode,
      coins: r.coins,
      deep: r.deep,
      alerts: r.alerts,
      messages: r.messages,
      at: r.at,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export const GET = handle;
export const POST = handle;
