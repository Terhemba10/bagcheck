import "server-only";
import { safeFetch, UnsafeUrlError } from "@/lib/net/safeFetch";

/**
 * Links health: are the project's official links still reachable?
 * Costs no CMC credits. Social sites that block bots (X/Twitter, Telegram,
 * Discord) are listed but not checked, so they never count against a coin.
 */
export type LinkState = "up" | "blocked" | "down" | "skipped";

export interface LinkCheck {
  kind: "website" | "docs" | "code" | "social";
  url: string;
  state: LinkState;
  status?: number;
  reason?: string;
}

const UNCHECKABLE = /(^|\.)(x\.com|twitter\.com|t\.me|telegram\.me|discord\.gg|discord\.com|facebook\.com|instagram\.com|reddit\.com|medium\.com)$/i;

export function classifyStatus(status: number): LinkState {
  if (status >= 200 && status < 400) return "up";
  // 401/403/429 = a live server that blocks bots: reachable
  if (status === 401 || status === 403 || status === 429 || status === 999) return "blocked";
  return "down";
}

export async function checkLink(kind: LinkCheck["kind"], url: string): Promise<LinkCheck> {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return { kind, url, state: "down", reason: "Not a valid link" };
  }
  if (UNCHECKABLE.test(host)) return { kind, url, state: "skipped", reason: "This site blocks automated checks" };
  try {
    // HEAD is cheap but many sites mishandle it; fall back to GET without reading the body
    let r = await safeFetch(url, { method: "HEAD", readBody: false, timeoutMs: 5000 });
    if (r.status === 405 || r.status === 404 || r.status >= 500) r = await safeFetch(url, { method: "GET", readBody: false, timeoutMs: 6000 });
    const state = classifyStatus(r.status);
    return { kind, url, state, status: r.status, reason: state === "down" ? `Responded with HTTP ${r.status}` : undefined };
  } catch (e) {
    if (e instanceof UnsafeUrlError) return { kind, url, state: "down", reason: e.message };
    const msg = e instanceof Error && e.name === "TimeoutError" ? "Didn't respond within 6 seconds" : "Couldn't connect";
    return { kind, url, state: "down", reason: msg };
  }
}

export async function checkProjectLinks(urls: {
  website?: string[];
  technical_doc?: string[];
  source_code?: string[];
  twitter?: string[];
}): Promise<LinkCheck[]> {
  const list: { kind: LinkCheck["kind"]; url: string }[] = [
    ...(urls.website ?? []).slice(0, 2).map((url) => ({ kind: "website" as const, url })),
    ...(urls.technical_doc ?? []).slice(0, 1).map((url) => ({ kind: "docs" as const, url })),
    ...(urls.source_code ?? []).slice(0, 1).map((url) => ({ kind: "code" as const, url })),
    ...(urls.twitter ?? []).slice(0, 1).map((url) => ({ kind: "social" as const, url })),
  ];
  return Promise.all(list.map((l) => checkLink(l.kind, l.url)));
}
