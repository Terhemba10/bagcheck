"use client";

import { useRouter } from "next/navigation";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CountUp } from "@/components/motion/CountUp";
import { useFullMotion } from "@/components/motion/useFullMotion";
import { Disclaimer } from "@/components/ui/Notice";
import { StateView } from "@/components/ui/StateView";
import { CONCERN, LEVELS } from "@/components/ui/status";
import { money, pct } from "@/lib/core/format";
import { filterRows, sortRows, type BoardFilter, type BoardRow, type BoardSort, type RiskBoard } from "@/lib/core/riskBoard";
import { navigateWithTransition } from "@/lib/client/viewTransition";
import { cn } from "@/lib/cn";
import { duration, ease, spring, stagger } from "@/lib/motion";

type Load = { s: "loading" } | { s: "ok"; b: RiskBoard } | { s: "error"; rate?: boolean };

const FILTERS: { id: BoardFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "memes", label: "Memes" },
  { id: "top100", label: "Top 100" },
];

const VERDICT_GLOW: Record<string, string> = {
  low: "0 0 0 1px rgb(74 222 128 / .35), 0 0 16px rgb(74 222 128 / .25)",
  medium: "0 0 0 1px rgb(251 191 36 / .4), 0 0 16px rgb(251 191 36 / .28)",
  high: "0 0 0 1px rgb(255 128 148 / .45), 0 0 18px rgb(255 128 148 / .32)",
};

// grid columns (the content area is ~650-700 px wide until 1280 with the sidebar):
//   md/lg: rank · coin · price · 24h · verdict
//   xl:    + 7-day chart + top warning sign
//   1400+: + promises
const COLS =
  "md:grid-cols-[2.5rem_minmax(8rem,1fr)_6.5rem_4.5rem_9.5rem] xl:grid-cols-[2.5rem_minmax(9rem,1.2fr)_6.5rem_4.5rem_7rem_9.5rem_minmax(10rem,1fr)] min-[87.5rem]:grid-cols-[2.5rem_minmax(9rem,1.2fr)_6.5rem_4.5rem_7rem_9.5rem_minmax(10rem,1fr)_8.5rem]";

/** Risk board: top coins by market cap, quick checks, sortable and filterable, with a calm 3D motion layer. */
export function RiskBoardView() {
  const full = useFullMotion();
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ s: "loading" });
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [sort, setSort] = useState<{ by: BoardSort; dir: "asc" | "desc" }>({ by: "concern", dir: "desc" });
  const [opening, setOpening] = useState<number | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/risk-board", { signal: ctrl.signal })
      .then(async (r) => {
        if (r.status === 429) return setLoad({ s: "error", rate: true });
        if (!r.ok) return setLoad({ s: "error" });
        setLoad({ s: "ok", b: (await r.json()) as RiskBoard });
      })
      .catch((e: Error) => e.name !== "AbortError" && setLoad({ s: "error" }));
    return () => ctrl.abort();
  }, []);

  const rows = useMemo(() => (load.s === "ok" ? sortRows(filterRows(load.b.rows, filter), sort.by, sort.dir) : []), [load, filter, sort]);

  // header floats on glass with a slight parallax while scrolling
  const { scrollY } = useScroll();
  const headerY = useTransform(scrollY, [0, 600], [0, full ? -8 : 0]);

  const open = (row: BoardRow) => {
    setOpening(row.id);
    const go = () => navigateWithTransition((h) => router.push(h), `/coin/${row.id}`);
    if (full) setTimeout(go, 160); // lift forward first, then morph into the report
    else go();
  };
  const toggleSort = (by: BoardSort) =>
    setSort((s) => (s.by === by ? { by, dir: s.dir === "desc" ? "asc" : "desc" } : { by, dir: by === "name" || by === "rank" ? "asc" : "desc" }));

  return (
    <div className="space-y-5">
      <motion.header
        style={{ y: headerY }}
        className="sticky top-2 z-20 space-y-3 rounded-2xl border border-line-strong bg-[linear-gradient(180deg,rgb(22_22_22/.96),rgb(10_10_10/.94))] px-4 py-4 shadow-[0_20px_50px_-24px_rgb(0_0_0/1),inset_0_1px_0_rgb(255_255_255/.05)] sm:px-5 md:top-4"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Risk board</h1>
            <p className="text-sm text-muted">Top coins by market cap, with Covex&apos;s warning-sign checks. Highest concern first.</p>
          </div>
          <div role="radiogroup" aria-label="Filter" className="flex rounded-lg border border-line bg-surface-2 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn("relative min-h-9 rounded-md px-3 text-sm", filter === f.id ? "text-text" : "text-muted hover:text-text")}
              >
                {filter === f.id && <motion.span layoutId="board-filter" transition={spring.snappy} className="absolute inset-0 rounded-md bg-glass-strong" />}
                <span className="relative">{f.label}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-faint">
          {load.s === "ok" && (
            <>
              Updated {new Date(load.b.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC, every 15 min ·{" "}
            </>
          )}
          &ldquo;Quick check&rdquo; uses 3 of 7 signals from market data; open a coin for the full report. Not financial advice. Covex explains data. It never tells you to buy or sell.
        </p>
      </motion.header>

      {load.s === "loading" && <StateView kind="loading" message="Covex is reading the top coins…" />}
      {load.s === "error" && <StateView kind={load.rate ? "rate-limited" : "error"} />}

      {load.s === "ok" && (
        <div role="table" aria-label="Risk board" aria-rowcount={rows.length + 1} className="space-y-2" style={{ perspective: 1400 }}>
          {/* column headers (sortable) */}
          <div role="row" className={cn("hidden items-center gap-3 px-4 text-xs text-faint md:grid", COLS)}>
            <SortHead label="#" by="rank" sort={sort} onSort={toggleSort} />
            <SortHead label="Coin" by="name" sort={sort} onSort={toggleSort} />
            <SortHead label="Price" by="price" sort={sort} onSort={toggleSort} />
            <SortHead label="24h" by="change24h" sort={sort} onSort={toggleSort} />
            <span role="columnheader" className="hidden xl:block">7 days</span>
            <SortHead label="Covex verdict" by="concern" sort={sort} onSort={toggleSort} />
            <span role="columnheader" className="hidden xl:block">Top warning sign</span>
            <span role="columnheader" className="hidden min-[87.5rem]:block">Promises</span>
          </div>
          <VirtualRows rows={rows} full={full} opening={opening} onOpen={open} />
          {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">No coins match this filter right now.</p>}
          {load.b.sparkNote && <p className="px-4 text-xs text-faint">{load.b.sparkNote}</p>}
        </div>
      )}
      <Disclaimer />
    </div>
  );
}

function SortHead({ label, by, sort, onSort }: { label: string; by: BoardSort; sort: { by: BoardSort; dir: string }; onSort: (b: BoardSort) => void }) {
  const on = sort.by === by;
  return (
    <button
      type="button"
      role="columnheader"
      aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      onClick={() => onSort(by)}
      className={cn("flex items-center gap-1 text-left hover:text-text", on && "text-text")}
    >
      {label}
      <span aria-hidden="true" className={cn("text-[10px]", !on && "opacity-0")}>{sort.dir === "asc" ? "▲" : "▼"}</span>
    </button>
  );
}

// ── virtual list: only rows in view (+ a buffer) are in the DOM; on re-sort each rendered
//    row springs to its new slot with a small lift toward the viewer (FLIP in 3D) ──────────
const ROW_H = 64;
const STEP = ROW_H + 8;
const BUFFER = 8;
const CHUNK = 6; // move the window in steps of 6 rows: far fewer re-renders while scrolling

function VirtualRows({ rows, full, opening, onOpen }: { rows: BoardRow[]; full: boolean; opening: number | null; onOpen: (r: BoardRow) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: 18 });
  const [dealt, setDealt] = useState(false);

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = box.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const start = Math.max(0, Math.floor((Math.floor(-top / STEP) - BUFFER) / CHUNK) * CHUNK);
      const end = Math.min(rows.length, Math.ceil((Math.ceil((window.innerHeight - top) / STEP) + BUFFER) / CHUNK) * CHUNK);
      setRange((r) => (r.start === start && r.end === end ? r : { start, end }));
    };
    // while scrolling, rows ignore the pointer: Chrome sends a synthetic mouse-move for every row
    // that passes under a still cursor, and running hover (lift, tilt, sweep) for each one drops frames
    let idle: ReturnType<typeof setTimeout> | null = null;
    const root = document.documentElement;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
      root.dataset.scrolling = "1";
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => delete root.dataset.scrolling, 150);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      if (idle) clearTimeout(idle);
      delete root.dataset.scrolling;
    };
  }, [rows.length]);

  // rows are "dealt" once; rows mounted later by scrolling just appear
  useEffect(() => {
    const t = setTimeout(() => setDealt(true), 1400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div ref={box} className="relative" style={{ height: rows.length * STEP }}>
      {rows.slice(range.start, range.end).map((r, k) => {
        const i = range.start + k;
        return (
          <Slot key={r.id} index={i} full={full}>
            <Row row={r} index={i} full={full} deal={full && !dealt} opening={opening === r.id} onOpen={() => onOpen(r)} />
          </Slot>
        );
      })}
    </div>
  );
}

/** Positions a row; when its index changes it glides there with a small lift (translateZ). */
function Slot({ index, full, children }: { index: number; full: boolean; children: React.ReactNode }) {
  const prev = useRef(index);
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    if (prev.current === index) return;
    prev.current = index;
    if (!full) return;
    queueMicrotask(() => setMoving(true));
    const t = setTimeout(() => setMoving(false), 320);
    return () => clearTimeout(t);
  }, [index, full]);
  const y = index * STEP;
  if (!full) return <div className="absolute inset-x-0" style={{ top: y }}>{children}</div>;
  return (
    <motion.div className="absolute inset-x-0 top-0" initial={false} animate={{ y, z: moving ? 26 : 0 }} transition={spring.soft} style={{ transformPerspective: 1400 }}>
      {children}
    </motion.div>
  );
}

function Row({ row, index, full, deal, opening, onOpen }: { row: BoardRow; index: number; full: boolean; deal: boolean; opening: boolean; onOpen: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const z = useMotionValue(0);
  const srx = useSpring(rx, spring.tilt);
  const sry = useSpring(ry, spring.tilt);
  const sz = useSpring(z, spring.tilt);
  const MAX = 3;

  // the 3D transform is only bound while hovered (+ settle time): 200 permanently-3D rows means
  // 200 GPU layers, which makes scrolling stutter on integrated graphics
  const [lifted, setLifted] = useState(false);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMove = (e: React.PointerEvent) => {
    if (!full || e.pointerType !== "mouse") return;
    if (settle.current) clearTimeout(settle.current);
    if (!lifted) setLifted(true);
    const b = ref.current!.getBoundingClientRect();
    ry.set(((e.clientX - b.left) / b.width - 0.5) * 2 * MAX);
    rx.set(-((e.clientY - b.top) / b.height - 0.5) * 2 * MAX * 0.6);
    z.set(18);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
    z.set(0);
    settle.current = setTimeout(() => setLifted(false), 450); // let it settle back, then go flat
  };

  const v = row.verdict;
  const c = v.concern ? CONCERN[v.concern] : null;
  const delay = Math.min(index, 18) * stagger.tight;
  const label = `${row.name} (${row.symbol}), ${c?.label ?? "not enough data"}${v.kind === "quick" ? ", quick check" : ""}. Open the report.`;

  return (
    <motion.div
      ref={ref}
      role="row"
      aria-rowindex={index + 2}
      onFocus={(e) => e.currentTarget.scrollIntoView({ block: "nearest" })}
      initial={deal ? { opacity: 0, z: -80, y: 10, rotateX: -6 } : false}
      animate={!full ? undefined : opening ? { z: 60, scale: 1.015, opacity: 1, y: 0, rotateX: 0 } : { opacity: 1, z: 0, y: 0, rotateX: 0 }}
      transition={{ ...spring.soft, delay: opening || !deal ? 0 : delay }}
      style={full && (lifted || opening) ? { rotateX: srx, rotateY: sry, translateZ: sz, transformPerspective: 1200 } : undefined}
      onPointerMove={onMove}
      onPointerLeave={reset}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      tabIndex={0}
      aria-label={label}
      className={cn(
        "board-row grid h-16 cursor-pointer overflow-hidden border border-line bg-surface-1 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-xl px-4 py-3 outline-none transition-shadow duration-200 hover:shadow-[0_18px_40px_-18px_rgb(0_0_0/1),0_0_0_1px_rgb(255_255_255/.1)] focus-visible:shadow-[0_0_0_2px_var(--color-teal)]",
        COLS,
      )}
    >
      <span role="cell" className="tabular hidden text-sm text-faint md:block">{row.rank ?? "—"}</span>
      <span role="cell" className="min-w-0" style={opening ? { viewTransitionName: "coin-hero" } : undefined}>
        <span className="block truncate font-medium">
          {row.name} <span className="text-sm text-muted">{row.symbol}</span>
        </span>
        <span className="block text-xs text-faint md:hidden">
          #{row.rank} · {money(row.price)} · <span className={(row.change24h ?? 0) >= 0 ? "text-ok" : "text-danger"}>{pct(row.change24h)}</span>
        </span>
      </span>
      <span role="cell" className="tabular hidden text-sm md:block">
        {/* count up only when first dealt; rows scrolled to later show the price at once (smooth scrolling) */}
        {deal && index < 14 ? <CountUp value={money(row.price)} /> : money(row.price)}
      </span>
      <span role="cell" className={cn("tabular hidden text-sm md:block", (row.change24h ?? 0) >= 0 ? "text-ok" : "text-danger")}>{pct(row.change24h)}</span>
      <span role="cell" className="hidden xl:block">
        {row.spark || (row.rank ?? 999) <= 100 ? (
          <Spark values={row.spark} up={(row.change7d ?? 0) >= 0} full={deal} delay={delay + 0.15} label={`${row.name}, 7 days: ${pct(row.change7d)}`} />
        ) : (
          <span className="text-xs text-faint">Top 100 only</span>
        )}
      </span>
      <span role="cell" className="justify-self-end md:justify-self-start">
        <Pill deal={deal} delay={delay + 0.2} className={cn("inline-flex flex-col items-start rounded-full px-2.5 py-1 text-xs font-medium", c ? cn(LEVELS[c.level].text, LEVELS[c.level].soft) : "bg-glass-strong text-faint")} glow={full && v.concern ? VERDICT_GLOW[v.concern] : undefined}>
          {c?.label ?? "Not enough data"}
        </Pill>
        <span className="mt-0.5 block text-[11px] text-faint">{v.kind === "full" ? "Full report" : "Quick check"}</span>
      </span>
      <span role="cell" className="hidden min-w-0 text-sm xl:block">
        {row.topSign ? (
          <>
            <span className={cn("font-medium", LEVELS[row.topSign.level].text)}>{row.topSign.title}</span>
            <span className="block truncate text-xs text-muted">{row.topSign.text}</span>
          </>
        ) : (
          <span className="text-xs text-faint">Nothing stands out</span>
        )}
      </span>
      <span role="cell" className="hidden text-xs min-[87.5rem]:block">
        {row.promises ? (
          row.promises.delivered + row.promises.datePassed + row.promises.upcoming > 0 ? (
            <span className="text-muted">
              <span className="text-ok">{row.promises.delivered} delivered</span> · <span className="text-warn">{row.promises.datePassed} date passed</span>
            </span>
          ) : (
            <span className="text-faint">No dated promises</span>
          )
        ) : (
          <span className="text-faint">Not checked yet</span>
        )}
      </span>
    </motion.div>
  );
}

/** Verdict pill: pops in with a soft spring when the rows are dealt, plain afterwards. */
function Pill({ deal, delay, className, glow, children }: { deal: boolean; delay: number; className: string; glow?: string; children: React.ReactNode }) {
  if (!deal) return <span className={className} style={glow ? { boxShadow: glow } : undefined}>{children}</span>;
  return (
    <motion.span
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 18, delay }}
      className={className}
      style={glow ? { boxShadow: glow } : undefined}
    >
      {children}
    </motion.span>
  );
}

function Spark({ values, up, full, delay, label }: { values: number[] | null; up: boolean; full: boolean; delay: number; label: string }) {
  if (!values || values.length < 2) return <span className="text-xs text-faint">No chart yet</span>;
  const w = 104;
  const h = 30;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((v - min) / (max - min || 1)) * (h - 6)).toFixed(1)}`);
  const d = `M${pts.join(" L")}`;
  const color = up ? "var(--color-ok)" : "var(--color-danger)";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      {full ? (
        <motion.path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: duration.slow * 2.2, ease: ease.out, delay }}
        />
      ) : (
        <path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
