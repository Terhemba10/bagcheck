/**
 * Renders the three YouTube thumbnail options (1280x720 PNG) from video/thumbs/thumb.html,
 * which embeds real report screenshots from video/thumb-shot.ts.
 *   npx tsx video/thumb-shot.ts && npx tsx video/thumbs/render.ts
 */
import { chromium } from "@playwright/test";
import { copyFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const url = pathToFileURL(resolve("video/thumbs/thumb.html")).href;
  for (const v of ["a", "b", "c"]) {
    await page.goto(`${url}?v=${v}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const out = `video/thumbnail-${v}.png`;
    await page.screenshot({ path: out });
    console.log(`${out}  ${(statSync(out).size / 1024).toFixed(0)} KB`);
  }
  copyFileSync("video/thumbnail-a.png", "video/thumbnail.png"); // default until you pick
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
