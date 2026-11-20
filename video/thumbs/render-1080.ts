/** The chosen thumbnail (A) at 1920x1080 for the video's opening frames (same template, 1.5x). */
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  await page.goto(`${pathToFileURL(resolve("video/thumbs/thumb.html")).href}?v=a`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: "video/out/thumb-1080.png" });
  await browser.close();
  console.log("saved video/out/thumb-1080.png");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
