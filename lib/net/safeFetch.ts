import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Server-side fetch for URLs that come from project data (websites, docs,
 * roadmaps). Those URLs are set by coin projects, so treat them as hostile:
 *  - http(s) only, default ports only
 *  - every hop (including redirects) must resolve to a public IP
 *  - timeout, max redirects, max body size
 * (A DNS change between our lookup and fetch's own lookup is still possible;
 *  on Vercel, private networks aren't reachable anyway.)
 */
export const SAFE_FETCH = {
  timeoutMs: 6000,
  maxRedirects: 4,
  maxBytes: 1_500_000,
  userAgent: "BagcheckBot/1.0 (+https://bagcheck-azure.vercel.app; checks public project pages)",
};

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/** True for loopback, private, link-local, CGNAT, multicast, reserved and IPv6 ULA ranges. Pure, tested. */
export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local (cloud metadata)
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast + reserved
    );
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return true;
    if (x.startsWith("::ffff:")) return isPrivateIp(x.slice(7)); // IPv4-mapped
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x.replace(/^\[|\]$/g, ""));
  }
  return true; // not an IP at all: refuse
}

/** Validate the URL's shape (no network). Pure, tested. */
export function checkUrlShape(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Not a valid URL");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new UnsafeUrlError("Only http(s) links are checked");
  if (u.port && u.port !== "80" && u.port !== "443") throw new UnsafeUrlError("Non-standard port");
  if (u.username || u.password) throw new UnsafeUrlError("Credentials in URL");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new UnsafeUrlError("Local host name");
  }
  if (isIP(host) && isPrivateIp(host)) throw new UnsafeUrlError("Private address");
  return u;
}

async function assertPublicHost(u: URL) {
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return;
  const addrs = await lookup(host, { all: true, verbatim: true }).catch(() => {
    throw new UnsafeUrlError("Domain does not resolve");
  });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new UnsafeUrlError("Resolves to a private address");
}

export interface SafeResponse {
  url: string; // final URL after redirects
  status: number;
  contentType: string;
  body: string; // decoded text, truncated to maxBytes
  truncated: boolean;
  ms: number;
}

export async function safeFetch(
  raw: string,
  opts: { method?: "GET" | "HEAD"; readBody?: boolean; timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<SafeResponse> {
  const started = Date.now();
  const doFetch = opts.fetchImpl ?? fetch;
  let current = checkUrlShape(raw);
  const deadline = AbortSignal.timeout(opts.timeoutMs ?? SAFE_FETCH.timeoutMs);

  for (let hop = 0; hop <= SAFE_FETCH.maxRedirects; hop++) {
    await assertPublicHost(current);
    const res = await doFetch(current, {
      method: opts.method ?? "GET",
      redirect: "manual",
      signal: deadline,
      headers: { "User-Agent": SAFE_FETCH.userAgent, Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5" },
      cache: "no-store",
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = checkUrlShape(new URL(res.headers.get("location")!, current).toString());
      continue;
    }
    let body = "";
    let truncated = false;
    if (opts.readBody !== false && opts.method !== "HEAD" && res.body) {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > SAFE_FETCH.maxBytes) {
          truncated = true;
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
      body = new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
    } else {
      await res.body?.cancel().catch(() => undefined);
    }
    return { url: current.toString(), status: res.status, contentType: res.headers.get("content-type") ?? "", body, truncated, ms: Date.now() - started };
  }
  throw new UnsafeUrlError("Too many redirects");
}
