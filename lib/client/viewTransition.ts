"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Shared-element page transitions with the browser's View Transitions API (no library).
 * The element that should morph gets `view-transition-name: coin-hero` on both pages; the
 * transition waits for the new route to render. Falls back to plain navigation when the API
 * is missing or motion is reduced / simple graphics is on.
 */
let resolveNav: (() => void) | null = null;

type VTDocument = Document & { startViewTransition?: (cb: () => Promise<void>) => { finished: Promise<void> } };

export function canViewTransition(): boolean {
  const d = document as VTDocument;
  return (
    typeof d.startViewTransition === "function" &&
    document.documentElement.dataset.graphics !== "simple" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function navigateWithTransition(push: (href: string) => void, href: string) {
  const d = document as VTDocument;
  if (!canViewTransition()) {
    push(href);
    return;
  }
  document.documentElement.dataset.vt = "1"; // page fade-in steps aside during the morph
  const t = d.startViewTransition!(
    () =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 1200); // never hang if the route is slow
        resolveNav = () => {
          clearTimeout(timer);
          // one frame so the new page's hero is painted
          requestAnimationFrame(() => resolve());
        };
        push(href);
      }),
  );
  t.finished.finally(() => delete document.documentElement.dataset.vt);
}

/** Mounted once in the app shell: tells a pending transition that the new route rendered. */
export function useViewTransitionResolver() {
  const pathname = usePathname();
  useEffect(() => {
    if (resolveNav) {
      const r = resolveNav;
      resolveNav = null;
      r();
    }
  }, [pathname]);
}
