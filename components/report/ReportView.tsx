"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgentActivity } from "@/components/agent/AgentActivity";
import { CovexMark } from "@/components/brand/CovexMark";
import { CountUp } from "@/components/motion/CountUp";
import { TiltCard } from "@/components/motion/TiltCard";
import { IconChat, IconExternal } from "@/components/ui/icons";
import { Disclaimer } from "@/components/ui/Notice";
import { SignalCard } from "@/components/ui/SignalCard";
import { SourceTag } from "@/components/ui/SourceTag";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { StateView } from "@/components/ui/StateView";
import { ScoreBadge } from "@/components/ui/StatusPill";
import { WatchButton } from "@/components/watch/WatchButton";
import { agent, TONE_COLOR, toneFor, useAgent, type Tone } from "@/lib/client/agentStore";
import { money, pct } from "@/lib/core/format";
import type { Report } from "@/lib/core/report";
import { applyStep, initialSteps, isFinished, type StepEvent, type StepState } from "@/lib/core/steps";
import { cn } from "@/lib/cn";
import { assemble, spring, stagger } from "@/lib/motion";
import { ContractDetails, LinksList, PoolsTable } from "./ReportDetails";
import { PromiseTimeline } from "./PromiseTimeline";

type Load =
  | { s: "loading" }
  | { s: "ok"; report: Report }
  | { s: "error"; kind: "rate" | "notfound" | "error"; message?: string; retryAfter?: number };

type Line = StepEvent | { type: "report"; report: Report } | { type: "error"; error: { kind: string; status: number; message?: string } };

/**
 * Stream the report: step events as they happen, then the report.
 * Falls back to an error state for rate limits (answered before the stream starts).
 */
async function streamReport(id: number, onStep: (e: StepEvent) => void, signal: AbortSignal): Promise<Load | null> {
  try {
    const res = await fetch(`/api/report/${id}?stream=1`, { signal });
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => null);
      if (res.status === 429) return { s: "error", kind: "rate", retryAfter: Number(res.headers.get("Retry-After")) || 60, message: body?.error?.message };
      return { s: "error", kind: res.status === 404 ? "notfound" : "error", message: body?.error?.message };
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const raw = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!raw) continue;
        const line = JSON.parse(raw) as Line;
        if (line.type === "step") onStep(line);
        else if (line.type === "report") return { s: "ok", report: line.report };
        else if (line.type === "error") {
          const k = line.error.status === 429 ? "rate" : line.error.status === 404 ? "notfound" : "error";
          return { s: "error", kind: k, message: line.error.message };
        }
      }
    }
    return { s: "error", kind: "error" };
  } catch (e) {
    return (e as Error).name === "AbortError" ? null : { s: "error", kind: "error" };
  }
}

export function ReportView({ id }: { id: number }) {
  const [load, setLoad] = useState<Load>({ s: "loading" });
  const [steps, setSteps] = useState<StepState[]>(initialSteps);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(0);

  const onStep = useCallback((e: StepEvent) => {
    setSteps((prev) => {
      const next = applyStep(prev, e);
      if (next.every((s) => isFinished(s.status)) && started.current) setElapsed(performance.now() - started.current);
      return next;
    });
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    started.current = performance.now();
    agent.start();
    streamReport(id, onStep, ctrl.signal).then((next) => {
      if (!next) return;
      setLoad(next);
      if (next.s === "ok") {
        const r = next.report;
        const tone = toneFor(r.score.concern);
        agent.finish(tone);
        agent.setCoin({ coinId: r.coin.id, name: r.coin.name, symbol: r.coin.symbol, verdict: r.verdict, tone });
      } else {
        agent.finish("idle");
      }
    });
    return () => {
      ctrl.abort();
      agent.setCoin(null);
      agent.reset();
    };
  }, [id, onStep, attempt]);

  const retry = () => {
    setLoad({ s: "loading" });
    setSteps(initialSteps());
    setElapsed(null);
    setAttempt((a) => a + 1);
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
  const tone: Tone = r ? toneFor(r.score.concern) : "idle";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-10">
      {/* phones: the coin comes first */}
      <div className="vt-hero-mobile lg:hidden">
        <CoinHeader r={r} tone={tone} />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start" aria-label="Covex's verdict and activity">
        <VerdictCard r={r} tone={tone} />
        <AgentActivity steps={steps} elapsedMs={elapsed} />
        {r && (
          <div className="space-y-2">
            <WatchButton coinId={r.coin.id} name={r.coin.name} />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={agent.openChat}
                className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-surface-1 text-sm hover:border-line-strong"
              >
                <IconChat className="size-4 text-teal" /> Ask Covex
              </button>
              <a href={`/rescue/${r.coin.id}`} className="flex min-h-11 items-center justify-center rounded-md border border-line bg-surface-1 text-sm text-rescue hover:border-line-strong">
                Rescue plan →
              </a>
            </div>
          </div>
        )}
        <Disclaimer />
      </aside>

      <div className="min-w-0 space-y-10">
        <div className="vt-hero-desktop hidden lg:block">
          <CoinHeader r={r} tone={tone} />
        </div>

        <section aria-labelledby="signals-title" className="space-y-4">
          <h2 id="signals-title" className="text-xl font-semibold">The warning signs, one by one</h2>
          {r ? (
            <motion.ul
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
              style={{ perspective: 1200 }}
              initial="from"
              animate="to"
              variants={{ to: { transition: { staggerChildren: stagger.base } } }}
            >
              {r.signals.map((s) => (
                <motion.li key={s.id} variants={{ from: assemble.from, to: { ...assemble.to, transition: spring.soft } }} style={{ transformOrigin: "50% 100%" }}>
                  <TiltCard>
                    <SignalCard title={s.title} level={s.level} value={s.value} valueLabel={s.valueLabel} meaning={s.meaning} why={s.why} source={s.source} />
                  </TiltCard>
                </motion.li>
              ))}
            </motion.ul>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i}>
                  <SkeletonCard />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* starts loading together with the report (separate AI call, cached 24 h) */}
        <PromiseTimeline id={id} onStep={onStep} />

        {r && (
          <motion.div className="space-y-10" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.soft, delay: 0.3 }}>
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
          </motion.div>
        )}
      </div>
    </div>
  );
}

function VerdictCard({ r, tone }: { r: Report | null; tone: Tone }) {
  const { working } = useAgent();
  return (
    <section
      aria-live="polite"
      className="relative overflow-hidden rounded-xl border border-line bg-surface-1 p-5"
      style={{ boxShadow: r ? `inset 0 1px 0 0 ${TONE_COLOR[tone]}` : undefined }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-10 size-40 rounded-full opacity-[0.12] blur-2xl transition-colors duration-500"
        style={{ background: TONE_COLOR[tone] }}
      />
      <div className="relative flex items-center gap-3">
        <CovexMark size={36} tone={tone} working={!r && working} />
        <div>
          <p className="text-xs font-medium tracking-wide text-faint uppercase">Covex verdict</p>
          {r ? <ScoreBadge concern={r.score.concern} scored={r.score.scored} total={r.score.total} /> : <p className="shimmer-text text-sm">Working on it…</p>}
        </div>
      </div>
      {r ? (
        <motion.p className="relative mt-4 text-base leading-relaxed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          {r.verdict}
        </motion.p>
      ) : (
        <div className="relative mt-4 space-y-2" aria-hidden="true">
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-4/5 rounded" />
        </div>
      )}
    </section>
  );
}

function CoinHeader({ r, tone }: { r: Report | null; tone: Tone }) {
  if (!r) {
    return (
      <header className="space-y-2" aria-busy="true">
        <div className="skeleton h-9 w-48 rounded-md" />
        <div className="skeleton h-5 w-72 rounded-md" />
      </header>
    );
  }
  const c = r.coin;
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {c.logo && (
          // eslint-disable-next-line @next/next/no-img-element -- small CMC logo, no optimisation needed
          <img src={c.logo} alt="" width={40} height={40} className="size-10 rounded-full" style={{ boxShadow: `0 0 0 2px #000, 0 0 0 4px ${TONE_COLOR[tone]}` }} />
        )}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {c.name} <span className="text-xl font-medium text-muted">{c.symbol}</span>
        </h1>
        {c.rank && <span className="tabular rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs text-muted">Rank #{c.rank}</span>}
      </div>
      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <Stat label="Price" value={money(c.price)} />
        <Stat label="24h" value={pct(c.change24h)} tone={c.change24h} />
        <Stat label="7d" value={pct(c.change7d)} tone={c.change7d} />
        <Stat label="Market cap" value={money(c.marketCap)} />
        {c.platform && <Stat label="Chain" value={c.platform} plain />}
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

function Stat({ label, value, tone, plain }: { label: string; value: string; tone?: number | null; plain?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      <dd className={cn("tabular text-base font-medium", typeof tone === "number" && (tone >= 0 ? "text-ok" : "text-danger"))}>
        {plain ? value : <CountUp value={value} />}
      </dd>
    </div>
  );
}
