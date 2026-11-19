import "server-only";
import { NextResponse } from "next/server";
import { CmcError } from "@/lib/cmc/errors";

/** Turn any thrown error into a friendly JSON response. Never leaks the key or internals. */
export function errorResponse(err: unknown) {
  if (err instanceof CmcError) {
    const status =
      err.kind === "rate_limited" ? 429 : err.kind === "plan_blocked" ? 403 : err.kind === "not_found" ? 404 : 502;
    return NextResponse.json(
      { error: { kind: err.kind, endpoint: err.endpoint, message: err.userMessage } },
      { status, headers: err.kind === "rate_limited" ? { "Retry-After": "60" } : undefined },
    );
  }
  console.error("[api] unexpected error", err);
  return NextResponse.json({ error: { kind: "internal", message: "Something went wrong on our side." } }, { status: 500 });
}

/** Bearer check for cron/admin routes. Constant-time-ish comparison. */
export function isAuthorized(req: Request, secret = process.env.CRON_SECRET): boolean {
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < header.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
