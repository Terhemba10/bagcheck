import { cn } from "@/lib/cn";
import { AGENT_LOOKS, type AgentState } from "./states";

/**
 * Bag in 2D: SVG + CSS. Used for the corner agent, alerts, reduced motion,
 * weak devices and as the 3D placeholder while it loads. Decorative.
 */
export function Agent2D({
  state,
  size = 160,
  fluid = false,
  className,
}: {
  state: AgentState;
  size?: number;
  /** Fill the parent's width (square) instead of a fixed pixel size. */
  fluid?: boolean;
  className?: string;
}) {
  const look = AGENT_LOOKS[state];
  const c = look.color;
  const id = `bag-${state}`;
  const motion =
    state === "danger" ? "animate-sway" : state === "concern" ? "" : "animate-bob";

  return (
    <div
      aria-hidden="true"
      className={cn("relative inline-block", fluid && "aspect-square w-full", className)}
      style={fluid ? undefined : { width: size, height: size }}
      data-agent-state={state}
    >
      {/* outer glow */}
      <div
        className="absolute inset-[6%] rounded-full blur-2xl animate-breathe"
        style={{ background: c, opacity: 0.35, animationDuration: `${look.breathe}s` }}
      />
      <div
        className={cn("absolute inset-0", motion)}
        style={{ transform: look.lean ? `rotate(${look.lean}deg)` : undefined, transformOrigin: "50% 80%" }}
      >
        <svg viewBox="0 0 200 200" width={fluid ? "100%" : size} height={fluid ? "100%" : size}>
          <defs>
            <radialGradient id={`${id}-body`} cx="38%" cy="32%" r="75%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="28%" stopColor={c} stopOpacity="0.55" />
              <stop offset="75%" stopColor="#0c1a3a" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#070b18" stopOpacity="1" />
            </radialGradient>
            <radialGradient id={`${id}-core`} cx="50%" cy="55%" r="50%">
              <stop offset="0%" stopColor={c} stopOpacity="0.9" />
              <stop offset="100%" stopColor={c} stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* body */}
          <circle cx="100" cy="100" r="78" fill={`url(#${id}-body)`} />
          <circle cx="100" cy="108" r="54" fill={`url(#${id}-core)`} opacity="0.55" />
          <circle cx="100" cy="100" r="78" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1.5" />
          {/* highlight */}
          <ellipse cx="72" cy="62" rx="22" ry="12" fill="#ffffff" opacity="0.22" transform="rotate(-28 72 62)" />
          {/* face of light */}
          <g fill="#f4fffd" style={{ filter: `drop-shadow(0 0 6px ${c})` }}>
            <rect x="70" y="86" width="13" height="22" rx="6.5" />
            <rect x="117" y="86" width="13" height="22" rx="6.5" />
          </g>
          <Mouth kind={look.mouth} color={c} />
          {/* scanning rings */}
          {look.rings && (
            <g className="origin-center animate-orbit" style={{ transformBox: "fill-box" }}>
              <ellipse cx="100" cy="100" rx="96" ry="30" fill="none" stroke={c} strokeOpacity="0.7" strokeWidth="2" strokeDasharray="6 10" transform="rotate(-18 100 100)" />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

function Mouth({ kind, color }: { kind: "smile" | "flat" | "o" | "soft"; color: string }) {
  const common = { stroke: "#f4fffd", strokeWidth: 5, strokeLinecap: "round" as const, fill: "none", style: { filter: `drop-shadow(0 0 5px ${color})` } };
  switch (kind) {
    case "smile":
      return <path d="M84 128 Q100 142 116 128" {...common} />;
    case "soft":
      return <path d="M88 130 Q100 137 112 130" {...common} />;
    case "flat":
      return <path d="M88 132 L112 132" {...common} />;
    case "o":
      return <ellipse cx="100" cy="133" rx="6" ry="7" {...common} strokeWidth={4} />;
  }
}
