import "server-only";
import { randomBytes } from "node:crypto";
import { getDexPools, getInfo, getKeyInfo, getQuotes } from "@/lib/cmc/api";
import { decideMode, isRunDue, type GovernorDecision } from "@/lib/cmc/budget";
import { checkLink } from "@/lib/core/links";
import { dexPlatformName } from "@/lib/core/report";
import { num, type DexPool } from "@/lib/core/signals";
import { runPromiseCheck } from "@/lib/promises/check";
import { kv } from "@/lib/store/kv";
import { formatAlert, sendMessage, telegramConfigured } from "@/lib/telegram/api";
import { evaluateRules, quoteKey } from "./rules";
import {
  addSnapshot,
  chatForUid,
  claimCooldown,
  getDelivered,
  getSnapshots,
  saveAlert,
  watchedCoins,
  watchersOf,
  type Alert,
  type Snapshot,
} from "./store";

/**
 * One monitoring run. Called by the scheduler (hourly) but only does work
 * when the credit governor says a run is due:
 *  - quotes for all watched coins in ONE batched call (+ Bitcoin for context)
 *  - "deep" checks (DEX liquidity, website, promise check) for a few coins per
 *    run, oldest first
 *  - snapshot → alert rules (code) → Telegram
 */
export interface RunResult {
  ran: boolean;
  reason: string;
  decision: GovernorDecision;
  coins: number;
  deep: number;
  alerts: number;
  messages: number;
  at: string;
}

const LAST_RUN = "monitor:lastRun";
const RUN_COUNT = "monitor:runCount";
const LOCK = "monitor:lock";
const deepKey = (id: number) => `monitor:deep:${id}`;

export async function getLastRun(): Promise<RunResult | null> {
  return kv().get<RunResult>(LAST_RUN);
}

export async function runMonitor(opts: { force?: boolean; now?: Date } = {}): Promise<RunResult> {
  const now = opts.now ?? new Date();
  const coins = await watchedCoins();
  const decision = decideMode(await getKeyInfo(), coins.length, now);
  const base = { decision, coins: 0, deep: 0, alerts: 0, messages: 0, at: now.toISOString() };
  const last = await getLastRun();

  if (!coins.length) return { ...base, ran: false, reason: "Nothing is on any watchlist yet" };
  if (decision.mode === "paused") return remember({ ...base, ran: false, reason: `Paused: ${decision.reason}` });
  if (!opts.force && last?.ran && !isRunDue(decision.mode, last.at, now)) {
    return { ...base, ran: false, reason: `Not due yet (${decision.mode} mode checks every ${decision.settings.intervalHours} h)` };
  }
  // one run at a time (the scheduler may overlap with a manual trigger); the lock expires after 2 min
  if ((await kv().incr(LOCK, 120)) > 1) {
    return { ...base, ran: false, reason: "Another run is in progress" };
  }

  try {
    const runNo = await kv().incr(RUN_COUNT, 365 * 86_400);
    const s = decision.settings;
    // rotate through the list when more coins are watched than the mode allows per run
    const start = coins.length > s.maxCoins ? ((runNo - 1) * s.maxCoins) % coins.length : 0;
    const selected = [...coins.slice(start), ...coins.slice(0, start)].slice(0, s.maxCoins);

    // 1. one batched quotes call for every selected coin + Bitcoin
    const quotes = (await getQuotes([...selected, 1])).value;
    const btc7d = quotes[1]?.quote.USD?.percent_change_7d ?? null;

    // 2. deep checks: the coins whose last deep check is oldest
    const lastDeep = await Promise.all(selected.map(async (id) => ({ id, at: (await kv().get<string>(deepKey(id))) ?? "" })));
    const deepIds = new Set(
      lastDeep
        .filter((d) => !d.at || now.getTime() - Date.parse(d.at) >= s.intervalHours * s.deepEvery * 3_600_000 - 600_000)
        .sort((a, b) => a.at.localeCompare(b.at))
        .slice(0, s.maxDeepPerRun)
        .map((d) => d.id),
    );

    let alerts = 0;
    let messages = 0;
    for (const id of selected) {
      const q = quotes[id];
      if (!q) continue;
      const usd = q.quote.USD;
      const snap: Snapshot = {
        at: now.toISOString(),
        price: usd?.price ?? null,
        marketCap: usd?.market_cap ?? null,
        volume24h: usd?.volume_24h ?? null,
        circulating: q.circulating_supply ?? null,
        numPairs: q.num_market_pairs ?? null,
        change7d: usd?.percent_change_7d ?? null,
        btcChange7d: btc7d,
        deep: false,
      };
      let promises = null;
      if (deepIds.has(id)) {
        Object.assign(snap, await deepCheck(id));
        snap.deep = true;
        await kv().set(deepKey(id), now.toISOString(), 30 * 86_400);
        promises = await runPromiseCheck(id, { now }).then((r) => r.promises).catch(() => null);
      }
      await addSnapshot(id, snap);

      const history = await getSnapshots(id, 30);
      const candidates = evaluateRules({ coinId: id, history, promises, now });
      for (const c of candidates) {
        if (!(await claimCooldown(id, c.key, c.cooldownDays))) continue;
        const { key, cooldownDays: _cd, ...rest } = c;
        void _cd;
        const alert: Alert = { ...rest, id: `${id}-${now.getTime().toString(36)}-${randomBytes(3).toString("hex")}`, coinId: id, coinName: q.name, coinSymbol: q.symbol, at: now.toISOString() };
        await saveAlert(alert);
        alerts++;
        messages += await deliver(alert, key);
      }
    }
    return remember({ ...base, ran: true, reason: `Checked ${selected.length} coin(s) in ${decision.mode} mode`, coins: selected.length, deep: deepIds.size, alerts, messages });
  } finally {
    await kv().del(LOCK);
  }
}

/** DEX liquidity (tokens only) + website reachability. ~1 credit for tokens, 0 for native coins. */
async function deepCheck(id: number): Promise<Pick<Snapshot, "dexLiquidityUsd" | "websiteUp">> {
  const info = (await getInfo([id]).catch(() => null))?.value[id];
  let dexLiquidityUsd: number | null = null;
  const contract = info?.platform?.token_address ?? info?.contract_address?.[0]?.contract_address ?? null;
  const platform = contract ? dexPlatformName(info?.platform ?? { name: info?.contract_address?.[0]?.platform?.name }) : null;
  if (contract && platform) {
    try {
      const pools = (await getDexPools(platform, contract)).value as DexPool[];
      dexLiquidityUsd = (Array.isArray(pools) ? pools : []).reduce((sum, p) => sum + (num(p.liqUsd) ?? 0), 0);
    } catch {
      dexLiquidityUsd = null;
    }
  }
  const site = info?.urls?.website?.[0];
  const websiteUp = site ? (await checkLink("website", site)).state !== "down" : null;
  return { dexLiquidityUsd, websiteUp };
}

/** Send to every watcher with a Telegram chat. Promise alerts respect each user's "delivered" marks. */
async function deliver(alert: Alert, key: string): Promise<number> {
  if (!telegramConfigured()) return 0;
  let sent = 0;
  for (const uid of await watchersOf(alert.coinId)) {
    const chat = await chatForUid(uid);
    if (!chat) continue;
    if (alert.rule === "promise_overdue") {
      const qk = key.replace(/^promise:/, "");
      if ((await getDelivered(uid, alert.coinId)).includes(qk)) continue;
    }
    const r = await sendMessage(chat, formatAlert(alert));
    if (r.ok) sent++;
  }
  return sent;
}

async function remember(r: RunResult): Promise<RunResult> {
  await kv().set(LAST_RUN, r, 30 * 86_400);
  return r;
}

export { quoteKey };
