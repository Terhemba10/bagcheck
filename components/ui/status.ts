import { IconCheck, IconOctagon, IconQuestion, IconShield, IconTriangle, IconWatch } from "./icons";

/**
 * One source of truth for status: icon + label + colour. Never colour alone
 * (design spec §1.3).
 */
export type Level = "ok" | "watch" | "concern" | "danger" | "unknown" | "rescue";

export const LEVELS: Record<
  Level,
  { label: string; Icon: typeof IconCheck; text: string; soft: string; border: string }
> = {
  ok: { label: "Looks fine", Icon: IconCheck, text: "text-ok", soft: "bg-ok-soft", border: "border-ok/35" },
  watch: { label: "Worth watching", Icon: IconWatch, text: "text-teal", soft: "bg-teal-soft", border: "border-teal/35" },
  concern: { label: "Warning sign", Icon: IconTriangle, text: "text-warn", soft: "bg-warn-soft", border: "border-warn/35" },
  danger: { label: "Serious warning", Icon: IconOctagon, text: "text-danger", soft: "bg-danger-soft", border: "border-danger/35" },
  unknown: { label: "Not enough data", Icon: IconQuestion, text: "text-muted", soft: "bg-glass-strong", border: "border-line" },
  rescue: { label: "Rescue mode", Icon: IconShield, text: "text-rescue", soft: "bg-rescue-soft", border: "border-rescue/35" },
};

export type Concern = "low" | "medium" | "high";

export const CONCERN: Record<Concern, { label: string; level: Level }> = {
  low: { label: "Low concern", level: "ok" },
  medium: { label: "Medium concern", level: "concern" },
  high: { label: "High concern", level: "danger" },
};
