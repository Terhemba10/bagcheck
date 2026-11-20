/**
 * Thin client for Covex's public API. The MCP server holds no API keys:
 * it uses the same endpoints, rate limits and credit guard as the website.
 *
 * Watchlist identity: an anonymous id (like the website's cookie), stored in
 * ~/.covex/mcp.json so the assistant keeps the same watchlist between runs.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// BAGCHECK_* and ~/.bagcheck are the names from before the rename to Covex; still honoured.
export const BASE_URL = (process.env.COVEX_URL ?? process.env.BAGCHECK_URL ?? "https://covex-ai.vercel.app").replace(/\/+$/, "");
const STATE_DIR = process.env.COVEX_MCP_HOME ?? process.env.BAGCHECK_MCP_HOME ?? join(homedir(), ".covex");
const STATE_FILE = join(STATE_DIR, "mcp.json");
const LEGACY_STATE_FILE = join(homedir(), ".bagcheck", "mcp.json");
const UID_RE = /^[a-f0-9]{32}$/;

function readUidFrom(file: string): string | null {
  try {
    const uid = (JSON.parse(readFileSync(file, "utf8")) as { uid?: string }).uid;
    return uid && UID_RE.test(uid) ? uid : null;
  } catch {
    return null;
  }
}

/** The saved watchlist id; an id saved before the rename is moved to ~/.covex. */
function readUid(): string | null {
  const uid = readUidFrom(STATE_FILE);
  if (uid) return uid;
  const legacy = readUidFrom(LEGACY_STATE_FILE);
  if (legacy) saveUid(legacy);
  return legacy;
}

function saveUid(uid: string) {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify({ uid, note: "Anonymous Covex watchlist id. Delete this file to start a new watchlist." }, null, 2));
  } catch {
    /* read-only home: the watchlist lasts for this session only */
  }
}

let sessionUid: string | null = null;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: "GET" | "POST" | "DELETE"; body?: unknown; withUid?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", "User-Agent": "covex-mcp/0.1" };
  const uid = init.withUid ? (sessionUid ?? readUid()) : null;
  if (uid) headers.Cookie = `bc_uid=${uid}`;
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE_URL + path, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(60_000),
  });
  // remember the anonymous id the server issued
  const set = res.headers.get("set-cookie");
  const m = set ? /bc_uid=([a-f0-9]{32})/.exec(set) : null;
  if (init.withUid && m && m[1] !== uid) {
    sessionUid = m[1]!;
    saveUid(sessionUid);
  }
  const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!res.ok) {
    const msg = json?.error?.message ?? (res.status === 429 ? "Covex is busy right now. Please try again in a minute." : `Covex returned HTTP ${res.status}.`);
    throw new ApiError(res.status, msg);
  }
  return json as T;
}

export interface CoinRef {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  rank: number | null;
}

/** Name, symbol, slug or contract address → the best match (0 CMC credits). */
export async function resolveCoin(query: string): Promise<CoinRef> {
  const q = query.trim();
  if (/^\d+$/.test(q)) {
    // a CoinMarketCap id
    return { id: Number(q), name: `CMC #${q}`, symbol: "", slug: "", rank: null };
  }
  const { results } = await api<{ results: CoinRef[] }>(`/api/search?q=${encodeURIComponent(q)}`);
  if (!results.length) throw new ApiError(404, `No coin matches "${q}" on CoinMarketCap. Try the name, symbol or contract address.`);
  return results[0]!;
}
