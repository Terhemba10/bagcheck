"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Agent } from "./Agent";
import { Agent2D } from "./Agent2D";
import { AGENT_STATES, type AgentState } from "./states";

/** /design: switch Bag between states, 3D and 2D side by side. */
export function AgentPlayground() {
  const [state, setState] = useState<AgentState>("idle");
  return (
    <div className="space-y-6">
      <div role="radiogroup" aria-label="Agent state" className="flex flex-wrap gap-2">
        {AGENT_STATES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={state === s}
            onClick={() => setState(s)}
            className={cn(
              "min-h-11 rounded-full px-4 text-sm font-medium capitalize transition-colors",
              state === s ? "bg-teal text-teal-ink" : "glass text-muted hover:text-text",
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div className="glass grid place-items-center rounded-xl py-6">
          <p className="mb-2 text-xs font-medium tracking-wide text-faint uppercase">Hero (3D when supported)</p>
          <Agent state={state} size={300} />
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
