import type { EndpointKey } from "./endpoints";

export type CmcErrorKind =
  | "plan_blocked" // 1006: this endpoint isn't in the key's plan
  | "rate_limited" // 1008 / 1011: per-minute or IP limit
  | "credits_exhausted" // 1009 / 1010: daily or monthly credits used up
  | "auth" // 1001 / 1002 / 1005 / 1007 / missing key
  | "subscription" // 1003 / 1004
  | "bad_request" // 400 / invalid params
  | "not_found"
  | "upstream" // 5xx, network, timeout
  | "budget_reserve"; // our own governor refused to spend credits

export class CmcError extends Error {
  constructor(
    public readonly kind: CmcErrorKind,
    public readonly endpoint: EndpointKey,
    message: string,
    public readonly code?: number,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "CmcError";
  }

  /** A short, friendly sentence that is safe to show users. */
  get userMessage(): string {
    switch (this.kind) {
      case "plan_blocked":
        return "This data needs a paid CoinMarketCap plan, so it isn't available live right now.";
      case "rate_limited":
        return "CoinMarketCap is busy with our requests. Please try again in a minute.";
      case "credits_exhausted":
      case "budget_reserve":
        return "We've used today's CoinMarketCap allowance, so we're showing saved data where we have it.";
      case "auth":
      case "subscription":
        return "Covex can't reach CoinMarketCap right now (API key problem). The team has been notified.";
      case "bad_request":
      case "not_found":
        return "CoinMarketCap doesn't have this data for that coin.";
      default:
        return "CoinMarketCap didn't respond. Please try again shortly.";
    }
  }
}

interface CmcStatusLike {
  error_code?: number | string | null;
  error_message?: string | null;
  /** Newer endpoints (v5) add a precise reason, e.g. "interval must be one of [...]". */
  error_detail?: string | null;
}

/** Map an HTTP status + CMC status object to an error kind. Returns null on success. */
export function classifyCmcResponse(
  httpStatus: number,
  status: CmcStatusLike | undefined,
): { kind: CmcErrorKind; code?: number; message: string } | null {
  const rawCode = status?.error_code;
  const code = rawCode === null || rawCode === undefined || rawCode === "" ? 0 : Number(rawCode);
  const base = status?.error_message || `HTTP ${httpStatus}`;
  const message = status?.error_detail ? `${base} ${status.error_detail}` : base;

  if (httpStatus >= 200 && httpStatus < 300 && (!code || Number.isNaN(code))) return null;

  switch (code) {
    case 4001: // v5 validation error
      return { kind: "bad_request", code, message };
    case 1006:
      return { kind: "plan_blocked", code, message };
    case 1008:
    case 1011:
      return { kind: "rate_limited", code, message };
    case 1009:
    case 1010:
      return { kind: "credits_exhausted", code, message };
    case 1001:
    case 1002:
    case 1005:
    case 1007:
      return { kind: "auth", code, message };
    case 1003:
    case 1004:
      return { kind: "subscription", code, message };
  }

  if (httpStatus === 403 && /plan|subscription|not authorized/i.test(message))
    return { kind: "plan_blocked", code: code || undefined, message };
  if (httpStatus === 429) return { kind: "rate_limited", code: code || undefined, message };
  if (httpStatus === 401) return { kind: "auth", code: code || undefined, message };
  if (httpStatus === 402) return { kind: "subscription", code: code || undefined, message };
  if (httpStatus === 404) return { kind: "not_found", code: code || undefined, message };
  if (httpStatus === 400) return { kind: "bad_request", code: code || undefined, message };
  if (httpStatus >= 500) return { kind: "upstream", code: code || undefined, message };
  // 2xx with a non-zero error code we don't know, or other 4xx
  return { kind: httpStatus < 500 ? "bad_request" : "upstream", code: code || undefined, message };
}
