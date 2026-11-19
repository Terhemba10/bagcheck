/**
 * Price-impact ESTIMATE for selling into DEX pools. Pure, unit-tested.
 *
 * Model: a standard constant-product (x·y=k) pool. Selling tokens worth A
 * (at today's price) into a pool holding X worth of the token gets an average
 * price X/(X+A) of today's, i.e. an impact of A/(X+A).
 *
 * Limits (shown to users): concentrated-liquidity pools (Uniswap v3/v4,
 * Meteora DLMM, …) can be better or worse; fees and other traders are ignored;
 * prices move while you trade. It's an estimate, never a quote.
 */
export interface PoolSide {
  dex: string;
  pair: string;
  /** USD value of OUR token held in the pool (the side you'd sell into). */
  tokenSideUsd: number;
  totalUsd: number;
  volume24h: number;
}

export function impactForPool(amountUsd: number, tokenSideUsd: number): number | null {
  if (!(amountUsd > 0) || !(tokenSideUsd > 0)) return null;
  return amountUsd / (tokenSideUsd + amountUsd);
}

export interface ImpactEstimate {
  amountUsd: number;
  /** Selling everything into the single deepest pool. */
  deepestPool: { dex: string; pair: string; impact: number } | null;
  /** Spread across all pools in proportion to their depth (what a DEX aggregator roughly does). */
  acrossPools: { pools: number; impact: number } | null;
  /** The same amount split into `parts` equal sales, each into the full depth, ignoring recovery between them. */
  inParts: { parts: number; impactPerPart: number } | null;
}

export function estimateImpact(amountUsd: number, pools: PoolSide[], parts = 4): ImpactEstimate {
  const usable = pools.filter((p) => p.tokenSideUsd > 0).sort((a, b) => b.tokenSideUsd - a.tokenSideUsd);
  const deepest = usable[0];
  const total = usable.reduce((s, p) => s + p.tokenSideUsd, 0);
  const di = deepest ? impactForPool(amountUsd, deepest.tokenSideUsd) : null;
  const ai = total > 0 ? impactForPool(amountUsd, total) : null;
  const pi = total > 0 ? impactForPool(amountUsd / parts, total) : null;
  return {
    amountUsd,
    deepestPool: deepest && di !== null ? { dex: deepest.dex, pair: deepest.pair, impact: di } : null,
    acrossPools: ai !== null ? { pools: usable.length, impact: ai } : null,
    inParts: pi !== null ? { parts, impactPerPart: pi } : null,
  };
}

/** Amount (USD) that moves the price by `impact` when spread across `depthUsd`: A = X·i/(1−i). */
export function amountForImpact(depthUsd: number, impact = 0.02): number {
  return depthUsd > 0 && impact > 0 && impact < 1 ? (depthUsd * impact) / (1 - impact) : 0;
}

/** Thin-liquidity flag: true when a typical retail sale ($1,000) would move the price ≥ 2%. */
export function isThin(totalTokenSideUsd: number): boolean {
  return (impactForPool(1000, totalTokenSideUsd) ?? 1) >= 0.02;
}
