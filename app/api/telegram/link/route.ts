import { NextResponse } from "next/server";
import { createLinkCode } from "@/lib/monitor/store";
import { LIMITS, rateLimit } from "@/lib/ratelimit";
import { BOT_USERNAME } from "@/lib/telegram/api";
import { ensureUid } from "@/lib/uid";

export const dynamic = "force-dynamic";

/** One-time (15 min) deep link that connects this browser's watchlist to a Telegram chat. */
export async function POST(req: Request) {
  const limited = await rateLimit(req, LIMITS.evidence);
  if (limited) return limited;
  const uid = await ensureUid();
  const code = await createLinkCode(uid);
  return NextResponse.json({ url: `https://t.me/${BOT_USERNAME}?start=${code}`, bot: BOT_USERNAME, expiresInMinutes: 15 }, { headers: { "Cache-Control": "no-store" } });
}
