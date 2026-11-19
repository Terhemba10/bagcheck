"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Agent2D } from "./Agent2D";
import type { Quality } from "./Agent3D";
import { detectGraphics, type GraphicsMode } from "./graphics";
import { pickQuality, rememberQuality, shouldDowngrade } from "./quality";
import { AGENT_LOOKS, SCAN_STEPS, type AgentState } from "./states";

const Agent3D = dynamic(() => import("./Agent3D"), { ssr: false });

/**
 * Bag, with automatic 3D/2D choice and automatic High/Low quality.
 *  - The 2D orb renders first (also on the server), so the hero is never empty.
 *  - The 3D bundle loads after idle, fades in after its first frame, then the 2D unmounts.
 *  - Quality starts High (unless remembered/overridden) and drops to Low if the
 *    measured frame rate can't hold the budget.
 *  - Rendering pauses whenever Bag is off-screen or the tab is hidden.
 */
export function Agent({
  state,
  size = 320,
  caption,
  steps,
  speak,
  showCaption = true,
  allow3D = true,
  reactToTyping = false,
  className,
}: {
  state: AgentState;
  size?: number;
  /** Fixed caption (overrides the state's default). */
  caption?: string;
  /** While scanning: live steps narrated one after another. */
  steps?: string[];
  /** A verdict to "speak": typed out while the core pulses in time, then Bag settles. */
  speak?: string;
  showCaption?: boolean;
  allow3D?: boolean;
  /** Lean toward the search box and brighten on each keystroke. */
  reactToTyping?: boolean;
  className?: string;
}) {
  const [mode, setMode] = useState<GraphicsMode>("2d");
  const [ready3D, setReady3D] = useState(false);
  const [active, setActive] = useState(true);
  const [react, setReact] = useState(0);
  const [quality, setQuality] = useState<Quality>("high");
  const [fpsCap, setFpsCap] = useState(30);
  const [forcedQuality, setForcedQuality] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // cross-fade: 3D drew its first frame -> fade 2D out -> unmount 2D after the fade
  const [drawn3D, setDrawn3D] = useState(false);
  const [gone2D, setGone2D] = useState(false);
  useEffect(() => {
    if (!drawn3D) return;
    const t = setTimeout(() => setGone2D(true), 800);
    return () => clearTimeout(t);
  }, [drawn3D]);

  // a reaction on each keystroke in the search bar
  useEffect(() => {
    if (!reactToTyping) return;
    const onType = () => setReact((n) => n + 1);
    window.addEventListener("bagcheck:typing", onType);
    return () => window.removeEventListener("bagcheck:typing", onType);
  }, [reactToTyping]);

  // pick graphics mode + quality (re-check when the user flips the toggle)
  useEffect(() => {
    if (!allow3D) return;
    const update = () => {
      setMode(detectGraphics().mode);
      const q = pickQuality(window.location.search);
      setQuality(q.quality);
      setFpsCap(q.fpsCap);
      setForcedQuality(q.forced);
    };
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
    let visible = document.visibilityState === "visible";
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
  // 3D switched off (e.g. "simple graphics"): reset the cross-fade so turning it back on fades in again
  const [prevUse3D, setPrevUse3D] = useState(use3D);
  if (prevUse3D !== use3D) {
    setPrevUse3D(use3D);
    if (!use3D) {
      setDrawn3D(false);
      setGone2D(false);
    }
  }

  const { text, speaking } = useNarration(state, caption, steps, speak);

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* square box: `size` px on wide screens, shrinks to 72% of the viewport on phones */}
      <div ref={box} className="relative grid aspect-square place-items-center" style={{ width: `min(${size}px, 72vw)` }}>
        {/* 3D layer: mounts when ready, stays transparent until its first frame is drawn */}
        {use3D && (
          <div
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-out",
              // soft radial mask: the canvas edge (opaque under bloom) can never show as a square
              "[mask-image:radial-gradient(closest-side,#000_78%,transparent_100%)]",
              drawn3D ? "opacity-100" : "opacity-0",
            )}
            data-agent-state={state}
            data-agent-mode={drawn3D ? "3d" : "3d-loading"}
            data-agent-quality={quality}
          >
            <Agent3D
              key={quality /* remount cleanly when quality changes */}
              state={state}
              active={active}
              react={react}
              speaking={speaking}
              quality={quality}
              fpsCap={fpsCap}
              onFirstFrame={() => setDrawn3D(true)}
              onPerf={(fps) => {
                // a quality forced by ?quality= (for testing) is never changed automatically
                if (!forcedQuality && shouldDowngrade(quality, fps, fpsCap)) {
                  rememberQuality("low");
                  setQuality("low");
                }
              }}
            />
          </div>
        )}
        {/* 2D layer: shown at once (also server-rendered), fades out under the 3D one, then unmounts.
            inset 19% = 62% of the box, matching the 3D orb so the cross-fade has no size jump.
            (Absolute, not a % width: a % width inside this auto-sized grid track collapses to 0.)
            `key` restarts the CSS hop on each typing ping. */}
        {!(use3D && gone2D) && (
          <div
            key={react}
            aria-hidden="true"
            className={cn(
              "absolute inset-[19%] transition-opacity duration-700 ease-out",
              use3D && drawn3D ? "opacity-0" : "opacity-100",
              react > 0 && "animate-hop",
            )}
          >
            <Agent2D state={state} fluid />
          </div>
        )}
      </div>
      {showCaption && (
        <p aria-live="polite" className="glass -mt-6 min-h-10 max-w-xs rounded-full px-4 py-2 text-center text-sm text-text/90">
          {text}
        </p>
      )}
    </div>
  );
}

/**
 * Bag's narration: a fixed caption, rotating live steps while scanning, or a
 * verdict typed out word by word (and `speaking` true while it types).
 * Reduced motion: the verdict appears at once.
 */
function useNarration(state: AgentState, caption?: string, steps?: string[], speak?: string) {
  const [stepIndex, setStepIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const words = speak ? speak.split(/(\s+)/) : [];

  // reset typing when the verdict changes (adjusting state during render)
  const [lastSpeak, setLastSpeak] = useState(speak);
  if (lastSpeak !== speak) {
    setLastSpeak(speak);
    setShown(0);
  }

  const scanning = state === "scanning";
  const scanSteps = scanning ? (steps?.length ? steps : SCAN_STEPS) : null;
  // depend on a boolean, not the array (a new array each render would reset the timer forever)
  useEffect(() => {
    if (!scanning) return;
    const t = setInterval(() => setStepIndex((i) => i + 1), 1600);
    return () => clearInterval(t);
  }, [scanning]);

  const reduced = useReducedMotion();
  useEffect(() => {
    if (!speak || reduced) return;
    if (shown >= words.length) return;
    const t = setTimeout(() => setShown((n) => n + 2), 85); // a word (+ its space) at a time
    return () => clearTimeout(t);
  }, [speak, shown, words.length, reduced]);

  if (speak && reduced) return { text: speak, speaking: false };
  if (speak) return { text: words.slice(0, shown).join("") || " ", speaking: shown < words.length };
  if (scanSteps) return { text: scanSteps[stepIndex % scanSteps.length]!, speaking: false };
  return { text: caption ?? AGENT_LOOKS[state].caption, speaking: false };
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(REDUCED_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}
