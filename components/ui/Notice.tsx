import { cn } from "@/lib/cn";
import { IconInfo, IconOctagon, IconShield, IconTriangle } from "./icons";

type Tone = "info" | "warn" | "danger" | "rescue";

const TONE = {
  info: { Icon: IconInfo, cls: "border-info/40 bg-info-soft", icon: "text-info" },
  warn: { Icon: IconTriangle, cls: "border-warn/40 bg-warn-soft", icon: "text-warn" },
  danger: { Icon: IconOctagon, cls: "border-danger/40 bg-danger-soft", icon: "text-danger" },
  rescue: { Icon: IconShield, cls: "border-rescue/40 bg-rescue-soft", icon: "text-rescue" },
} as const;

export function Notice({
  tone = "info",
  title,
  children,
  className,
  role,
}: {
  tone?: Tone;
  title: string;
  children?: React.ReactNode;
  className?: string;
  role?: "status" | "alert" | "note";
}) {
  const t = TONE[tone];
  return (
    <div role={role ?? "note"} className={cn("flex gap-3 rounded-lg border p-4", t.cls, className)}>
      <t.Icon className={cn("mt-0.5 size-5 shrink-0", t.icon)} />
      <div className="space-y-1 text-sm leading-relaxed">
        <p className="font-semibold text-text">{title}</p>
        {children && <div className="text-text/85">{children}</div>}
      </div>
    </div>
  );
}

export const DISCLAIMER = "Not financial advice. Bagcheck explains data. It never tells you to buy or sell.";

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center gap-2 text-sm text-muted", className)}>
      <IconInfo className="size-4 shrink-0" />
      {DISCLAIMER}
    </p>
  );
}
