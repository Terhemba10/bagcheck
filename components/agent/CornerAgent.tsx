"use client";

import { useState } from "react";
import { Agent2D } from "./Agent2D";
import { AGENT_LOOKS, type AgentState } from "./states";

/**
 * Small Bag in the bottom-right corner of every page (2D only, so it costs
 * almost nothing). Click to see what Bag is doing.
 */
export function CornerAgent({ state = "idle", message }: { state?: AgentState; message?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2 print:hidden">
      {open && (
        <div id="corner-agent-panel" role="status" className="glass max-w-[16rem] rounded-lg px-4 py-3 text-sm">
          {message ?? AGENT_LOOKS[state].caption}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="corner-agent-panel"
        aria-label={open ? "Hide Bag's status" : "What is Bag doing?"}
        className="glass grid size-14 place-items-center rounded-full transition-transform duration-200 hover:scale-105"
      >
        <Agent2D state={state} size={44} />
      </button>
    </div>
  );
}
