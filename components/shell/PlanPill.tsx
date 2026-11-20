"use client";

import { useEffect, useState } from "react";
import { compactCredits, type PlanSummary } from "@/lib/cmc/planLabel";
import { cn } from "@/lib/cn";
import { Tip } from "./Sidebar";

const KEY = "covex:plan";

/** CMC plan + credits left, read from /api/plan (0 CMC credits, cached 5 min; once per tab session). */
export function PlanPill({ auto }: { auto: boolean }) {
  const [plan, setPlan] = useState<PlanSummary | null>(null);

  useEffect(() => {
    let cached: PlanSummary | null = null;
    try {
      cached = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    } catch {
      cached = null;
    }
    if (cached) {
      queueMicrotask(() => setPlan(cached));
      return;
    }
    const ctrl = new AbortController();
    fetch("/api/plan", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: PlanSummary | null) => {
        if (!p) return;
        setPlan(p);
        try {
          sessionStorage.setItem(KEY, JSON.stringify(p));
        } catch {
          /* fine */
        }
      })
      .catch(() => undefined);
    return () => ctrl.abort();
  }, []);

  const text = plan ? `CMC ${plan.label}${plan.creditsLeft !== null ? ` · ${compactCredits(plan.creditsLeft)} credits left` : ""}` : "CMC plan…";
  return (
    <a
      href="/evidence"
      className="sb-item group relative flex min-h-9 items-center gap-3 rounded-md px-3 text-xs text-muted hover:bg-glass hover:text-text"
      aria-label={text}
    >
      <span className={cn("size-2 shrink-0 rounded-full", plan?.paid ? "bg-ok" : "bg-teal")} aria-hidden="true" />
      <span className={cn("truncate", auto && "sb-label")}>
        {plan ? (
          <>
            CMC <span className="text-text">{plan.label}</span>
            {plan.creditsLeft !== null && (
              <>
                {" "}· <span className="tabular">{compactCredits(plan.creditsLeft)}</span> left
              </>
            )}
          </>
        ) : (
          "CMC plan…"
        )}
      </span>
      {auto && <Tip>{text}</Tip>}
    </a>
  );
}
