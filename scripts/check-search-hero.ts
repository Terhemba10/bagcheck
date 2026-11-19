/**
 * Visual regression check for two bugs:
 *  1. search dropdown must be solid and above the chips / later sections
 *  2. hero must show Bag immediately (2D), then cross-fade to 3D
 *
 *   npx tsx scripts/check-search-hero.ts            (BASE_URL to test another host)
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = "design/screens/checks";

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const failures: string[] = [];

  for (const w of [390, 1440]) {
    const page = await (await browser.newContext({ viewport: { width: w, height: 900 } })).newPage();

    // 2. hero is never empty: Bag visible ~200 ms after load
    await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(200);
    const early = await page.evaluate(() => {
      const el = document.querySelector("[data-agent-state]");
      const r = el?.getBoundingClientRect();
      return r ? Math.round(r.width) : 0;
    });
    if (early < 50) failures.push(`@${w}: hero agent not visible at 200 ms (width ${early})`);
    await page.screenshot({ path: `${out}/hero-early-${w}.png`, clip: { x: 0, y: 0, width: w, height: Math.min(900, w < 800 ? 700 : 620) } });
    await page.waitForTimeout(4000);
    const mode = await page.evaluate(() => document.querySelector("[data-agent-mode]")?.getAttribute("data-agent-mode") ?? "2d-only");
    await page.screenshot({ path: `${out}/hero-late-${w}.png`, clip: { x: 0, y: 0, width: w, height: Math.min(900, w < 800 ? 700 : 620) } });

    // 1. dropdown solid and on top
    const input = page.getByRole("combobox");
    await input.scrollIntoViewIfNeeded();
    await input.focus();
    await input.fill("pepe");
    await page.getByRole("option").first().waitFor({ timeout: 20_000 });
    // results must be on screen (the search box scrolls up on focus on phones)
    await page.waitForTimeout(700);
    const onScreen = await page.evaluate(() => {
      const r = document.querySelector('[role="listbox"]')!.getBoundingClientRect();
      return r.top >= 0 && r.top < window.innerHeight - 80;
    });
    if (!onScreen) failures.push(`@${w}: results list opens off-screen`);
    await page.getByRole("listbox").evaluate((el) => el.scrollIntoView({ block: "center" }));
    const box = await page.getByRole("listbox").boundingBox();
    const check = await page.evaluate(() => {
      const list = document.querySelector('[role="listbox"]') as HTMLElement;
      const bg = getComputedStyle(list).backgroundColor;
      const r = list.getBoundingClientRect();
      // what is actually painted at a few points inside the list?
      const pts = [0.2, 0.5, 0.8].map((f) => document.elementFromPoint(r.left + r.width * 0.5, r.top + r.height * f));
      const allInside = pts.every((el) => el && list.contains(el));
      const chips = [...document.querySelectorAll("p")].find((p) => p.textContent?.startsWith("Try:"));
      return { bg, allInside, chipsHidden: chips ? getComputedStyle(chips).visibility === "hidden" : true };
    });
    const opaque = /^rgb\(/.test(check.bg) || /, 1\)$/.test(check.bg);
    if (!opaque) failures.push(`@${w}: listbox background not solid (${check.bg})`);
    if (!check.allInside) failures.push(`@${w}: something is painted on top of the results list`);
    if (!check.chipsHidden) failures.push(`@${w}: example chips still visible over the list`);
    if (box) {
      await page.screenshot({
        path: `${out}/search-open-${w}.png`,
        clip: { x: 0, y: Math.max(0, box.y - 140), width: w, height: Math.min(560, box.height + 220) },
      });
    }
    console.log(`@${w}: hero early width ${early}px, final mode ${mode}; list bg ${check.bg}, on top ${check.allInside}, chips hidden ${check.chipsHidden}`);
  }

  await browser.close();
  if (failures.length) {
    console.error("FAIL\n" + failures.join("\n"));
    process.exitCode = 1;
  } else console.log("PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
