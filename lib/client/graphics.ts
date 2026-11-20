/**
 * "Simple graphics" decision. Full = hover tilt, light edges, depth background,
 * staggered 3D-ish reveals. Simple = flat, fades only. Pure (inputs passed in) so
 * it can be unit-tested; `detectGraphics()` reads the real browser.
 */
export interface GraphicsInputs {
  reducedMotion: boolean;
  deviceMemory?: number;
  cores?: number;
  userPrefersSimple: boolean;
  saveData?: boolean;
}

export type GraphicsMode = "full" | "simple";

export function chooseGraphics(i: GraphicsInputs): { mode: GraphicsMode; reason: string } {
  if (i.userPrefersSimple) return { mode: "simple", reason: "You chose simple graphics" };
  if (i.reducedMotion) return { mode: "simple", reason: "Your device asks for reduced motion" };
  if (i.saveData) return { mode: "simple", reason: "Data saver is on" };
  if (i.deviceMemory !== undefined && i.deviceMemory < 4) return { mode: "simple", reason: "Saving memory on this device" };
  if (i.cores !== undefined && i.cores <= 2) return { mode: "simple", reason: "Saving power on this device" };
  return { mode: "full", reason: "Full graphics" };
}

export const SIMPLE_GRAPHICS_KEY = "covex:simple-graphics";
const LEGACY_KEY = "bagcheck:simple-graphics";
export const GRAPHICS_EVENT = "covex:graphics";

export function readSimplePref(): boolean {
  try {
    const v = localStorage.getItem(SIMPLE_GRAPHICS_KEY) ?? localStorage.getItem(LEGACY_KEY);
    return v === "1";
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
  applyGraphics();
  window.dispatchEvent(new Event(GRAPHICS_EVENT));
}

export function detectGraphics() {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return chooseGraphics({
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    deviceMemory: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
    userPrefersSimple: readSimplePref(),
    saveData: nav.connection?.saveData,
  });
}

/** Mirror the decision onto <html data-graphics> so CSS can switch effects off. */
export function applyGraphics() {
  document.documentElement.dataset.graphics = detectGraphics().mode;
}

/**
 * Runs in <head> before first paint (stringified into an inline script), so the
 * sidebar width and graphics mode never flash. Keep it dependency-free.
 */
export const BOOT_SCRIPT = `(function(){try{var d=document.documentElement,s=localStorage;
var simple=(s.getItem("${SIMPLE_GRAPHICS_KEY}")||s.getItem("${LEGACY_KEY}"))==="1";
var n=navigator,rm=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
var low=(n.deviceMemory&&n.deviceMemory<4)||(n.hardwareConcurrency&&n.hardwareConcurrency<=2)||(n.connection&&n.connection.saveData);
d.dataset.graphics=(simple||rm||low)?"simple":"full";
if(s.getItem("covex:sidebar")==="collapsed")d.dataset.sidebar="collapsed";}catch(e){}})();`;
