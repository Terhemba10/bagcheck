"use client";

import { StateView } from "@/components/ui/StateView";

/** Client wrapper so the retry buttons on /design are live. */
export function StateDemos() {
  const noop = () => undefined;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <StateView kind="empty" message="Nothing watched yet. Check a coin and press Watch." />
      <StateView kind="error" onRetry={noop} />
      <StateView kind="rate-limited" onRetry={noop} retryAfterSeconds={60} />
      <StateView kind="plan-blocked" message="Exchange-by-exchange liquidity needs a higher CMC plan (Standard). DEX liquidity is shown instead." />
    </div>
  );
}

export function LoadingDemo() {
  return <StateView kind="loading" />;
}
