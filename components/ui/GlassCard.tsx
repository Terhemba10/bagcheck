import type { ElementType, HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { LEVELS, type Level } from "./status";

export function GlassCard({
  className,
  interactive,
  level,
  as,
  ...props
}: HTMLAttributes<HTMLElement> & { interactive?: boolean; level?: Level; as?: "div" | "section" | "article" | "li" }) {
  const Tag: ElementType = as ?? "div";
  return (
    <Tag
      className={cn(
        "glass rounded-lg p-5",
        interactive && "transition-colors duration-200 hover:bg-glass-strong",
        level && level !== "unknown" && cn("border-l-4", LEVELS[level].border),
        className,
      )}
      {...props}
    />
  );
}
