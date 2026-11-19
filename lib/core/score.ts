/**
 * Overall concern from the signals. Pure, unit-tested.
 * Only signals with real data count ("scored on N of 7 signals").
 */
import type { Concern } from "@/components/ui/status";
import type { Signal } from "./signals";

export const POINTS = { ok: 0, watch: 1, concern: 2, danger: 4, unknown: 0, rescue: 0 } as const;

export interface ScoreResult {
  concern: Concern | null;
  points: number;
  scored: number;
  total: number;
  dangers: number;
  concerns: number;
  /** Signal titles that drove the result, worst first. */
  drivers: string[];
  /** Signals marked "worth watching" (not warning signs). */
  watching: string[];
}

export function scoreReport(signals: Signal[]): ScoreResult {
  const counted = signals.filter((s) => s.scored);
  const points = counted.reduce((sum, s) => sum + POINTS[s.level], 0);
  const dangers = counted.filter((s) => s.level === "danger").length;
  const concerns = counted.filter((s) => s.level === "concern").length;
  const drivers = counted
    .filter((s) => s.level === "danger" || s.level === "concern")
    .sort((a, b) => POINTS[b.level] - POINTS[a.level])
    .map((s) => s.title);
  const watching = counted.filter((s) => s.level === "watch").map((s) => s.title);

  // too little data to say anything honest
  if (counted.length < 3) return { concern: null, points, scored: counted.length, total: signals.length, dangers, concerns, drivers, watching };

  let concern: Concern = "low";
  if (dangers >= 2 || points >= 8) concern = "high";
  else if (dangers === 1 || concerns >= 2 || points >= 4) concern = "medium";
  return { concern, points, scored: counted.length, total: signals.length, dangers, concerns, drivers, watching };
}

/**
 * The verdict Bag "speaks". Written by code from the computed result, so it
 * can never contradict the score. The AI explanation (later) adds colour only.
 */
export function verdictText(name: string, s: ScoreResult): string {
  if (!s.concern) return `There isn't enough data on ${name} for a fair score yet. Here's what we could check.`;
  const signs = s.dangers + s.concerns;
  const list = s.drivers.slice(0, 3).map((d) => d.toLowerCase());
  const joined = list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list.at(-1)}` : list[0];
  if (s.concern === "low") {
    if (signs) return `${name}: low concern overall. One thing to keep an eye on: ${joined}.`;
    const w = s.watching.map((x) => x.toLowerCase());
    return w.length
      ? `${name}: low concern. No major warning signs in the data we checked. Worth knowing about: ${w.join(" and ")}.`
      : `${name}: low concern. No major warning signs in the data we checked.`;
  }
  if (s.concern === "medium") return `${name}: medium concern. ${signs} warning sign${signs === 1 ? "" : "s"} worth a closer look: ${joined}.`;
  return `${name}: high concern. Several warning signs showed up: ${joined}. Here's the evidence.`;
}
