/**
 * Decide whether this device should get the 3D agent. Pure (inputs passed in)
 * so it can be unit-tested; `detectGraphics()` reads the real browser.
 */
export interface GraphicsInputs {
  reducedMotion: boolean;
  webgl: boolean;
  deviceMemory?: number;
  cores?: number;
  userPrefersSimple: boolean;
  saveData?: boolean;
}

export type GraphicsMode = "3d" | "2d";

export function chooseGraphics(i: GraphicsInputs): { mode: GraphicsMode; reason: string } {
  if (i.userPrefersSimple) return { mode: "2d", reason: "You chose simple graphics" };
  if (i.reducedMotion) return { mode: "2d", reason: "Your device asks for reduced motion" };
  if (!i.webgl) return { mode: "2d", reason: "WebGL isn't available" };
  if (i.saveData) return { mode: "2d", reason: "Data saver is on" };
  if (i.deviceMemory !== undefined && i.deviceMemory < 4) return { mode: "2d", reason: "Saving memory on this device" };
  if (i.cores !== undefined && i.cores <= 2) return { mode: "2d", reason: "Saving power on this device" };
  return { mode: "3d", reason: "3D agent" };
}

export const SIMPLE_GRAPHICS_KEY = "bagcheck:simple-graphics";

export function readSimplePref(): boolean {
  try {
    return localStorage.getItem(SIMPLE_GRAPHICS_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSimplePref(on: boolean) {
  try {
    localStorage.setItem(SIMPLE_GRAPHICS_KEY, on ? "1" : "0");
  } catch {
    /* storage blocked: preference lasts for this page only */
  }
  window.dispatchEvent(new Event("bagcheck:graphics"));
}

export function detectGraphics() {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  let webgl = false;
  try {
    const c = document.createElement("canvas");
    webgl = Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webgl = false;
  }
  return chooseGraphics({
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    webgl,
    deviceMemory: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
    userPrefersSimple: readSimplePref(),
    saveData: nav.connection?.saveData,
  });
}
