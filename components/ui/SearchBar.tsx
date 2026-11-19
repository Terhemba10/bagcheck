"use client";

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
export function SearchBar({ size = "lg", autoFocus }: { size?: "lg" | "md"; autoFocus?: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
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
    router.push(`/coin/${r.id}`);
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
      <label htmlFor={`${listId}-input`} className={cn("mb-2 block font-medium", lg ? "text-base" : "sr-only")}>
        Check any coin
      </label>
      <div
        className={cn(
          "glass flex items-center gap-3 rounded-xl transition-shadow duration-200 focus-within:shadow-[0_0_0_2px_var(--color-teal),0_12px_40px_-12px_rgb(62_230_200/.5)]",
          lg ? "px-5 py-4" : "px-4 py-2.5",
        )}
      >
        <IconSearch className={cn("shrink-0 text-muted", lg ? "size-6" : "size-5")} />
        <input
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
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder="Name, symbol or contract address"
          className={cn("w-full bg-transparent outline-none placeholder:text-faint", lg ? "text-lg" : "text-base")}
        />
        {status === "loading" && <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-muted border-t-transparent" aria-hidden="true" />}
      </div>

      <p className="sr-only" aria-live="polite">
        {status === "busy"
          ? "CoinMarketCap is busy. Please try again in a minute."
          : status === "error"
            ? "Search isn't working right now."
            : showList
              ? `${results.length} results`
              : ""}
      </p>

      {showList && (
        <ul
          id={`${listId}-list`}
          role="listbox"
          aria-label="Matching coins"
          className="glass absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-lg bg-bg-raised/95 p-1"
        >
          {status === "busy" && <li className="px-3 py-2 text-sm text-warn">CoinMarketCap is busy. Try again in a minute.</li>}
          {status === "error" && <li className="px-3 py-2 text-sm text-warn">Search isn&apos;t working right now.</li>}
          {status === "idle" && results.length === 0 && <li className="px-3 py-2 text-sm text-muted">No coins match “{q.trim()}”.</li>}
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
  );
}
