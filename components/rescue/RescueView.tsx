"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CovexMark } from "@/components/brand/CovexMark";
import { agent } from "@/lib/client/agentStore";
import { Disclaimer } from "@/components/ui/Notice";
import { StateView } from "@/components/ui/StateView";
import type { Rescue } from "@/lib/rescue/build";
import { EvidencePack } from "./EvidencePack";
import { LessonsSection, ProtectSection, ReportWhere, ScamShield } from "./RescueSections";
import { SellSection } from "./SellSection";

type Load = { s: "loading" } | { s: "ok"; r: Rescue } | { s: "error"; kind: "rate" | "notfound" | "error" };

async function loadRescue(id: number, signal?: AbortSignal): Promise<Load | null> {
  try {
    const res = await fetch(`/api/rescue/${id}`, { signal });
    if (res.status === 429) return { s: "error", kind: "rate" };
    if (res.status === 404) return { s: "error", kind: "notfound" };
    if (!res.ok) return { s: "error", kind: "error" };
    return { s: "ok", r: (await res.json()) as Rescue };
  } catch (e) {
    return (e as Error).name === "AbortError" ? null : { s: "error", kind: "error" };
  }
}

const STEPS = [
  { href: "#sell", label: "Can I still sell?" },
  { href: "#protect", label: "Protect what's left" },
  { href: "#evidence", label: "Evidence & reporting" },
  { href: "#lessons", label: "Lessons for next time" },
];

export function RescueView({ id }: { id: number }) {
  const [load, setLoad] = useState<Load>({ s: "loading" });
  useEffect(() => {
    const ctrl = new AbortController();
    agent.start();
    loadRescue(id, ctrl.signal).then((n) => {
      if (!n) return;
      setLoad(n);
      agent.finish("rescue");
    });
    return () => {
      ctrl.abort();
      agent.reset();
    };
  }, [id]);
  const retry = () => {
    setLoad({ s: "loading" });
    loadRescue(id).then((n) => n && setLoad(n));
  };

  const r = load.s === "ok" ? load.r : null;
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
      {/* a calm guide beside the steps (no tilt, slower motion on rescue pages) */}
      <aside className="space-y-5 lg:sticky lg:top-8 lg:self-start" aria-label="Rescue steps">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-1 p-4">
          <CovexMark size={36} tone="rescue" working={!r && load.s === "loading"} />
          <p className="text-sm text-muted">{r ? "Let's take this one step at a time." : "Gathering where it can still be traded…"}</p>
        </div>
        <nav aria-label="Steps" className="hidden lg:block">
          <ol className="space-y-1 text-sm">
            {STEPS.map((s, i) => (
              <li key={s.href}>
                <a href={s.href} className="flex min-h-10 items-center gap-2 rounded-md px-3 text-muted hover:bg-glass hover:text-text">
                  <span className="tabular grid size-6 place-items-center rounded-full bg-rescue-soft text-xs text-rescue">{i + 1}</span>
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>

      <div className="min-w-0 space-y-10">
        <header className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-rescue uppercase">Rescue plan</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{r ? `${r.coin.name} (${r.coin.symbol})` : "Loading…"}</h1>
          <p className="text-muted">
            If something went wrong, here&apos;s where things stand and what you can do. Covex explains the options; you decide.{" "}
            {r && (
              <Link href={`/coin/${r.coin.id}`} className="text-teal hover:underline">
                See the full report
              </Link>
            )}
          </p>
        </header>

        <ScamShield />

        {load.s === "loading" && <StateView kind="loading" message="Checking where it can still be traded…" />}
        {load.s === "error" &&
          (load.kind === "rate" ? (
            <StateView kind="rate-limited" onRetry={retry} />
          ) : load.kind === "notfound" ? (
            <StateView kind="empty" title="We couldn't find that coin" message="Search for it on the rescue page." />
          ) : (
            <StateView kind="error" onRetry={retry} />
          ))}

        {r && <SellSection r={r} />}

        <ProtectSection chain={r?.chain ?? null} />

        <section id="evidence" aria-labelledby="evidence-title" className="scroll-mt-24 space-y-4">
          <h2 id="evidence-title" className="text-2xl font-semibold tracking-tight">3. Evidence and reporting</h2>
          <p className="text-muted">Write down what happened while it&apos;s fresh. Reports with transaction hashes, dates and screenshots are much easier to act on.</p>
          <EvidencePack
            coin={r ? { id: r.coin.id, name: r.coin.name, symbol: r.coin.symbol } : null}
            facts={r ? [r.verdict, ...r.lessons.signsToday.map((s) => `${s.title}: ${s.meaning}`)] : []}
          />
          <ReportWhere />
        </section>

        {r && <LessonsSection lessons={r.lessons} />}

        <Disclaimer />
      </div>
    </div>
  );
}
