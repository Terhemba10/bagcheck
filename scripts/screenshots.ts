/**
 * Covex screenshots in real Chrome, saved to design/screens/:
 *   1440 with the sidebar open and collapsed, 1024 (open), 390 (top bar + bottom bar,
 *   plus the drawer and the command palette open). Also checks for horizontal page scroll.
 *
 *   npx tsx scripts/screenshots.ts                  # against http://localhost:3000
 *   BASE_URL=http://localhost:3123 npx tsx scripts/screenshots.ts
 * Report pages are cached server-side, so a run costs 0–8 CMC credits.
 */
import { chromium, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = "design/screens";
const PAGES = [
  ["home", "/"],
  ["risk", "/risk"],
  ["report", "/coin/24478"],
  ["rescue", "/rescue/24478"],
  ["watchlist", "/watchlist"],
  ["alerts", "/alerts"],
  ["connect", "/connect"],
] as const;

async function settle(page: Page, path: string) {
  await page.goto(base + path, { waitUntil: "load", timeout: 90_000 });
  // reports stream in; wait for the verdict, then for cards to finish assembling
  if (path.startsWith("/coin/")) await page.getByText("Covex verdict").waitFor();
  if (path === "/risk") await page.getByRole("row", { name: /Open the report/ }).first().waitFor({ timeout: 60_000 });
  if (path.startsWith("/coin/")) await page.locator("text=/\\d+\\/8 done/").waitFor({ timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(1800);
}

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1500,1000"] });
  const problems: string[] = [];
  const shot = async (page: Page, name: string, fullPage = false) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) problems.push(`${name}: horizontal overflow of ${overflow}px`);
    await page.screenshot({ path: `${out}/${name}.png`, fullPage });
    console.log(`saved ${out}/${name}.png`);
  };

  for (const [w, h, label, collapsed] of [
    [1440, 900, "1440", false],
    [1440, 900, "1440-collapsed", true],
    [1024, 768, "1024", false],
  ] as const) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript({ content: `window.__name = (f) => f; try { localStorage.setItem("covex:sidebar", "${collapsed ? "collapsed" : "open"}") } catch {}` });
    const page = await ctx.newPage();
    for (const [name, path] of PAGES) {
      if (collapsed && !["home", "report", "risk"].includes(name)) continue;
      await settle(page, path);
      await shot(page, `${name}-${label}`);
    }
    if (label === "1440") {
      await settle(page, "/coin/24478");
      await shot(page, "report-1440-full", true);
      await page.keyboard.press("Control+k");
      await page.waitForTimeout(400);
      await page.keyboard.type("pepe", { delay: 60 });
      await page.waitForTimeout(1200);
      await shot(page, "palette-1440");
      await page.keyboard.press("Escape");
      if (collapsed === false) {
        // rail tooltip demo needs the collapsed state; skip here
      }
    }
    if (label === "1440-collapsed") {
      await settle(page, "/");
      await page.getByRole("link", { name: "Watchlist" }).first().hover();
      await page.waitForTimeout(300);
      await shot(page, "home-1440-collapsed-tooltip");
    }
    await ctx.close();
  }

  // phones
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.addInitScript({ content: "window.__name = (f) => f;" });
  const page = await ctx.newPage();
  for (const [name, path] of PAGES) {
    await settle(page, path);
    await shot(page, `${name}-390`);
  }
  await settle(page, "/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.waitForTimeout(500);
  await shot(page, "drawer-390");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Search coins and pages" }).click();
  await page.waitForTimeout(400);
  await shot(page, "palette-390");
  await ctx.close();

  await browser.close();
  if (problems.length) {
    console.error("Layout problems:\n" + problems.join("\n"));
    process.exit(1);
  }
  console.log("No horizontal overflow.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
