import "server-only";
import { kv } from "@/lib/store/kv";
import { CMC_BASE_URL, ENDPOINTS, type EndpointDef, type EndpointKey } from "./endpoints";
import { CmcError, classifyCmcResponse } from "./errors";
import { getCapability, isForcedBlocked, markCapability } from "./capabilities";
import { recordEvidence } from "./evidence";

/**
 * The only place in the app that talks to CoinMarketCap.
 *
 *  - server-only: the key never reaches the browser
 *  - two cache layers: per-instance memory + shared KV (Redis), TTL per endpoint
 *  - a long-lived "last good" copy, used when CMC refuses (rate limit, credits,
 *    plan) so users still see data, clearly marked with its age
 *  - in-flight de-duplication, retries with backoff on 5xx/network errors
 *  - plan detection: 1006 marks the endpoint blocked (see capabilities.ts)
 *  - every network call is written to the evidence log
 */

export interface CmcStatus {
  timestamp?: string;
  error_code?: number | string | null;
  error_message?: string | null;
  elapsed?: number | null;
  credit_count?: number | null;
  notice?: string | null;
}

export interface CmcResult<T> {
  data: T;
  status: CmcStatus;
  /** live = fetched now; cache = fresh cache hit; stale = last good copy served because CMC refused */
  source: "live" | "cache" | "stale";
  fetchedAt: string;
  /** Set when source is "stale": why we couldn't fetch live. */
  staleReason?: CmcError["kind"];
}

export interface RequestOptions {
  /** For POST endpoints. */
  body?: unknown;
  /** Skip the fresh cache (still writes to it). */
  fresh?: boolean;
  /** Override TTL (seconds). */
  ttl?: number;
  /** Set false for very large responses (e.g. the full id map) that the caller caches itself in compact form. */
  sharedCache?: boolean;
  /** Test seam. */
  fetchImpl?: typeof fetch;
  /** Test seam: skip sleeps. */
  sleep?: (ms: number) => Promise<void>;
}

interface CachedValue<T> {
  data: T;
  status: CmcStatus;
  fetchedAt: string;
}

const STALE_TTL = 7 * 24 * 3600;
const TIMEOUT_MS = 12_000;
const MAX_RETRIES = 2;

const memory = new Map<string, { value: CachedValue<unknown>; expires: number }>();
const inflight = new Map<string, Promise<CmcResult<unknown>>>();

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function cacheKey(endpoint: EndpointKey, params: Record<string, string>, body?: unknown) {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return `cmc:c:${endpoint}:${sorted}${body ? `:${JSON.stringify(body)}` : ""}`;
}

function cleanParams(params: Record<string, string | number | boolean | undefined | null>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") out[k] = String(v);
  }
  return out;
}

export async function cmcRequest<T = unknown>(
  endpoint: EndpointKey,
  rawParams: Record<string, string | number | boolean | undefined | null> = {},
  opts: RequestOptions = {},
): Promise<CmcResult<T>> {
  const params = cleanParams(rawParams);
  const key = cacheKey(endpoint, params, opts.body);
  const def = ENDPOINTS[endpoint];
  const ttl = opts.ttl ?? def.ttl;

  // 1. Fresh cache
  if (!opts.fresh) {
    const mem = memory.get(key);
    if (mem && mem.expires > Date.now()) return { ...(mem.value as CachedValue<T>), source: "cache" };
    const shared = opts.sharedCache === false ? null : await safeGet<CachedValue<T>>(key);
    if (shared) {
      memory.set(key, { value: shared, expires: Date.now() + Math.min(ttl, 60) * 1000 });
      return { ...shared, source: "cache" };
    }
  }

  // 2. De-duplicate identical concurrent requests
  const existing = inflight.get(key);
  if (existing) return existing as Promise<CmcResult<T>>;

  const p = (async (): Promise<CmcResult<T>> => {
    try {
      // 3. Known plan block: don't spend a call, go straight to fallback
      const cap = await getCapability(endpoint);
      if (cap.state === "plan_blocked") {
        throw new CmcError("plan_blocked", endpoint, "Endpoint not included in the current CMC plan", cap.code ?? 1006, 403);
      }
      const live = await fetchLive<T>(endpoint, params, opts);
      const value: CachedValue<T> = { data: live.data, status: live.status, fetchedAt: new Date().toISOString() };
      memory.set(key, { value, expires: Date.now() + ttl * 1000 });
      if (opts.sharedCache !== false) {
        await safeSet(key, value, ttl);
        await safeSet(`${key}:last`, value, STALE_TTL);
      }
      return { ...value, source: "live" };
    } catch (err) {
      if (err instanceof CmcError && ["plan_blocked", "rate_limited", "credits_exhausted", "upstream", "budget_reserve"].includes(err.kind)) {
        const last = await safeGet<CachedValue<T>>(`${key}:last`);
        if (last) return { ...last, source: "stale", staleReason: err.kind };
      }
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p as Promise<CmcResult<unknown>>);
  return p;
}

async function fetchLive<T>(
  endpoint: EndpointKey,
  params: Record<string, string>,
  opts: RequestOptions,
): Promise<{ data: T; status: CmcStatus }> {
  const apiKey = process.env.CMC_API_KEY;
  if (!apiKey) throw new CmcError("auth", endpoint, "CMC_API_KEY is not set");

  const def: EndpointDef = ENDPOINTS[endpoint];
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const url = new URL(def.path, CMC_BASE_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let lastError: CmcError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const started = Date.now();
    let httpStatus = 0;
    let body: unknown = null;
    try {
      const res = await doFetch(url, {
        method: def.method,
        headers: {
          "X-CMC_PRO_API_KEY": apiKey,
          Accept: "application/json",
          ...(def.method === "POST" ? { "Content-Type": "application/json" } : {}),
        },
        body: def.method === "POST" && opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      httpStatus = res.status;
      body = await res.json().catch(() => null);
    } catch (e) {
      lastError = new CmcError("upstream", endpoint, e instanceof Error ? e.message : "Network error");
    }

    if (httpStatus) {
      const status = extractStatus(body);
      await recordEvidence({
        endpoint,
        path: def.path,
        method: def.method,
        params,
        at: new Date().toISOString(),
        httpStatus,
        creditCount: numOrNull(status.credit_count),
        elapsedMs: numOrNull(status.elapsed),
        errorCode: numOrNull(status.error_code) || null,
        errorMessage: status.error_message || null,
        durationMs: Date.now() - started,
        body,
      });

      const problem = classifyCmcResponse(httpStatus, status);
      if (!problem) {
        await markCapability(endpoint, "available");
        await countCredits(numOrNull(status.credit_count) ?? 0);
        return { data: (body as { data: T }).data, status };
      }

      lastError = new CmcError(problem.kind, endpoint, problem.message, problem.code, httpStatus);
      if (problem.kind === "plan_blocked") {
        await markCapability(endpoint, "plan_blocked", problem.code ?? 1006);
        throw lastError;
      }
      if (problem.kind === "credits_exhausted") {
        await safeSet("cmc:credits:exhausted", { at: new Date().toISOString(), code: problem.code }, 3600);
        throw lastError;
      }
      // Per-minute limit: one short retry, then give up gracefully. Waiting the
      // full 60 s inside a serverless request isn't an option.
      if (problem.kind === "rate_limited") {
        if (attempt === 0) {
          await sleep(2000 + Math.random() * 1000);
          continue;
        }
        throw lastError;
      }
      if (problem.kind !== "upstream") throw lastError;
    }

    if (attempt < MAX_RETRIES) await sleep(400 * 2 ** attempt + Math.random() * 250);
  }

  throw lastError ?? new CmcError("upstream", endpoint, "Unknown error");
}

function extractStatus(body: unknown): CmcStatus {
  if (body && typeof body === "object" && "status" in body) {
    const s = (body as { status: unknown }).status;
    if (s && typeof s === "object") return s as CmcStatus;
  }
  return {};
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Local running tally per UTC day, a backup for when /v1/key/info isn't reachable. */
async function countCredits(n: number) {
  if (!n) return;
  const day = new Date().toISOString().slice(0, 10);
  const k = `cmc:credits:used:${day}`;
  const current = (await safeGet<number>(k)) ?? 0;
  await safeSet(k, current + n, 3 * 24 * 3600);
}

export async function creditsUsedToday(): Promise<number> {
  return (await safeGet<number>(`cmc:credits:used:${new Date().toISOString().slice(0, 10)}`)) ?? 0;
}

async function safeGet<T>(key: string): Promise<T | null> {
  try {
    return await kv().get<T>(key);
  } catch {
    return null;
  }
}
async function safeSet<T>(key: string, value: T, ttl: number) {
  try {
    await kv().set(key, value, ttl);
  } catch {
    /* cache is best-effort */
  }
}

/** Test helper. */
export function __resetClientState() {
  memory.clear();
  inflight.clear();
}

export { isForcedBlocked };
