/**
 * covex-mcp: Covex for AI assistants (Model Context Protocol, stdio).
 *
 * Tools: check_token, promise_check, watch_token, rescue_plan.
 * Every result is information, not advice, and ends with the disclaimer.
 * Code decides (Covex's server computes scores from CoinMarketCap data);
 * the assistant only relays and explains.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { estimateImpact } from "../../lib/rescue/impact";
import { EXCHANGE_SUPPORT, IC3, revokeCheckerFor, SCAM_SHIELD, WALLET_HELP } from "../../lib/rescue/links";
import { detectSecret } from "../../lib/safety/secrets";
import { api, ApiError, BASE_URL, resolveCoin } from "./api";

const DISCLAIMER = "Not financial advice. Covex explains data. It never tells you to buy or sell.";

type Content = { content: { type: "text"; text: string }[]; isError?: boolean };
const text = (t: string): Content => ({ content: [{ type: "text", text: `${t}\n\n${DISCLAIMER}` }] });
const fail = (t: string): Content => ({ content: [{ type: "text", text: t }], isError: true });

/** Never accept seed phrases or private keys, even from an assistant. */
function guard(...inputs: string[]): Content | null {
  for (const i of inputs) {
    const hit = detectSecret(i);
    if (hit) return fail(`Blocked: ${hit.message.replace("so it wasn't sent", "so Covex didn't use it")}`);
  }
  return null;
}

async function run(fn: () => Promise<Content>): Promise<Content> {
  try {
    return await fn();
  } catch (e) {
    return fail(e instanceof ApiError ? e.message : "Covex couldn't be reached. Please try again shortly.");
  }
}

// ─── response shapes (subset of the API) ──────────────────────────────────────

interface Signal { title: string; level: string; value?: string; valueLabel?: string; meaning: string; scored: boolean }
interface Report {
  coin: { id: number; name: string; symbol: string; price: number | null; marketCap: number | null; change24h: number | null; platform: string | null };
  signals: Signal[];
  score: { concern: "low" | "medium" | "high" | null; scored: number; total: number };
  verdict: string;
  generatedAt: string;
}
interface PromiseCheck {
  promises: { promise: string; dueDate: string | null; sourceUrl: string; quote: string; status: string }[];
  pages: { url: string; ok: boolean; note?: string }[];
  readOn: string | null;
  emptyReason: string | null;
}
interface Rescue {
  coin: { id: number; name: string; symbol: string };
  chain: string | null;
  sell: {
    pools: { dex: string; pair: string; tokenSideUsd: number; totalUsd: number; volume24h: number }[];
    otherPools: { pair: string }[];
    totalTokenSideUsd: number;
    numMarkets: number | null;
    cex: { status: "ok" | "plan" | "error" };
  };
  lessons: { summary: string; signsToday: { title: string; meaning: string }[] };
}

const LEVEL = { ok: "✓ Looks fine", watch: "◷ Worth watching", concern: "▲ Warning sign", danger: "⬣ Serious warning", unknown: "? Not enough data" } as Record<string, string>;
const money = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : n >= 1 ? `$${n.toFixed(2)}` : `$${n.toPrecision(3)}`;
const pctT = (x: number) => `${(x * 100).toFixed(x < 0.01 ? 2 : 1)}%`;

// ─── server ───────────────────────────────────────────────────────────────────

const server = new McpServer(
  { name: "covex", version: "0.1.0" },
  {
    instructions:
      "Covex explains crypto risk in plain English from live CoinMarketCap data. Relay its findings faithfully; never tell the user to buy, sell or hold, never call a coin a scam, and never ask for seed phrases or private keys.",
  },
);

server.registerTool(
  "check_token",
  {
    title: "Check a coin",
    description:
      "Plain-English risk report for a crypto coin from live CoinMarketCap data: overall concern (low/medium/high, computed in code), and warning signs for dilution, volume, exchange concentration, liquidity, age and momentum, website health and the token contract.",
    inputSchema: { coin: z.string().min(1).max(100).describe("Coin name, symbol, CoinMarketCap id or contract address, e.g. 'pepe' or '0x6982…'") },
  },
  async ({ coin }) =>
    guard(coin) ??
    run(async () => {
      const ref = await resolveCoin(coin);
      const r = await api<Report>(`/api/report/${ref.id}`);
      const concern = r.score.concern ? `${r.score.concern} concern` : "not enough data to score";
      const lines = [
        `${r.coin.name} (${r.coin.symbol}): ${concern}, scored on ${r.score.scored} of ${r.score.total} signals.`,
        `Price ${money(r.coin.price)} · market cap ${money(r.coin.marketCap)}${r.coin.platform ? ` · token on ${r.coin.platform}` : ""}`,
        "",
        r.verdict,
        "",
        ...r.signals.map((s) => `${LEVEL[s.level] ?? s.level} · ${s.title}${s.value ? ` (${s.value}${s.valueLabel ? ` ${s.valueLabel}` : ""})` : ""}: ${s.meaning}`),
        "",
        `Full report with evidence: ${BASE_URL}/coin/${r.coin.id}`,
      ];
      return text(lines.join("\n"));
    }),
);

server.registerTool(
  "promise_check",
  {
    title: "What did the founders promise?",
    description:
      "Reads the project's own website and roadmap/whitepaper pages and lists what it says it will deliver and by when. Every quote is verified word-for-word against the page it links to; dates and statuses are computed by Covex.",
    inputSchema: { coin: z.string().min(1).max(100).describe("Coin name, symbol, CoinMarketCap id or contract address") },
  },
  async ({ coin }) =>
    guard(coin) ??
    run(async () => {
      const ref = await resolveCoin(coin);
      const p = await api<PromiseCheck>(`/api/promises/${ref.id}`);
      if (!p.promises.length) return text(`${p.emptyReason ?? "No specific commitments were found."}${p.readOn ? ` (${p.readOn})` : ""}`);
      const status: Record<string, string> = { overdue: "date passed (delivered?)", "due-soon": "due soon", upcoming: "upcoming", delivered: "delivered", "no-date": "no date" };
      const lines = [
        `${p.promises.length} commitment${p.promises.length === 1 ? "" : "s"} found on the project's own pages${p.readOn ? ` · ${p.readOn}` : ""}:`,
        ...p.promises.map((x) => `- ${x.dueDate ?? "no date"} [${status[x.status] ?? x.status}] ${x.promise}. Quote: "${x.quote}" (${x.sourceUrl})`),
        "",
        "'Date passed' only means the date has gone by; Covex can't confirm delivery, so check the source.",
        `Timeline: ${BASE_URL}/coin/${ref.id}#promises-title`,
      ];
      return text(lines.join("\n"));
    }),
);

server.registerTool(
  "watch_token",
  {
    title: "Watch a coin",
    description:
      "Adds a coin to an anonymous Covex watchlist (or removes it, or lists the watchlist). Covex re-checks watched coins on a schedule and can alert on Telegram when warning signs appear: falling volume, fewer markets, draining liquidity, a supply jump, the website going down, or a promise date passing.",
    inputSchema: {
      coin: z.string().max(100).optional().describe("Coin to watch or unwatch (not needed for 'list')"),
      action: z.enum(["watch", "unwatch", "list"]).default("watch"),
    },
  },
  async ({ coin, action }) =>
    guard(coin ?? "") ??
    run(async () => {
      if (action !== "list") {
        if (!coin) return fail("Tell me which coin.");
        const ref = await resolveCoin(coin);
        if (action === "watch") await api("/api/watchlist", { method: "POST", body: { coinId: ref.id }, withUid: true });
        else await api(`/api/watchlist?coinId=${ref.id}`, { method: "DELETE", withUid: true });
      }
      const wl = await api<{ coins: { id: number; name: string; symbol: string }[]; max: number; telegramLinked: boolean; monitor: { intervalHours: number | null; lastRunAt: string | null } }>("/api/watchlist", { withUid: true });
      const lines = [
        action === "watch" ? "Watching. " : action === "unwatch" ? "Removed. " : "",
        wl.coins.length ? `Watchlist (${wl.coins.length}/${wl.max}): ${wl.coins.map((c) => `${c.name} (${c.symbol})`).join(", ")}.` : "The watchlist is empty.",
        wl.monitor.intervalHours ? `Covex re-checks watched coins about every ${wl.monitor.intervalHours} hours.` : "",
      ];
      if (!wl.telegramLinked && wl.coins.length) {
        const link = await api<{ url: string }>("/api/telegram/link", { method: "POST", withUid: true });
        lines.push(`To get alerts on Telegram, open this one-time link (valid 15 minutes) and press Start: ${link.url}`);
      } else if (wl.telegramLinked) lines.push("Alerts go to the linked Telegram chat.");
      return text(lines.filter(Boolean).join("\n"));
    }),
);

server.registerTool(
  "rescue_plan",
  {
    title: "Rescue plan",
    description:
      "For when something went wrong with a coin: where it can still be traded right now, an ESTIMATE of price impact for an amount (information, not advice), steps to protect a wallet (official links only), where to report, and a recovery-scam warning.",
    inputSchema: {
      coin: z.string().min(1).max(100).describe("Coin name, symbol, CoinMarketCap id or contract address"),
      amount_usd: z.number().positive().max(1e10).optional().describe("Optional: the amount held, in US dollars at today's price, for the price-impact estimate"),
    },
  },
  async ({ coin, amount_usd }) =>
    guard(coin) ??
    run(async () => {
      const ref = await resolveCoin(coin);
      const r = await api<Rescue>(`/api/rescue/${ref.id}`);
      const lines = [`Rescue plan for ${r.coin.name} (${r.coin.symbol})`, "", `Recovery-scam shield: ${SCAM_SHIELD}`, "", "1. Where it can still be traded"];
      if (r.sell.numMarkets !== null) lines.push(`CoinMarketCap tracks ${r.sell.numMarkets.toLocaleString("en-US")} markets for ${r.coin.symbol}.`);
      if (r.sell.pools.length) {
        lines.push(`DEX pools paired with major assets (${money(r.sell.totalTokenSideUsd)} of ${r.coin.symbol} in total):`);
        for (const p of r.sell.pools.slice(0, 5)) lines.push(`- ${p.dex} ${p.pair}: ${money(p.tokenSideUsd)} of ${r.coin.symbol}, 24h volume ${money(p.volume24h)}`);
        if (r.sell.otherPools.length) lines.push(`(${r.sell.otherPools.length} other pools are paired with small tokens and not counted.)`);
      } else lines.push(r.chain ? "No DEX pools paired with a major asset were found." : `${r.coin.name} trades on exchanges, not in DEX pools.`);
      if (r.sell.cex.status === "plan") lines.push("Exchange-by-exchange depth needs a higher CoinMarketCap plan (Standard), so it isn't included.");
      if (amount_usd && r.sell.pools.length) {
        const e = estimateImpact(amount_usd, r.sell.pools);
        lines.push(
          "",
          `ESTIMATE for ${money(amount_usd)} (standard 50/50 pool model; concentrated-liquidity pools can differ; fees and price moves not included):`,
          `- all in the deepest pool (${e.deepestPool!.dex}): ~${pctT(e.deepestPool!.impact)} price impact`,
          `- spread across all ${e.acrossPools!.pools} pools: ~${pctT(e.acrossPools!.impact)}`,
          `- each of ${e.inParts!.parts} smaller parts: ~${pctT(e.inParts!.impactPerPart)} per part, if pools refill in between`,
          "When liquidity is thin, selling in smaller parts over time usually moves the price less per sale; the price can also change while waiting.",
        );
      }
      const checker = revokeCheckerFor(r.chain);
      lines.push(
        "",
        "2. If a wallet was drained or a bad site was approved",
        "Beware of fake 'revoke' and 'recovery' sites. Only use official links.",
        "- Stop signing anything from that site and disconnect it in the wallet.",
        `- Revoke token approvals only in the wallet or the chain's own explorer${checker ? `: ${checker.url}` : " (no verified checker for this chain; use the wallet's settings)"}.`,
        `- Wallet help: ${WALLET_HELP.map((l) => l.url).join(", ")}`,
        "- Move what's left to a NEW wallet with a NEW seed phrase. Revoking stops future drains but doesn't return stolen funds.",
        "- Never share a seed phrase or private key with anyone.",
        "",
        "3. Evidence and reporting",
        "Keep transaction hashes, dates and screenshots. Report to the exchange used (official support), " +
          `${IC3.url} (United States), or the local police cybercrime unit. Exchange support: ${EXCHANGE_SUPPORT.map((l) => l.url).join(", ")}`,
        "",
        `4. Lessons: ${r.lessons.summary}`,
        ...r.lessons.signsToday.map((s) => `- Warning sign today: ${s.title}: ${s.meaning}`),
        "",
        `Full rescue plan (with a private evidence-summary builder): ${BASE_URL}/rescue/${r.coin.id}`,
      );
      return text(lines.join("\n"));
    }),
);

await server.connect(new StdioServerTransport());
