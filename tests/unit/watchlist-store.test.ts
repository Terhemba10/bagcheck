import { beforeEach, describe, expect, it } from "vitest";
import { __setKV, memoryKV } from "@/lib/store/kv";
import {
  addWatch,
  chatForUid,
  claimCooldown,
  consumeLinkCode,
  createLinkCode,
  getDelivered,
  getWatchlist,
  isUid,
  MAX_WATCH,
  newUid,
  removeWatch,
  setDelivered,
  uidForChat,
  watchedCoins,
  watchersOf,
} from "@/lib/monitor/store";

beforeEach(() => __setKV(memoryKV()));

const coin = (id: number) => ({ id, name: `Coin ${id}`, symbol: `C${id}` });

describe("watchlist", () => {
  it("adds, lists and removes coins, keeping the global index in sync", async () => {
    const u = newUid();
    await addWatch(u, coin(5));
    await addWatch(u, coin(3));
    expect((await getWatchlist(u)).map((c) => c.id)).toEqual([5, 3]);
    expect(await watchedCoins()).toEqual([3, 5]);
    expect(await watchersOf(5)).toEqual([u]);
    await removeWatch(u, 5);
    expect(await watchedCoins()).toEqual([3]);
  });

  it(`stops at ${MAX_WATCH} coins (the Basic-plan monitoring cap)`, async () => {
    const u = newUid();
    for (let i = 1; i <= MAX_WATCH; i++) expect((await addWatch(u, coin(i))).ok).toBe(true);
    expect(await addWatch(u, coin(99))).toEqual({ ok: false, reason: "limit" });
    expect((await addWatch(u, coin(1))).ok).toBe(true); // re-adding an existing one is fine
  });

  it("keeps a coin in the index while anyone still watches it", async () => {
    const a = newUid();
    const b = newUid();
    await addWatch(a, coin(7));
    await addWatch(b, coin(7));
    await removeWatch(a, 7);
    expect(await watchedCoins()).toEqual([7]);
  });
});

describe("Telegram linking", () => {
  it("links a chat with a one-time code and moves its Telegram-only watchlist", async () => {
    const web = newUid();
    const chat = 123456;
    await addWatch(`tg:${chat}`, coin(9)); // watched from Telegram before linking
    const code = await createLinkCode(web);
    expect(await consumeLinkCode(code, chat)).toBe(web);
    expect(await uidForChat(chat)).toBe(web);
    expect(await chatForUid(web)).toBe(chat);
    expect((await getWatchlist(web)).map((c) => c.id)).toEqual([9]);
    expect(await getWatchlist(`tg:${chat}`)).toEqual([]);
    // codes work once
    expect(await consumeLinkCode(code, 999)).toBeNull();
  });

  it("rejects malformed codes", async () => {
    expect(await consumeLinkCode("../../etc", 1)).toBeNull();
  });

  it("Telegram-only users are their own chat", async () => {
    expect(await uidForChat(42)).toBe("tg:42");
    expect(await chatForUid("tg:42")).toBe(42);
  });

  it("validates uids", () => {
    expect(isUid(newUid())).toBe(true);
    expect(isUid("tg:-100123")).toBe(true);
    expect(isUid("<script>")).toBe(false);
  });
});

describe("delivered marks and cooldowns", () => {
  it("stores per-user delivered marks", async () => {
    const u = newUid();
    await setDelivered(u, 5, "abcdef0123456789", true);
    expect(await getDelivered(u, 5)).toEqual(["abcdef0123456789"]);
    await setDelivered(u, 5, "abcdef0123456789", false);
    expect(await getDelivered(u, 5)).toEqual([]);
  });

  it("an alert key fires once per cooldown", async () => {
    expect(await claimCooldown(5, "volume_falling", 3)).toBe(true);
    expect(await claimCooldown(5, "volume_falling", 3)).toBe(false);
    expect(await claimCooldown(6, "volume_falling", 3)).toBe(true);
  });
});
