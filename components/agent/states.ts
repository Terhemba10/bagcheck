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
  /** Gentle sway amplitude in degrees (danger). */
  sway: number;
  /** Breathing period in seconds. */
  breathe: number;
  rings: boolean;
}

export const AGENT_LOOKS: Record<AgentState, AgentLook> = {
  idle: { color: "#3ee6c8", caption: "Hi, I'm Bag. Ask me about any coin.", mouth: "smile", lean: 0, sway: 0, breathe: 4, rings: false },
  scanning: { color: "#5cf0d6", caption: "Checking supply… reading the roadmap…", mouth: "flat", lean: 0, sway: 0, breathe: 2.4, rings: true },
  clear: { color: "#4ade80", caption: "No major warning signs in the data.", mouth: "smile", lean: 0, sway: 0, breathe: 4, rings: false },
  concern: { color: "#fbbf24", caption: "A few things are worth a closer look.", mouth: "flat", lean: 8, sway: 0, breathe: 3.6, rings: false },
  danger: { color: "#ff8094", caption: "Several warning signs. Here's the evidence.", mouth: "o", lean: 0, sway: 2, breathe: 3.2, rings: false },
  rescue: { color: "#7ab2ff", caption: "Let's take this one step at a time.", mouth: "soft", lean: 0, sway: 0, breathe: 5.5, rings: false },
};

export const AGENT_STATES = Object.keys(AGENT_LOOKS) as AgentState[];
