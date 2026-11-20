"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Reveal, RevealItem } from "@/components/motion/Reveal";
import { Disclaimer } from "@/components/ui/Notice";
import { StateView } from "@/components/ui/StateView";
import { StatusPill } from "@/components/ui/StatusPill";
import { ButtonLink } from "@/components/ui/Button";
import type { Alert } from "@/lib/monitor/store";

type Load = { s: "loading" } | { s: "ok"; alerts: Alert[]; coins: number; telegram: boolean } | { s: "error"; rate?: boolean };

/** Alerts for the coins on your watchlist (same data as the watchlist page; 0 CMC credits). */
export function AlertsView() {
  const [load, setLoad] = useState<Load>({ s: "loading" });
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/watchlist", { signal: ctrl.signal })
      .then(async (res) => {
        if (res.status === 429) return setLoad({ s: "error", rate: true });
        if (!res.ok) return setLoad({ s: "error" });
        const d = (await res.json()) as { alerts: Alert[]; coins: unknown[]; telegramLinked: boolean };
        setLoad({ s: "ok", alerts: d.alerts, coins: d.coins.length, telegram: d.telegramLinked });
      })
      .catch((e: Error) => e.name !== "AbortError" && setLoad({ s: "error" }));
    return () => ctrl.abort();
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Alerts</h1>
        <p className="text-muted">
          Warning signs Covex found on the coins you watch: falling volume, fewer markets, draining liquidity, a supply jump, the website going down, or a
          promise date passing.
        </p>
      </header>

      {load.s === "loading" && <StateView kind="loading" message="Reading your alerts…" />}
      {load.s === "error" && <StateView kind={load.rate ? "rate-limited" : "error"} />}
      {load.s === "ok" && load.alerts.length === 0 && (
        <StateView
          kind="empty"
          title={load.coins ? "No alerts yet" : "You're not watching any coins"}
          message={
            load.coins
              ? `Covex re-checks your ${load.coins} coin${load.coins === 1 ? "" : "s"} on a schedule and lists any warning sign here${load.telegram ? " and on Telegram" : ""}.`
              : "Open a coin's report and press Watch. Alerts for it will appear here."
          }
          action={<ButtonLink href={load.coins ? "/watchlist" : "/"} variant="secondary">{load.coins ? "Open watchlist" : "Check a coin"}</ButtonLink>}
        />
      )}
      {load.s === "ok" && load.alerts.length > 0 && (
        <Reveal as="ul" className="space-y-2">
          {load.alerts.map((a) => (
            <RevealItem as="li" key={a.id}>
              <Link href={`/alerts/${a.id}`} className="glass light-edge flex flex-col gap-1 rounded-lg p-4 hover:border-line-strong sm:flex-row sm:items-center sm:justify-between">
                <span className="flex flex-wrap items-center gap-2">
                  <StatusPill level={a.severity} size="sm" />
                  <span className="font-medium">{a.coinName}</span>
                  <span className="text-sm text-muted">{a.title}</span>
                </span>
                <time className="text-xs text-faint" dateTime={a.at}>
                  {new Date(a.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC
                </time>
              </Link>
            </RevealItem>
          ))}
        </Reveal>
      )}
      <Disclaimer />
    </div>
  );
}
