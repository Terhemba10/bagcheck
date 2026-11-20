/**
 * Real screenshots of the live report for the YouTube thumbnails: the verdict card and the
 * agent activity steps glowing in the accent colour. 2x pixel density for crisp crops.
 *   npx tsx video/thumb-shot.ts   → video/out/thumb-aside.png, video/out/thumb-wide.png
 */
import { chromium } from "@playwright/test";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "https://covex-ai.vercel.app";
const GLOW = "0 0 0 2px #3ee6c8, 0 0 22px 4px rgba(62,230,200,.55), 0 0 60px 8px rgba(62,230,200,.25)";

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, colorScheme: "dark" });
  await ctx.addInitScript({ content: "window.__name = (f) => f;" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/coin/11841`, { waitUntil: "load" });
  const activity = page.getByRole("region", { name: "Agent activity" });
  await page.locator("text=/8\\/8 done/").first().waitFor({ timeout: 60_000 });
  const toggle = activity.getByRole("button").first();
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  await page.waitForTimeout(1500); // let numbers finish counting up
  const verdict = page.locator("section", { hasText: "Covex verdict" }).first();
  for (const l of [verdict, activity]) await l.evaluate((el, glow) => ((el as HTMLElement).style.boxShadow = glow), GLOW);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
  const v = (await verdict.boundingBox())!;
  const a = (await activity.boundingBox())!;
  const pad = 36;
  await page.screenshot({ path: join("video", "out", "thumb-aside.png"), clip: { x: v.x - pad, y: v.y - pad, width: v.width + pad * 2, height: a.y + a.height - v.y + pad * 2 } });
  await page.screenshot({ path: join("video", "out", "thumb-wide.png"), clip: { x: v.x - pad, y: Math.max(0, v.y - pad), width: 1920 - (v.x - pad) - 40, height: Math.min(1000, a.y + a.height - v.y + pad * 2) } });
  await browser.close();
  console.log("saved video/out/thumb-aside.png and thumb-wide.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
