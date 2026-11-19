"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Agent } from "./Agent";
import { Agent2D } from "./Agent2D";
import { AGENT_STATES, type AgentState } from "./states";

// Demo verdicts for the style guide (no real coin data).
const DEMO_VERDICT: Partial<Record<AgentState, string>> = {
  clear: "No major warning signs. Supply is mostly released and trading is spread across many markets.",
  concern: "Two warning signs: most tokens are still locked, and one exchange handles most of the trading.",
  danger: "Several warning signs: the contract can block sellers, and DEX liquidity fell 60% this week.",
  rescue: "First, protect what's left. Then we'll look at where you can still sell.",
};

/** /design: switch Bag between states, hear a verdict, 3D and 2D side by side. */
export function AgentPlayground() {
  const [state, setState] = useState<AgentState>("idle");
  const [speak, setSpeak] = useState<string | undefined>(undefined);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Agent state" className="flex flex-wrap gap-2">
          {AGENT_STATES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={state === s}
              onClick={() => {
                setState(s);
                setSpeak(undefined);
              }}
              className={cn(
                "min-h-11 rounded-full px-4 text-sm font-medium capitalize transition-colors",
                state === s ? "bg-teal text-teal-ink" : "glass text-muted hover:text-text",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        {DEMO_VERDICT[state] && (
          <button
            type="button"
            onClick={() => setSpeak(`${DEMO_VERDICT[state]}${speak === DEMO_VERDICT[state] ? "​" : ""}`)}
            className="min-h-11 rounded-full border border-line px-4 text-sm text-teal hover:bg-teal-soft"
          >
            Speak the verdict
          </button>
        )}
      </div>
      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div className="glass grid place-items-center rounded-xl py-6">
          <p className="mb-2 text-xs font-medium tracking-wide text-faint uppercase">Hero (3D when supported)</p>
          <Agent state={state} size={300} speak={speak} />
        </div>
        <div className="glass flex flex-col items-center justify-center gap-6 rounded-xl py-6">
          <p className="text-xs font-medium tracking-wide text-faint uppercase">2D fallback · corner · alerts</p>
          <Agent2D state={state} size={140} />
          <Agent2D state={state} size={44} />
        </div>
      </div>
    </div>
  );
}

/** All six states at once (2D) for quick visual comparison and screenshots. */
export function AgentStateStrip() {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {AGENT_STATES.map((s) => (
        <li key={s} className="glass flex flex-col items-center gap-2 rounded-lg py-4">
          <Agent2D state={s} size={88} />
          <span className="text-sm font-medium capitalize">{s}</span>
        </li>
      ))}
    </ul>
  );
}
