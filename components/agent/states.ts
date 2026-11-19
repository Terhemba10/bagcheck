/** Bag's states (design spec §4). Shared by the 3D and 2D renderers. */
export type AgentState = "idle" | "scanning" | "clear" | "concern" | "danger" | "rescue";

export interface AgentLook {
  /** Glow / core colour. */
  color: string;
  /** Default caption. */
  caption: string;
  /** Mouth shape. */
  mouth: "smile" | "flat" | "o" | "soft";
  /** Lean in degrees (concern). */
  lean: number;
  /** Breathing period in seconds. */
  breathe: number;
  /** Heartbeat period of the inner core in seconds. */
  heartbeat: number;
  /** How strongly the core pulses (0..1). Danger uses a slow, deep pulse instead of motion. */
  pulseDepth: number;
  rings: boolean;
  /** Protective hexagonal shield ring (danger). */
  shield: boolean;
}

export const AGENT_LOOKS: Record<AgentState, AgentLook> = {
  idle: { color: "#3ee6c8", caption: "Hi, I'm Bag. Ask me about any coin.", mouth: "smile", lean: 0, breathe: 4, heartbeat: 1.6, pulseDepth: 0.35, rings: false, shield: false },
  scanning: { color: "#5cf0d6", caption: "Checking supply… reading the roadmap…", mouth: "flat", lean: 0, breathe: 2.4, heartbeat: 1.0, pulseDepth: 0.45, rings: true, shield: false },
  clear: { color: "#4ade80", caption: "No major warning signs in the data.", mouth: "smile", lean: 0, breathe: 4, heartbeat: 1.6, pulseDepth: 0.35, rings: false, shield: false },
  concern: { color: "#fbbf24", caption: "A few things are worth a closer look.", mouth: "flat", lean: 8, breathe: 3.6, heartbeat: 1.4, pulseDepth: 0.4, rings: false, shield: false },
  // no shaking or flashing: a slow, deep pulse and a shield ring instead
  danger: { color: "#ff8094", caption: "Several warning signs. Here's the evidence.", mouth: "o", lean: 0, breathe: 5, heartbeat: 2.4, pulseDepth: 0.75, rings: false, shield: true },
  rescue: { color: "#7ab2ff", caption: "Let's take this one step at a time.", mouth: "soft", lean: 0, breathe: 5.5, heartbeat: 2.0, pulseDepth: 0.3, rings: false, shield: false },
};

export const AGENT_STATES = Object.keys(AGENT_LOOKS) as AgentState[];

/** Default narration while scanning (the report page passes its own live steps). */
export const SCAN_STEPS = ["Checking supply…", "Reading the roadmap…", "Checking the contract…", "Looking at liquidity…"];

/**
 * "Lub-dub" heartbeat curve in 0..1 for time t and period p. Pure, tested.
 * Two soft gaussian beats, the second smaller, then rest.
 */
export function heartbeat(t: number, period: number): number {
  const x = (((t % period) + period) % period) / period;
  const g = (c: number, w: number) => Math.exp(-((x - c) ** 2) / (2 * w * w));
  return Math.min(1, g(0.08, 0.035) + 0.6 * g(0.24, 0.04));
}
