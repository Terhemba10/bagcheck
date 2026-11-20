"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { IconTriangle } from "@/components/ui/icons";
import { Disclaimer } from "@/components/ui/Notice";
import { Sparkline } from "@/components/ui/Sparkline";
import { StateView } from "@/components/ui/StateView";
import { StatusPill } from "@/components/ui/StatusPill";
import type { Alert, Snapshot, WatchCoin } from "@/lib/monitor/store";
import { money, pct } from "@/lib/core/format";
import { ConnectTelegram } from "./ConnectTelegram";

interface Payload {
  coins: (WatchCoin & { snapshots: Snapshot[] })[];
  alerts: Alert[];
  max: number;
  telegramLinked: boolean;
  monitor: { mode: string; intervalHours: number | null; reason: string; lastRunAt: string | null; lastRunSummary: string | null };
}

type Load = { s: "loading" } | { s: "ok"; d: Payload } | { s: "error"; rate?: boolean };

async function load(signal?: AbortSignal): Promise<Load | null> {
  try {
    const res = await fetch("/api/watchlist", { signal });
    if (res.status === 429) return { s: "error", rate: true };
    if (!res.ok) return { s: "error" };
    return { s: "ok", d: (await res.json()) as Payload };
  } catch (e) {
    return (e as Error).name === "AbortError" ? null : { s: "error" };
  }
}

const MODE_TEXT: Record<string, string> = {
  full: "Full monitoring",
  lean: "Lean monitoring",
  basic: "Basic-plan monitoring",
  paused: "Monitoring paused to save API credits",
};

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";

export function WatchlistView() {
  const [state, setState] = useState<Load>({ s: "loading" });
  const refresh = useCallback(() => {
    load().then((n) => n && setState(n));
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).then((n) => n && setState(n));
    return () => ctrl.abort();
  }, []);

  async function remove(id: number) {
    await fetch(`/api/watchlist?coinId=${id}`, { method: "DELETE" }).catch(() => null);
    refresh();
  }

  if (state.s === "loading") return <StateView kind="loading" message="Loading your watchlist…" />;
  if (state.s === "error") return state.rate ? <StateView kind="rate-limited" onRetry={refresh} /> : <StateView kind="error" onRetry={refresh} />;
  const d = state.d;
  const m = d.monitor;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your watchlist</h1>
        <p className="text-muted">
          {MODE_TEXT[m.mode] ?? m.mode}
          {m.intervalHours ? `: Covex re-checks your coins about every ${m.intervalHours} hours` : ""}.{" "}
          {m.lastRunAt ? `Last check ${when(m.lastRunAt)}.` : "The first check runs soon."}
        </p>
      </header>

      <GlassCard className="space-y-3">
        <h2 className="text-lg font-semibold">Alerts on Telegram</h2>
        <ConnectTelegram linked={d.telegramLinked} />
      </GlassCard>

      {d.coins.length === 0 ? (
        <StateView kind="empty" title="Nothing watched yet" message="Check a coin and press “Watch this coin”. Covex will re-check it and warn you when something changes." action={<Link href="/#search" className="text-teal hover:underline">Check a coin →</Link>} />
      ) : (
        <section aria-labelledby="coins-title" className="space-y-3">
          <h2 id="coins-title" className="text-xl font-semibold">
            Watching {d.coins.length} of {d.max}
          </h2>
          <ul className="space-y-3">
            {d.coins.map((c) => {
              const last = c.snapshots.at(-1);
              const latestAlert = d.alerts.find((a) => a.coinId === c.id);
              const prices = c.snapshots.map((s) => s.price).filter((p): p is number => typeof p === "number");
              const vols = c.snapshots.map((s) => s.volume24h).filter((p): p is number => typeof p === "number");
              return (
                <GlassCard as="li" key={c.id} className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Link href={`/coin/${c.id}`} className="text-lg font-semibold hover:text-teal">
                      {c.name} <span className="text-sm font-normal text-muted">{c.symbol}</span>
                    </Link>
                    <p className="tabular text-sm text-muted">
                      {last ? `${money(last.price)} · 7d ${pct(last.change7d)} · ${c.snapshots.length} check${c.snapshots.length === 1 ? "" : "s"}` : "Waiting for the first check"}
                    </p>
                    {latestAlert ? (
                      <Link href={`/alerts/${latestAlert.id}`} className="inline-flex items-center gap-1.5 text-sm text-warn hover:underline">
                        <IconTriangle className="size-4" /> {latestAlert.title}
                      </Link>
                    ) : (
                      <StatusPill level={last ? "ok" : "unknown"} label={last ? "No new warning signs" : "Not checked yet"} size="sm" />
                    )}
                  </div>
                  <div className="flex items-center gap-6">
                    <figure className="space-y-1">
                      <Sparkline values={prices} level="watch" label={`Price over the last ${prices.length} checks`} />
                      <figcaption className="text-[11px] text-faint">Price</figcaption>
                    </figure>
                    <figure className="space-y-1">
                      <Sparkline values={vols} level="watch" label={`24h volume over the last ${vols.length} checks`} />
                      <figcaption className="text-[11px] text-faint">Volume</figcaption>
                    </figure>
                    <button type="button" onClick={() => remove(c.id)} className="min-h-11 rounded-md px-3 text-sm text-muted hover:bg-glass hover:text-text">
                      Remove<span className="sr-only"> {c.name}</span>
                    </button>
                  </div>
                </GlassCard>
              );
            })}
          </ul>
        </section>
      )}

      {d.alerts.length > 0 && (
        <section aria-labelledby="alerts-title" className="space-y-3">
          <h2 id="alerts-title" className="text-xl font-semibold">Latest alerts</h2>
          <ul className="space-y-2">
            {d.alerts.map((a) => (
              <li key={a.id}>
                <Link href={`/alerts/${a.id}`} className="glass flex flex-col gap-1 rounded-lg p-4 hover:bg-glass-strong sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex items-center gap-2">
                    <StatusPill level={a.severity} size="sm" />
                    <span className="font-medium">{a.coinSymbol}</span>
                    <span className="text-sm">{a.title}</span>
                  </span>
                  <span className="text-xs text-faint">{when(a.at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Disclaimer />
    </div>
  );
}
