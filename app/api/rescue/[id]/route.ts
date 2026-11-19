import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { LIMITS, rateLimit } from "@/lib/ratelimit";
import { buildRescue } from "@/lib/rescue/build";

export const maxDuration = 30;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0 || id > 10_000_000) {
    return NextResponse.json({ error: { kind: "bad_request", message: "That isn't a valid coin id." } }, { status: 400 });
  }
  const limited = await rateLimit(req, LIMITS.report);
  if (limited) return limited;
  try {
    return NextResponse.json(await buildRescue(id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
