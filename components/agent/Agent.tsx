"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Agent2D } from "./Agent2D";
import { detectGraphics, type GraphicsMode } from "./graphics";
import { AGENT_LOOKS, type AgentState } from "./states";

const Agent3D = dynamic(() => import("./Agent3D"), { ssr: false });

/**
 * Bag, with automatic 3D/2D choice. The 2D orb renders first (also on the
 * server); the 3D scene loads only on capable devices, after idle, and pauses
 * whenever it is off-screen or the tab is hidden.
 */
export function Agent({
  state,
  size = 320,
  caption,
  showCaption = true,
  allow3D = true,
  className,
}: {
  state: AgentState;
  size?: number;
  caption?: string;
  showCaption?: boolean;
  allow3D?: boolean;
  className?: string;
}) {
  const [mode, setMode] = useState<GraphicsMode>("2d");
  const [ready3D, setReady3D] = useState(false);
  const [active, setActive] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  // pick graphics mode (re-check when the user flips the toggle)
  useEffect(() => {
    if (!allow3D) return;
    const update = () => setMode(detectGraphics().mode);
    update();
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", update);
    window.addEventListener("bagcheck:graphics", update);
    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("bagcheck:graphics", update);
    };
  }, [allow3D]);

  // load the 3D bundle only once the browser is idle
  useEffect(() => {
    if (mode !== "3d") return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setReady3D(true), { timeout: 1500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setReady3D(true), 300);
    return () => clearTimeout(t);
  }, [mode]);

  // pause rendering off-screen / hidden tab
  useEffect(() => {
    if (mode !== "3d" || !box.current) return;
    let visible = true;
    let onScreen = true;
    const sync = () => setActive(visible && onScreen);
    const io = new IntersectionObserver(([e]) => {
      onScreen = Boolean(e?.isIntersecting);
      sync();
    });
    io.observe(box.current);
    const onVis = () => {
      visible = document.visibilityState === "visible";
      sync();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [mode]);

  const use3D = allow3D && mode === "3d" && ready3D;
  const text = caption ?? AGENT_LOOKS[state].caption;

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* square box: `size` px on wide screens, shrinks to 72% of the viewport on phones */}
      <div ref={box} className="relative grid aspect-square place-items-center" style={{ width: `min(${size}px, 72vw)` }}>
        {use3D ? (
          <div className="absolute inset-0" data-agent-state={state} data-agent-mode="3d">
            <Agent3D state={state} active={active} />
          </div>
        ) : (
          // inset 19% on each side = 62% of the box, matching the 3D orb so the swap doesn't jump.
          // (Absolute, not a % width: a % width inside this auto-sized grid track collapses to 0.)
          <div className="absolute inset-[19%]">
            <Agent2D state={state} fluid />
          </div>
        )}
      </div>
      {showCaption && (
        <p aria-live="polite" className="glass -mt-6 max-w-xs rounded-full px-4 py-2 text-center text-sm text-text/90">
          {text}
        </p>
      )}
    </div>
  );
}
