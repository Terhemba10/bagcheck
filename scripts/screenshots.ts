/**
 * Screenshots of every built screen at 1440 and 390 px, saved to design/screens/.
 * Also checks for horizontal page scroll (a spec requirement at 390 px).
 *
 *   npx tsx scripts/screenshots.ts                  # against http://localhost:3000
 *   BASE_URL=https://… npx tsx scripts/screenshots.ts
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const pages = (process.env.PAGES ?? "/,/design,/evidence").split(",");
const widths = [1440, 390];

async function main() {
  mkdirSync("design/screens", { recursive: true });
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const problems: string[] = [];
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w > 800 ? 900 : 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const p of pages) {
      // "load", not "networkidle": the dev server's hot-reload socket never goes idle
      await page.goto(base + p, { waitUntil: "load", timeout: 90_000 });
      await page.waitForTimeout(2500); // agent mounts after idle
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 0) problems.push(`${p} @${w}px: horizontal overflow of ${overflow}px`);
      const name = (p === "/" ? "home" : p.slice(1).replace(/\//g, "-")) + `-${w}.png`;
      // Grow the viewport to the full page first and let the 3D canvas redraw: a `fullPage`
      // capture resizes mid-shot and headless software WebGL leaves the canvas blank.
      // Very tall pages exceed Chromium's max surface (~8k px) and tile, so those use fullPage.
      const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      if (fullHeight <= 7000) {
        await page.setViewportSize({ width: w, height: fullHeight });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `design/screens/${name}`, animations: "disabled", timeout: 180_000 });
        await page.setViewportSize({ width: w, height: w > 800 ? 900 : 844 });
      } else {
        // save as parts of ≤ 6000 px each (…-part1.png, …-part2.png)
        const chunk = 6000;
        await page.setViewportSize({ width: w, height: chunk });
        for (let i = 0, y = 0; y < fullHeight; i++, y += chunk) {
          await page.evaluate((top) => window.scrollTo(0, top), y);
          await page.waitForTimeout(1200);
          const part = name.replace(".png", `-part${i + 1}.png`);
          await page.screenshot({ path: `design/screens/${part}`, animations: "disabled", timeout: 180_000 });
          console.log(`saved design/screens/${part}`);
        }
        await page.setViewportSize({ width: w, height: w > 800 ? 900 : 844 });
        continue;
      }
      console.log(`saved design/screens/${name}`);
    }
    await ctx.close();
  }
  // 2D fallback proof: home with prefers-reduced-motion (no 3D, static orb)
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(base + "/", { waitUntil: "load", timeout: 90_000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "design/screens/home-390-reduced-motion.png" });
    console.log("saved design/screens/home-390-reduced-motion.png");
    await ctx.close();
  }

  await browser.close();
  if (problems.length) {
    console.error("Layout problems:\n" + problems.join("\n"));
    process.exitCode = 1;
  } else console.log("No horizontal overflow at any width.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
