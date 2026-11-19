/**
 * Which DEX pools count as real liquidity. One config list, used by the
 * report's liquidity signal, the rescue plan's "Can I still sell?" and the
 * watchlist's liquidity snapshot/alert. Pure, unit-tested.
 *
 * A pool only counts when the OTHER side is a major asset you could actually
 * receive and use (ETH, BTC wrappers, major stablecoins, chain coins).
 * Pools against tiny lookalike tokens (e.g. PEPE0.5/PEPE) are shown separately
 * as "Other pools (paired with small tokens, not counted)".
 */
export const MAJOR_QUOTE_ASSETS = [
  // ETH and wrappers
  "ETH", "WETH", "STETH", "WSTETH",
  // BTC wrappers
  "WBTC", "CBBTC", "BTCB", "TBTC",
  // major USD stablecoins
  "USDC", "USDC.E", "USDBC", "USDT", "USDT0", "USDT.E", "DAI", "FDUSD", "USDS", "PYUSD",
  // chain coins and their wrappers
  "SOL", "WSOL", "BNB", "WBNB", "POL", "WPOL", "MATIC", "WMATIC", "AVAX", "WAVAX", "SUI", "TRX", "WTRX",
] as const;

const MAJOR = new Set<string>(MAJOR_QUOTE_ASSETS);

export function isMajorAsset(symbol: string | null | undefined): boolean {
  return !!symbol && MAJOR.has(symbol.trim().toUpperCase());
}

export interface PoolToken {
  addr?: string;
  sym?: string;
  liqUsd?: string | number;
}

export interface RawPoolLike {
  t0?: PoolToken;
  t1?: PoolToken;
}

/**
 * Splits a pool into our token's side and the other side.
 * Matches by contract address first, then by symbol; null if neither side is ours.
 */
export function sidesOf(pool: RawPoolLike, ours: { contract?: string | null; symbol?: string | null }): { ours: PoolToken; other: PoolToken } | null {
  const c = ours.contract?.toLowerCase();
  const s = ours.symbol?.toUpperCase();
  const { t0, t1 } = pool;
  if (c && t0?.addr?.toLowerCase() === c && t1) return { ours: t0, other: t1 };
  if (c && t1?.addr?.toLowerCase() === c && t0) return { ours: t1, other: t0 };
  if (s && t0?.sym?.toUpperCase() === s && t1) return { ours: t0, other: t1 };
  if (s && t1?.sym?.toUpperCase() === s && t0) return { ours: t1, other: t0 };
  return null;
}

/** Counted when the other side is a major asset. If the other side is itself major and ours can't be identified, it's not counted. */
export function countsAsLiquidity(pool: RawPoolLike, ours: { contract?: string | null; symbol?: string | null }): boolean {
  const s = sidesOf(pool, ours);
  return !!s && isMajorAsset(s.other.sym);
}
