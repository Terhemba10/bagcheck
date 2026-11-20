"use client";

import { useSyncExternalStore } from "react";
import { GRAPHICS_EVENT, readSimplePref, writeSimplePref } from "@/lib/client/graphics";
import { cn } from "@/lib/cn";
import { Tip } from "./Sidebar";

function subscribe(cb: () => void) {
  window.addEventListener(GRAPHICS_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(GRAPHICS_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** "Simple graphics" switch: flat surfaces, no tilt, light edges or background depth. */
export function GraphicsToggle({ auto = false }: { auto?: boolean }) {
  const on = useSyncExternalStore(subscribe, readSimplePref, () => false);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => writeSimplePref(!on)}
      aria-label="Simple graphics"
      className="sb-item group relative flex min-h-9 w-full items-center gap-3 rounded-md px-3 text-xs text-muted hover:bg-glass hover:text-text"
    >
      <span
        aria-hidden="true"
        className={cn("relative h-4 w-7 shrink-0 rounded-full border transition-colors", on ? "border-teal bg-teal-soft" : "border-line-strong bg-surface-3")}
      >
        <span className={cn("absolute top-0.5 size-2.5 rounded-full transition-[left,background-color]", on ? "left-3.5 bg-teal" : "left-0.5 bg-faint")} />
      </span>
      <span className={cn(auto && "sb-label")}>Simple graphics</span>
      {auto && <Tip>Simple graphics: {on ? "on" : "off"}</Tip>}
    </button>
  );
}
