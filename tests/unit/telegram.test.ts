import { describe, expect, it } from "vitest";
import { escapeHtml, formatAlert } from "@/lib/telegram/api";
import { HELP_TEXT, parseCommand, RESCUE_TEXT, rescueText } from "@/lib/telegram/commands";
import type { Alert } from "@/lib/monitor/store";

describe("parseCommand", () => {
  it.each([
    ["/check pepe", { cmd: "check", arg: "pepe" }],
    ["/check@BagcheckAlertsBot  Pepe ", { cmd: "check", arg: "Pepe" }],
    ["/WATCH sui", { cmd: "watch", arg: "sui" }],
    ["/list", { cmd: "list", arg: "" }],
    ["/start abc123XYZ_-", { cmd: "start", arg: "abc123XYZ_-" }],
    ["/dance", { cmd: "unknown", arg: "" }],
  ])("%s", (text, out) => expect(parseCommand(text)).toEqual(out));
  it("ignores plain text and commands for other bots", () => {
    expect(parseCommand("hello")).toBeNull();
    expect(parseCommand("/check@OtherBot pepe")).toBeNull();
  });
  it("caps argument length", () => {
    expect(parseCommand(`/check ${"x".repeat(500)}`)!.arg.length).toBe(100);
  });
});

describe("messages", () => {
  const alert: Alert = {
    id: "1-abc",
    coinId: 24478,
    coinName: "Pepe <script>",
    coinSymbol: "PEPE",
    rule: "liquidity_draining",
    severity: "danger",
    title: "DEX liquidity is draining",
    before: "$1.0M",
    after: "$400.0K",
    meaning: "The money in this token's DEX pools fell -60%.",
    next: ["Check the official channels."],
    at: "2026-11-20T00:00:00Z",
  };
  it("escapes HTML from data", () => {
    expect(escapeHtml("<b>&")).toBe("&lt;b&gt;&amp;");
    expect(formatAlert(alert)).toContain("Pepe &lt;script&gt;");
  });
  it("every alert and the help/rescue texts end with the disclaimer", () => {
    for (const t of [formatAlert(alert), HELP_TEXT, RESCUE_TEXT]) {
      expect(t).toContain("Not financial advice. Covex explains data. It never tells you to buy or sell.");
    }
  });
  it("links to the alert evidence and the report", () => {
    const t = formatAlert(alert);
    expect(t).toContain("/alerts/1-abc");
    expect(t).toContain("/coin/24478");
  });
  it("the rescue text uses the exact shield wording and warns about fake revoke sites", () => {
    expect(RESCUE_TEXT).toContain("Anyone who guarantees to recover your crypto for an upfront fee is running a scam. Real authorities never charge recovery fees.");
    expect(RESCUE_TEXT).toMatch(/fake "revoke" sites/);
    expect(RESCUE_TEXT).toContain('href="https://covex-ai.vercel.app/rescue"');
  });
  it("/rescue <coin> links to that coin's rescue page", () => {
    expect(rescueText({ id: 24478, name: "Pepe" })).toContain("https://covex-ai.vercel.app/rescue/24478");
  });
});
