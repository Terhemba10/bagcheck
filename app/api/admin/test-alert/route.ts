import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { money } from "@/lib/core/format";
import { isAuthorized } from "@/lib/http";
import { chatForUid, getSnapshots, getWatchlist, saveAlert, watchersOf, type Alert } from "@/lib/monitor/store";
import { formatAlert, sendMessage } from "@/lib/telegram/api";

export const dynamic = "force-dynamic";

/**
 * Sends a clearly labelled TEST alert for a watched coin to its linked
 * Telegram watchers, and saves it so the alert page can be checked.
 * Protected by CRON_SECRET. For demos and end-to-end checks only.
 *   POST /api/admin/test-alert?coinId=24478
 */
export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const coinId = Number(new URL(req.url).searchParams.get("coinId"));
  const watchers = await watchersOf(coinId);
  if (!watchers.length) return NextResponse.json({ error: "Nobody watches this coin" }, { status: 404 });
  const snaps = await getSnapshots(coinId, 2);
  const coin = (await getWatchlist(watchers[0]!)).find((c) => c.id === coinId);
  const s = snaps[0];
  const alert: Alert = {
    id: `${coinId}-test-${randomBytes(4).toString("hex")}`,
    coinId,
    coinName: coin?.name ?? `Coin ${coinId}`,
    coinSymbol: coin?.symbol ?? "",
    rule: "volume_falling",
    severity: "concern",
    title: "[Test] This is what an alert looks like",
    before: snaps[1] ? money(snaps[1].volume24h) : "—",
    after: s ? money(s.volume24h) : "—",
    meaning: "This is a test message from Bagcheck to check that alerts reach you. Nothing has happened to this coin; the numbers are its latest real 24h volume.",
    next: ["No action needed. Real alerts look like this, with the evidence linked below."],
    metric: "volume24h",
    at: new Date().toISOString(),
  };
  await saveAlert(alert);
  let sent = 0;
  for (const uid of watchers) {
    const chat = await chatForUid(uid);
    if (chat && (await sendMessage(chat, formatAlert(alert))).ok) sent++;
  }
  return NextResponse.json({ ok: true, alertId: alert.id, sent });
}
