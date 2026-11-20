/**
 * Risk board checks in real Chrome: rows load and deal in, fps while hovering (tilt + light
 * sweep) and while re-sorting / filtering (FLIP), a row opens its report through the shared
 * view transition, and Simple graphics gives a plain table.
 *   BASE_URL=http://localhost:3123 npx tsx scripts/check-risk.ts
 */
import { chromium, type Page } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://localhost:3000";
let failures = 0;
const check = (ok: boolean, label: string, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  (${extra})` : ""}`);
  if (!ok) failures++;
};

async function fps(page: Page, ms: number, work: () => Promise<void>) {
  await page.evaluate(() => {
    const w = window as unknown as { __f: number; __run: boolean; __worst: number; __last: number };
    w.__f = 0;
    w.__run = true;
    w.__worst = 0;
    w.__last = performance.now();
    const tick = (t: number) => {
      if (!w.__run) return;
      w.__f++;
      w.__worst = Math.max(w.__worst, t - w.__last);
      w.__last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const t0 = Date.now();
  await work();
  const left = ms - (Date.now() - t0);
  if (left > 0) await page.waitForTimeout(left);
  const r = await page.evaluate(() => {
    const w = window as unknown as { __f: number; __run: boolean; __worst: number };
    w.__run = false;
    return { f: w.__f, worst: w.__worst };
  });
  return { fps: (r.f * 1000) / Math.max(ms, Date.now() - t0), worst: r.worst };
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1500,1000"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript({ content: "window.__name = (f) => f;" });
  const page = await ctx.newPage();
  await page.goto(base + "/risk", { waitUntil: "load" });
  const rows = page.getByRole("row", { name: /Open the report/ });
  await rows.first().waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1500);
  const table = page.getByRole("table", { name: "Risk board" });
  const total = async () => Number(await table.getAttribute("aria-rowcount")) - 1;
  const n = await total();
  const rendered = await rows.count();
  check(n >= 100, "board lists the top coins", `${n} rows`);
  check(rendered < n, "long list is virtualised (only rows in view are in the DOM)", `${rendered} of ${n} rendered`);
  const firstLabel = await rows.first().getAttribute("aria-label");
  check(/concern|not enough data/i.test(firstLabel ?? ""), "rows use the report's verdict wording", firstLabel ?? "");
  const body = await page.locator("main").innerText();
  check(!/\b(safe|verified)\b/i.test(body), "no 'safe' or 'verified' wording");
  check(/Not financial advice/.test(body), "the not-financial-advice line is visible");

  // hover: tilt + lift + sweep
  const box = await rows.nth(2).boundingBox();
  const hover = await fps(page, 2500, async () => {
    for (let i = 0; i < 50 && box; i++) await page.mouse.move(box.x + 30 + ((i * 37) % (box.width - 60)), box.y + 5 + ((i * 7) % (box.height - 10)));
  });
  check(hover.fps >= 45, "smooth while hovering rows", `${hover.fps.toFixed(0)} fps, worst frame ${hover.worst.toFixed(0)} ms`);
  if (box) await page.mouse.move(box.x + 160, box.y + box.height / 2, { steps: 4 });
  await page.waitForTimeout(250);
  const tf = await rows.nth(2).evaluate((el) => getComputedStyle(el).transform);
  check(tf !== "none", "hovered row lifts/tilts in 3D", tf.slice(0, 40));

  // FLIP re-sort and filter
  await page.mouse.move(10, 10);
  const sortFps = await fps(page, 2000, async () => {
    await page.getByRole("columnheader", { name: /^#/ }).click();
  });
  check(sortFps.fps >= 40, "smooth while rows glide to a new sort order", `${sortFps.fps.toFixed(0)} fps, worst ${sortFps.worst.toFixed(0)} ms`);
  const firstAfterSort = await rows.first().getAttribute("aria-label");
  check(/^Bitcoin/.test(firstAfterSort ?? ""), "sorting by # puts Bitcoin first", firstAfterSort?.slice(0, 30));
  const filterFps = await fps(page, 2000, async () => {
    await page.getByRole("radio", { name: "Memes" }).click();
  });
  await page.waitForTimeout(400);
  const memes = await total();
  check(memes > 0 && memes < n, "Memes filter narrows the list", `${memes} rows, ${filterFps.fps.toFixed(0)} fps`);
  await page.getByRole("radio", { name: "All" }).click();
  await page.getByRole("columnheader", { name: /Covex verdict/ }).click();
  await page.waitForTimeout(800);

  // scroll + parallax header
  const scrollFps = await fps(page, 2500, async () => {
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, i < 5 ? 600 : -600);
      await page.waitForTimeout(180);
    }
  });
  // the wheel test jumps 600 px every 180 ms (harsher than normal scrolling); the report page
  // measures 46–61 fps under the same test on an Intel HD 520, so 40 is the bar here
  check(scrollFps.fps >= 40, "smooth while scrolling 200 rows", `${scrollFps.fps.toFixed(0)} fps, worst ${scrollFps.worst.toFixed(0)} ms`);

  // open a row → report with shared-element transition
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const vtSupported = await page.evaluate(() => typeof (document as unknown as { startViewTransition?: unknown }).startViewTransition === "function");
  const target = rows.nth(1);
  const label = (await target.getAttribute("aria-label")) ?? "";
  await target.click();
  await page.waitForURL(/\/coin\/\d+/, { timeout: 15_000 });
  const heroName = await page.locator(".vt-hero-desktop").evaluate((el) => getComputedStyle(el).viewTransitionName);
  check(heroName === "coin-hero", "row opens its report (shared-element target present)", `${label.split(",")[0]} · view transitions ${vtSupported ? "supported" : "not supported"}`);

  // Simple graphics: plain table
  await page.evaluate(() => localStorage.setItem("covex:simple-graphics", "1"));
  await page.goto(base + "/risk", { waitUntil: "load" });
  await rows.first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(600);
  const plain = await rows.nth(0).evaluate((el) => getComputedStyle(el).transform);
  check(plain === "none" || plain === "matrix(1, 0, 0, 1, 0, 0)", "Simple graphics: rows are flat (no 3D)", plain);
  await page.evaluate(() => localStorage.removeItem("covex:simple-graphics"));

  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll Risk board checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
