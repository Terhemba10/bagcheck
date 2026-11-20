/**
 * Home search checks:
 *  1. the search dropdown is solid and above the chips / later sections
 *  2. the PEPE / SUI chips open the report in one click, with the agent activity running
 *  3. "paste a contract" fills the search box instead
 *
 *   npx tsx scripts/check-search.ts            (BASE_URL to test another host)
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

    // 2. one-click chips
    await page.goto(base + "/", { waitUntil: "load", timeout: 90_000 });
    await page.getByRole("link", { name: "Check Pepe (PEPE)" }).click();
    await page.waitForURL(/\/coin\/24478$/, { timeout: 20_000 }).catch(() => failures.push(`@${w}: PEPE chip didn't open /coin/24478`));
    const activity = await page
      .getByRole("region", { name: "Agent activity" })
      .waitFor({ timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (!activity) failures.push(`@${w}: agent activity panel not shown after the chip click`);
    await page.locator("text=/\\d+\\/8 (done|steps)/").first().waitFor({ timeout: 30_000 }).catch(() => failures.push(`@${w}: no step counter`));
    const early = page.url();
    await page.goto(base + "/", { waitUntil: "load", timeout: 90_000 });
    await page.getByRole("button", { name: "Try a contract address (Pepe on Ethereum)" }).click();
    const filled = await page.getByRole("combobox").inputValue();
    if (!filled.startsWith("0x6982")) failures.push(`@${w}: "paste a contract" didn't fill the search box`);
    const mode = filled.startsWith("0x") ? "contract filled" : "not filled";
    await page.keyboard.press("Escape");

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
      const chips = [...document.querySelectorAll("p")].find((p) => p.textContent?.startsWith("Try"));
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
    console.log(`@${w}: chip opened ${early}; ${mode}; list bg ${check.bg}, on top ${check.allInside}, chips hidden ${check.chipsHidden}`);
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
