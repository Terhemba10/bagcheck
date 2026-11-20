"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { IconCheck, IconLock } from "@/components/ui/icons";
import { isFinished, progress, REPORT_STEPS, type StepState, type StepStatus } from "@/lib/core/steps";
import { cn } from "@/lib/cn";
import { duration, ease } from "@/lib/motion";

/**
 * Agent activity: a live checklist of what Covex is doing, each step ticking
 * pending → running (shimmer) → done, with its data source. Driven by real
 * server events; stays inspectable after the run (collapsed to a summary).
 */
export function AgentActivity({ steps, elapsedMs, className }: { steps: StepState[]; elapsedMs: number | null; className?: string }) {
  const { finished, total } = progress(steps);
  const done = finished === total;
  const [open, setOpen] = useState<boolean | null>(null); // null = automatic (open while working)
  const expanded = open ?? !done;
  const running = steps.find((s) => s.status === "running");
  const runningDef = REPORT_STEPS.find((d) => d.id === running?.id);

  return (
    <section aria-label="Agent activity" className={cn("rounded-xl border border-line bg-surface-1", className)}>
      <button
        type="button"
        onClick={() => setOpen(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left"
      >
        <span className="text-xs font-medium tracking-wide text-faint uppercase">Agent activity</span>
        <span className="tabular ml-auto text-xs text-muted">
          {finished}/{total} {done ? "done" : "steps"}
          {done && elapsedMs !== null && <> · {(elapsedMs / 1000).toFixed(1)}s</>}
        </span>
        <svg viewBox="0 0 24 24" className={cn("size-4 text-faint transition-transform", expanded && "rotate-180")} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* progress bar */}
      <div className="mx-4 h-px overflow-hidden bg-line" aria-hidden="true">
        <motion.div className="h-full bg-teal" initial={{ width: 0 }} animate={{ width: `${(finished / total) * 100}%` }} transition={{ duration: duration.slow, ease: ease.out }} />
      </div>

      <p className="sr-only" aria-live="polite">
        {done ? `All ${total} steps finished.` : runningDef ? runningDef.running : ""}
      </p>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.ol
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="overflow-hidden px-2 pt-2 pb-2"
          >
            {steps.map((s) => {
              const def = REPORT_STEPS.find((d) => d.id === s.id)!;
              return (
                <li key={s.id} className="flex gap-3 rounded-lg px-2 py-2">
                  <StepIcon status={s.status} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm leading-5", s.status === "pending" ? "text-faint" : "text-text")}>
                      {s.status === "running" ? <span className="shimmer-text">{def.running}</span> : def.label}
                      {s.note && isFinished(s.status) && (
                        <span className={cn("ml-2 rounded px-1.5 py-0.5 text-[11px]", s.status === "blocked" ? "bg-glass-strong text-faint" : "bg-glass-strong text-muted")}>{s.note}</span>
                      )}
                    </p>
                    <p className="truncate font-mono text-[11px] leading-5 text-faint">{def.source}</p>
                  </div>
                </li>
              );
            })}
          </motion.ol>
        )}
      </AnimatePresence>
    </section>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  const base = "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full";
  const label = { pending: "Pending", running: "Running", done: "Done", skipped: "Skipped", blocked: "Needs a paid plan", failed: "No data" }[status];
  return (
    <span className={cn(base, "relative")} role="img" aria-label={label}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={status}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: duration.fast }}
          className="absolute inset-0 grid place-items-center"
        >
          {status === "pending" && <span className="size-3.5 rounded-full border border-line-strong" />}
          {status === "running" && <span className="size-4 animate-spin rounded-full border-2 border-teal/25 border-t-teal" />}
          {status === "done" && (
            <span className="grid size-5 place-items-center rounded-full bg-ok-soft text-ok">
              <IconCheck className="size-3" strokeWidth={3} />
            </span>
          )}
          {status === "skipped" && <span className="h-0.5 w-2.5 rounded bg-faint" />}
          {status === "blocked" && <IconLock className="size-3.5 text-faint" />}
          {status === "failed" && <span className="grid size-5 place-items-center rounded-full bg-warn-soft text-[11px] font-bold text-warn">!</span>}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
