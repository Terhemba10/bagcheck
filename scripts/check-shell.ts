/**
 * Interaction checks for the Covex shell in real Chrome (GPU, like a user's laptop):
 * command palette keyboard flow, sidebar collapse (remembered), rail tooltips,
 * nav arrow keys, the agent mark while a report streams, the phone drawer's focus
 * trap, and frame rate while tilting cards and scrolling.
 *
 *   BASE_URL=http://localhost:3123 npx tsx scripts/check-shell.ts
 */
import { chromium, type Page } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://localhost:3000";
let failures = 0;
const check = (ok: boolean, label: string, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  (${extra})` : ""}`);
  if (!ok) failures++;
};

/** Frames per second over `ms` while `work` runs (requestAnimationFrame count). */
async function fps(page: Page, ms: number, work: () => Promise<void>) {
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number; __run: boolean };
    w.__frames = 0;
    w.__run = true;
    const tick = () => {
      if (!w.__run) return;
      w.__frames++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const t0 = Date.now();
  await work();
  const left = ms - (Date.now() - t0);
  if (left > 0) await page.waitForTimeout(left);
  const frames = await page.evaluate(() => {
    const w = window as unknown as { __frames: number; __run: boolean };
    w.__run = false;
    return w.__frames;
  });
  return (frames * 1000) / Math.max(ms, Date.now() - t0);
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1500,1000"] });

  // ── desktop ────────────────────────────────────────────────────────────────
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript({ content: "window.__name = (f) => f;" });
  const page = await ctx.newPage();
  await page.goto(base + "/", { waitUntil: "load" });
  await page.waitForTimeout(800);

  // skip link is the first Tab stop
  await page.keyboard.press("Tab");
  check((await page.evaluate(() => document.activeElement?.textContent)) === "Skip to content", "first Tab reaches 'Skip to content'");

  // Ctrl+K opens the palette with focus in its input; Esc closes it
  await page.locator("body").click({ position: { x: 700, y: 20 } });
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(300);
  check(await page.getByRole("dialog", { name: "Search coins and pages" }).isVisible(), "Ctrl+K opens the command palette");
  check((await page.evaluate(() => document.activeElement?.getAttribute("role"))) === "combobox", "focus is in the palette input");
  await page.keyboard.type("pepe", { delay: 40 });
  await page.getByRole("option", { name: /Pepe/ }).first().waitFor({ timeout: 8000 });
  await page.keyboard.press("ArrowDown");
  check((await page.locator('[role="option"][aria-selected="true"]').count()) === 1, "arrow keys move the active option");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check(!(await page.getByRole("dialog", { name: "Search coins and pages" }).isVisible().catch(() => false)), "Esc closes the palette");

  // nav arrow keys
  await page.getByRole("link", { name: "Home", exact: true }).first().focus();
  await page.keyboard.press("ArrowDown");
  check((await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) === "Check a coin", "↓ moves focus to the next nav item");

  // collapse → rail; remembered after reload; tooltip on hover
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await page.waitForTimeout(400);
  check((await page.evaluate(() => document.documentElement.dataset.sidebar)) === "collapsed", "collapse button switches to the icon rail");
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(500);
  check((await page.evaluate(() => document.documentElement.dataset.sidebar)) === "collapsed", "the rail is remembered after reload");
  const sbWidth = await page.locator('aside[aria-label="Sidebar"]').evaluate((el) => el.getBoundingClientRect().width);
  check(Math.round(sbWidth) === 72, "rail is 72px wide", `${sbWidth}px`);
  const watch = page.locator('aside[aria-label="Sidebar"] a[aria-label="Watchlist"]');
  await watch.hover();
  await page.waitForTimeout(200);
  check(await watch.locator('[role="tooltip"]').isVisible(), "rail shows a tooltip on hover");
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await page.waitForTimeout(400);
  check((await page.evaluate(() => document.documentElement.dataset.sidebar)) !== "collapsed", "expand button restores the full sidebar");

  // report: the mark breathes while streaming, then shows the verdict colour
  const seen = new Set<string>();
  await page.exposeFunction("__markState", (s: string) => seen.add(s));
  await page.addInitScript({
    content: `new MutationObserver(() => { const m = document.querySelector('aside[aria-label="Sidebar"] svg[data-tone]'); if (m) window.__markState?.((m.getAttribute('data-working') ? 'working:' : 'idle:') + m.getAttribute('data-tone')); }).observe(document, { subtree: true, attributes: true, childList: true });`,
  });
  await page.goto(base + "/coin/35336", { waitUntil: "load" });
  await page.getByText("Covex verdict").waitFor();
  await page.locator("text=/\\d+\\/8 done/").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(500);
  const finalTone = await page.locator('aside[aria-label="Sidebar"] svg[data-tone]').getAttribute("data-tone");
  check([...seen].some((s) => s.startsWith("working:")), "logo mark breathes while Covex works", [...seen].join(" → "));
  check(finalTone !== "idle", "logo mark settles on the verdict colour", `tone=${finalTone}`);
  const stepsText = await page.getByRole("region", { name: "Agent activity" }).innerText().catch(() => "");
  check(/8\/8 done/.test(stepsText), "agent activity finishes all 8 steps");

  // fps: tilt over cards + scrolling (1440, real GPU)
  const cards = page.locator("#signals-title ~ ul > li");
  const box = await cards.first().boundingBox();
  const tiltFps = await fps(page, 3000, async () => {
    if (!box) return;
    for (let i = 0; i < 60; i++) await page.mouse.move(box.x + 20 + ((i * 7) % (box.width - 40)), box.y + 20 + ((i * 5) % (box.height - 40)));
  });
  const scrollFps = await fps(page, 3000, async () => {
    for (let i = 0; i < 12; i++) {
      await page.mouse.wheel(0, i < 6 ? 400 : -400);
      await page.waitForTimeout(200);
    }
  });
  check(tiltFps >= 45, "smooth while tilting cards", `${tiltFps.toFixed(0)} fps`);
  check(scrollFps >= 45, "smooth while scrolling the report", `${scrollFps.toFixed(0)} fps`);
  await ctx.close();

  // ── phone ──────────────────────────────────────────────────────────────────
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await m.addInitScript({ content: "window.__name = (f) => f;" });
  const p = await m.newPage();
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForTimeout(500);
  const menu = p.getByRole("button", { name: "Open menu" });
  await menu.click();
  await p.waitForTimeout(400);
  const drawer = p.getByRole("dialog", { name: "Menu" });
  check(await drawer.isVisible(), "menu button opens the drawer");
  for (let i = 0; i < 20; i++) await p.keyboard.press("Tab");
  check(await drawer.evaluate((d) => d.contains(document.activeElement)), "Tab stays inside the drawer");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  check(!(await drawer.isVisible().catch(() => false)), "Esc closes the drawer");
  check(await menu.evaluate((b) => b === document.activeElement), "focus returns to the menu button");
  check(await p.getByRole("navigation", { name: "Main actions" }).isVisible(), "bottom bar is visible on phones");
  await m.close();

  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll shell checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
