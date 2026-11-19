import { cn } from "@/lib/cn";
import { CONCERN, LEVELS, type Concern, type Level } from "./status";

/** Icon + label + colour. Never colour alone. */
export function StatusPill({ level, label, size = "md", className }: { level: Level; label?: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const l = LEVELS[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        l.text,
        l.soft,
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-2.5 py-1 text-sm",
        size === "lg" && "px-4 py-2 text-base",
        className,
      )}
    >
      <l.Icon className={size === "lg" ? "size-5" : "size-4"} />
      {label ?? l.label}
    </span>
  );
}

export function ScoreBadge({ concern, scored, total }: { concern: Concern | null; scored: number; total: number }) {
  const c = concern ? CONCERN[concern] : null;
  return (
    <div className="flex flex-col items-start gap-2">
      <StatusPill level={c?.level ?? "unknown"} label={c?.label ?? "Not enough data to score"} size="lg" />
      <p className="text-sm text-muted">
        Scored on <span className="tabular font-medium text-text">{scored}</span> of {total} signals
        {scored < total && " (the others have no data for this coin)"}
      </p>
    </div>
  );
}
