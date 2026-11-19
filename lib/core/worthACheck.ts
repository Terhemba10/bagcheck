/**
 * "Coins worth a check" for the Home page. Pure, unit-tested.
 *
 * Code decides, AI explains: every pick comes with the computed warning signs
 * that put it on the list. We never call a coin a scam.
 */
import type { CoinQuote } from "@/lib/cmc/types";

export type WorthReason = "big-move" | "dilution" | "thin-volume" | "hot-volume";

export interface WorthACheck {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  rank: number | null;
  price: number | null;
  change24h: number | null;
  reasons: { code: WorthReason; text: string }[];
}

export const WORTH_RULES = {
  bigMove: 15, // |24h %| at or above
  dilution: 3, // fully diluted value ÷ market cap at or above
  thinVolume: 0.005, // 24h volume ÷ market cap below
  hotVolume: 1.0, // 24h volume ÷ market cap above (possible wash trading)
  minMarketCap: 10_000_000, // ignore tiny coins where ratios are noise
};

const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;

export function reasonsFor(c: CoinQuote): WorthACheck["reasons"] {
  const q = c.quote.USD;
  const out: WorthACheck["reasons"] = [];
  if (!q) return out;
  const mcap = q.market_cap ?? 0;
  const ch = q.percent_change_24h;
  if (typeof ch === "number" && Math.abs(ch) >= WORTH_RULES.bigMove) {
    out.push({ code: "big-move", text: `${pct(ch)} in 24h` });
  }
  const fdv = q.fully_diluted_market_cap;
  if (mcap > 0 && typeof fdv === "number" && fdv / mcap >= WORTH_RULES.dilution) {
    out.push({ code: "dilution", text: `${Math.round((mcap / fdv) * 100)}% of supply released` });
  }
  const vol = q.volume_24h;
  if (mcap > 0 && typeof vol === "number") {
    const r = vol / mcap;
    if (r < WORTH_RULES.thinVolume) out.push({ code: "thin-volume", text: "Very little trading" });
    else if (r > WORTH_RULES.hotVolume) out.push({ code: "hot-volume", text: "Trading more than its whole value daily" });
  }
  return out;
}

export function pickWorthACheck(coins: CoinQuote[], limit = 6): WorthACheck[] {
  const scored = coins
    .filter((c) => (c.quote.USD?.market_cap ?? 0) >= WORTH_RULES.minMarketCap)
    // stablecoins sit still by design and add noise
    .filter((c) => !(Array.isArray((c as { tags?: unknown }).tags) && JSON.stringify((c as { tags?: unknown }).tags).includes("stablecoin")))
    .map((c) => {
      const reasons = reasonsFor(c);
      const move = Math.abs(c.quote.USD?.percent_change_24h ?? 0);
      // more warning signs always rank first; the size of the move breaks ties
      return { c, reasons, score: reasons.length * 100 + Math.min(move, 99) };
    })
    .filter((x) => x.reasons.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ c, reasons }) => ({
    id: c.id,
    name: c.name,
    symbol: c.symbol,
    slug: c.slug,
    rank: c.cmc_rank ?? null,
    price: c.quote.USD?.price ?? null,
    change24h: c.quote.USD?.percent_change_24h ?? null,
    reasons,
  }));
}
