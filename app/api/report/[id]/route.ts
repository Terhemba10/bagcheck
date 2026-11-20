import { NextResponse } from "next/server";
import { CmcError } from "@/lib/cmc/errors";
import { buildReport } from "@/lib/core/report";
import type { StepEvent } from "@/lib/core/steps";
import { errorResponse } from "@/lib/http";
import { LIMITS, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 30;

/**
 * GET /api/report/:id         → the report as JSON (used by the MCP server and the bot)
 * GET /api/report/:id?stream=1 → NDJSON: one {"type":"step",…} line per real step as it
 *   happens, then {"type":"report","report":…} or {"type":"error","error":…}. Drives the
 *   agent activity panel. Same cache, rate limits and credit guard either way.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0 || id > 10_000_000) {
    return NextResponse.json({ error: { kind: "bad_request", message: "That isn't a valid coin id." } }, { status: 400 });
  }
  const limited = await rateLimit(req, LIMITS.report);
  if (limited) return limited;

  if (new URL(req.url).searchParams.get("stream") !== "1") {
    try {
      const report = await buildReport(id);
      return NextResponse.json(report, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } });
    } catch (err) {
      return errorResponse(err);
    }
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // if the visitor leaves mid-report the stream closes: keep building (so the report is cached), just stop sending
      let open = true;
      const send = (obj: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
        } catch {
          open = false;
        }
      };
      try {
        const report = await buildReport(id, { onStep: (e: StepEvent) => send(e) });
        send({ type: "report", report });
      } catch (err) {
        if (err instanceof CmcError) {
          const status = err.kind === "rate_limited" ? 429 : err.kind === "plan_blocked" ? 403 : err.kind === "not_found" ? 404 : 502;
          send({ type: "error", error: { kind: err.kind, status, message: err.userMessage } });
        } else {
          console.error("[api] report stream error", err);
          send({ type: "error", error: { kind: "internal", status: 500, message: "Something went wrong on our side." } });
        }
      } finally {
        if (open) controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
