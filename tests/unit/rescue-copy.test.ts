import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isOfficial } from "@/lib/rescue/links";
import { RESCUE_TEXT } from "@/lib/telegram/commands";

/** Static guard over the rescue UI source: information only, official links only. */
const files = [
  ...readdirSync("components/rescue").map((f) => join("components/rescue", f)),
  "app/rescue/page.tsx",
  "app/rescue/[id]/page.tsx",
  "lib/rescue/evidence.ts",
  "lib/rescue/lessons.ts",
];
const source = files.map((f) => readFileSync(f, "utf8")).join("\n") + RESCUE_TEXT;
const visible = source.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ""); // ignore code comments

describe("rescue plan wording", () => {
  it.each([/\bsell now\b/i, /\byou should (sell|hold|buy)\b/i, /\bhold (on|your)\b/i, /\bwe recommend\b/i, /\bbest time to\b/i, /\bit'?s a scam\b/i, /\brug ?pull\b/i])(
    "never says %s",
    (re) => expect(visible).not.toMatch(re),
  );

  it("labels the price impact as an estimate", () => {
    expect(source).toContain(">Estimate<");
    expect(source).toContain("Estimate from a standard 50/50 pool model");
  });

  it("only hard-codes https links that are on the allowlist (plus our own site)", () => {
    const urls = [...source.matchAll(/https:\/\/[^\s"'`)<>]+/g)].map((m) => m[0].replace(/[.,]$/, ""));
    for (const u of urls) {
      if (u.startsWith("https://covex-ai.vercel.app")) continue;
      expect(isOfficial(u), u).toBe(true);
    }
  });
});
