"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { IconSearch } from "./icons";

interface Result {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  rank: number | null;
}

/**
 * "Check any coin": accessible combobox (ARIA 1.2 pattern) over /api/search.
 * Debounced, so typing doesn't spend calls (map search costs 0 credits anyway).
 */
/** Pepe's Ethereum contract, so "paste a contract" shows a real lookup. */
const EXAMPLE_CONTRACT = "0x6982508145454ce325ddbe47a25d4ec3d2311933";


export function SearchBar({
  size = "lg",
  autoFocus,
  examples = false,
  target = "coin",
}: {
  size?: "lg" | "md";
  autoFocus?: boolean;
  /** Which page a result opens: the report or the rescue plan. */
  target?: "coin" | "rescue";
  /** Show "Try: PEPE · SUI · paste a contract" chips. */
  examples?: boolean;
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const setQuery = (v: string) => {
    setQ(v);
    setOpen(true);
  };
  const [results, setResults] = useState<Result[]>([]);
  // the term the current results answer; until it matches the input, we're still searching
  const [resultsFor, setResultsFor] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "busy">("idle");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    // Under 2 characters the list is hidden (see showList), so there's nothing to fetch.
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setStatus("loading");
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.status === 429) return setStatus("busy");
        if (!res.ok) return setStatus("error");
        const json = (await res.json()) as { results: Result[] };
        setResults(json.results);
        setResultsFor(term);
        setActive(json.results.length ? 0 : -1);
        setOpen(true);
        setStatus("idle");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStatus("error");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const go = (r: Result) => {
    setOpen(false);
    router.push(`/${target}/${r.id}`);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      const r = results[active];
      if (r) {
        e.preventDefault();
        go(r);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && q.trim().length >= 2;
  const lg = size === "lg";

  return (
    <div className="relative w-full">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Check any coin
      </label>
      {/* z-40 anchor: the results list must sit above the chips and every later section */}
      <div data-search-anchor className="relative z-40 scroll-mt-20">
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border border-line-strong bg-surface-2 shadow-[0_1px_0_rgb(255_255_255/.05)_inset,0_24px_60px_-24px_rgb(0_0_0/1)] transition-[box-shadow,border-color] duration-200 focus-within:border-teal/60 focus-within:shadow-[0_0_0_4px_rgb(62_230_200/.12),0_24px_60px_-24px_rgb(62_230_200/.35)]",
          lg ? "min-h-16 px-5" : "min-h-12 px-4",
        )}
      >
        <IconSearch className={cn("shrink-0 text-muted", lg ? "size-6" : "size-5")} />
        <input
          ref={inputRef}
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-opt-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          onFocus={(e) => {
            setOpen(true);
            // phones: bring the box to the top so results (and the keyboard) don't hide each other
            if (window.innerWidth < 768) {
              const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              e.currentTarget.closest("[data-search-anchor]")?.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
            }
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder={lg ? "Check any coin: name, symbol or contract address" : "Coin name or address"}
          className={cn("w-full bg-transparent outline-none placeholder:text-faint", lg ? "text-lg" : "text-base")}
        />
        {status === "loading" && <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-muted border-t-transparent" aria-hidden="true" />}
        {lg && status !== "loading" && (
          <kbd className="hidden shrink-0 rounded-md border border-line px-2 py-1 text-xs text-faint sm:inline" title="Press Ctrl+K anywhere">
            Ctrl K
          </kbd>
        )}
      </div>
      {showList && (
        <ul
          id={`${listId}-list`}
          role="listbox"
          aria-label="Matching coins"
          className="absolute top-full z-50 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-line-strong bg-surface-2 p-1 shadow-[var(--shadow-pop)]"
        >
          {status === "busy" && <li className="px-3 py-2 text-sm text-warn">CoinMarketCap is busy. Try again in a minute.</li>}
          {status === "error" && <li className="px-3 py-2 text-sm text-warn">Search isn&apos;t working right now.</li>}
          {status !== "busy" && status !== "error" && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">{resultsFor === q.trim() ? <>No coins match “{q.trim()}”.</> : "Searching…"}</li>
          )}
          {results.map((r, i) => (
            <li
              key={r.id}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(r)}
              onMouseEnter={() => setActive(i)}
              className={cn("flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2", i === active && "bg-glass-strong")}
            >
              <span>
                <span className="font-medium">{r.name}</span> <span className="text-sm text-muted">{r.symbol}</span>
              </span>
              {r.rank ? <span className="tabular text-xs text-faint">#{r.rank}</span> : null}
            </li>
          ))}
        </ul>
      )}
      </div>

      {examples && (
        // hidden (not removed) while results are open, so the page below does not jump
        <p aria-hidden={showList || undefined} className={cn("mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-muted", showList && "invisible")}>
          <span className="text-faint">Try</span>
          {/* coin chips open the report directly (one click: the agent starts working on arrival) */}
          {[
            { label: "PEPE", id: 24478, name: "Pepe" },
            { label: "SUI", id: 20947, name: "Sui" },
          ].map((ex) => (
            <Link
              key={ex.label}
              href={`/${target}/${ex.id}`}
              className="inline-flex min-h-9 items-center rounded-full border border-line bg-surface-1 px-3.5 text-text transition-colors hover:border-teal/50 hover:bg-teal-soft"
              aria-label={`Check ${ex.name} (${ex.label})`}
            >
              {ex.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setQuery(EXAMPLE_CONTRACT);
              inputRef.current?.focus();
            }}
            className="min-h-9 rounded-full border border-line bg-surface-1 px-3.5 text-text transition-colors hover:border-teal/50 hover:bg-teal-soft"
            aria-label="Try a contract address (Pepe on Ethereum)"
          >
            paste a contract
          </button>
        </p>
      )}

      <p className="sr-only" aria-live="polite">
        {status === "busy"
          ? "CoinMarketCap is busy. Please try again in a minute."
          : status === "error"
            ? "Search isn't working right now."
            : showList
              ? `${results.length} results`
              : ""}
      </p>

    </div>
  );
}
