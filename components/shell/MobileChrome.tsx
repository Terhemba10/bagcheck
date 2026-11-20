"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { CovexLogo } from "@/components/brand/CovexMark";
import { IconMenu, IconSearch, IconX } from "@/components/ui/icons";
import { agent, useAgent } from "@/lib/client/agentStore";
import { ui, useUi } from "@/lib/client/uiStore";
import { cn } from "@/lib/cn";
import { duration, ease, spring } from "@/lib/motion";
import { activeNavId, NAV } from "./nav";
import { SidebarBody } from "./Sidebar";

/** Phones (<768px): top bar with menu + search, a left drawer, and a bottom bar. */
export function MobileTopBar() {
  const { working, tone } = useAgent();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-black/90 px-2 md:hidden print:hidden">
      <button type="button" onClick={ui.openDrawer} aria-label="Open menu" aria-controls="drawer" className="grid size-11 place-items-center rounded-md text-muted hover:text-text">
        <IconMenu className="size-5" />
      </button>
      <Link href="/" className="flex items-center rounded-md px-1" aria-label="Covex home">
        <CovexLogo size={24} tone={tone} working={working} />
      </Link>
      <button type="button" onClick={ui.openPalette} aria-label="Search coins and pages" className="ml-auto grid size-11 place-items-center rounded-md text-muted hover:text-text">
        <IconSearch className="size-5" />
      </button>
    </header>
  );
}

export function MobileDrawer() {
  const { drawer } = useUi();
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // close on navigation
  useEffect(() => ui.closeDrawer(), [pathname]);

  // focus the panel, trap Tab inside, Esc closes, restore focus after
  useEffect(() => {
    if (!drawer) return;
    const before = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") ui.closeDrawer();
      if (e.key !== "Tab" || !panel) return;
      const f = Array.from(panel.querySelectorAll<HTMLElement>("a[href],button:not([disabled])"));
      if (!f.length) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      before?.focus?.();
    };
  }, [drawer]);

  return (
    <AnimatePresence>
      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden">
          <motion.div
            className="absolute inset-0 bg-black/70"
            onClick={ui.closeDrawer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast }}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            id="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] border-r border-line bg-surface-1"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: duration.base, ease: ease.out }}
          >
            <button type="button" onClick={ui.closeDrawer} aria-label="Close menu" className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-md text-muted hover:text-text">
              <IconX className="size-5" />
            </button>
            <SidebarBody variant="drawer" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function MobileBottomBar() {
  const pathname = usePathname();
  const active = activeNavId(pathname);
  const { chatOpen } = useAgent();
  const items = NAV.filter((n) => n.bottom);
  return (
    <nav aria-label="Main actions" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-black/95 pb-[env(safe-area-inset-bottom)] md:hidden print:hidden">
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const on = item.id === active || (item.action === "chat" && chatOpen);
          const inner = (
            <>
              {on && <motion.span layoutId="bottom-active" transition={spring.snappy} className="absolute inset-x-5 top-0 h-0.5 rounded-b bg-teal" aria-hidden="true" />}
              <item.Icon className={cn("size-5", on && "text-teal")} />
              <span className="text-[11px]">{item.label === "Check a coin" ? "Check" : item.label === "Ask Covex" ? "Ask" : item.label}</span>
            </>
          );
          const cls = cn("relative flex min-h-14 w-full flex-col items-center justify-center gap-1", on ? "text-text" : "text-muted");
          return (
            <li key={item.id}>
              {item.href ? (
                <Link href={item.href} className={cls} aria-current={on ? "page" : undefined}>
                  {inner}
                </Link>
              ) : (
                <button type="button" className={cls} aria-label={item.label} onClick={() => (item.action === "chat" ? agent.toggleChat() : ui.openPalette())}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
