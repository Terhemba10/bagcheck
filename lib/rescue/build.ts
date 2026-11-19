import "server-only";
import { getDexPools, getMarketPairs, getQuotes } from "@/lib/cmc/api";
import { CmcError } from "@/lib/cmc/errors";
import { buildReport, dexPlatformName, type Report } from "@/lib/core/report";
import { num } from "@/lib/core/signals";
import { alertsForCoins, getSnapshots, type Snapshot } from "@/lib/monitor/store";
import { lessonsFrom, type Lessons } from "./lessons";
import type { PoolSide } from "./impact";

/**
 * Data for the rescue plan of ANY coin (watched or not). Information only:
 * where liquidity is, and what the history shows. Never "sell"/"hold".
 */
export interface CexMarket {
  exchange: string;
  pair: string;
  volumeShare: number;
  volume24h: number;
  /** USD that can be sold before the price drops 2%, when CoinMarketCap provides it. */
  depthMinus2: number | null;
}

export interface Rescue {
  coin: Report["coin"];
  /** DEX chain name (for the revoke checker), null for native coins. */
  chain: string | null;
  verdict: string;
  concern: Report["score"]["concern"];
  sell: {
    pools: PoolSide[];
    totalTokenSideUsd: number;
    numMarkets: number | null;
    cex: { status: "ok"; markets: CexMarket[] } | { status: "plan" } | { status: "error" };
  };
  lessons: Lessons;
  generatedAt: string;
}

interface RawPool {
  exn?: string;
  liqUsd?: string | number;
  v24?: string | number;
  t0?: { addr?: string; sym?: string; liqUsd?: string | number };
  t1?: { addr?: string; sym?: string; liqUsd?: string | number };
}

/** USD of OUR token in each pool (the side a sale goes into). Pure, exported for tests. */
export function poolSides(raw: RawPool[], contract: string): PoolSide[] {
  const c = contract.toLowerCase();
  return raw
    .map((p) => {
      const total = num(p.liqUsd) ?? 0;
      const ours = p.t0?.addr?.toLowerCase() === c ? p.t0 : p.t1?.addr?.toLowerCase() === c ? p.t1 : null;
      const side = ours ? num(ours.liqUsd) ?? total / 2 : total / 2;
      return { dex: p.exn ?? "DEX", pair: `${p.t0?.sym ?? "?"}/${p.t1?.sym ?? "?"}`, tokenSideUsd: side, totalUsd: total, volume24h: num(p.v24) ?? 0 };
    })
    .filter((p) => p.tokenSideUsd >= 500) // dust pools aren't a realistic exit
    .sort((a, b) => b.tokenSideUsd - a.tokenSideUsd)
    .slice(0, 8);
}

export async function buildRescue(id: number): Promise<Rescue> {
  const report = await buildReport(id); // cached 5 min
  const contract = report.coin.contract;
  const chain = contract ? dexPlatformName({ name: report.coin.platform }) : null;

  const [poolsRaw, quotes, pairs, snaps, alerts] = await Promise.all([
    contract && chain ? getDexPools(chain, contract).then((r) => (Array.isArray(r.value) ? (r.value as RawPool[]) : [])).catch(() => []) : Promise.resolve([] as RawPool[]),
    getQuotes([id]).then((r) => r.value[id] ?? null).catch(() => null),
    getMarketPairs(id, 20).then((r) => ({ status: "ok" as const, value: r.value })).catch((e) => ({ status: e instanceof CmcError && e.kind === "plan_blocked" ? ("plan" as const) : ("error" as const) })),
    getSnapshots(id, 120),
    alertsForCoins([id], 20),
  ]);

  const pools = contract ? poolSides(poolsRaw, contract) : [];
  let cex: Rescue["sell"]["cex"] = { status: "error" };
  if (pairs.status === "plan") cex = { status: "plan" };
  else if (pairs.status === "ok") {
    const list = pairs.value.market_pairs;
    const total = list.reduce((s, p) => s + (p.quote.USD?.volume_24h ?? 0), 0) || 1;
    cex = {
      status: "ok",
      markets: list
        .filter((p) => !p.outlier_detected)
        .map((p) => ({ exchange: p.exchange.name, pair: p.market_pair, volume24h: p.quote.USD?.volume_24h ?? 0, volumeShare: (p.quote.USD?.volume_24h ?? 0) / total, depthMinus2: p.quote.USD?.depth_negative_two ?? null }))
        .sort((a, b) => (b.depthMinus2 ?? 0) - (a.depthMinus2 ?? 0) || b.volume24h - a.volume24h)
        .slice(0, 8),
    };
  }

  return {
    coin: report.coin,
    chain,
    verdict: report.verdict,
    concern: report.score.concern,
    sell: { pools, totalTokenSideUsd: pools.reduce((s, p) => s + p.tokenSideUsd, 0), numMarkets: quotes?.num_market_pairs ?? null, cex },
    lessons: lessonsFrom({ snapshots: (snaps as Snapshot[]).slice().reverse(), alerts, report }),
    generatedAt: new Date().toISOString(),
  };
}
