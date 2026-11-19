/**
 * Every CMC endpoint Bagcheck calls, in one place.
 *
 * `minPlan` is what the docs say (checked 19 Nov 2026). We do NOT rely on it at
 * runtime for real access decisions: live 1006 responses are the source of
 * truth (see capabilities.ts). It is used for `CMC_FORCE_PLAN=basic`
 * simulation and for labelling features in the UI.
 */
export type Plan = "basic" | "builder" | "startup";

export interface EndpointDef {
  path: string;
  method: "GET" | "POST";
  minPlan: Plan;
  /** Cache TTL in seconds. */
  ttl: number;
  /** What Bagcheck uses it for (shown on /evidence). */
  purpose: string;
  /** Log successful calls to the evidence list at most this often (seconds). Errors are always logged. */
  evidenceEvery?: number;
}

export const ENDPOINTS = {
  map: {
    path: "/v1/cryptocurrency/map",
    method: "GET",
    minPlan: "basic",
    ttl: 24 * 3600,
    purpose: "Resolve a name, symbol or slug to a CMC id",
  },
  info: {
    path: "/v2/cryptocurrency/info",
    method: "GET",
    minPlan: "basic",
    ttl: 6 * 3600,
    purpose: "Official website/social links, date added, contract addresses",
  },
  quotesV3: {
    path: "/v3/cryptocurrency/quotes/latest",
    method: "GET",
    minPlan: "basic",
    ttl: 60,
    purpose: "Price, volume, market cap, supply, fully diluted value",
  },
  quotesV2: {
    path: "/v2/cryptocurrency/quotes/latest",
    method: "GET",
    minPlan: "basic",
    ttl: 60,
    purpose: "Fallback for quotes if v3 is unavailable",
  },
  marketPairs: {
    path: "/v2/cryptocurrency/market-pairs/latest",
    method: "GET",
    // Docs say "Basic and up", but a live Basic key gets 1006 (observed 19 Nov 2026).
    minPlan: "builder",
    ttl: 120,
    purpose: "Where it trades: volume share per exchange, liquidity per pair",
  },
  globalMetrics: {
    path: "/v1/global-metrics/quotes/latest",
    method: "GET",
    minPlan: "basic",
    ttl: 300,
    purpose: "Overall market context",
  },
  pricePerformance: {
    path: "/v2/cryptocurrency/price-performance-stats/latest",
    method: "GET",
    // Docs say "Basic and up", but a live Basic key gets 1006 (observed 19 Nov 2026).
    minPlan: "builder",
    ttl: 300,
    purpose: "Price change over 24h / 7d / 30d / 90d",
  },
  ohlcvHistorical: {
    path: "/v5/cryptocurrency/ohlcv/historical",
    method: "GET",
    minPlan: "basic",
    ttl: 3600,
    purpose: "Daily history for health trends and lessons",
  },
  trendingGainersLosers: {
    path: "/v1/cryptocurrency/trending/gainers-losers",
    method: "GET",
    minPlan: "startup",
    ttl: 600,
    purpose: "Home page: coins moving fast that are worth a check",
  },
  trendingMostVisited: {
    path: "/v1/cryptocurrency/trending/most-visited",
    method: "GET",
    minPlan: "startup",
    ttl: 3600,
    purpose: "Home page: most-looked-at coins",
  },
  dexSecurity: {
    path: "/v1/dex/security/detail",
    method: "GET",
    minPlan: "basic",
    ttl: 3600,
    purpose: "Contract warning signs: honeypot, taxes, mintable, flagged",
  },
  dexPools: {
    path: "/v1/dex/token/pools",
    method: "GET",
    minPlan: "basic",
    ttl: 300,
    purpose: "DEX pools and their liquidity",
  },
  dexLiquidity: {
    path: "/v1/dex/token-liquidity/query",
    method: "GET",
    minPlan: "basic",
    ttl: 900,
    purpose: "DEX liquidity history (draining alerts)",
  },
  keyInfo: {
    path: "/v1/key/info",
    method: "GET",
    minPlan: "basic",
    ttl: 30,
    purpose: "Credits left and plan limits (credit governor)",
    // called on every /evidence view; one sample per 10 min keeps the log readable
    evidenceEvery: 600,
  },
} as const satisfies Record<string, EndpointDef>;

export type EndpointKey = keyof typeof ENDPOINTS;

const PLAN_RANK: Record<Plan, number> = { basic: 0, builder: 1, startup: 2 };

export function planAllows(plan: Plan, required: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[required];
}

export const CMC_BASE_URL = "https://pro-api.coinmarketcap.com";
