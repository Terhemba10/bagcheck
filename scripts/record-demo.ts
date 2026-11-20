/**
 * README media in real Chrome:
 *  - docs/media/covex-scan.webm: home → search → the agent activity steps run → verdict → cards assemble
 *  - docs/media/*.png: report and rescue plan screenshots
 * Then make the GIF (trims the blank first frame):
 *   F="trim=start=1.6,setpts=PTS-STARTPTS,fps=8,scale=680:-1:flags=lanczos"
 *   ffmpeg -i covex-scan.webm -vf "$F,palettegen=max_colors=128:stats_mode=diff" pal.png
 *   ffmpeg -i covex-scan.webm -i pal.png -lavfi "$F [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=4" covex-scan.gif
 *
 *   DEMO_QUERY=sui npx tsx scripts/record-demo.ts   # BASE_URL defaults to the live site
 * Pick a coin whose report isn't cached (5 min) so the steps run live. About 4 CMC credits.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

const base = process.env.BASE_URL ?? "https://covex-ai.vercel.app";
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
  await box.pressSequentially(process.env.DEMO_QUERY ?? "pepe", { delay: 140 });
  await page.getByRole("option").first().waitFor();
  await page.waitForTimeout(700);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/coin\/\d+/);
  await page.getByText("Covex verdict").waitFor();
  await page.locator("text=/\\d+\\/8 done/").waitFor({ timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(2500); // cards assemble, numbers count up
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(2500);
  await ctx.close(); // flushes the video
  const webm = readdirSync(tmp).find((f) => f.endsWith(".webm"));
  if (webm) renameSync(join(tmp, webm), join(out, "covex-scan.webm"));
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
  console.log(`saved ${out}/covex-scan.webm`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
