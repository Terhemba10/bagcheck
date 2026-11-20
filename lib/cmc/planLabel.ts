/**
 * A short label for the sidebar pill from /v1/key/info's monthly credit limit.
 * Basic is 15,000 credits/month (verified on our key); anything larger is a paid
 * plan. We don't guess paid tier names from the number.
 */
export interface PlanSummary {
  label: string;
  creditsLeft: number | null;
  limit: number | null;
  paid: boolean;
}

export function planSummary(limit: number | null | undefined, left: number | null | undefined): PlanSummary {
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) {
    return { label: "Plan unknown", creditsLeft: typeof left === "number" ? left : null, limit: null, paid: false };
  }
  const paid = limit > 20_000;
  return { label: paid ? "Paid plan" : "Basic plan", creditsLeft: typeof left === "number" ? left : null, limit, paid };
}

/** "14.8K" style for the pill. */
export function compactCredits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString("en-US");
}

/**
 * Which plan an endpoint needs when the current key gets 1006, for user-facing text.
 * Market pairs still returns 1006 on the paid (450k-credit) key, so it needs Standard;
 * for other endpoints we only know "higher than this key".
 */
const NEEDS: Partial<Record<string, string>> = { marketPairs: "Standard" };

/** "a higher CMC plan (Standard)" / "a higher CMC plan". `long` spells out CoinMarketCap. */
export function higherPlan(endpoint?: string, long = false): string {
  const name = long ? "CoinMarketCap" : "CMC";
  const tier = endpoint ? NEEDS[endpoint] : undefined;
  return `a higher ${name} plan${tier ? ` (${tier})` : ""}`;
}

/** The tier name to show, if we know it. */
export const tierFor = (endpoint?: string): string | undefined => (endpoint ? NEEDS[endpoint] : undefined);
