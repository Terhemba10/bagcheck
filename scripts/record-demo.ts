/**
 * README media from the live site in real Chrome (GPU, so Bag renders in 3D):
 *  - docs/media/bag-scan.webm: home → search "pepe" → Bag scans → verdict
 *  - docs/media/*.png: report and rescue plan screenshots
 * Then make the GIF (cuts the wait while the report renders; adjust the times to the clip):
 *   F="select='between(t,1.5,10.6)+between(t,15.2,27.5)',setpts=N/FRAME_RATE/TB,fps=8,scale=680:-1:flags=lanczos"
 *   ffmpeg -i bag-scan.webm -vf "$F,palettegen=max_colors=128:stats_mode=diff" pal.png
 *   ffmpeg -i bag-scan.webm -i pal.png -lavfi "$F [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=4" bag-scan.gif
 *
 *   npx tsx scripts/record-demo.ts            # BASE_URL defaults to the live site
 * Reports are cached, so a run usually costs 0–4 CMC credits.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

const base = process.env.BASE_URL ?? "https://bagcheck-azure.vercel.app";
const out = "docs/media";
const size = { width: 1280, height: 760 };

async function main() {
  mkdirSync(out, { recursive: true });
  const tmp = join(out, ".video");
  rmSync(tmp, { recursive: true, force: true });
  const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1300,900"] });

  // 1. the clip
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: tmp, size } });
  await ctx.addInitScript({ content: "window.__name = (f) => f;" });
  const page = await ctx.newPage();
  await page.goto(base + "/", { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const box = page.getByRole("combobox");
  await box.click();
  await box.pressSequentially("pepe", { delay: 140 });
  await page.getByRole("option").first().waitFor();
  await page.waitForTimeout(700);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/coin\/\d+/);
  await page.waitForTimeout(9000); // scan steps, then the spoken verdict
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(2500);
  await ctx.close(); // flushes the video
  const webm = readdirSync(tmp).find((f) => f.endsWith(".webm"));
  if (webm) renameSync(join(tmp, webm), join(out, "bag-scan.webm"));
  rmSync(tmp, { recursive: true, force: true });

  // 2. stills
  const shots: [string, string, number][] = [
    ["report", "/coin/24478", 7000],
    ["rescue", "/rescue/24478", 4000],
  ];
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx2.addInitScript({ content: "window.__name = (f) => f;" });
  const p2 = await ctx2.newPage();
  for (const [name, path, wait] of shots) {
    await p2.goto(base + path, { waitUntil: "load" });
    await p2.waitForTimeout(wait);
    await p2.screenshot({ path: join(out, `${name}.png`) });
    console.log(`saved ${out}/${name}.png`);
  }
  await browser.close();
  console.log(`saved ${out}/bag-scan.webm`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
