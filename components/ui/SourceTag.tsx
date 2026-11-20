import { cn } from "@/lib/cn";
import { IconArchive, IconClock, IconLive, IconLock, IconRecord } from "./icons";

/**
 * Where a piece of data came from. Shown on every data block (spec §1.4).
 *  live      fetched just now
 *  cached    fresh cache hit (with age)
 *  saved     last good copy, served because CMC refused (rate limit / credits)
 *  recorded  recorded demo from a paid plan (with date)
 *  paid-plan not available on the current CMC plan (needs a higher one; `plan` names the tier when known)
 */
export type SourceKind = "live" | "cached" | "saved" | "recorded" | "paid-plan";

export function SourceTag({
  kind,
  at,
  when: whenOverride,
  plan,
  className,
}: {
  kind: SourceKind;
  at?: string;
  /** For "paid-plan": the tier needed, when known ("Standard"). */
  plan?: string;
  /** Pre-formatted age ("4 min ago"); skips the clock-based calculation. */
  when?: string;
  className?: string;
}) {
  const when = whenOverride ?? (at ? formatWhen(kind, at) : "");
  const map = {
    live: { Icon: IconLive, text: "Live from CoinMarketCap", cls: "text-ok" },
    cached: { Icon: IconClock, text: `CoinMarketCap · ${when || "cached"}`, cls: "text-muted" },
    saved: { Icon: IconArchive, text: `Saved copy · ${when || "older data"}`, cls: "text-warn" },
    recorded: { Icon: IconRecord, text: `Recorded from the live CMC API${when ? ` on ${when}` : ""}`, cls: "text-info" },
    "paid-plan": { Icon: IconLock, text: `Needs a higher CMC plan${plan ? ` (${plan})` : ""}`, cls: "text-faint" },
  }[kind];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", map.cls, className)}>
      <map.Icon className="size-3.5" />
      {map.text}
    </span>
  );
}

function formatWhen(kind: SourceKind, iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  if (kind === "recorded") {
    return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  const mins = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
