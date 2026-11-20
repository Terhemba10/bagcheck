"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useRef } from "react";
import { CovexLogo, CovexMark } from "@/components/brand/CovexMark";
import { IconPanelLeft } from "@/components/ui/icons";
import { agent, TONE_LABEL, useAgent } from "@/lib/client/agentStore";
import { ui, useUi } from "@/lib/client/uiStore";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { GraphicsToggle } from "./GraphicsToggle";
import { activeNavId, NAV, type NavItem } from "./nav";
import { PlanPill } from "./PlanPill";

/** Desktop/tablet sidebar: fixed on the left. Full at ≥1024px (collapsible), icon rail at 768–1023px. */
export function Sidebar() {
  const { collapsed } = useUi();
  return (
    <aside
      aria-label="Sidebar"
      className="sb-width fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface-1 md:flex print:hidden"
    >
      <SidebarBody variant="sidebar" />
      <button
        type="button"
        onClick={ui.toggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute top-5 -right-3.5 hidden size-7 place-items-center rounded-full border border-line-strong bg-surface-2 text-muted hover:text-text lg:grid"
      >
        <IconPanelLeft className="size-3.5" />
      </button>
    </aside>
  );
}

/**
 * Logo, search, nav, then plan + settings at the bottom.
 * `labels="auto"` hides labels in rail mode (CSS); the drawer always shows them.
 */
export function SidebarBody({ variant }: { variant: "sidebar" | "drawer" }) {
  const pathname = usePathname();
  const active = activeNavId(pathname);
  const { working, tone, chatOpen } = useAgent();
  const auto = variant === "sidebar";
  const listRef = useRef<HTMLUListElement>(null);

  // ↑/↓ move between nav items (Tab still works as usual)
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-nav]") ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* logo + agent presence */}
      <div className="flex h-16 shrink-0 items-center px-[22px]">
        <Link href="/" className="flex items-center rounded-md" aria-label={`Covex home. ${working ? "Covex is working" : TONE_LABEL[tone]}`}>
          {auto ? (
            <>
              <CovexMark size={28} tone={tone} working={working} />
              <span className="sb-label ml-2.5 text-[17px] font-semibold tracking-tight">Covex</span>
            </>
          ) : (
            <CovexLogo size={28} tone={tone} working={working} />
          )}
        </Link>
      </div>

      {/* command palette trigger */}
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={ui.openPalette}
          className="sb-item group relative flex min-h-10 w-full items-center gap-3 rounded-md border border-line bg-surface-2 px-3 text-sm text-muted hover:border-line-strong hover:text-text"
          aria-label="Search coins and pages (Ctrl+K)"
        >
          <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className={cn(auto && "sb-label", "flex-1 text-left")}>Search…</span>
          <kbd className={cn(auto && "sb-label", "rounded border border-line px-1.5 py-0.5 font-sans text-[11px] text-faint")}>Ctrl K</kbd>
          {auto && <Tip>Search (Ctrl+K)</Tip>}
        </button>
      </div>

      <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto px-3 py-2" onKeyDown={onKeyDown}>
        <ul ref={listRef} className="space-y-0.5">
          {NAV.map((item) => (
            <li key={item.id}>
              <NavEntry item={item} active={item.id === active || (item.action === "chat" && chatOpen)} auto={auto} variant={variant} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="shrink-0 space-y-1 border-t border-line px-3 py-3">
        <PlanPill auto={auto} />
        <GraphicsToggle auto={auto} />
        <Link
          href="/disclaimer"
          className="sb-item group relative flex min-h-9 items-center gap-3 rounded-md px-3 text-xs text-faint hover:bg-glass hover:text-text"
        >
          <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01M11 12h1v4h1" />
          </svg>
          <span className={cn(auto && "sb-label")}>Not financial advice</span>
          {auto && <Tip>Not financial advice</Tip>}
        </Link>
      </div>
    </div>
  );
}

function NavEntry({ item, active, auto, variant }: { item: NavItem; active: boolean; auto: boolean; variant: string }) {
  const cls = cn(
    "sb-item group relative flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-sm outline-none",
    active ? "text-text" : "text-muted hover:text-text",
  );
  const inner = (
    <>
      {active && (
        <motion.span
          layoutId={`nav-active-${variant}`}
          transition={spring.snappy}
          className="absolute inset-0 rounded-md border border-line bg-glass-strong"
          aria-hidden="true"
        >
          <span className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r bg-teal" />
        </motion.span>
      )}
      <item.Icon className={cn("relative size-[18px] shrink-0", active && "text-teal")} />
      <span className={cn("relative truncate", auto && "sb-label")}>{item.label}</span>
      {auto && <Tip>{item.label}</Tip>}
    </>
  );
  const onAction = () => {
    ui.closeDrawer();
    if (item.action === "palette") ui.openPalette();
    if (item.action === "chat") agent.toggleChat();
  };
  return item.href ? (
    <Link href={item.href} className={cls} aria-current={active ? "page" : undefined} aria-label={item.label} data-nav onClick={() => ui.closeDrawer()}>
      {inner}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onAction} aria-label={item.label} aria-pressed={item.action === "chat" ? active : undefined} data-nav>
      {inner}
    </button>
  );
}

/** Tooltip shown in rail mode (CSS decides when). */
export function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="tooltip"
      className="sb-tip pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2 rounded-md border border-line-strong bg-surface-3 px-2.5 py-1.5 text-xs whitespace-nowrap text-text shadow-[var(--shadow-pop)]"
    >
      {children}
    </span>
  );
}
