/**
 * The agent activity checklist: what Covex does to build a report, in order,
 * with the data source of each step. The server emits real events from
 * buildReport() (nothing is timed or simulated); the client renders them.
 * Pure and client-safe.
 */
export type StepId = "profile" | "market" | "contract" | "liquidity" | "markets" | "links" | "score" | "roadmap";
export type StepStatus = "pending" | "running" | "done" | "skipped" | "blocked" | "failed";

export interface StepDef {
  id: StepId;
  label: string;
  running: string;
  source: string;
}

export const REPORT_STEPS: StepDef[] = [
  { id: "profile", label: "Resolve the coin", running: "Resolving the coin…", source: "CMC /v2/cryptocurrency/info" },
  { id: "market", label: "Read price, supply and volume", running: "Reading supply and volume…", source: "CMC /v3/cryptocurrency/quotes/latest" },
  { id: "contract", label: "Scan the contract", running: "Scanning the contract…", source: "CMC /v1/dex/security/detail" },
  { id: "liquidity", label: "Measure DEX liquidity", running: "Measuring DEX liquidity…", source: "CMC /v1/dex/token/pools" },
  { id: "markets", label: "Check exchange markets", running: "Checking exchange markets…", source: "CMC /v2/cryptocurrency/market-pairs/latest" },
  { id: "links", label: "Check the official links", running: "Checking the official links…", source: "Project website (live fetch)" },
  { id: "score", label: "Score 7 warning signs", running: "Scoring the warning signs…", source: "Covex code (no AI)" },
  { id: "roadmap", label: "Read the roadmap", running: "Reading the roadmap…", source: "Project pages + Gemini (quotes verified)" },
];

export interface StepState {
  id: StepId;
  status: StepStatus;
  /** Short note: "live", "cached", "not a token", "needs a higher CMC plan"… */
  note?: string;
}

export type StepEvent = { type: "step"; id: StepId; status: StepStatus; note?: string };

export function initialSteps(): StepState[] {
  return REPORT_STEPS.map((s) => ({ id: s.id, status: "pending" }));
}

/** Apply one event. Finished steps never go back to running (late/duplicate events are ignored). */
export function applyStep(steps: StepState[], e: StepEvent): StepState[] {
  return steps.map((s) => {
    if (s.id !== e.id) return s;
    if (isFinished(s.status) && !isFinished(e.status)) return s;
    return { id: s.id, status: e.status, note: e.note ?? s.note };
  });
}

export const isFinished = (s: StepStatus) => s === "done" || s === "skipped" || s === "blocked" || s === "failed";

/** "5/8 done" counter: finished steps over all steps. */
export function progress(steps: StepState[]): { finished: number; total: number } {
  return { finished: steps.filter((s) => isFinished(s.status)).length, total: steps.length };
}

/** Mark every unfinished report step as done from cache (whole report served from cache). */
export function allFromCache(): StepEvent[] {
  return REPORT_STEPS.filter((s) => s.id !== "roadmap").map((s) => ({ type: "step", id: s.id, status: "done", note: "cached" }));
}

/** Avail source → a short note. */
export function sourceNote(source: string | undefined): string | undefined {
  if (source === "live") return "live";
  if (source === "cached") return "cached";
  if (source === "saved") return "saved copy";
  return undefined;
}
