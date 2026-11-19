"use client";

import { useEffect, useState } from "react";
import { Agent } from "@/components/agent/Agent";
import type { AgentState } from "@/components/agent/states";
import { Button } from "@/components/ui/Button";
import { IconBell, IconExternal } from "@/components/ui/icons";
import { Disclaimer } from "@/components/ui/Notice";
import { SignalCard } from "@/components/ui/SignalCard";
import { SourceTag } from "@/components/ui/SourceTag";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { StateView } from "@/components/ui/StateView";
import { ScoreBadge } from "@/components/ui/StatusPill";
import type { Report } from "@/lib/core/report";
import { money, pct } from "@/lib/core/format";
import { cn } from "@/lib/cn";
import { ContractDetails, LinksList, PoolsTable } from "./ReportDetails";
import { WatchButton } from "@/components/watch/WatchButton";
import { PromiseTimeline } from "./PromiseTimeline";
import { setBagContext } from "@/lib/client/bagContext";

const SCAN_STEPS = ["Checking supply…", "Reading the official links…", "Scanning the contract…", "Measuring DEX liquidity…", "Comparing with the market…"];

type Load =
  | { s: "loading" }
  | { s: "ok"; report: Report }
  | { s: "error"; kind: "rate" | "notfound" | "error"; message?: string; retryAfter?: number };

const AGENT_FOR: Record<string, AgentState> = { low: "clear", medium: "concern", high: "danger" };

/** Fetch a report and map the response to the next view state (null if aborted). */
async function loadReport(id: number, signal?: AbortSignal): Promise<Load | null> {
  try {
    const res = await fetch(`/api/report/${id}`, { signal });
    const body = await res.json().catch(() => null);
    if (res.status === 429) return { s: "error", kind: "rate", retryAfter: Number(res.headers.get("Retry-After")) || 60, message: body?.error?.message };
    if (res.status === 404) return { s: "error", kind: "notfound" };
    if (!res.ok) return { s: "error", kind: "error", message: body?.error?.message };
    return { s: "ok", report: body as Report };
  } catch (e) {
    return (e as Error).name === "AbortError" ? null : { s: "error", kind: "error" };
  }
}

export function ReportView({ id }: { id: number }) {
  const [load, setLoad] = useState<Load>({ s: "loading" });

  // the fetch returns the next state; state is only set in callbacks (no setState inside the effect body)
  useEffect(() => {
    const ctrl = new AbortController();
    loadReport(id, ctrl.signal).then((next) => next && setLoad(next));
    return () => ctrl.abort();
  }, [id]);

  // tell the corner Bag which coin is on screen (cleared when leaving the page)
  const report = load.s === "ok" ? load.report : null;
  useEffect(() => {
    if (!report) return;
    setBagContext({
      coinId: report.coin.id,
      name: report.coin.name,
      symbol: report.coin.symbol,
      state: report.score.concern ? AGENT_FOR[report.score.concern]! : "idle",
      verdict: report.verdict,
    });
    return () => setBagContext(null);
  }, [report]);

  const retry = () => {
    setLoad({ s: "loading" });
    loadReport(id).then((next) => next && setLoad(next));
  };

  if (load.s === "error") {
    return (
      <div className="mx-auto max-w-xl py-10">
        {load.kind === "rate" && <StateView kind="rate-limited" message={load.message} onRetry={retry} retryAfterSeconds={load.retryAfter} />}
        {load.kind === "notfound" && <StateView kind="empty" title="We couldn't find that coin" message="CoinMarketCap has no data for this id. Try searching by name or contract address." />}
        {load.kind === "error" && <StateView kind="error" message={load.message} onRetry={retry} />}
      </div>
    );
  }

  const r = load.s === "ok" ? load.report : null;
  const agentState: AgentState = r ? (r.score.concern ? AGENT_FOR[r.score.concern]! : "idle") : "scanning";

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      {/* left: Bag + verdict (sticky on desktop) */}
      {/* phones: the coin comes first */}
      <div className="lg:hidden">
        <CoinHeader r={r} />
      </div>
      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start" aria-label="Bag's verdict">
        <Agent state={agentState} size={300} steps={SCAN_STEPS} speak={r?.verdict} showCaption={false} />
        <div aria-live="polite" className="space-y-4">
          {r ? (
            <>
              <ScoreBadge concern={r.score.concern} scored={r.score.scored} total={r.score.total} />
              <p className="text-base leading-relaxed">{r.verdict}</p>
            </>
          ) : (
            <p className="text-sm text-muted">Bag is reading live CoinMarketCap data…</p>
          )}
        </div>
        {r ? <WatchButton coinId={r.coin.id} name={r.coin.name} /> : null}
        <Disclaimer />
      </aside>

      {/* right: the evidence */}
      <div className="min-w-0 space-y-10">
        <div className="hidden lg:block">
          <CoinHeader r={r} />
        </div>

        <section aria-labelledby="signals-title" className="space-y-4">
          <h2 id="signals-title" className="text-xl font-semibold">The warning signs, one by one</h2>
          {r ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {r.signals.map((s) => (
                <li key={s.id}>
                  <SignalCard title={s.title} level={s.level} value={s.value} valueLabel={s.valueLabel} meaning={s.meaning} why={s.why} source={s.source} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i}>
                  <SkeletonCard />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* starts loading together with the report (separate AI call, cached 24 h) */}
        <PromiseTimeline id={id} />

        {r && (
          <>
            <ContractDetails r={r} />
            <PoolsTable r={r} />
            <LinksList r={r} />
            <section className="space-y-2 border-t border-line pt-6 text-sm text-muted">
              <p>
                Built from the CoinMarketCap API at{" "}
                <time dateTime={r.generatedAt}>{new Date(r.generatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</time>.
                Scores are computed in code from these numbers; nothing here is a prediction.
              </p>
              <p>
                Want to see the raw calls? <a className="text-teal hover:underline" href="/evidence">API evidence</a>.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function CoinHeader({ r }: { r: Report | null }) {
  if (!r) {
    return (
      <header className="space-y-2" aria-busy="true">
        <div className="h-9 w-48 animate-shimmer rounded-md bg-[linear-gradient(90deg,rgb(255_255_255/.04),rgb(255_255_255/.09),rgb(255_255_255/.04))] bg-[length:200%_100%]" />
        <div className="h-5 w-72 animate-shimmer rounded-md bg-[linear-gradient(90deg,rgb(255_255_255/.04),rgb(255_255_255/.09),rgb(255_255_255/.04))] bg-[length:200%_100%]" />
      </header>
    );
  }
  const c = r.coin;
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {c.logo && (
          // eslint-disable-next-line @next/next/no-img-element -- small CMC logo, no optimisation needed
          <img src={c.logo} alt="" width={40} height={40} className="size-10 rounded-full" />
        )}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {c.name} <span className="text-xl font-medium text-muted">{c.symbol}</span>
        </h1>
        {c.rank && <span className="tabular rounded-full bg-glass-strong px-2.5 py-1 text-xs text-muted">Rank #{c.rank}</span>}
      </div>
      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <Stat label="Price" value={money(c.price)} />
        <Stat label="24h" value={pct(c.change24h)} tone={c.change24h} />
        <Stat label="7d" value={pct(c.change7d)} tone={c.change7d} />
        <Stat label="Market cap" value={money(c.marketCap)} />
        {c.platform && <Stat label="Chain" value={c.platform} />}
      </dl>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <SourceTag kind={r.freshness === "live" ? "live" : "cached"} at={r.generatedAt} />
        {c.website && (
          <a href={c.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-sm text-teal hover:underline">
            Official website <IconExternal className="size-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </div>
    </header>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      <dd className={cn("tabular text-base font-medium", typeof tone === "number" && (tone >= 0 ? "text-ok" : "text-danger"))}>{value}</dd>
    </div>
  );
}
