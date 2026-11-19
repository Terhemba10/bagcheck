import { NextResponse } from "next/server";
import { LlmError } from "@/lib/llm";
import { runPromiseCheck } from "@/lib/promises/check";
import { errorResponse } from "@/lib/http";
import { LIMITS, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0 || id > 10_000_000) {
    return NextResponse.json({ error: { kind: "bad_request", message: "That isn't a valid coin id." } }, { status: 400 });
  }
  const limited = await rateLimit(req, LIMITS.promises);
  if (limited) return limited;
  try {
    const result = await runPromiseCheck(id);
    return NextResponse.json(result, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
  } catch (err) {
    if (err instanceof LlmError) {
      const status = err.kind === "rate_limited" ? 429 : err.kind === "not_configured" ? 503 : 502;
      return NextResponse.json({ error: { kind: `llm_${err.kind}`, message: err.userMessage } }, { status, headers: status === 429 ? { "Retry-After": "60" } : undefined });
    }
    return errorResponse(err);
  }
}
