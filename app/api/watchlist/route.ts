import { NextResponse } from "next/server";
import { z } from "zod";
import { getCoinMap, getKeyInfo } from "@/lib/cmc/api";
import { decideMode } from "@/lib/cmc/budget";
import { errorResponse } from "@/lib/http";
import { getLastRun } from "@/lib/monitor/run";
import { addWatch, alertsForCoins, chatOf, getSnapshots, getWatchlist, MAX_WATCH, removeWatch, watchedCoins } from "@/lib/monitor/store";
import { LIMITS, rateLimit } from "@/lib/ratelimit";
import { ensureUid, readUid } from "@/lib/uid";

export const dynamic = "force-dynamic";

/** Your watchlist with recent snapshots and alerts, plus the monitoring status. 0 CMC credits. */
export async function GET(req: Request) {
  const limited = await rateLimit(req, LIMITS.evidence);
  if (limited) return limited;
  try {
    const uid = await readUid();
    const list = uid ? await getWatchlist(uid) : [];
    const [coins, alerts, lastRun, keyInfo, all, chat] = await Promise.all([
      Promise.all(list.map(async (c) => ({ ...c, snapshots: (await getSnapshots(c.id, 30)).reverse() }))),
      alertsForCoins(list.map((c) => c.id), 30),
      getLastRun(),
      getKeyInfo(),
      watchedCoins(),
      uid ? chatOf(uid) : Promise.resolve(null),
    ]);
    const decision = decideMode(keyInfo, all.length);
    return NextResponse.json(
      {
        coins,
        alerts,
        max: MAX_WATCH,
        telegramLinked: Boolean(chat),
        monitor: {
          mode: decision.mode,
          intervalHours: Number.isFinite(decision.settings.intervalHours) ? decision.settings.intervalHours : null,
          reason: decision.reason,
          lastRunAt: lastRun?.ran ? lastRun.at : null,
          lastRunSummary: lastRun?.reason ?? null,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}

const Body = z.object({ coinId: z.number().int().positive().max(10_000_000) });

export async function POST(req: Request) {
  const limited = await rateLimit(req, LIMITS.search);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { kind: "bad_request", message: "Unknown coin." } }, { status: 400 });
  try {
    const coin = (await getCoinMap()).find((c) => c.id === parsed.data.coinId); // free (map)
    if (!coin) return NextResponse.json({ error: { kind: "not_found", message: "Unknown coin." } }, { status: 404 });
    const uid = await ensureUid();
    const r = await addWatch(uid, { id: coin.id, name: coin.name, symbol: coin.symbol });
    if (!r.ok) return NextResponse.json({ error: { kind: "limit", message: `Your watchlist is full (${MAX_WATCH} coins). Remove one first.` } }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request) {
  const coinId = Number(new URL(req.url).searchParams.get("coinId"));
  const uid = await readUid();
  if (!uid || !Number.isInteger(coinId)) return NextResponse.json({ ok: true });
  await removeWatch(uid, coinId);
  return NextResponse.json({ ok: true });
}
