"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { PromiseItem } from "@/components/ui/PromiseItem";
import { Skeleton } from "@/components/ui/Skeleton";
import { IconInfo } from "@/components/ui/icons";
import type { PromiseCheck } from "@/lib/promises/check";

type Load = { s: "loading" } | { s: "ok"; data: PromiseCheck } | { s: "error"; message: string };

async function loadPromises(id: number, signal?: AbortSignal): Promise<Load | null> {
  try {
    const res = await fetch(`/api/promises/${id}`, { signal });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { s: "error", message: body?.error?.message ?? "The promise check isn't available right now." };
    return { s: "ok", data: body as PromiseCheck };
  } catch (e) {
    return (e as Error).name === "AbortError" ? null : { s: "error", message: "The promise check isn't available right now." };
  }
}

/** "Promise check": what the founders promised and by when, read from their own pages. */
export function PromiseTimeline({ id, onLoaded }: { id: number; onLoaded?: (d: PromiseCheck) => void }) {
  const [load, setLoad] = useState<Load>({ s: "loading" });

  useEffect(() => {
    const ctrl = new AbortController();
    loadPromises(id, ctrl.signal).then((next) => {
      if (!next) return;
      setLoad(next);
      if (next.s === "ok") onLoaded?.(next.data);
    });
    return () => ctrl.abort();
  }, [id, onLoaded]);

  return (
    <section aria-labelledby="promises-title" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="promises-title" className="text-xl font-semibold">Promise check</h2>
        {load.s === "ok" && load.data.promises.length > 0 && <Summary d={load.data} />}
      </div>
      <p className="text-sm text-muted">What the project says it will deliver, and by when, read from its own website and docs.</p>

      <GlassCard aria-busy={load.s === "loading"} aria-live="polite">
        {load.s === "loading" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Bag is reading the roadmap…</p>
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {load.s === "error" && <p className="text-sm text-muted">{load.message}</p>}

        {load.s === "ok" && load.data.promises.length > 0 && (
          <ol>
            {load.data.promises.map((p, i) => (
              <PromiseItem key={i} promise={p.promise} dueDate={p.dueDate} quote={p.quote} sourceUrl={p.sourceUrl} status={p.status} />
            ))}
          </ol>
        )}

        {load.s === "ok" && load.data.promises.length === 0 && (
          <p className="text-sm">{load.data.emptyReason ?? "No specific commitments found."}</p>
        )}

        {load.s === "ok" && <PagesRead d={load.data} />}
      </GlassCard>

      <p className="flex items-start gap-2 text-xs text-faint">
        <IconInfo className="mt-0.5 size-3.5 shrink-0" />
        Read by AI from the project&apos;s own pages. Every quote was checked word-for-word against the page it links to; items that
        didn&apos;t match were dropped. Dates and statuses are worked out by Bagcheck, and &ldquo;date passed&rdquo; doesn&apos;t mean it wasn&apos;t
        delivered: check the source.
      </p>
    </section>
  );
}

function Summary({ d }: { d: PromiseCheck }) {
  const passed = d.promises.filter((p) => p.status === "overdue").length;
  const soon = d.promises.filter((p) => p.status === "due-soon").length;
  const parts = [`${d.promises.length} found`];
  if (passed) parts.push(`${passed} with dates passed`);
  if (soon) parts.push(`${soon} due soon`);
  return <p className="tabular min-w-0 basis-full text-sm text-muted sm:basis-auto">{parts.join(" · ")}</p>;
}

function PagesRead({ d }: { d: PromiseCheck }) {
  if (!d.pages.length) return null;
  return (
    <details className="mt-4 border-t border-line pt-3 text-sm text-muted">
      <summary className="cursor-pointer select-none">
        Pages Bag read ({d.pages.filter((p) => p.ok).length} of {d.pages.length})
        {d.dropped > 0 && ` · ${d.dropped} AI item${d.dropped === 1 ? "" : "s"} dropped (quote not found on the page)`}
      </summary>
      <ul className="mt-2 space-y-1">
        {d.pages.map((p, i) => (
          <li key={i} className="flex flex-wrap gap-x-2 break-all">
            <span className={p.ok ? "text-ok" : "text-warn"}>{p.ok ? "✓" : "✗"}</span>
            <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-text">
              {p.url.replace(/^https?:\/\//, "")}
            </a>
            {p.note && <span className="text-faint">({p.note})</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}
