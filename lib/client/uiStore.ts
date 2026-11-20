"use client";

import { useSyncExternalStore } from "react";

/** App chrome state: command palette, mobile drawer, sidebar collapse (remembered). */
interface UiSnapshot {
  palette: boolean;
  drawer: boolean;
  collapsed: boolean;
}

export const SIDEBAR_KEY = "covex:sidebar";

let state: UiSnapshot = { palette: false, drawer: false, collapsed: false };
const SERVER: UiSnapshot = state;
const listeners = new Set<() => void>();
let hydrated = false;

function set(patch: Partial<UiSnapshot>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function hydrate() {
  if (hydrated || typeof document === "undefined") return;
  hydrated = true;
  // the boot script already put the remembered choice on <html>
  state = { ...state, collapsed: document.documentElement.dataset.sidebar === "collapsed" };
}

export const ui = {
  openPalette: () => set({ palette: true, drawer: false }),
  closePalette: () => set({ palette: false }),
  openDrawer: () => set({ drawer: true }),
  closeDrawer: () => set({ drawer: false }),
  toggleCollapsed: () => {
    const collapsed = !state.collapsed;
    if (collapsed) document.documentElement.dataset.sidebar = "collapsed";
    else delete document.documentElement.dataset.sidebar;
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "open");
    } catch {
      /* not remembered: fine */
    }
    set({ collapsed });
  },
};

function subscribe(l: () => void) {
  hydrate();
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useUi(): UiSnapshot {
  return useSyncExternalStore(
    subscribe,
    () => {
      hydrate();
      return state;
    },
    () => SERVER,
  );
}
