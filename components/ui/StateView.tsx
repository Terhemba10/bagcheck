"use client";

import { useEffect, useState } from "react";
import { Agent2D } from "@/components/agent/Agent2D";
import { Button } from "./Button";
import { IconLock, IconRefresh } from "./icons";
import { SkeletonCard } from "./Skeleton";

/**
 * The standard non-happy states used on every screen (spec §6.8).
 */
export type StateKind = "loading" | "empty" | "error" | "rate-limited" | "plan-blocked";

export function StateView({
  kind,
  title,
  message,
  action,
  onRetry,
  retryAfterSeconds = 60,
}: {
  kind: StateKind;
  title?: string;
  message?: string;
  action?: React.ReactNode;
  onRetry?: () => void;
  retryAfterSeconds?: number;
}) {
  if (kind === "loading") {
    return (
      <div role="status" aria-live="polite" className="space-y-6">
        <div className="flex flex-col items-center gap-3 py-4">
          <Agent2D state="scanning" size={120} />
          <p className="text-sm text-muted">{message ?? "Checking supply… reading the roadmap…"}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  const copy = {
    empty: { t: title ?? "Nothing here yet", m: message ?? "Check a coin to get started.", agent: "idle" as const },
    error: { t: title ?? "Something went wrong on our side", m: message ?? "Your data is safe. Please try again.", agent: "concern" as const },
    "rate-limited": { t: title ?? "CoinMarketCap is busy", m: message ?? "We've hit the API's per-minute limit. Please try again in a minute.", agent: "idle" as const },
    "plan-blocked": { t: title ?? "Needs a paid CoinMarketCap plan", m: message ?? "This part isn't available live on the current API plan.", agent: "idle" as const },
  }[kind];

  return (
    <div role={kind === "error" ? "alert" : "status"} className="glass flex flex-col items-center gap-4 rounded-lg px-6 py-10 text-center">
      {kind === "plan-blocked" ? <IconLock className="size-10 text-faint" /> : <Agent2D state={copy.agent} size={96} />}
      <div className="space-y-1">
        <p className="text-lg font-semibold">{copy.t}</p>
        <p className="max-w-md text-sm text-muted">{copy.m}</p>
      </div>
      {kind === "rate-limited" && onRetry ? (
        <RetryCountdown seconds={retryAfterSeconds} onRetry={onRetry} />
      ) : kind === "error" && onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          <IconRefresh className="size-4" /> Try again
        </Button>
      ) : null}
      {action}
    </div>
  );
}

function RetryCountdown({ seconds, onRetry }: { seconds: number; onRetry: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <Button variant="secondary" onClick={onRetry} disabled={left > 0}>
      <IconRefresh className="size-4" />
      {left > 0 ? <span className="tabular">Try again in {left}s</span> : "Try again"}
    </Button>
  );
}
