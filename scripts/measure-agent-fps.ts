/**
 * Measures Bag's real frame rate in the installed Chrome (hardware GPU, visible window).
 * For each quality (high, low) and cap (30, 60): rendered frames per second over 5 s,
 * after the cross-fade and warm-up. Also checks that auto mode settles correctly.
 *
 *   npx tsx scripts/measure-agent-fps.ts          (BASE_URL to test another host)
 *
 * Keep the Chrome window visible while it runs: hidden windows don't render.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3123";

async function main() {
  mkdirSync("design/screens/checks", { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1440,960"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } });
  // tsx/esbuild wraps named functions in __name(); define it inside the page too
  await ctx.addInitScript({ content: "window.__name = (f) => f;" });
  const page = await ctx.newPage();
  const rows: string[] = [];
  let gpu = "unknown";

  for (const quality of ["high", "low"] as const) {
    for (const fps of [30, 60]) {
      await page.goto(`${base}/?quality=${quality}&fps=${fps}`, { waitUntil: "load" });
      await page.waitForSelector('[data-agent-mode="3d"]', { timeout: 30_000 });
      await page.waitForTimeout(2500); // warm-up after the fade
      const r = await page.evaluate(async () => {
        const w = window as Window & { __bagFrames?: number };
        const f0 = w.__bagFrames ?? 0;
        let raf = 0;
        const t0 = performance.now();
        await new Promise<void>((res) => {
          const tick = () => {
            raf++;
            if (performance.now() - t0 < 5000) requestAnimationFrame(tick);
            else res();
          };
          requestAnimationFrame(tick);
        });
        const secs = (performance.now() - t0) / 1000;
        const gl = document.querySelector("canvas")?.getContext("webgl2");
        const ext = gl?.getExtension("WEBGL_debug_renderer_info");
        return {
          rendered: ((w.__bagFrames ?? 0) - f0) / secs,
          display: raf / secs,
          q: document.querySelector("[data-agent-quality]")?.getAttribute("data-agent-quality"),
          gpu: gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "unknown",
        };
      });
      gpu = r.gpu;
      rows.push(`| ${quality} | ${fps} | ${r.rendered.toFixed(1)} | ${r.display.toFixed(1)} | ${r.q} |`);
      console.log(`${quality} @cap ${fps}: rendered ${r.rendered.toFixed(1)} fps (display ${r.display.toFixed(1)} Hz)`);
      if (fps === 30) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.locator("[data-agent-mode]").screenshot({ path: `design/screens/checks/agent-${quality}.png` });
      }
    }
  }

  // auto mode: start high, keep it if it holds the budget
  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.evaluate(() => sessionStorage.removeItem("bagcheck:quality"));
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector('[data-agent-mode="3d"]', { timeout: 30_000 });
  await page.waitForTimeout(7000);
  const auto = await page.evaluate(() => document.querySelector("[data-agent-quality]")?.getAttribute("data-agent-quality"));
  console.log(`auto mode settled on: ${auto}`);

  const md = [
    `# Bag (3D agent) frame rate`,
    ``,
    `Measured ${new Date().toISOString()} in installed Chrome, visible window, 1440×860, production build.`,
    `GPU: ${gpu}`,
    ``,
    `| Quality | FPS cap | Rendered fps | Display refresh | Quality in use |`,
    `|---|---|---|---|---|`,
    ...rows,
    ``,
    `Auto mode settled on: **${auto}**.`,
    ``,
    `"Rendered fps" counts frames Bag actually drew. The product runs at the 30 fps cap. The 60 row asks for more than the budget: if High`,
    `drops below 30 there and the page's display refresh falls, the GPU is near its limit (that's when auto mode switches to Low).`,
    `The 60 row is not a true uncapped benchmark: even Low stays at ~30 there, so frames appear to be limited to every other refresh.`,
  ].join("\n");
  writeFileSync("design/AGENT_PERF.md", md + "\n");
  console.log("wrote design/AGENT_PERF.md");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
