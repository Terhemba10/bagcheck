import { randomBytes } from "node:crypto";
import { kv } from "@/lib/store/kv";

/**
 * Watchlists, snapshots, alerts and Telegram links.
 *
 * Identity without accounts:
 *  - web: a random anonymous id in an httpOnly cookie (`bc_uid`)
 *  - Telegram: the chat id (uid `tg:<chatId>` until linked to a web uid)
 *  - linking: a one-time code (15 min) carried in t.me/<bot>?start=<code>
 */
export const MAX_WATCH = 10; // matches the Basic-plan monitoring cap
const SNAP_CAP = 120;
const ALERT_CAP = 50;
const ALERT_TTL = 60 * 24 * 3600;

export interface WatchCoin {
  id: number;
  name: string;
  symbol: string;
  addedAt: string;
}

export interface Snapshot {
  at: string;
  price: number | null;
  marketCap: number | null;
  volume24h: number | null;
  circulating: number | null;
  numPairs: number | null;
  change7d: number | null;
  btcChange7d: number | null;
  /** Only on deep checks: */
  dexLiquidityUsd?: number | null;
  /** How dexLiquidityUsd was measured; only "major" (major-asset pools) values are compared. */
  liqMethod?: "major";
  websiteUp?: boolean | null;
  deep: boolean;
}

export type AlertRule = "promise_overdue" | "volume_falling" | "pairs_dropping" | "liquidity_draining" | "supply_jump" | "website_down" | "underperforming";

export interface Alert {
  id: string;
  coinId: number;
  coinName: string;
  coinSymbol: string;
  rule: AlertRule;
  severity: "concern" | "danger";
  title: string;
  /** Plain-English before/after, e.g. "$1.2M" → "$640K". */
  before: string;
  after: string;
  meaning: string;
  next: string[];
  /** Which snapshot metric to chart on the alert page. */
  metric?: keyof Snapshot;
  /** For promise alerts: the verified quote (used for "mark as delivered"). */
  quote?: string;
  at: string;
}

const k = {
  wl: (uid: string) => `wl:${uid}`,
  wlMeta: (uid: string) => `wlmeta:${uid}`,
  watchers: (coinId: number) => `watchers:${coinId}`,
  watched: "watched:coins",
  snaps: (coinId: number) => `snaps:${coinId}`,
  alerts: (coinId: number) => `alerts:${coinId}`,
  alert: (id: string) => `alert:${id}`,
  cooldown: (coinId: number, key: string) => `alertcd:${coinId}:${key}`,
  chatOf: (uid: string) => `tg:chat:${uid}`,
  uidOf: (chatId: number | string) => `tg:uid:${chatId}`,
  linkCode: (code: string) => `tg:link:${code}`,
  delivered: (uid: string, coinId: number) => `delivered:${uid}:${coinId}`,
};

export const newUid = () => randomBytes(16).toString("hex");
export const isUid = (s: string | undefined | null): s is string => !!s && /^(?:[a-f0-9]{32}|tg:-?\d{1,20})$/.test(s);

// ─── watchlist ────────────────────────────────────────────────────────────────

export async function getWatchlist(uid: string): Promise<WatchCoin[]> {
  const meta = (await kv().get<Record<string, WatchCoin>>(k.wlMeta(uid))) ?? {};
  return Object.values(meta).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

export async function addWatch(uid: string, coin: Omit<WatchCoin, "addedAt">): Promise<{ ok: true } | { ok: false; reason: "limit" }> {
  const meta = (await kv().get<Record<string, WatchCoin>>(k.wlMeta(uid))) ?? {};
  if (!meta[coin.id] && Object.keys(meta).length >= MAX_WATCH) return { ok: false, reason: "limit" };
  if (!meta[coin.id]) {
    // strictly after the newest entry, so two coins added in the same millisecond keep their order
    const newest = Math.max(0, ...Object.values(meta).map((c) => Date.parse(c.addedAt) || 0));
    meta[coin.id] = { ...coin, addedAt: new Date(Math.max(Date.now(), newest + 1)).toISOString() };
  }
  await kv().set(k.wlMeta(uid), meta);
  await kv().sadd(k.watchers(coin.id), uid);
  await kv().sadd(k.watched, String(coin.id));
  return { ok: true };
}

export async function removeWatch(uid: string, coinId: number): Promise<boolean> {
  const meta = (await kv().get<Record<string, WatchCoin>>(k.wlMeta(uid))) ?? {};
  const had = Boolean(meta[coinId]);
  delete meta[coinId];
  await kv().set(k.wlMeta(uid), meta);
  await kv().srem(k.watchers(coinId), uid);
  if ((await kv().smembers(k.watchers(coinId))).length === 0) await kv().srem(k.watched, String(coinId));
  return had;
}

export const watchersOf = (coinId: number) => kv().smembers(k.watchers(coinId));
export async function watchedCoins(): Promise<number[]> {
  return (await kv().smembers(k.watched)).map(Number).filter((n) => Number.isInteger(n) && n > 0).sort((a, b) => a - b);
}

/** Move a Telegram-only watchlist into the web uid when the two get linked. */
async function mergeWatchlists(from: string, to: string) {
  for (const c of await getWatchlist(from)) {
    await addWatch(to, { id: c.id, name: c.name, symbol: c.symbol });
    await removeWatch(from, c.id);
  }
}

// ─── snapshots ────────────────────────────────────────────────────────────────

export const addSnapshot = (coinId: number, s: Snapshot) => kv().pushCapped(k.snaps(coinId), s, SNAP_CAP);
/** Newest first. */
export const getSnapshots = (coinId: number, n = SNAP_CAP) => kv().list<Snapshot>(k.snaps(coinId), n);

// ─── alerts ───────────────────────────────────────────────────────────────────

export async function saveAlert(a: Alert) {
  await kv().set(k.alert(a.id), a, ALERT_TTL);
  await kv().pushCapped(k.alerts(a.coinId), a.id, ALERT_CAP);
}

export const getAlert = (id: string) => kv().get<Alert>(k.alert(id));

export async function alertsForCoins(coinIds: number[], limit = 20): Promise<Alert[]> {
  const ids = (await Promise.all(coinIds.map((c) => kv().list<string>(k.alerts(c), 10)))).flat();
  const alerts = (await Promise.all(ids.map((id) => getAlert(id)))).filter((a): a is Alert => !!a);
  return alerts.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** true if this alert key hasn't fired for this coin within the cooldown (and starts the cooldown). */
export async function claimCooldown(coinId: number, key: string, days: number): Promise<boolean> {
  if (await kv().get(k.cooldown(coinId, key))) return false;
  await kv().set(k.cooldown(coinId, key), 1, days * 86_400);
  return true;
}

// ─── "delivered" marks (per user) ─────────────────────────────────────────────

export async function getDelivered(uid: string, coinId: number): Promise<string[]> {
  return (await kv().get<string[]>(k.delivered(uid, coinId))) ?? [];
}
export async function setDelivered(uid: string, coinId: number, quoteKey: string, on: boolean) {
  const cur = new Set(await getDelivered(uid, coinId));
  if (on) cur.add(quoteKey);
  else cur.delete(quoteKey);
  await kv().set(k.delivered(uid, coinId), [...cur]);
}

// ─── Telegram linking ─────────────────────────────────────────────────────────

export const chatOf = (uid: string) => kv().get<number>(k.chatOf(uid));
export async function uidForChat(chatId: number): Promise<string> {
  return (await kv().get<string>(k.uidOf(chatId))) ?? `tg:${chatId}`;
}

export async function createLinkCode(uid: string): Promise<string> {
  const code = randomBytes(9).toString("base64url"); // 12 chars, allowed in /start payloads
  await kv().set(k.linkCode(code), uid, 15 * 60);
  return code;
}

/** Links a chat to the web uid behind `code`. Returns the uid, or null if the code is unknown/expired. */
export async function consumeLinkCode(code: string, chatId: number): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(code)) return null;
  const uid = await kv().get<string>(k.linkCode(code));
  if (!uid) return null;
  await kv().del(k.linkCode(code));
  await mergeWatchlists(`tg:${chatId}`, uid);
  await kv().set(k.uidOf(chatId), uid);
  await kv().set(k.chatOf(uid), chatId);
  return uid;
}

/** For Telegram-only users, the chat is the uid itself. */
export async function chatForUid(uid: string): Promise<number | null> {
  if (uid.startsWith("tg:")) return Number(uid.slice(3));
  return chatOf(uid);
}

export async function unlinkChat(chatId: number) {
  const uid = await kv().get<string>(k.uidOf(chatId));
  if (uid) await kv().del(k.chatOf(uid));
  await kv().del(k.uidOf(chatId));
}
