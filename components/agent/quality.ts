/**
 * High/Low quality for the 3D agent. Pure helpers (unit-tested) + tiny
 * storage wrappers.
 *
 *  - URL overrides for testing/measuring: ?quality=high|low and ?fps=60
 *  - otherwise: a remembered "low" from earlier in this session, else "high"
 *  - downgrade when the measured rate can't hold ~80% of the cap
 */
import type { Quality } from "./Agent3D";

export const QUALITY_KEY = "bagcheck:quality";

export function pickQuality(search: string, remembered: string | null = readRemembered()): { quality: Quality; fpsCap: number; forced: boolean } {
  const params = new URLSearchParams(search);
  const q = params.get("quality");
  const fps = Number(params.get("fps"));
  const fpsCap = fps === 60 ? 60 : 30;
  if (q === "high" || q === "low") return { quality: q, fpsCap, forced: true };
  return { quality: remembered === "low" ? "low" : "high", fpsCap, forced: false };
}

export function shouldDowngrade(current: Quality, measuredFps: number, cap: number): boolean {
  if (current === "low") return false; // never flap back and forth
  return measuredFps < cap * 0.8;
}

function readRemembered(): string | null {
  try {
    return sessionStorage.getItem(QUALITY_KEY);
  } catch {
    return null;
  }
}

export function rememberQuality(q: Quality) {
  try {
    sessionStorage.setItem(QUALITY_KEY, q);
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
}
