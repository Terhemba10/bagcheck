"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { IconArrowRight, IconCoin, IconLifebuoy, IconSearch } from "@/components/ui/icons";
import { agent } from "@/lib/client/agentStore";
import { readSimplePref, writeSimplePref } from "@/lib/client/graphics";
import { ui, useUi } from "@/lib/client/uiStore";
import { cn } from "@/lib/cn";
import { duration, ease } from "@/lib/motion";
import { NAV } from "./nav";

interface Coin {
  id: number;
  name: string;
  symbol: string;
  rank: number | null;
}

interface Cmd {
  key: string;
  group: "Coins" | "Go to" | "Actions";
  label: string;
  hint?: string;
  Icon: (p: { className?: string }) => React.ReactNode;
  run: () => void;
}

const EXAMPLES: Coin[] = [
  { id: 1, name: "Bitcoin", symbol: "BTC", rank: 1 },
  { id: 24478, name: "Pepe", symbol: "PEPE", rank: null },
  { id: 1027, name: "Ethereum", symbol: "ETH", rank: 2 },
];

/** Ctrl+K / ⌘K anywhere (and "/" when not typing) opens it. */
export function useCommandShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ui.openPalette();
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        ui.openPalette();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}

export function CommandPalette() {
  const { palette } = useUi();
  return <AnimatePresence>{palette && <PaletteDialog />}</AnimatePresence>;
}

function PaletteDialog() {
  const router = useRouter();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [coins, setCoins] = useState<Coin[]>(EXAMPLES);
  const [coinsFor, setCoinsFor] = useState("");
  const [active, setActive] = useState(0);
  const term = q.trim();

  // remember focus, restore on close
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => before?.focus?.();
  }, []);

  // coin search (map search: 0 CMC credits), debounced
  useEffect(() => {
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!r.ok) return;
        const j = (await r.json()) as { results: Coin[] };
        setCoins(j.results.slice(0, 6));
        setCoinsFor(term);
        setActive(0);
      } catch {
        /* aborted or offline: keep the last list */
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term]);

  const go = (href: string) => {
    ui.closePalette();
    router.push(href);
  };

  const cmds = useMemo<Cmd[]>(() => {
    const shownCoins = term.length < 2 ? EXAMPLES : coinsFor === term ? coins : [];
    const coinCmds: Cmd[] = shownCoins.map((c) => ({
      key: `coin-${c.id}`,
      group: "Coins",
      label: `${c.name}`,
      hint: c.symbol,
      Icon: IconCoin,
      run: () => go(`/coin/${c.id}`),
    }));
    const top = shownCoins[0];
    if (top && term.length >= 2) {
      coinCmds.push({ key: `rescue-${top.id}`, group: "Coins", label: `Rescue plan for ${top.name}`, hint: top.symbol, Icon: IconLifebuoy, run: () => go(`/rescue/${top.id}`) });
    }
    const t = term.toLowerCase();
    const nav: Cmd[] = NAV.filter((n) => n.href || n.action === "chat")
      .filter((n) => !t || `${n.label} ${n.keywords ?? ""}`.toLowerCase().includes(t))
      .map((n) => ({
        key: `nav-${n.id}`,
        group: n.href ? "Go to" : "Actions",
        label: n.label,
        Icon: n.Icon,
        run: () => {
          if (n.href) go(n.href);
          else {
            ui.closePalette();
            agent.openChat();
          }
        },
      }));
    const actions: Cmd[] = [
      {
        key: "graphics",
        group: "Actions" as const,
        label: "Toggle simple graphics",
        Icon: IconArrowRight,
        run: () => {
          writeSimplePref(!readSimplePref());
          ui.closePalette();
        },
      },
    ].filter((a) => !t || a.label.toLowerCase().includes(t) || "graphics motion simple".includes(t));
    return [...coinCmds, ...nav, ...actions];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `go` is stable enough (router)
  }, [term, coins, coinsFor]);

  const searching = term.length >= 2 && coinsFor !== term;
  const safeActive = Math.min(active, Math.max(0, cmds.length - 1));

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      ui.closePalette();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (cmds.length ? (Math.min(a, cmds.length - 1) + 1) % cmds.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (cmds.length ? (Math.min(a, cmds.length - 1) - 1 + cmds.length) % cmds.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      cmds[safeActive]?.run();
    } else if (e.key === "Tab") {
      e.preventDefault(); // focus stays in the dialog
    }
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" onKeyDown={onKey}>
      <motion.div
        className="absolute inset-0 bg-black/70"
        onClick={ui.closePalette}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: duration.fast }}
        aria-hidden="true"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Search coins and pages"
        className="glass-blur relative w-full max-w-xl overflow-hidden rounded-xl"
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -4 }}
        transition={{ duration: duration.base, ease: ease.out }}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <IconSearch className="size-5 shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls={`${id}-list`}
            aria-activedescendant={cmds.length ? `${id}-${safeActive}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            placeholder="Coin name, symbol or contract, or a page…"
            className="min-h-14 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
          />
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[11px] text-faint sm:inline">Esc</kbd>
        </div>
        <ul id={`${id}-list`} role="listbox" aria-label="Results" className="max-h-[min(60vh,26rem)] overflow-y-auto p-2">
          {searching && (
            <li role="presentation" className="px-3 py-2 text-sm text-muted">
              <span className="shimmer-text">Searching CoinMarketCap…</span>
            </li>
          )}
          {!searching && term.length >= 2 && coinsFor === term && coins.length === 0 && (
            <li role="presentation" className="px-3 py-2 text-sm text-muted">No coins match “{term}”.</li>
          )}
          {cmds.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <li key={c.key} role="presentation">
                {header && <p className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase">{header}</p>}
                <div
                  id={`${id}-${i}`}
                  role="option"
                  aria-selected={i === safeActive}
                  onMouseMove={() => setActive(i)}
                  onClick={() => c.run()}
                  className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-sm", i === safeActive ? "bg-glass-strong text-text" : "text-muted")}
                >
                  <c.Icon className={cn("size-4 shrink-0", i === safeActive && "text-teal")} />
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="text-xs text-faint">{c.hint}</span>}
                  {i === safeActive && <span className="text-[11px] text-faint">Enter</span>}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-line px-4 py-2 text-[11px] text-faint">↑↓ to move · Enter to open · Searching coins costs 0 CMC credits</p>
      </motion.div>
    </div>
  );
}
