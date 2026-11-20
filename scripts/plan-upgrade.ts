/**
 * Run when /v1/key/info shows a paid plan:
 *  1. one small live call to each endpoint that was plan-blocked on Basic
 *  2. mark the ones that answer as "available" (the app otherwise waits out its 24 h block)
 *  3. save the raw responses for the showcase coins as demo snapshots in data/demo/<date>/
 *     (public market data only; the key is never written) for the judging period
 *
 *   npx tsx --env-file=.env.local --conditions=react-server scripts/plan-upgrade.ts
 * Cost: about 10 credits.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { markCapability } from "@/lib/cmc/capabilities";
import type { EndpointKey } from "@/lib/cmc/endpoints";

const KEY = process.env.CMC_API_KEY;
if (!KEY) throw new Error("CMC_API_KEY missing (run with --env-file=.env.local)");
const BASE = "https://pro-api.coinmarketcap.com";

// showcase coins: healthy large-cap, meme token with DEX flags, heavily diluted
const COINS = [
  { id: 1, slug: "bitcoin" },
  { id: 24478, slug: "pepe" },
  { id: 35336, slug: "official-trump" },
];

async function cmc(path: string, params: Record<string, string | number>) {
  const url = `${BASE}${path}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;
  const res = await fetch(url, { headers: { "X-CMC_PRO_API_KEY": KEY!, Accept: "application/json" } });
  const body = (await res.json()) as { status?: { error_code?: number | string; error_message?: string | null; credit_count?: number } };
  const code = Number(body.status?.error_code ?? 0);
  return { ok: res.ok && code === 0, http: res.status, code, credits: body.status?.credit_count ?? 0, body };
}

async function main() {
  const date = new Date().toISOString().slice(0, 10);
  const dir = join("data", "demo", date);
  mkdirSync(dir, { recursive: true });
  const report: string[] = [];
  let credits = 0;

  const save = (name: string, r: Awaited<ReturnType<typeof cmc>>, path: string, params: Record<string, string | number>) => {
    writeFileSync(
      join(dir, `${name}.json`),
      JSON.stringify({ recordedAt: new Date().toISOString(), endpoint: path, params, response: r.body }, null, 2) + "\n",
    );
  };

  const check = async (key: EndpointKey, name: string, path: string, params: Record<string, string | number>) => {
    const r = await cmc(path, params);
    credits += r.credits;
    report.push(`${r.ok ? "AVAILABLE" : `BLOCKED (${r.code})`}  ${path}  ${JSON.stringify(params)}  credits=${r.credits}`);
    if (r.ok) {
      await markCapability(key, "available");
      save(name, r, path, params);
    }
    return r.ok;
  };

  for (const c of COINS) {
    await check("marketPairs", `market-pairs-${c.slug}`, "/v2/cryptocurrency/market-pairs/latest", { id: c.id, limit: 50, convert: "USD" });
  }
  await check("pricePerformance", "price-performance", "/v2/cryptocurrency/price-performance-stats/latest", {
    id: COINS.map((c) => c.id).join(","),
    time_period: "all_time,90d,30d,7d",
  });
  await check("trendingGainersLosers", "trending-gainers-losers", "/v1/cryptocurrency/trending/gainers-losers", { time_period: "24h", limit: 50, convert: "USD" });
  await check("trendingMostVisited", "trending-most-visited", "/v1/cryptocurrency/trending/most-visited", { time_period: "24h", limit: 20, convert: "USD" });

  const info = await cmc("/v1/key/info", {});
  const plan = (info.body as { data?: { plan?: unknown; usage?: unknown } }).data;
  writeFileSync(join(dir, "key-info.json"), JSON.stringify({ recordedAt: new Date().toISOString(), plan: plan?.plan, usage: plan?.usage }, null, 2) + "\n");

  console.log(report.join("\n"));
  console.log(`\nSaved to ${dir}. Credits used: ${credits}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
