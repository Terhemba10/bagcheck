import { LEVELS, type Level } from "./status";

/** Tiny trend line with a text summary for screen readers. */
export function Sparkline({
  values,
  level = "watch",
  label,
  width = 120,
  height = 32,
}: {
  values: number[];
  level?: Level;
  /** e.g. "Health score over the last 14 checks, from 72 to 41" */
  label: string;
  width?: number;
  height?: number;
}) {
  const color = {
    ok: "var(--color-ok)",
    watch: "var(--color-teal)",
    concern: "var(--color-warn)",
    danger: "var(--color-danger)",
    unknown: "var(--color-faint)",
    rescue: "var(--color-rescue)",
  }[level];
  if (values.length < 2) {
    return <span className="text-xs text-faint">{LEVELS.unknown.label}</span>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1]!;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <path d={`${d} L${last[0]} ${height} L${pts[0]![0]} ${height} Z`} fill={color} opacity="0.12" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
    </svg>
  );
}
