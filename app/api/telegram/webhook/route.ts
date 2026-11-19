import { NextResponse } from "next/server";
import { decideMode } from "@/lib/cmc/budget";
import { getKeyInfo, searchCoins } from "@/lib/cmc/api";
import { CmcError } from "@/lib/cmc/errors";
import { buildReport } from "@/lib/core/report";
import {
  addWatch,
  consumeLinkCode,
  getWatchlist,
  MAX_WATCH,
  removeWatch,
  uidForChat,
  unlinkChat,
  watchedCoins,
} from "@/lib/monitor/store";
import { detectSecret } from "@/lib/safety/secrets";
import { kv } from "@/lib/store/kv";
import { BOT_USERNAME, escapeHtml, sendMessage, SITE_URL, tg } from "@/lib/telegram/api";
import { HELP_TEXT, parseCommand, reportText, RESCUE_TEXT, rescueText } from "@/lib/telegram/commands";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface TgUpdate {
  message?: { message_id: number; chat: { id: number; type: string }; text?: string; from?: { is_bot?: boolean } };
}

/** Constant-time compare of Telegram's secret header. */
function validSecret(req: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const got = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!expected || got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** Per-chat limit for commands that spend CMC credits. */
async function chatAllowed(chatId: number): Promise<boolean> {
  const minute = await kv().incr(`tgrl:m:${chatId}:${Math.floor(Date.now() / 60_000)}`, 70);
  const day = await kv().incr(`tgrl:d:${chatId}:${new Date().toISOString().slice(0, 10)}`, 90_000);
  return minute <= 4 && day <= 40;
}

export async function POST(req: Request) {
  if (!validSecret(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  const msg = update?.message;
  // Always answer 200 so Telegram doesn't retry; errors are reported in the chat.
  if (!msg?.text || msg.from?.is_bot) return NextResponse.json({ ok: true });
  const chatId = msg.chat.id;
  const text = msg.text;

  try {
    // 1. never keep secrets: delete the message and warn
    const secret = detectSecret(text);
    if (secret) {
      await tg("deleteMessage", { chat_id: chatId, message_id: msg.message_id });
      await sendMessage(chatId, `🔒 <b>I deleted your message.</b> ${escapeHtml(secret.message)}`);
      return NextResponse.json({ ok: true });
    }

    const parsed = parseCommand(text, BOT_USERNAME);
    if (!parsed) {
      await sendMessage(chatId, `Send a command, for example <code>/check pepe</code>.\n\n${HELP_TEXT}`);
      return NextResponse.json({ ok: true });
    }
    const { cmd, arg } = parsed;
    // observability without personal data: the command name only (no chat id, no text)
    console.info(`[tg] command=${cmd}${arg ? " with-arg" : ""}`);
    const uid = await uidForChat(chatId);

    switch (cmd) {
      case "start": {
        if (arg) {
          const linked = await consumeLinkCode(arg, chatId);
          await sendMessage(
            chatId,
            linked
              ? `✓ <b>Connected.</b> I'll send alerts for your watchlist to this chat.\n\nManage it on the website or here with /list.`
              : "That link has expired or was already used. Open Connect on the website to get a new one.",
          );
          break;
        }
        await sendMessage(chatId, HELP_TEXT);
        break;
      }
      case "help":
      case "unknown":
        await sendMessage(chatId, HELP_TEXT);
        break;
      case "check":
      case "watch": {
        if (!arg) {
          await sendMessage(chatId, `Tell me which coin, for example <code>/${cmd} pepe</code>.`);
          break;
        }
        if (!(await chatAllowed(chatId))) {
          await sendMessage(chatId, "You're checking very quickly. Please wait a minute and try again.");
          break;
        }
        const coin = (await searchCoins(arg))[0];
        if (!coin) {
          await sendMessage(chatId, `I couldn't find “${escapeHtml(arg)}” on CoinMarketCap. Try the name, symbol or contract address.`);
          break;
        }
        if (cmd === "check") {
          await sendMessage(chatId, "Checking supply… reading the links… scanning the contract…");
          await sendMessage(chatId, reportText(await buildReport(coin.id)));
          break;
        }
        const added = await addWatch(uid, { id: coin.id, name: coin.name, symbol: coin.symbol });
        if (!added.ok) {
          await sendMessage(chatId, `Your watchlist is full (${MAX_WATCH} coins). Remove one with /unwatch first.`);
          break;
        }
        const decision = decideMode(await getKeyInfo(), (await watchedCoins()).length);
        await sendMessage(
          chatId,
          `👀 <b>Watching ${escapeHtml(coin.name)} (${escapeHtml(coin.symbol)}).</b>\nI re-check watched coins about every ${decision.settings.intervalHours} hours and message you here if a warning sign appears: falling volume, fewer markets, draining liquidity, a supply jump, the website going down, or a promise date passing.\n\n<a href="${SITE_URL}/coin/${coin.id}">Today's report</a>`,
        );
        break;
      }
      case "unwatch": {
        const list = await getWatchlist(uid);
        const a = arg.toLowerCase();
        const hit = list.find((c) => c.symbol.toLowerCase() === a || c.name.toLowerCase() === a) ?? list.find((c) => c.name.toLowerCase().includes(a));
        if (!arg || !hit) {
          await sendMessage(chatId, list.length ? `Which one? Your watchlist: ${list.map((c) => c.symbol).join(", ")}` : "Your watchlist is empty.");
          break;
        }
        await removeWatch(uid, hit.id);
        await sendMessage(chatId, `Stopped watching ${escapeHtml(hit.name)}.`);
        break;
      }
      case "list": {
        const list = await getWatchlist(uid);
        await sendMessage(
          chatId,
          list.length
            ? `<b>Your watchlist</b> (${list.length}/${MAX_WATCH})\n${list.map((c) => `• <a href="${SITE_URL}/coin/${c.id}">${escapeHtml(c.name)}</a> (${escapeHtml(c.symbol)})`).join("\n")}\n\n<a href="${SITE_URL}/watchlist">Open on the website</a>`
            : "Your watchlist is empty. Add a coin with <code>/watch pepe</code>.",
        );
        break;
      }
      case "rescue": {
        // with a coin: link to that coin's rescue page (search costs 0 credits)
        const coin = arg ? (await searchCoins(arg))[0] ?? null : null;
        if (arg && !coin) {
          await sendMessage(chatId, `I couldn't find “${escapeHtml(arg)}”. Here's the general rescue plan:\n\n${RESCUE_TEXT}`);
          break;
        }
        await sendMessage(chatId, rescueText(coin));
        break;
      }
      case "stop":
        await unlinkChat(chatId);
        for (const c of await getWatchlist(`tg:${chatId}`)) await removeWatch(`tg:${chatId}`, c.id);
        await sendMessage(chatId, "Done. I won't send alerts to this chat any more. Send /start any time to come back.");
        break;
    }
  } catch (err) {
    const friendly = err instanceof CmcError ? err.userMessage : "Something went wrong on my side. Please try again in a moment.";
    await sendMessage(chatId, escapeHtml(friendly));
  }
  return NextResponse.json({ ok: true });
}
