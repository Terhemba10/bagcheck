/**
 * Minimal Telegram Bot API client + message formatting.
 * The token is only read from the environment and only sent to api.telegram.org.
 */
import type { Alert } from "@/lib/monitor/store";

export const DISCLAIMER_TG = "Not financial advice. Bagcheck explains data. It never tells you to buy or sell.";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bagcheck-azure.vercel.app";
export const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "BagcheckAlertsBot";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; result?: T; description?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN not set" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    return (await res.json()) as { ok: boolean; result?: T; description?: string };
  } catch {
    return { ok: false, description: "network error" };
  }
}

export function sendMessage(chatId: number, html: string, extra: Record<string, unknown> = {}) {
  return tg("sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML", link_preview_options: { is_disabled: true }, ...extra });
}

const SEVERITY = { concern: "▲ Warning sign", danger: "⬣ Serious warning" } as const;

/** Alert message: what changed, what it means, what to check next, disclaimer. */
export function formatAlert(a: Alert): string {
  const lines = [
    `<b>${SEVERITY[a.severity]} · ${escapeHtml(a.coinName)} (${escapeHtml(a.coinSymbol)})</b>`,
    `<b>${escapeHtml(a.title)}</b>`,
    `${escapeHtml(a.before)} → ${escapeHtml(a.after)}`,
    "",
    escapeHtml(a.meaning),
    "",
    "<b>What to check next</b>",
    ...a.next.map((n) => `• ${escapeHtml(n)}`),
    "",
    `<a href="${SITE_URL}/alerts/${encodeURIComponent(a.id)}">See the evidence</a> · <a href="${SITE_URL}/coin/${a.coinId}">Full report</a>`,
    "",
    `<i>${escapeHtml(DISCLAIMER_TG)}</i>`,
  ];
  return lines.join("\n");
}
