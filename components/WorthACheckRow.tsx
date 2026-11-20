"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import type { WorthACheck } from "@/lib/core/worthACheck";
import { IconTriangle } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/Skeleton";

interface Payload {
  source: "trending" | "listings";
  picks: WorthACheck[];
  fetchedAt: string;
  dataSource: "live" | "cache" | "stale";
}

/**
 * "Coins worth a check": top-200 coins with a warning sign worth a look.
 * Startup key: CMC trending. Basic key: our own warning-sign rules over
 * listings/latest. Labelled honestly either way.
 */
export function WorthACheckRow({ className }: { className?: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/worth-a-check", { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Payload>) : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setFailed(true);
      });
    return () => ctrl.abort();
  }, []);

  // Quietly hide on failure: this row is a bonus, not the main task.
  if (failed || (data && data.picks.length === 0)) return null;

  return (
    <section aria-labelledby="worth-title" className={cn("w-full space-y-3", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="worth-title" className="text-sm font-semibold tracking-wide text-muted uppercase">
          Coins worth a check
        </h2>
        {data && (
          <p className="text-xs text-faint">
            {data.source === "trending" ? "From CMC trending" : "Top 200 by market cap, filtered by our warning-sign rules"}
          </p>
        )}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {!data &&
          Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="glass rounded-lg p-3" aria-hidden="true">
              <Skeleton className="mb-2 h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </li>
          ))}
        {data?.picks.map((c) => (
          <li key={c.id}>
            <Link
              href={`/coin/${c.id}`}
              className="glass flex min-h-16 flex-col gap-1 rounded-lg p-3 transition-colors hover:bg-glass-strong"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate font-medium">
                  {c.name} <span className="text-sm text-muted">{c.symbol}</span>
                </span>
                {typeof c.change24h === "number" && (
                  <span className={cn("tabular shrink-0 text-sm whitespace-nowrap", c.change24h >= 0 ? "text-ok" : "text-danger")}>
                    {c.change24h >= 0 ? "▲" : "▼"} {Math.abs(c.change24h).toFixed(1)}%
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-warn">
                <IconTriangle className="size-3.5 shrink-0" />
                {c.reasons.map((r) => r.text).join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-faint">Warning signs, not verdicts. Open a coin to see the evidence.</p>
    </section>
  );
}
