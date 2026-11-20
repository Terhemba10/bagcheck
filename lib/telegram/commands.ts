/**
 * Telegram command parsing and reply text. Pure, unit-tested.
 */
import type { Level } from "@/components/ui/status";
import type { Report } from "@/lib/core/report";
import { REVOKE_CHECKERS, SCAM_SHIELD } from "@/lib/rescue/links";
import { DISCLAIMER_TG, escapeHtml, SITE_URL } from "./api";

export type Command = "start" | "help" | "check" | "watch" | "unwatch" | "list" | "rescue" | "stop" | "unknown";

const KNOWN: Command[] = ["start", "help", "check", "watch", "unwatch", "list", "rescue", "stop"];

/** "/check@BagcheckAlertsBot  pepe " → { cmd: "check", arg: "pepe" }. Plain text → null. */
export function parseCommand(text: string, botUsername = "BagcheckAlertsBot"): { cmd: Command; arg: string } | null {
  const m = /^\/([a-z_]+)(?:@([A-Za-z0-9_]+))?(?:\s+([\s\S]*))?$/i.exec(text.trim());
  if (!m) return null;
  if (m[2] && m[2].toLowerCase() !== botUsername.toLowerCase()) return null; // a command for another bot in a group
  const name = m[1]!.toLowerCase() as Command;
  return { cmd: KNOWN.includes(name) ? name : "unknown", arg: (m[3] ?? "").trim().slice(0, 100) };
}

const LEVEL_TG: Record<Level, string> = {
  ok: "✓ Looks fine",
  watch: "◷ Worth watching",
  concern: "▲ Warning sign",
  danger: "⬣ Serious warning",
  unknown: "? Not enough data",
  rescue: "⛨ Rescue",
};

const CONCERN_TG = { low: "✓ Low concern", medium: "▲ Medium concern", high: "⬣ High concern" } as const;

export const HELP_TEXT = [
  "<b>Hi, I'm Covex.</b> I check coins with live CoinMarketCap data and warn you about warning signs.",
  "",
  "/check <i>coin</i> · a plain-English risk report",
  "/watch <i>coin</i> · I'll re-check it and alert you here",
  "/unwatch <i>coin</i> · stop watching",
  "/list · your watchlist",
  "/rescue <i>coin</i> · what to do if something went wrong",
  "/stop · stop all alerts in this chat",
  "",
  "🔒 I will <b>never</b> ask for your seed phrase or private key. Never share them with anyone.",
  "",
  `<i>${DISCLAIMER_TG}</i>`,
].join("\n");

export function reportText(r: Report): string {
  const concern = r.score.concern ? CONCERN_TG[r.score.concern] : "? Not enough data to score";
  const worst = [...r.signals]
    .filter((s) => s.scored)
    .sort((a, b) => order(b.level) - order(a.level))
    .slice(0, 4);
  return [
    `<b>${escapeHtml(r.coin.name)} (${escapeHtml(r.coin.symbol)})</b>`,
    `<b>${concern}</b> · scored on ${r.score.scored} of ${r.score.total} signals`,
    "",
    escapeHtml(r.verdict),
    "",
    ...worst.map((s) => `${LEVEL_TG[s.level]} · <b>${escapeHtml(s.title)}</b>${s.value ? ` (${escapeHtml(s.value)})` : ""}\n${escapeHtml(s.meaning)}`),
    "",
    `<a href="${SITE_URL}/coin/${r.coin.id}">Full report with evidence</a> · /watch ${escapeHtml(r.coin.symbol.toLowerCase())}`,
    "",
    `<i>${DISCLAIMER_TG}</i>`,
  ].join("\n");
}

function order(l: Level) {
  return { danger: 4, concern: 3, watch: 2, ok: 1, unknown: 0, rescue: 0 }[l];
}

/** /rescue reply: the essentials, then a link to the full plan (for a coin, or the general page). */
export function rescueText(coin?: { id: number; name: string } | null): string {
  const link = coin ? `${SITE_URL}/rescue/${coin.id}` : `${SITE_URL}/rescue`;
  return [
    `<b>⛨ ${coin ? `Rescue plan for ${escapeHtml(coin.name)}` : "If something went wrong, start here."}</b>`,
    "",
    `<b>Recovery-scam shield:</b> ${escapeHtml(SCAM_SHIELD)}`,
    "",
    "<b>1. Can I still sell?</b> The full plan shows where it trades now and an estimate of price impact for your amount.",
    `<b>2. Wallet drained or approved a bad site?</b> Revoke approvals only in your wallet or the chain's own explorer (e.g. ${REVOKE_CHECKERS.ethereum!.url}). Scammers make fake "revoke" sites. Revoking stops future drains but doesn't return stolen funds.`,
    "<b>3. Move what's left</b> to a <b>new</b> wallet with a <b>new</b> seed phrase.",
    "<b>4. Keep evidence</b> (transaction hashes, dates, screenshots) and <b>report it</b>: the exchange you used, ic3.gov (US), or your local police cybercrime unit.",
    "",
    `<a href="${link}">Open the full rescue plan</a>`,
    "",
    `<i>${DISCLAIMER_TG}</i>`,
  ].join("\n");
}

export const RESCUE_TEXT = rescueText(null);
