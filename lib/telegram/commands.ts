/**
 * Telegram command parsing and reply text. Pure, unit-tested.
 */
import type { Level } from "@/components/ui/status";
import type { Report } from "@/lib/core/report";
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
  "<b>Hi, I'm Bag.</b> I check coins with live CoinMarketCap data and warn you about warning signs.",
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

export const RESCUE_TEXT = [
  "<b>⛨ If something went wrong, start here.</b>",
  "",
  "<b>1. Never pay anyone to \"recover\" crypto.</b> Anyone who guarantees recovery for an upfront fee is running a scam. Real authorities never charge recovery fees.",
  "<b>2. If your wallet was drained or you approved a bad site:</b> revoke token approvals using only your wallet's own settings or the official explorer (e.g. etherscan.io/tokenapprovalchecker). Scammers make fake \"revoke\" sites.",
  "<b>3. Move what's left</b> to a <b>new</b> wallet with a <b>new</b> seed phrase. Revoking stops future drains but doesn't return stolen funds.",
  "<b>4. Keep evidence:</b> transaction hashes, dates, screenshots, and the site or contact involved.",
  "<b>5. Report it:</b> to the exchange you used, ic3.gov (US) or your local police cybercrime unit.",
  "",
  "The full rescue plan (where you can still sell, an evidence pack) is coming to the website soon.",
  "",
  `<i>${DISCLAIMER_TG}</i>`,
].join("\n");
