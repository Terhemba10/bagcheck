"use client";

import { useSyncExternalStore } from "react";
import type { AgentState } from "@/components/agent/states";

/**
 * What's on screen, for the corner Bag: the coin being viewed and its verdict.
 * A tiny external store so any page can tell Bag what it's showing.
 */
export interface BagContext {
  coinId: number;
  name: string;
  symbol: string;
  state: AgentState;
  verdict: string;
}

let current: BagContext | null = null;
const listeners = new Set<() => void>();

export function setBagContext(next: BagContext | null) {
  current = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useBagContext(): BagContext | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
