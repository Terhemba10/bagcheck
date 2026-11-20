"use client";

import { useSyncExternalStore } from "react";

/**
 * Covex's presence, shared by the whole app in one tiny external store:
 *  - `working`: an agent run is in progress (the logo mark breathes)
 *  - `tone`: the latest verdict colour (shown on the mark and the report header)
 *  - `coin`: what's on screen, so "Ask Covex" can answer about it
 *  - `chatOpen`: the Ask Covex panel
 */
export type Tone = "idle" | "low" | "medium" | "high" | "rescue";

export interface CoinContext {
  coinId: number;
  name: string;
  symbol: string;
  verdict: string;
  tone: Tone;
}

interface AgentSnapshot {
  working: boolean;
  tone: Tone;
  coin: CoinContext | null;
  chatOpen: boolean;
}

let state: AgentSnapshot = { working: false, tone: "idle", coin: null, chatOpen: false };
const SERVER: AgentSnapshot = state;
const listeners = new Set<() => void>();

function set(patch: Partial<AgentSnapshot>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export const agent = {
  start: () => set({ working: true }),
  finish: (tone: Tone) => set({ working: false, tone }),
  setTone: (tone: Tone) => set({ tone }),
  setCoin: (coin: CoinContext | null) => set({ coin, tone: coin?.tone ?? "idle" }),
  reset: () => set({ working: false, tone: "idle" }),
  openChat: () => set({ chatOpen: true }),
  closeChat: () => set({ chatOpen: false }),
  toggleChat: () => set({ chatOpen: !state.chatOpen }),
};

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAgent(): AgentSnapshot {
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}

/** Verdict concern level → tone. */
export function toneFor(concern: "low" | "medium" | "high" | null | undefined): Tone {
  return concern ?? "idle";
}

/** Tone → CSS colour token (used on the logo mark and the report header). */
export const TONE_COLOR: Record<Tone, string> = {
  idle: "var(--color-teal)",
  low: "var(--color-ok)",
  medium: "var(--color-warn)",
  high: "var(--color-danger)",
  rescue: "var(--color-rescue)",
};

export const TONE_LABEL: Record<Tone, string> = {
  idle: "Ready",
  low: "Low concern",
  medium: "Medium concern",
  high: "High concern",
  rescue: "Rescue mode",
};
