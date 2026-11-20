import "server-only";
import { kv } from "@/lib/store/kv";
import { getDexPools, getDexSecurity, getInfo, getMarketPairs, getQuotes, type Sourced } from "@/lib/cmc/api";
import { CmcError } from "@/lib/cmc/errors";
import type { CoinInfo, CoinQuote, MarketPairs } from "@/lib/cmc/types";
import { checkProjectLinks, type LinkCheck } from "./links";
import { higherPlan } from "@/lib/cmc/planLabel";
import { allFromCache, sourceNote, type StepEvent, type StepId } from "./steps";
import { scoreReport, verdictText, type ScoreResult } from "./score";
import {
  concentrationSignal,
  contractSignal,
  dilutionSignal,
  linksSignal,
  liquiditySignal,
  momentumSignal,
  volumeSignal,
  type Avail,
  type DexPool,
  type DexSecurity,
  type Signal,
} from "./signals";

/**
 * Builds a coin report from live CMC data. Every input is fetched in
 * parallel and wrapped in Avail<T>, so one failing endpoint becomes an honest
 * "no data" signal instead of a broken page. Whole reports are cached 5 min.
 */
export interface Report {
  coin: {
    id: number;
    name: string;
    symbol: string;
    slug: string;
    logo: string | null;
    rank: number | null;
    price: number | null;
    change24h: number | null;
    change7d: number | null;
    marketCap: number | null;
    platform: string | null;
    contract: string | null;
    website: string | null;
  };
  signals: Signal[];
  score: ScoreResult;
  verdict: string;
  links: LinkCheck[];
  generatedAt: string;
  /** "live" if any CMC data was fetched just now, else the oldest source used. */
  freshness: "live" | "cache" | "stale";
}

const REPORT_TTL = 300;
const BTC_ID = 1;

/** CMC platform slug/name → the platform name the DEX endpoints expect (verified: ethereum). */
export function dexPlatformName(p: { slug?: string | null; name?: string | null } | null | undefined): string | null {
  if (!p) return null;
  const s = `${p.slug ?? ""} ${p.name ?? ""}`.toLowerCase();
  if (s.includes("ethereum")) return "ethereum";
  if (s.includes("bnb") || s.includes("binance") || s.includes("bsc")) return "bsc";
  if (s.includes("solana")) return "solana";
  if (s.includes("base")) return "base";
  if (s.includes("arbitrum")) return "arbitrum";
  if (s.includes("optimism") || s.includes("op mainnet")) return "optimism";
  if (s.includes("polygon")) return "polygon";
  if (s.includes("avalanche")) return "avalanche";
  if (s.includes("tron")) return "tron";
  if (s.includes("sui")) return "sui";
  return (p.slug ?? null) || null;
}

async function settle<T>(p: Promise<Sourced<T>>): Promise<Avail<T>> {
  try {
    const r = await p;
    return { status: "ok", value: r.value, source: r.source === "live" ? "live" : r.source === "stale" ? "saved" : "cached", at: r.fetchedAt };
  } catch (e) {
    if (e instanceof CmcError && e.kind === "plan_blocked") return { status: "plan", reason: e.userMessage };
    return { status: "error", reason: e instanceof CmcError ? e.userMessage : "Unexpected error" };
  }
}

const pickOne = <T>(a: Avail<Record<number, T>>, id: number): Avail<T> => {
  if (a.status !== "ok") return a;
  const v = a.value[id];
  return v ? { ...a, value: v } : { status: "error", reason: "CoinMarketCap returned no data for this coin." };
};

/** Report the outcome of one Avail as a finished step. */
function stepFor(id: StepId, a: Avail<unknown>): StepEvent {
  if (a.status === "ok") return { type: "step", id, status: "done", note: sourceNote(a.source) };
  if (a.status === "plan") return { type: "step", id, status: "blocked", note: `needs ${higherPlan(id === "markets" ? "marketPairs" : undefined)}` };
  if (a.status === "none") return { type: "step", id, status: "skipped", note: id === "contract" || id === "liquidity" ? "not a token" : "not needed" };
  return { type: "step", id, status: "failed", note: "no data" };
}

/**
 * Build a report. `onStep` receives real progress events (used by the streaming
 * route to drive the agent activity panel); it never changes the result.
 */
export async function buildReport(id: number, opts: { fresh?: boolean; onStep?: (e: StepEvent) => void } = {}): Promise<Report> {
  const emit = opts.onStep ?? (() => undefined);
  const track = <T>(sid: StepId, p: Promise<Avail<T>>): Promise<Avail<T>> => {
    emit({ type: "step", id: sid, status: "running" });
    return p.then((a) => {
      emit(stepFor(sid, a));
      return a;
    });
  };
  const key = `report:v3:${id}`; // bump when the report shape or copy changes
  if (!opts.fresh) {
    const cached = await kv().get<Report>(key).catch(() => null);
    if (cached) {
      for (const e of allFromCache()) emit(e);
      return { ...cached, freshness: "cache" };
    }
  }

  // 1. metadata + quotes (coin and Bitcoin in one call)
  const [infoAll, quotesAll] = await Promise.all([track("profile", settle(getInfo([id]))), track("market", settle(getQuotes(id === BTC_ID ? [id] : [id, BTC_ID])))]);
  const info = pickOne<CoinInfo>(infoAll, id);
  const quote = pickOne<CoinQuote>(quotesAll, id);
  const btc = pickOne<CoinQuote>(quotesAll, BTC_ID);
  if (info.status !== "ok" && quote.status !== "ok") {
    throw new CmcError(quote.status === "error" ? "upstream" : "not_found", "quotesV3", quote.reason);
  }

  // 2. token-only checks (DEX security + pools), market pairs, links: in parallel
  const meta = info.status === "ok" ? info.value : null;
  const platform = meta?.platform ?? null;
  const contract = platform?.token_address ?? meta?.contract_address?.[0]?.contract_address ?? null;
  const dexName = contract ? dexPlatformName(platform ?? { name: meta?.contract_address?.[0]?.platform?.name }) : null;
  const notToken = { status: "none" as const, reason: `${meta?.name ?? "This coin"} is a native coin, not a token contract, so there's no contract to scan.` };

  const [security, pools, pairs, links] = await Promise.all([
    track(
      "contract",
      contract && dexName ? settle(getDexSecurity(dexName, contract)).then(firstItem<DexSecurity>) : Promise.resolve(notToken as Avail<DexSecurity>),
    ),
    track(
      "liquidity",
      contract && dexName
        ? settle(getDexPools(dexName, contract)).then((a) => (a.status === "ok" ? { ...a, value: (Array.isArray(a.value) ? a.value : []) as DexPool[] } : a))
        : Promise.resolve({ status: "none" as const, reason: `${meta?.name ?? "This coin"} trades on exchanges, not in DEX pools.` } as Avail<DexPool[]>),
    ),
    track("markets", settle<MarketPairs>(getMarketPairs(id, 50))),
    track<LinkCheck[]>(
      "links",
      meta?.urls
        ? checkProjectLinks(meta.urls).then((v) => ({ status: "ok" as const, value: v, source: "live" as const }))
        : Promise.resolve({ status: "ok" as const, value: [] as LinkCheck[], source: "live" as const }),
    ),
  ]);
  emit({ type: "step", id: "score", status: "running" });

  const signals: Signal[] = [
    dilutionSignal(quote),
    volumeSignal(quote),
    concentrationSignal(pairs),
    liquiditySignal(pools as Avail<DexPool[]>, quote, { contract, symbol: meta?.symbol }),
    momentumSignal(quote, btc, info),
    linksSignal(links),
    contractSignal(security),
  ];
  const score = scoreReport(signals);
  const q = quote.status === "ok" ? quote.value : null;
  const usd = q?.quote.USD;
  const name = q?.name ?? meta?.name ?? `Coin ${id}`;

  const report: Report = {
    coin: {
      id,
      name,
      symbol: q?.symbol ?? meta?.symbol ?? "",
      slug: q?.slug ?? meta?.slug ?? "",
      logo: meta?.logo ?? null,
      rank: q?.cmc_rank ?? null,
      price: usd?.price ?? null,
      change24h: usd?.percent_change_24h ?? null,
      change7d: usd?.percent_change_7d ?? null,
      marketCap: usd?.market_cap ?? null,
      // only token contracts have a meaningful "platform" (chain)
      platform: contract ? platform?.name ?? meta?.contract_address?.[0]?.platform?.name ?? null : null,
      contract,
      website: meta?.urls?.website?.[0] ?? null,
    },
    signals,
    score,
    verdict: verdictText(name, score),
    links: links.status === "ok" ? links.value : [],
    generatedAt: new Date().toISOString(),
    freshness: [quote, info].some((a) => a.status === "ok" && a.source === "live") ? "live" : "cache",
  };
  emit({ type: "step", id: "score", status: "done", note: `${score.scored} of ${score.total} scored` });
  await kv().set(key, report, REPORT_TTL).catch(() => undefined);
  return report;
}

/** DEX security returns a one-item array. */
function firstItem<T>(a: Avail<unknown>): Avail<T> {
  if (a.status !== "ok") return a;
  const v = Array.isArray(a.value) ? a.value[0] : a.value;
  return v ? { ...a, value: v as T } : { status: "error", reason: "No security scan for this token." };
}
