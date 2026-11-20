"use client";

import { useSyncExternalStore } from "react";
import { GRAPHICS_EVENT } from "@/lib/client/graphics";

/** true when rich motion is allowed: "full" graphics and no reduced-motion request. */
function read(): boolean {
  return document.documentElement.dataset.graphics !== "simple" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  window.addEventListener(GRAPHICS_EVENT, cb);
  mq.addEventListener("change", cb);
  // the boot script / AppShell set data-graphics: watch the attribute too
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-graphics"] });
  return () => {
    window.removeEventListener(GRAPHICS_EVENT, cb);
    mq.removeEventListener("change", cb);
    mo.disconnect();
  };
}

export function useFullMotion(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
