import "server-only";
import { kv } from "@/lib/store/kv";
import type { LastVerdict } from "./riskBoard";

/**
 * Small summary maps the Risk board reads in one go (instead of one read per coin):
 *  - the last full-report verdict per coin (7 days)
 *  - the promise counts from the last promise check per coin (7 days)
 * Writes are read-modify-write; a lost update only means the board shows the quick
 * check for that coin until its next report.
 */
export const VERDICTS_KEY = "board:verdicts:v1";
export const PROMISES_KEY = "board:promises:v1";
const WEEK = 7 * 24 * 3600;
const MAX_AGE_MS = WEEK * 1000;

export interface PromiseSummary {
  delivered: number;
  datePassed: number;
  upcoming: number;
  at: string;
}

function prune<T extends { at: string }>(m: Record<string, T>): Record<string, T> {
  const cutoff = Date.now() - MAX_AGE_MS;
  return Object.fromEntries(Object.entries(m).filter(([, v]) => Date.parse(v.at) >= cutoff));
}

export async function saveLastVerdict(id: number, v: LastVerdict) {
  try {
    const m = (await kv().get<Record<string, LastVerdict>>(VERDICTS_KEY)) ?? {};
    m[id] = v;
    await kv().set(VERDICTS_KEY, prune(m), WEEK);
  } catch {
    /* best effort */
  }
}

export async function savePromiseSummary(id: number, statuses: string[]) {
  try {
    const m = (await kv().get<Record<string, PromiseSummary>>(PROMISES_KEY)) ?? {};
    m[id] = {
      delivered: statuses.filter((s) => s === "delivered").length,
      datePassed: statuses.filter((s) => s === "overdue").length,
      upcoming: statuses.filter((s) => s === "upcoming" || s === "due-soon").length,
      at: new Date().toISOString(),
    };
    await kv().set(PROMISES_KEY, prune(m), WEEK);
  } catch {
    /* best effort */
  }
}

export async function readSummaries() {
  const [verdicts, promises] = await Promise.all([
    kv().get<Record<string, LastVerdict>>(VERDICTS_KEY).catch(() => null),
    kv().get<Record<string, PromiseSummary>>(PROMISES_KEY).catch(() => null),
  ]);
  return { verdicts: verdicts ?? {}, promises: promises ?? {} };
}
