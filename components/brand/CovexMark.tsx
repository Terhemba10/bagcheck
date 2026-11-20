import { cn } from "@/lib/cn";
import { TONE_COLOR, type Tone } from "@/lib/client/agentStore";

/**
 * The Covex mark: an open hexagon (a convex hull, opening to the right like a "C")
 * holding a small hexagonal core. The core carries the verdict colour and breathes
 * while Covex is working; it settles when the run is done. No face, no mascot.
 */
const HULL = "M27.26 9.5 16 3 4.74 9.5v13L16 29l11.26-6.5"; // pointy-top hexagon, right edge open
const CORE = "M17.6 11.2l4.16 2.4v4.8l-4.16 2.4-4.16-2.4v-4.8z"; // small hexagon, nudged into the opening

export function CovexMark({
  size = 28,
  tone = "idle",
  working = false,
  className,
  title,
}: {
  size?: number;
  tone?: Tone;
  working?: boolean;
  className?: string;
  /** Accessible name; omit when a visible label sits next to the mark. */
  title?: string;
}) {
  const color = TONE_COLOR[tone];
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn("shrink-0 overflow-visible", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-working={working || undefined}
      data-tone={tone}
    >
      {/* solid stroke, no gradient: shared SVG ids break when the first copy sits in a hidden sidebar */}
      <path d={HULL} fill="none" stroke="#e6e6e6" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      {/* soft glow behind the core (static: no blur filters, cheap to paint) */}
      <circle cx="17.6" cy="16" r="7" fill={color} opacity={working ? 0.22 : 0.14} style={{ transition: "fill 400ms, opacity 400ms" }} />
      <path
        d={CORE}
        fill={color}
        className={cn(working && "animate-breathe")}
        style={{ transformBox: "fill-box", transformOrigin: "center", transition: "fill 400ms" }}
      />
    </svg>
  );
}

/** Mark + wordmark. */
export function CovexLogo({ size = 26, tone, working, className }: { size?: number; tone?: Tone; working?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <CovexMark size={size} tone={tone} working={working} />
      <span className="text-[17px] font-semibold tracking-tight">Covex</span>
    </span>
  );
}
