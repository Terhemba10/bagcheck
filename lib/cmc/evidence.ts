import { kv } from "@/lib/store/kv";
import type { EndpointKey } from "./endpoints";
import { redactKey, trimJson } from "./trim";

/**
 * Proof of real API calls for the judges. Every network call to CMC (not
 * cache hits) is logged here with its status object and a trimmed body.
 * The API key is never stored.
 */
export interface EvidenceEntry {
  id: string;
  endpoint: EndpointKey;
  path: string;
  method: "GET" | "POST";
  params: Record<string, string>;
  at: string;
  httpStatus: number;
  creditCount: number | null;
  elapsedMs: number | null;
  errorCode: number | null;
  errorMessage: string | null;
  durationMs: number;
  response: unknown;
}

const LIST_KEY = "cmc:evidence";
const MAX_ENTRIES = 50;

export async function recordEvidence(entry: Omit<EvidenceEntry, "id" | "response"> & { body: unknown }) {
  const { body, ...rest } = entry;
  const safe: EvidenceEntry = {
    ...rest,
    id: `${Date.parse(rest.at)}-${Math.random().toString(36).slice(2, 8)}`,
    params: Object.fromEntries(Object.entries(rest.params).map(([k, v]) => [k, redactKey(v)])),
    errorMessage: rest.errorMessage ? redactKey(rest.errorMessage) : null,
    response: trimJson(body),
  };
  try {
    await kv().pushCapped(LIST_KEY, safe, MAX_ENTRIES);
  } catch (err) {
    // Evidence logging must never break a user-facing request.
    console.warn("[evidence] failed to record", err);
  }
}

export async function listEvidence(count = 20): Promise<EvidenceEntry[]> {
  return kv().list<EvidenceEntry>(LIST_KEY, count);
}
