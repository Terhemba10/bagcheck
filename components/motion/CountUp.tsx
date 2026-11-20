"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/**
 * Counts a formatted number up once when it scrolls into view ("$26.2M", "100%", "0.26").
 * The digits animate; prefix, suffix and decimals come from the final string, so
 * the end state is always exactly the text the server computed. Screen readers get
 * the final value only.
 */
export function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const parsed = parse(value);
  const [shown, setShown] = useState(parsed ? format(parsed, 0) : value);

  useEffect(() => {
    if (!parsed || !inView) return;
    if (reduce || document.documentElement.dataset.graphics === "simple") {
      queueMicrotask(() => setShown(value));
      return;
    }
    const c = animate(0, parsed.n, {
      duration: 0.9,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setShown(format(parsed, v)),
      onComplete: () => setShown(value),
    });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parsed derives from value
  }, [inView, value, reduce]);

  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{value}</span>
    </span>
  );
}

interface Parsed {
  pre: string;
  n: number;
  dec: number;
  post: string;
}

/** "$26.2M" → { pre: "$", n: 26.2, dec: 1, post: "M" }. Null for things we shouldn't animate. */
export function parse(v: string): Parsed | null {
  const m = /^([^\d-]*)(-?\d[\d,]*(?:\.\d+)?)(.*)$/.exec(v.trim());
  if (!m) return null;
  const num = m[2]!.replace(/,/g, "");
  const n = Number(num);
  if (!Number.isFinite(n)) return null;
  return { pre: m[1]!, n, dec: num.includes(".") ? num.split(".")[1]!.length : 0, post: m[3]! };
}

function format(p: Parsed, v: number): string {
  const s = v.toLocaleString("en-US", { minimumFractionDigits: p.dec, maximumFractionDigits: p.dec });
  return `${p.pre}${s}${p.post}`;
}
