import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { kv } from "@/lib/store/kv";

/**
 * Per-IP fixed-window rate limits for public API routes, so visitors can't
 * drain the CMC credits. IPs are hashed (never stored raw).
 *
 * Without Upstash, counts live in each serverless instance's memory, which is
 * weaker (a busy site spreads across instances). The credit guard in
 * lib/cmc/client.ts is the hard backstop either way.
 */
export interface Limit {
  /** Name of the bucket, e.g. "search". */
  name: string;
  /** Max requests per window. */
  max: number;
  /** Window length in seconds. */
  windowSec: number;
}

export const LIMITS = {
  search: [
    { name: "search-min", max: 30, windowSec: 60 },
    { name: "search-day", max: 600, windowSec: 86_400 },
  ],
  evidence: [{ name: "evidence-min", max: 20, windowSec: 60 }],
  report: [
    { name: "report-min", max: 8, windowSec: 60 },
    { name: "report-day", max: 80, windowSec: 86_400 },
  ],
} satisfies Record<string, Limit[]>;

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function hashIp(ip: string): string {
  const salt = process.env.RATE_LIMIT_SALT ?? "bagcheck";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 20);
}

export interface LimitResult {
  ok: boolean;
  /** Seconds until the tightest exceeded window resets. */
  retryAfter: number;
  limit?: Limit;
}

export async function checkLimits(req: Request, limits: Limit[]): Promise<LimitResult> {
  const id = hashIp(clientIp(req));
  const now = Math.floor(Date.now() / 1000);
  for (const l of limits) {
    const window = Math.floor(now / l.windowSec);
    try {
      const n = await kv().incr(`rl:${l.name}:${id}:${window}`, l.windowSec + 5);
      if (n > l.max) return { ok: false, retryAfter: (window + 1) * l.windowSec - now, limit: l };
    } catch {
      // a broken store must not take the site down; the credit guard still applies
    }
  }
  return { ok: true, retryAfter: 0 };
}

/** Returns a 429 response if over the limit, otherwise null. */
export async function rateLimit(req: Request, limits: Limit[]): Promise<NextResponse | null> {
  const r = await checkLimits(req, limits);
  if (r.ok) return null;
  return NextResponse.json(
    {
      error: {
        kind: "rate_limited_local",
        message: "You're checking very quickly. Please wait a moment and try again.",
        retryAfter: r.retryAfter,
      },
    },
    { status: 429, headers: { "Retry-After": String(r.retryAfter) } },
  );
}
