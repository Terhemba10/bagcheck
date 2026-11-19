/** Simple accessible line chart of a snapshot metric up to the alert (server-rendered SVG). */
export function BeforeAfterChart({ series, label, severity }: { series: { at: string; value: number }[]; label: string; severity: "concern" | "danger" }) {
  const w = 640;
  const h = 180;
  const pad = { l: 8, r: 8, t: 12, b: 24 };
  const vals = series.map((s) => s.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || Math.abs(max) || 1;
  const x = (i: number) => pad.l + (i / (series.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (h - pad.t - pad.b);
  const d = series.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(s.value).toFixed(1)}`).join(" ");
  const color = severity === "danger" ? "var(--color-danger)" : "var(--color-warn)";
  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={`${label}: ${series.length} checks from ${fmtDay(series[0]!.at)} to ${fmtDay(series.at(-1)!.at)}`}>
        <path d={`${d} L${x(series.length - 1)} ${h - pad.b} L${x(0)} ${h - pad.b} Z`} fill={color} opacity="0.1" />
        <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {series.map((s, i) => (
          <circle key={i} cx={x(i)} cy={y(s.value)} r={i === series.length - 1 ? 4.5 : 2.5} fill={color} />
        ))}
        <text x={pad.l} y={h - 6} fill="var(--color-faint)" fontSize="12">{fmtDay(series[0]!.at)}</text>
        <text x={w - pad.r} y={h - 6} fill="var(--color-faint)" fontSize="12" textAnchor="end">{fmtDay(series.at(-1)!.at)}</text>
      </svg>
      <figcaption className="text-xs text-faint">Each point is one of Bag&apos;s checks (live CoinMarketCap data at the time).</figcaption>
    </figure>
  );
}
