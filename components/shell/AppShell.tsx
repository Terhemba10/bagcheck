"use client";

import { MotionConfig } from "motion/react";
import { useEffect } from "react";
import { applyGraphics, GRAPHICS_EVENT } from "@/lib/client/graphics";
import { useViewTransitionResolver } from "@/lib/client/viewTransition";
import { ChatPanel } from "./ChatPanel";
import { CommandPalette, useCommandShortcut } from "./CommandPalette";
import { MobileBottomBar, MobileDrawer, MobileTopBar } from "./MobileChrome";
import { Sidebar } from "./Sidebar";

/**
 * App frame: left sidebar (rail on tablets), phone top bar + drawer + bottom bar,
 * the command palette (Ctrl+K) and the Ask Covex panel. Motion follows the
 * user's reduced-motion setting everywhere.
 */
export function AppShell({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) {
  useCommandShortcut();
  useViewTransitionResolver();
  useEffect(() => {
    applyGraphics();
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => applyGraphics();
    mq.addEventListener("change", on);
    window.addEventListener(GRAPHICS_EVENT, on);
    return () => {
      mq.removeEventListener("change", on);
      window.removeEventListener(GRAPHICS_EVENT, on);
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="depth-grid" aria-hidden="true" />
      <a
        href="#main"
        className="sr-only z-[70] rounded-md bg-teal px-4 py-2 font-medium text-teal-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Sidebar />
      <MobileTopBar />
      <div className="sb-offset flex min-h-screen flex-col pb-16 md:pb-0">
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
        {footer}
      </div>
      <MobileBottomBar />
      <MobileDrawer />
      <CommandPalette />
      <ChatPanel />
    </MotionConfig>
  );
}
