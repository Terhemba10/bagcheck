/**
 * Records the live-site scenes of the Covex demo in real (headed) Chrome, timed to the voiceover:
 *  - 1920x1080 viewport at 1.5x pixel density (2880x1620 frames: zooms stay sharp), CDP screencast
 *  - every action waits for its word in the narration (word timings from video/tts.py), so the
 *    highlight on an element appears as the voice names it
 *  - highlights: the element's real boundingBox (and corner radius) is sampled every ~70 ms while
 *    it's highlighted, so the glow drawn in post follows scrolling, layout changes and zooms
 *  - cursor glides and clicks are logged and drawn in post at 30 fps; the real mouse moves too
 * Writes video/out/frames/*.jpg and video/out/events.json. video/build.py makes the MP4.
 *
 *   python video/tts.py && npx tsx video/record.ts      (BASE_URL defaults to the live site)
 * Only real live data. Record when Arbitrum's report isn't cached (5 min) so the steps run live.
 */
import { chromium, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "https://covex-ai.vercel.app";
const OUT = join("video", "out");
/** ONLY=board records just that scene (into its own folder/events file) to splice into the video. */
const ONLY = process.env.ONLY ?? "";
const FRAME_DIR = ONLY ? `frames-${ONLY}` : "frames";
const FRAMES = join(OUT, FRAME_DIR);
const DSF = 1.5;
const PAD = 1.2; // seconds after the voice ends
const LEAD = 0.35; // must match build.py: the voice starts this long after a scene starts
const timings = JSON.parse(readFileSync(join(OUT, "vo", "timings.json"), "utf8")) as Record<string, { duration: number; words: { t: number; w: string }[] }>;

// ── recording state ──────────────────────────────────────────────────────────
type Box = { x: number; y: number; w: number; h: number };
interface Zoom extends Box { t0: number; t1: number }
interface Highlight { id: string; radius: number; t0: number; t1: number; samples: ({ t: number } & Box)[] }
const frames: { file: string; t: number; tab: number }[] = [];
/** Which tab is on screen from when (pages pre-load in a background tab, then come to the front). */
const switches: { t: number; tab: number }[] = [];
let frameNo = 0;
const scenes: { id: string; t0: number; t1: number }[] = [];
const zooms: Zoom[] = [];
const highlights: Highlight[] = [];
const cueLog: { scene: string; cue: string; lateMs: number }[] = [];
const cursor: { moves: { t0: number; ms: number; from: { x: number; y: number }; to: { x: number; y: number } }[]; clicks: { t: number; x: number; y: number }[] } = { moves: [], clicks: [] };
const now = () => Date.now() / 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
let cur = { x: 960, y: 540 };

async function startScreencast(page: Page, tab: number) {
  const cdp = await page.context().newCDPSession(page);
  cdp.on("Page.screencastFrame", (f) => {
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
    const name = `${String(frameNo++).padStart(6, "0")}.jpg`;
    writeFileSync(join(FRAMES, name), Buffer.from(f.data, "base64"));
    // main frames are stored by name (under frames/); spliced scenes keep their folder in the path
    frames.push({ file: ONLY ? `${FRAME_DIR}/${name}` : name, t: f.metadata.timestamp ?? now(), tab: ONLY ? tab + 10 : tab });
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 82, maxWidth: 1920 * DSF, maxHeight: 1080 * DSF, everyNthFrame: 1 });
}

// ── voice cues ───────────────────────────────────────────────────────────────
const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");
let scene0 = { id: "", t0: 0, wordIdx: 0 };

/** Wait until the narration reaches `phrase` (searched forward from the last cue). `early` starts that many seconds before. */
async function at(phrase: string, early = 0) {
  const words = timings[scene0.id]!.words;
  const want = phrase.split(/\s+/).map(norm);
  let idx = -1;
  for (let i = scene0.wordIdx; i <= words.length - want.length; i++) {
    if (want.every((w, k) => norm(words[i + k]!.w).startsWith(w))) {
      idx = i;
      break;
    }
  }
  if (idx < 0) throw new Error(`cue "${phrase}" not found in ${scene0.id}`);
  scene0.wordIdx = idx + 1;
  const target = scene0.t0 + LEAD + words[idx]!.t - early;
  const late = now() - target;
  cueLog.push({ scene: scene0.id, cue: phrase, lateMs: Math.round(late * 1000) });
  if (late > 0.25) console.log(`  ⚠ cue "${phrase}" ${Math.round(late * 1000)} ms late`);
  await sleep((target - now()) * 1000);
}

// ── highlights (sampled boxes) ───────────────────────────────────────────────
let active: { h: Highlight; stop: boolean; loop: Promise<void> } | null = null;

async function hl(page: Page, l: Locator, id: string) {
  await unhl();
  const radius = await l.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 10, undefined, { timeout: 500 }).catch(() => 10);
  const h: Highlight = { id, radius: Math.min(radius, 24), t0: now(), t1: 0, samples: [] };
  highlights.push(h);
  const state = { h, stop: false, loop: Promise.resolve() };
  state.loop = (async () => {
    while (!state.stop) {
      // short timeout: once the element is gone (navigation), stop waiting for it
      const b = await l.boundingBox({ timeout: 150 }).catch(() => null);
      if (b) h.samples.push({ t: now(), x: b.x, y: b.y, w: b.width, h: b.height });
      await sleep(70);
    }
  })();
  active = state;
  await sleep(30);
}

async function unhl() {
  if (!active) return;
  active.stop = true;
  await active.loop;
  active.h.t1 = now();
  active = null;
}

// ── zooms (start/stop between cues) ──────────────────────────────────────────
let zoomStart: (Box & { t0: number }) | null = null;
async function zoomOn(l: Locator, pad = 24) {
  const b = await l.boundingBox();
  if (b) zoomStart = { t0: now(), x: b.x - pad, y: b.y - pad, w: b.width + pad * 2, h: b.height + pad * 2 };
}
function zoomOff() {
  if (zoomStart) zooms.push({ ...zoomStart, t1: now() });
  zoomStart = null;
}

// ── cursor + input ───────────────────────────────────────────────────────────
async function center(l: Locator) {
  await l.scrollIntoViewIfNeeded();
  const b = await l.boundingBox();
  if (!b) throw new Error("element not visible");
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function moveTo(page: Page, p: { x: number; y: number }, ms = 600) {
  cursor.moves.push({ t0: now(), ms, from: cur, to: p });
  await Promise.all([page.mouse.move(p.x, p.y, { steps: 12 }), sleep(ms)]);
  cur = p;
}
async function moveNear(page: Page, l: Locator, dx = 40, dy = 0, ms = 600) {
  const c = await center(l);
  await moveTo(page, { x: c.x + dx, y: c.y + dy }, ms);
}
async function click(page: Page, l: Locator, { ms = 600, nav = false } = {}) {
  const p = await center(l);
  await moveTo(page, p, ms);
  await sleep(100);
  cursor.clicks.push({ t: now(), ...p });
  await sleep(120);
  if (nav) await Promise.all([page.waitForLoadState("domcontentloaded"), l.click()]);
  else await l.click();
}
async function keepCursor(page: Page) {
  await page.mouse.move(cur.x, cur.y);
}
async function smoothScroll(l: Locator, block: ScrollLogicalPosition = "center", wait = 800) {
  await l.evaluate((el, block) => el.scrollIntoView({ behavior: "smooth", block }), block);
  await sleep(wait);
}

async function scene(id: string, fn: () => Promise<void>) {
  scene0 = { id, t0: now(), wordIdx: 0 };
  const min = timings[id]!.duration + LEAD + PAD;
  console.log(`▶ ${id}`);
  await fn();
  const left = min - (now() - scene0.t0);
  if (left > 0) await sleep(left * 1000);
  await unhl();
  zoomOff();
  scenes.push({ id, t0: scene0.t0, t1: now() });
  console.log(`  ${id}: ${(now() - scene0.t0).toFixed(1)}s (voice ${timings[id]!.duration.toFixed(1)}s)`);
}

const SIDEBAR = (page: Page, label: string) => page.locator(`aside[aria-label="Sidebar"] a[aria-label="${label}"]`);

async function main() {
  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });
  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    args: ["--window-size=1940,1200", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling"],
  });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: DSF, colorScheme: "dark" });
  await ctx.addInitScript({ content: "window.__name = (f) => f;" });
  const page = await ctx.newPage();
  const tab2 = await ctx.newPage(); // background tab for pre-loading the next page
  // links that open a new tab: close it (we show those pages in our own tabs instead)
  ctx.on("page", (p) => p !== page && p !== tab2 && p.close().catch(() => undefined));
  const show = async (p: Page, tab: number) => {
    await p.bringToFront();
    switches.push({ t: now(), tab });
  };
  const show0 = async () => {
    await page.bringToFront();
    switches.push({ t: now(), tab: ONLY ? 11 : 1 });
  };
  await show0();

  if (ONLY === "board") {
    await page.goto(BASE + "/coin/1", { waitUntil: "load" }); // warm the report route
    await sleep(1500);
  }
  await page.goto(BASE + (ONLY === "board" ? "/risk" : "/"), { waitUntil: "load" });
  await sleep(2500);
  await keepCursor(page);
  await startScreencast(page, 1);
  await startScreencast(tab2, 2);
  await sleep(800);

  if (ONLY === "board") {
    // Risk board: the table, a chart, a warning sign, the Memes filter, a row opening into its report
    await scene("board", async () => {
      const table = page.getByRole("table", { name: "Risk board" });
      const row = page.getByRole("row", { name: /Open the report/ }).first();
      await row.waitFor({ timeout: 60_000 });
      await at("risk board", 0.1);
      await hl(page, table, "risk board table");
      await moveNear(page, row, 0, 0);
      await at("seven-day charts", 0.1);
      await hl(page, row.getByRole("img").first(), "7-day chart");
      await at("top warning sign", 0.1);
      await hl(page, row.locator('[role="cell"]').nth(6), "top warning sign");
      await at("filter to memes", 0.7);
      const memes = page.getByRole("radio", { name: "Memes" });
      await hl(page, memes, "memes filter");
      await click(page, memes, { ms: 400 });
      const first = page.getByRole("row", { name: /Open the report/ }).first();
      await sleep(150);
      await moveNear(page, first, 140, 0, 300); // hover: the report prefetches
      await at("any row opens", 0.5);
      await hl(page, first, "row");
      await click(page, first, { ms: 300 });
      await page.waitForURL(/\/coin\/\d+/, { timeout: 15_000 });
      await keepCursor(page);
      await at("full report", 0.1);
      await hl(page, page.locator(".vt-hero-desktop"), "report header");
    });
  }

  if (!ONLY) {
  // 3. Home → command bar → Arbitrum → agent activity (steps named one by one)
  await scene("search", async () => {
    const box = page.getByRole("combobox");
    await moveNear(page, box, 120, 0, 700);
    await at("built on the", 0.2);
    await hl(page, box.locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]"), "command bar");
    await click(page, box, { ms: 450 });
    await page.keyboard.type("arbitrum", { delay: 65 });
    const opt = page.getByRole("option", { name: /Arbitrum/ }).first();
    await opt.waitFor();
    await sleep(250);
    await click(page, opt, { nav: true });
    await keepCursor(page);
    const activity = page.getByRole("region", { name: "Agent activity" });
    await activity.waitFor();
    await at("watch the agent activity", 0.2);
    await hl(page, activity, "agent activity");
    await zoomOn(activity, 30);
    await at("every step");
    // keep the checklist open once the run finishes, so each step can be shown
    const toggle = activity.getByRole("button").first();
    if ((await toggle.getAttribute("aria-expanded")) === "false") await click(page, toggle);
    else await moveNear(page, toggle, 0, 0, 400);
    const step = (text: string) => activity.locator("li", { hasText: text }).first();
    await at("quotes");
    await hl(page, step("Read price"), "step: quotes");
    await at("dex security");
    await hl(page, step("Scan the contract"), "step: DEX security");
    await at("liquidity pools");
    await hl(page, step("Measure DEX liquidity"), "step: pools");
    await at("own links");
    await hl(page, step("Check the official links"), "step: links");
    await at("scores are computed");
    await hl(page, step("Score 7 warning signs"), "step: scoring");
    await at("the ai only explains");
    await hl(page, step("Read the roadmap"), "step: roadmap (AI)");
  });

  // 4. Report: verdict, then each warning card as it's named
  const SOURCE_URL = `https://ethereum.org/roadmap/security/#:~:text=${encodeURIComponent("ePBS is a headliner")},${encodeURIComponent("targeted for 2026")}`;
  await scene("report", async () => {
    await unhl();
    zoomOff();
    void tab2.goto(SOURCE_URL, { waitUntil: "load" }).catch(() => undefined); // pre-load the cited page behind the report
    const verdict = page.locator("section", { hasText: "Covex verdict" }).first();
    await at("the verdict", 0.1);
    await hl(page, verdict, "verdict");
    await zoomOn(verdict, 20);
    await moveNear(page, verdict, 80, 30);
    const dilution = page.locator("article", { hasText: "Dilution" }).first();
    await at("dilution", 0.9);
    zoomOff();
    await smoothScroll(dilution, "center", 700);
    await hl(page, dilution, "card: dilution");
    await moveNear(page, dilution, 70, -30);
    const liq = page.locator("article", { hasText: "Liquidity" }).first();
    await at("liquidity", 0.1);
    await hl(page, liq, "card: liquidity");
    await moveNear(page, liq, 70, -10);
    const contract = page.locator("article", { hasText: "Contract check" }).first();
    await at("and the contract scan", 0.8);
    await smoothScroll(contract, "center", 700);
    await hl(page, contract, "card: contract");
    await moveNear(page, contract, 70, -20);
    await at("why it matters", 0.4);
    const why = contract.locator("summary");
    await hl(page, why, "why it matters");
    await click(page, why);
  });

  // 5. Promise check on Ethereum (palette), a promise + its source, then the cited sentence
  await scene("promises", async () => {
    await unhl();
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Search coins and pages" });
    await dialog.waitFor();
    await hl(page, dialog, "command palette");
    await page.keyboard.type("ethereum", { delay: 70 });
    await page.getByRole("option", { name: /^Ethereum/ }).first().waitFor();
    await sleep(300);
    await unhl();
    await Promise.all([page.waitForURL(/\/coin\/1027/), page.keyboard.press("Enter")]);
    await keepCursor(page);
    const timeline = page.locator("section", { has: page.locator("#promises-title") });
    const item = page.locator("li", { hasText: "ePBS is a headliner" }).first();
    await item.waitFor({ timeout: 45_000 });
    await at("lists each dated promise", 0.9);
    await smoothScroll(page.locator("#promises-title"), "start", 800);
    await hl(page, timeline, "promise check");
    await at("this one is targeted", 0.2);
    await hl(page, item, "promise");
    await zoomOn(item, 24);
    await moveNear(page, item, 140, -10);
    await at("click the source", 0.1);
    const link = item.locator("a", { hasText: "Source" });
    zoomOff();
    await hl(page, link, "source link");
    const href = await link.getAttribute("href");
    if (!SOURCE_URL.startsWith(href ?? "-")) console.log(`  ⚠ source link is ${href}, pre-loaded ${SOURCE_URL}`);
    await click(page, link);
    await unhl();
    // the cited page was pre-loaded in the background tab (with the quote highlighted): bring it forward
    await show(tab2, 2);
    await tab2.mouse.move(cur.x, cur.y);
    const quote = tab2.getByText("ePBS is a headliner", { exact: false }).first();
    await quote.waitFor();
    await smoothScroll(quote, "center", 500);
    void page.goto(BASE + "/coin/11841", { waitUntil: "load" }).catch(() => undefined); // pre-load "Back on Arbitrum" behind it
    await at("exact sentence", 0.2);
    await hl(tab2, quote, "cited sentence");
    await zoomOn(quote, 40);
    await moveNear(tab2, quote, 180, 30);
  });

  // 6. Watch (no account) → watchlist: schedule, Alerts, Telegram
  await scene("watch", async () => {
    await unhl();
    zoomOff();
    const watch = page.getByRole("button", { name: /Watch this coin/ });
    await watch.waitFor({ timeout: 30_000 });
    const show0 = async () => {
    await page.bringToFront();
    switches.push({ t: now(), tab: ONLY ? 11 : 1 });
  };
  await show0();
    await keepCursor(page);
    await at("one click", 0.3);
    await hl(page, watch, "watch this coin");
    await click(page, watch, { ms: 450 });
    await at("no account", 0.1);
    // the "Watching Arbitrum" confirmation: it worked, with no sign-in
    await hl(page, page.getByText(/Watching Arbitrum/).first(), "watching (no account)");
    await at("re-checks watched coins", 1.3);
    await click(page, SIDEBAR(page, "Watchlist"), { nav: true, ms: 400 });
    await keepCursor(page);
    await unhl();
    const row = page.locator("li", { hasText: "Arbitrum" }).first();
    await row.waitFor();
    await hl(page, row, "watched coin + schedule");
    await moveNear(page, row, 200, 0);
    await at("alerts", 0.1);
    await hl(page, SIDEBAR(page, "Alerts"), "alerts");
    await moveNear(page, SIDEBAR(page, "Alerts"), 30, 0, 500);
    await at("on telegram", 0.1);
    const tg = page.locator("section, div.glass", { hasText: "Alerts on Telegram" }).last();
    await hl(page, tg, "telegram");
    await moveNear(page, tg, 120, 0);
  });

  // 7. Rescue (top to bottom): shield, where it trades, impact estimate, protect steps, official links, seed-phrase blocker
  await scene("rescue", async () => {
    await unhl();
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog", { name: "Search coins and pages" }).waitFor();
    await page.keyboard.type("arbitrum", { delay: 30 });
    const opt = page.getByRole("option", { name: /Rescue plan for Arbitrum/ });
    await opt.waitFor();
    await sleep(200);
    await click(page, opt, { nav: true, ms: 350 });
    await keepCursor(page);
    const shield = page.locator("section", { hasText: "Recovery-scam shield" }).first();
    await shield.waitFor();
    await at("recovery scammers", 0.1);
    await hl(page, shield, "scam shield");
    await moveNear(page, shield, 220, 0);
    const pools = page.locator("#sell .glass", { has: page.locator("table") }).first();
    await pools.waitFor({ timeout: 30_000 });
    await at("where the coin", 1.1);
    await smoothScroll(pools, "center", 700);
    await hl(page, pools, "where it trades");
    await moveNear(page, pools, 200, -40);
    const est = page.locator("#sell .glass", { hasText: "Amount you hold" }).first();
    await at("an estimated price impact", 0.6);
    await smoothScroll(est, "center", 600);
    await hl(page, est, "impact estimate");
    await moveNear(page, est, 160, 0);
    const steps = page.locator("#protect ol").first();
    await at("and steps to protect", 0.6);
    await smoothScroll(steps, "center", 600);
    await hl(page, steps, "protect steps");
    await moveNear(page, steps, 200, -60);
    await at("with official links", 0.1);
    const official = page.locator("#protect li", { hasText: "How it works" }).first();
    await hl(page, official, "official links only");
    await moveNear(page, official, 160, 0);
    const field = page.locator("#evidence textarea").first();
    await at("covex never takes", 0.7);
    await smoothScroll(field, "center", 600);
    await hl(page, field, "evidence field");
    await click(page, field);
    await at("paste one", 0.1);
    await page.keyboard.insertText("abandon ability able about above absent absorb abstract absurd abuse access accident"); // pasted
    const warn = page.getByText(/wasn.t saved/).first();
    await warn.waitFor();
    await hl(page, warn, "seed-phrase blocked");
    await zoomOn(warn, 30);
    await at("information never", 0.1);
  });

  // 8. Connect (MCP one-liner) → API evidence list + credits
  await scene("connect", async () => {
    await unhl();
    zoomOff();
    await click(page, SIDEBAR(page, "Connect"), { nav: true, ms: 450 });
    await keepCursor(page);
    const cmd = page.locator("pre", { hasText: "claude mcp add" }).first();
    await cmd.waitFor();
    await smoothScroll(cmd, "center", 700);
    await at("one command", 0.1);
    await hl(page, cmd, "MCP command");
    await zoomOn(cmd, 26);
    await moveNear(page, cmd, 260, 0);
    await at("and the api evidence", 0.4);
    zoomOff();
    await unhl();
    await click(page, SIDEBAR(page, "API evidence"), { nav: true, ms: 450 });
    await keepCursor(page);
    const table = page.locator("table").last();
    await table.waitFor();
    await at("every real", 0.6);
    await smoothScroll(table, "start", 700);
    await hl(page, table, "API evidence list");
    await moveNear(page, table, 300, 20);
    await at("credits", 0.1);
  });

  } // end of the full recording

  await unhl();
  await sleep(400);
  await browser.close();
  writeFileSync(join(OUT, ONLY ? `events-${ONLY}.json` : "events.json"), JSON.stringify({ dsf: DSF, frames, switches, scenes, zooms, cursor, highlights, cueLog }, null, 1));
  const late = cueLog.filter((c) => c.lateMs > 250);
  console.log(`frames ${frames.length}, scenes ${scenes.length}, zooms ${zooms.length}, highlights ${highlights.length}, late cues ${late.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
