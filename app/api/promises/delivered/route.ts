import { NextResponse } from "next/server";
import { z } from "zod";
import { setDelivered } from "@/lib/monitor/store";
import { LIMITS, rateLimit } from "@/lib/ratelimit";
import { ensureUid } from "@/lib/uid";

export const dynamic = "force-dynamic";

const Body = z.object({ coinId: z.number().int().positive(), quoteKey: z.string().regex(/^[a-f0-9]{16}$/), delivered: z.boolean() });

/** "Mark as delivered": your own note, so Bagcheck stops reminding you about that promise. */
export async function POST(req: Request) {
  const limited = await rateLimit(req, LIMITS.search);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { kind: "bad_request" } }, { status: 400 });
  const uid = await ensureUid();
  await setDelivered(uid, parsed.data.coinId, parsed.data.quoteKey, parsed.data.delivered);
  return NextResponse.json({ ok: true });
}
