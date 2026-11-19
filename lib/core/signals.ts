/**
 * The seven Bagcheck signals. Pure functions from CMC data to a level and
 * plain-English copy. Code decides; the AI only explains later.
 *
 * Every input is wrapped in `Avail<T>` so a signal can say *why* it has no
 * data (not a token, needs a paid plan, CMC error) instead of guessing.
 */
import type { Level } from "@/components/ui/status";
import type { SourceKind } from "@/components/ui/SourceTag";
import type { CoinInfo, CoinQuote, MarketPairs } from "@/lib/cmc/types";
import type { LinkCheck } from "./links";
import { ageText, daysBetween, money, pct, share } from "./format";

export type Avail<T> =
  | { status: "ok"; value: T; source: SourceKind; at?: string }
  | { status: "none"; reason: string } // not applicable (e.g. not a token)
  | { status: "plan"; reason: string } // needs a paid CMC plan
  | { status: "error"; reason: string }; // CMC/network problem

export type SignalId = "dilution" | "volume" | "concentration" | "liquidity" | "momentum" | "links" | "contract";

export interface Signal {
  id: SignalId;
  title: string;
  level: Level;
  value?: string;
  valueLabel?: string;
  meaning: string;
  why: string;
  source: { kind: SourceKind; at?: string };
  /** true when the level was actually computed (counts towards the score) */
  scored: boolean;
  details?: Record<string, unknown>;
}

// ─── DEX shapes (as returned live; numbers often arrive as strings) ───────────

export interface DexSecurity {
  securityLevel?: string;
  extra?: { buyTax?: string | number; sellTax?: string | number; isVerified?: boolean; isFlaggedByVendor?: boolean; isReported?: boolean };
  securityItems?: { code?: string; riskCode?: string; riskyLevel?: string; isHit?: boolean; des?: string }[];
  evmDisplay?: { honeypotStatus?: string; unverifiedContractStatus?: string; rugPullStatus?: string; fakeTokenStatus?: string; mintableStatus?: string };
  solanaDisplay?: { mintableStatus?: string; freezableStatus?: string; fakeTokenStatus?: string };
}

export interface DexPool {
  addr?: string;
  exn?: string; // exchange name
  liqUsd?: string | number;
  v24?: string | number;
  pubAt?: string | number;
  t0?: { sym?: string };
  t1?: { sym?: string };
}

export const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

const src = <T>(a: Avail<T>): Signal["source"] =>
  a.status === "ok" ? { kind: a.source, at: a.at } : a.status === "plan" ? { kind: "paid-plan" } : { kind: "cached" };

function unknown(id: SignalId, title: string, meaning: string, why: string, source: Signal["source"]): Signal {
  return { id, title, level: "unknown", meaning, why, source, scored: false };
}

// ─── 1. Dilution ──────────────────────────────────────────────────────────────

export const RULES = {
  dilution: { concernShare: 0.3, dangerShare: 0.15, concernFdv: 3, dangerFdv: 6 },
  volume: { hot: 1, warm: 0.5, thin: 0.005, dead: 0.001 },
  concentration: { concern: 0.6, danger: 0.85 },
  liquidity: { danger: 50_000, concern: 250_000, watch: 1_000_000 },
  momentum: { youngDays: 90, newDays: 30, lagConcern: -30, lagDanger: -50 },
  contract: { taxConcern: 10, taxDanger: 25 },
};

export function dilutionSignal(q: Avail<CoinQuote>): Signal {
  const title = "Dilution";
  const why = "Tokens that haven't been released yet can be unlocked and sold, which often pushes the price down.";
  if (q.status !== "ok") return unknown("dilution", title, "We couldn't load supply data for this coin.", why, src(q));
  const c = q.value;
  const usd = c.quote.USD;
  const circ = c.circulating_supply ?? null;
  const cap = c.max_supply ?? c.total_supply ?? null;
  const fdv = usd?.fully_diluted_market_cap ?? null;
  const mcap = usd?.market_cap ?? null;

  if (c.infinite_supply) {
    return { id: "dilution", title, level: "watch", value: "No cap", valueLabel: "maximum supply", meaning: "This coin has no maximum supply: new coins can keep being created over time.", why, source: src(q), scored: true };
  }
  if (!circ || !cap || cap <= 0) {
    return unknown("dilution", title, "CoinMarketCap doesn't report enough supply data to measure dilution.", why, src(q));
  }
  const released = Math.min(1, circ / cap);
  const fdvRatio = fdv && mcap ? fdv / mcap : null;
  const R = RULES.dilution;
  let level: Level = "ok";
  if (released < R.dangerShare || (fdvRatio !== null && fdvRatio >= R.dangerFdv)) level = "danger";
  else if (released < R.concernShare || (fdvRatio !== null && fdvRatio >= R.concernFdv)) level = "concern";
  else if (released < 0.7) level = "watch";

  const left = 1 - released;
  const meaning =
    left < 0.02
      ? `Almost all tokens (${share(released)}) are already in circulation, so there's little left to be released.`
      : released >= 0.7
        ? `${share(released)} of all tokens already exist. The remaining ${share(left)} can still be released over time.`
        : `Only ${share(released)} of all tokens exist today. The other ${share(left)} can still be released${level === "concern" || level === "danger" ? ", which often pushes the price down" : ""}.`;
  return {
    id: "dilution",
    title,
    level,
    value: share(released),
    valueLabel: "of all tokens in circulation",
    meaning,
    why: fdvRatio ? `${why} If every token existed today, the coin would be worth ${money(fdv)} (${fdvRatio.toFixed(1)}× its current value).` : why,
    source: src(q),
    scored: true,
    details: { circulating: circ, maxOrTotal: cap, released, fdv, marketCap: mcap, fdvRatio },
  };
}

// ─── 2. Volume sanity ─────────────────────────────────────────────────────────

export function volumeSignal(q: Avail<CoinQuote>): Signal {
  const title = "Volume sanity";
  const why = "Very high trading compared to a coin's value can mean fake (wash) trading; very low trading means it may be hard to sell.";
  if (q.status !== "ok") return unknown("volume", title, "We couldn't load trading volume.", why, src(q));
  const usd = q.value.quote.USD;
  const vol = usd?.volume_24h ?? null;
  const mcap = usd?.market_cap ?? null;
  if (vol === null || !mcap) return unknown("volume", title, "CoinMarketCap doesn't report a market cap for this coin, so we can't judge its volume.", why, src(q));
  const r = vol / mcap;
  const V = RULES.volume;
  let level: Level = "ok";
  let meaning: string;
  if (r > V.hot) {
    level = "concern";
    meaning = `In the last day, ${money(vol)} traded, more than the coin's whole value (${money(mcap)}). That's unusually high and can be a sign of fake volume.`;
  } else if (r > V.warm) {
    level = "watch";
    meaning = `${money(vol)} traded in the last day, about ${share(r)} of the coin's value. That's busy but not unheard of.`;
  } else if (r < V.dead) {
    level = "danger";
    meaning = `Only ${money(vol)} traded in the last day (${share(r)} of the coin's value). With so little trading, selling could be slow or move the price a lot.`;
  } else if (r < V.thin) {
    level = "concern";
    meaning = `Only ${money(vol)} traded in the last day, ${share(r)} of the coin's value. Thin trading can make it hard to sell.`;
  } else {
    meaning = `${money(vol)} traded in the last day, about ${share(r)} of the coin's value, which is a normal range.`;
  }
  return { id: "volume", title, level, value: r < 0.01 ? r.toFixed(4) : r.toFixed(2), valueLabel: "24h volume ÷ market cap", meaning, why, source: src(q), scored: true, details: { volume24h: vol, marketCap: mcap, ratio: r } };
}

// ─── 3. Trading concentration (Startup extra: market pairs) ───────────────────

export function concentrationSignal(pairs: Avail<MarketPairs>): Signal {
  const title = "Exchange concentration";
  const why = "When most trading happens on one exchange, a single delisting or outage can trap holders.";
  if (pairs.status === "plan") return unknown("concentration", title, "Exchange-by-exchange volume needs a paid CoinMarketCap plan, so it isn't checked live right now.", why, { kind: "paid-plan" });
  if (pairs.status !== "ok") return unknown("concentration", title, "We couldn't load where this coin trades.", why, src(pairs));
  const byExchange = new Map<string, number>();
  let total = 0;
  for (const p of pairs.value.market_pairs) {
    const v = p.quote.USD?.volume_24h ?? 0;
    if (!v || p.outlier_detected) continue;
    total += v;
    byExchange.set(p.exchange.name, (byExchange.get(p.exchange.name) ?? 0) + v);
  }
  if (!total) return unknown("concentration", title, "No trading volume was reported across this coin's markets.", why, src(pairs));
  const [topName, topVol] = [...byExchange.entries()].sort((a, b) => b[1] - a[1])[0]!;
  const top = topVol / total;
  const C = RULES.concentration;
  const level: Level = top >= C.danger ? "danger" : top >= C.concern ? "concern" : top >= 0.4 ? "watch" : "ok";
  return {
    id: "concentration",
    title,
    level,
    value: share(top),
    valueLabel: `of volume on ${topName}`,
    meaning: `${share(top)} of tracked trading happens on ${topName}, across ${byExchange.size} exchanges in total.`,
    why,
    source: src(pairs),
    scored: true,
    details: { topExchange: topName, topShare: top, exchanges: byExchange.size },
  };
}

// ─── 4. Liquidity (DEX pools on Basic; CEX pairs when available) ──────────────

export function liquiditySignal(pools: Avail<DexPool[]>, quote: Avail<CoinQuote>): Signal {
  const title = "Liquidity";
  const why = "Liquidity is the money available to buy from you. If it's thin, selling even a small amount can drop the price.";
  if (pools.status === "none") {
    return unknown("liquidity", title, `${pools.reason} Exchange order-book depth needs a paid CoinMarketCap plan.`, why, { kind: "paid-plan" });
  }
  if (pools.status !== "ok") return unknown("liquidity", title, "We couldn't load DEX pool liquidity.", why, src(pools));
  const list = pools.value
    .map((p) => ({ dex: p.exn ?? "DEX", liq: num(p.liqUsd) ?? 0, vol: num(p.v24) ?? 0, pair: `${p.t0?.sym ?? "?"}/${p.t1?.sym ?? "?"}` }))
    .filter((p) => p.liq >= 1000) // ignore dust pools
    .sort((a, b) => b.liq - a.liq);
  const total = list.reduce((s, p) => s + p.liq, 0);
  if (!list.length) {
    return { id: "liquidity", title, level: "danger", value: "$0", valueLabel: "in DEX pools", meaning: "We found no DEX pools with liquidity for this token.", why, source: src(pools), scored: true, details: { pools: [] } };
  }
  const L = RULES.liquidity;
  const level: Level = total < L.danger ? "danger" : total < L.concern ? "concern" : total < L.watch ? "watch" : "ok";
  const mcap = quote.status === "ok" ? quote.value.quote.USD?.market_cap ?? null : null;
  const topShare = list[0]!.liq / total;
  return {
    id: "liquidity",
    title,
    level,
    value: money(total),
    valueLabel: `across ${list.length} DEX pool${list.length === 1 ? "" : "s"}`,
    meaning: `${money(total)} sits in decentralised exchange pools${mcap ? ` (${share(total / mcap)} of the coin's market value)` : ""}. The deepest is ${list[0]!.dex} ${list[0]!.pair} with ${share(topShare)} of it.`,
    why,
    source: src(pools),
    scored: true,
    details: { totalUsd: total, pools: list.slice(0, 8) },
  };
}

// ─── 5. Age & momentum vs the market ──────────────────────────────────────────

export function momentumSignal(q: Avail<CoinQuote>, btc: Avail<CoinQuote>, info: Avail<CoinInfo>, now = new Date()): Signal {
  const title = "Age and momentum";
  const why = "Young coins have little track record, and a coin falling far more than the market can mean holders are leaving.";
  if (q.status !== "ok") return unknown("momentum", title, "We couldn't load price history.", why, src(q));
  const usd = q.value.quote.USD;
  const added = q.value.date_added ?? (info.status === "ok" ? info.value.date_added : null);
  const days = added ? daysBetween(added, now) : null;
  const ch30 = usd?.percent_change_30d ?? null;
  const btc30 = btc.status === "ok" ? btc.value.quote.USD?.percent_change_30d ?? null : null;
  const lag = ch30 !== null && btc30 !== null && q.value.id !== 1 ? ch30 - btc30 : null;
  const M = RULES.momentum;

  let level: Level = "ok";
  if ((days !== null && days < M.newDays) || (lag !== null && lag <= M.lagDanger)) level = "danger";
  else if ((days !== null && days < M.youngDays) || (lag !== null && lag <= M.lagConcern)) level = "concern";
  else if (lag !== null && lag <= -15) level = "watch";

  const parts: string[] = [];
  if (days !== null) parts.push(`Listed on CoinMarketCap ${ageText(days)} ago.`);
  if (ch30 !== null) {
    parts.push(
      lag !== null
        ? `Over 30 days it moved ${pct(ch30)} while Bitcoin moved ${pct(btc30)}, ${lag >= 0 ? `${Math.round(lag)} points better` : `${Math.round(-lag)} points worse`} than the market leader.`
        : `Over 30 days it moved ${pct(ch30)}.`,
    );
  }
  if (!parts.length) return unknown("momentum", title, "CoinMarketCap doesn't report a listing date or 30-day change for this coin.", why, src(q));
  return {
    id: "momentum",
    title,
    level,
    value: ch30 !== null ? pct(ch30, 0) : days !== null ? ageText(days) : undefined,
    valueLabel: ch30 !== null ? "price change, 30 days" : "listed",
    meaning: parts.join(" "),
    why,
    source: src(q),
    scored: true,
    details: { days, change7d: usd?.percent_change_7d ?? null, change30d: ch30, btc30d: btc30, lag },
  };
}

// ─── 6. Links health ──────────────────────────────────────────────────────────

export function linksSignal(links: Avail<LinkCheck[]>): Signal {
  const title = "Links health";
  const why = "Projects that stop maintaining their website and docs often stop building too.";
  if (links.status !== "ok") return unknown("links", title, "We couldn't check the project's links.", why, { kind: "cached" });
  const checked = links.value.filter((l) => l.state !== "skipped");
  if (!links.value.length) {
    return { id: "links", title, level: "concern", value: "None", valueLabel: "official links listed", meaning: "CoinMarketCap lists no official website or docs for this coin.", why, source: { kind: "live" }, scored: true, details: { links: [] } };
  }
  if (!checked.length) return unknown("links", title, "Only social links are listed, and those sites block automated checks.", why, { kind: "live" });
  const down = checked.filter((l) => l.state === "down");
  const websiteDown = down.some((l) => l.kind === "website");
  const level: Level = websiteDown ? "concern" : down.length ? "watch" : "ok";
  const meaning = down.length
    ? `${down.length} of ${checked.length} official link${checked.length === 1 ? "" : "s"} didn't respond: ${down.map((d) => `${d.kind} (${d.reason ?? "no response"})`).join(", ")}.`
    : checked.length === 1
      ? "The official link we checked is online."
      : `All ${checked.length} official links we checked are online.`;
  return { id: "links", title, level, value: `${checked.length - down.length}/${checked.length}`, valueLabel: "official links online", meaning, why, source: { kind: "live" }, scored: true, details: { links: links.value } };
}

// ─── 7. Contract check (DEX security) ─────────────────────────────────────────

export function contractSignal(sec: Avail<DexSecurity>): Signal {
  const title = "Contract check";
  const why = "Token contracts can include switches that block selling, charge big taxes or let the team create new tokens.";
  if (sec.status === "none") return unknown("contract", title, sec.reason, why, { kind: "live" });
  if (sec.status !== "ok") return unknown("contract", title, "We couldn't load the contract security scan.", why, src(sec));
  const s = sec.value;
  const buy = num(s.extra?.buyTax) ?? 0;
  const sell = num(s.extra?.sellTax) ?? 0;
  // The unit isn't documented. Security vendors usually send fractions ("0.05" = 5%), so values
  // below 1 are read as fractions and values of 1 or more as percentages ("1" = 1%, not 100%).
  const asPct = (t: number) => (t > 0 && t < 1 ? t * 100 : t);
  const buyPct = asPct(buy);
  const sellPct = asPct(sell);
  const hits = (s.securityItems ?? []).filter((i) => i.isHit);
  const red = hits.filter((i) => i.riskyLevel === "r");
  const yellow = hits.filter((i) => i.riskyLevel === "y");
  const honeypot = s.evmDisplay?.honeypotStatus === "Yes";
  const flagged = Boolean(s.extra?.isFlaggedByVendor || s.extra?.isReported);
  const C = RULES.contract;

  let level: Level = "ok";
  if (honeypot || red.length || Math.max(buyPct, sellPct) >= C.taxDanger || flagged) level = "danger";
  else if (Math.max(buyPct, sellPct) >= C.taxConcern || yellow.length >= 2) level = "concern";
  else if (yellow.length === 1) level = "watch";

  const findings: string[] = [];
  if (honeypot) findings.push("the scan says selling may be blocked (honeypot)");
  if (sellPct > 0 || buyPct > 0) findings.push(`buy tax ${buyPct.toFixed(1)}%, sell tax ${sellPct.toFixed(1)}%`);
  for (const i of [...red, ...yellow].slice(0, 3)) if (i.code) findings.push(i.code.toLowerCase());
  if (flagged) findings.push("flagged or reported by a security vendor");
  const meaning = findings.length
    ? `The security scan found: ${findings.join("; ")}.`
    : "The security scan found no risky switches in the contract and no buy or sell tax.";
  return {
    id: "contract",
    title,
    level,
    value: red.length + yellow.length ? `${red.length + yellow.length}` : "0",
    valueLabel: red.length + yellow.length === 1 ? "risk flag" : "risk flags",
    meaning,
    why,
    source: src(sec),
    scored: true,
    details: { buyTax: buyPct, sellTax: sellPct, honeypot, flagged, items: hits.map((i) => ({ code: i.code, level: i.riskyLevel, des: i.des })) },
  };
}
