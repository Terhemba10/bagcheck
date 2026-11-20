# Covex design spec (v2: black, sidebar, agent activity)

Code-first design system (the Figma seat is view-only, so this file is the source of truth).
Implemented in `app/globals.css` (tokens), `lib/motion.ts` (motion tokens), `components/shell/*`, `components/ui/*`, `components/motion/*`, and shown live on **`/design`**.

Patterns borrowed (never branding) from 2026 agent apps: a collapsible left sidebar with an icon rail, a Ctrl+K command palette, and an **agent activity panel**: a checklist of real steps (pending → running → done) with a counter, kept inspectable after the run.

## 1. Principles

1. **Show the work, not a face.** Covex is an agent you watch working: each step it takes is listed with its data source. No mascot, no orb.
2. **Explain every number in one sentence:** fact → meaning → why.
3. **Status is never colour alone.** Icon + label + colour, everywhere.
4. **Honest about data.** Every block shows its source: live, cached (with age), saved copy, recorded demo, or "needs a paid CMC plan". Agent steps are real server events, never timed animations.
5. **Information, not advice.** Never "buy" or "sell". Every report and alert ends with the disclaimer.
6. **Calm depth.** Motion explains structure (things assembling, the active item moving); nothing loops except the working breath and the step shimmer.

## 2. Tokens

### Colour (pure black)

| Token | Value | Use | Contrast on `#000` (on `#161616`) |
|---|---|---|---|
| `bg` | `#000000` | Page background, everywhere | — |
| `surface-1` | `#0A0A0A` | Sidebar, cards, panels | — |
| `surface-2` | `#111111` | Inputs, search bar, raised rows | — |
| `surface-3` | `#161616` | Tooltips, menus | — |
| `line` / `line-strong` | `rgb(255 255 255 / .08)` / `.14` | 1px borders | — |
| `text` | `#EDEDED` | Body | 17.9 (15.5) |
| `muted` | `#A1A1A1` | Secondary | 8.1 (7.0) |
| `faint` | `#8B8B8B` | Captions, sources | 6.2 (5.3) |
| `teal` (the one accent) | `#3EE6C8` | Focus, active nav, primary button, links | 13.4 (11.5) |
| `ok` | `#4ADE80` | Low concern | 12.1 |
| `warn` | `#FBBF24` | Medium concern | 12.6 |
| `danger` | `#FF8094` | High concern | 8.8 |
| `rescue` | `#7AB2FF` | Rescue mode | 9.6 |
| `info` | `#B49CFF` | Recorded demo data | 9.1 |

All text colours pass WCAG 2.2 AA (≥ 4.5 : 1) on every surface. Status colours have `-soft` variants (12% alpha). Primary button: `#021A15` on teal.
Glass is subtle: a 3.5% → 1.5% white gradient over `surface-1` with a 1px border. **No backdrop blur on cards** (expensive on integrated GPUs); blur is used only on the command palette.

### Typography
- **Inter** (self-hosted via `next/font`), tabular numbers for all figures.
- Display 52/58 (34/40 on phones) · h1 36–40 · h2 20–28 · body 16/26 · small 14 · micro 11–12 (uppercase labels).

### Space, radius, layout
- 4px spacing base. Radius 8 / 12 / 16 / 24.
- Sidebar 264px (≥1024), icon rail 72px (768–1023, or collapsed), none on phones (top bar + drawer + bottom bar).
- Content max width 1152px.

### Motion (`lib/motion.ts`, mirrored as CSS variables)
| Token | Value | Use |
|---|---|---|
| `fast` | 150 ms | Icons ticking, overlays fading |
| `base` | 250 ms | Drawer, palette, sidebar width |
| `slow` | 400 ms | Page transitions, verdict colour |
| `spring.snappy` | 520 / 40 | Active nav indicator sliding between items |
| `spring.soft` | 260 / 30 | Report cards assembling |
| `spring.tilt` | 300 / 26 | Hover tilt following the pointer |
| `stagger` | 40 / 70 / 120 ms | Tight / base / calm (rescue) |
| `TILT_MAX_DEG` | 4° | Card hover tilt |

- **Page transitions:** fade + 6px rise + 0.5% scale (`app/template.tsx`).
- **Report cards assemble:** staggered, from 14px below, −8° X rotation and 98% scale (slight depth), spring.soft.
- **Cards:** hover tilt ≤ 4° plus a light edge (masked radial gradient) that follows the pointer. Fine pointers only.
- **Numbers count up** once in view; the final text is always exactly the server's string. **Charts draw in** (stroke-dashoffset).
- **Rescue pages are calmer:** no tilt, slower and smaller reveals.
- **Background:** a static CSS perspective grid fading into black. **No WebGL**: React Three Fiber was removed. It cost GPU time and about 1 MB of JS on an Intel HD 520 for a decorative effect.
- **Reduced motion** (`prefers-reduced-motion`) and **Simple graphics** (sidebar toggle, remembered; automatic on < 4 GB RAM, ≤ 2 cores or data saver): no tilt, light edges, grid or shimmer; fades only. Set on `<html data-graphics>` before first paint.

## 3. Shell (`components/shell`)

| Piece | Behaviour |
|---|---|
| `Sidebar` | Logo mark + name; search button (Ctrl+K); nav (Home, Check a coin, Watchlist, Alerts, Rescue, Ask Covex, Connect, API evidence) with icons; bottom: CMC plan + credits pill, Simple graphics switch, disclaimer link. Active indicator slides between items. ↑/↓ move between items. Collapse button (≥1024) switches to the rail; remembered in `localStorage` and applied before paint. Rail items show tooltips on hover/focus. |
| `MobileTopBar` / `MobileDrawer` / `MobileBottomBar` | Phones: menu button opens a left drawer (focus trapped, Esc closes, focus returns); bottom bar with Check, Watchlist, Rescue, Ask. |
| `CommandPalette` | Ctrl/⌘+K or "/". ARIA combobox: coins (0-credit search), "Rescue plan for …", pages, actions. ↑↓ Enter Esc. |
| `ChatPanel` | "Ask Covex": side sheet (bottom sheet on phones). Answers only from the report; the secret blocker runs before anything is sent. |
| `PlanPill` | `/api/plan` → "CMC Basic plan · 14.8K left" / "Paid plan". 0 credits, cached. |

## 4. The Covex mark and agent presence

- **Mark** (`components/brand/CovexMark.tsx`, also `app/icon.svg`): an open pointy-top hexagon (a convex hull), open on the right like a "C", holding a small hexagonal core. Original geometry; no mascot.
- **Presence:** the mark in the sidebar breathes (core scale 1 → 1.08, 2.8 s) while Covex works and settles when done. The **core takes the verdict colour** (teal ready · green low · amber medium · coral high · blue rescue), shown on the sidebar mark, the verdict card and a ring around the coin logo in the report header.
- **Agent activity** (`components/agent/AgentActivity.tsx`): 8 steps (resolve coin, price/supply/volume, contract scan, DEX liquidity, exchange markets, official links, scoring, roadmap), each with its source (e.g. `CMC /v1/dex/security/detail`). States: pending (ring) → running (spinner + shimmer text) → done (check) / skipped (dash, e.g. "not a token") / blocked (lock, "needs a paid CMC plan") / failed. Counter "5/8 steps", progress line, and "8/8 done · 2.3s" when finished; collapses to that summary and can be reopened. Steps are streamed from `buildReport` (`/api/report/:id?stream=1`, NDJSON); the roadmap step comes from the Promise check request.

## 5. Copy rules
- Plain, short sentences; explain jargon on first use.
- "Warning signs", never "scam" or "rug pull" about a coin.
- The agent is "Covex" ("Ask Covex", "Covex is reading the roadmap…").

## 6. Screens
1. **Home `/`:** centred headline, the large command-style search bar (Ctrl K hint) with example chips, the 8 steps Covex will take, "Coins worth a check", and three stage cards (tilt).
2. **Report `/coin/[id]`:** left (sticky): verdict card (mark, ScoreBadge, verdict), agent activity, Watch, Ask Covex, Rescue plan, disclaimer. Right: coin header (verdict ring), signal cards assembling (2 columns from 1280px, 1 next to the sidebar at 1024), Promise check, contract scan, pools, links.
3. **Watchlist**, **Alerts `/alerts`** (list) and **alert detail**, **Rescue** (calm), **Connect** (Telegram + one-command MCP), **API evidence**, **Disclaimer**, **Design system**.
4. **States:** loading (working mark + skeletons), empty, error, rate-limited (countdown), plan-blocked.

## 7. Breakpoints and checks
- Screenshots (`npm run screens`, real Chrome): 1440 (sidebar open and collapsed, plus the rail tooltip and the palette), 1024, 390 (plus drawer and palette). No horizontal scroll anywhere.
- `scripts/check-shell.ts`: keyboard and interaction checks (skip link first, Ctrl+K, Esc, arrow keys, collapse remembered, rail tooltips, drawer focus trap) and fps while tilting and scrolling. Measured on this laptop (Intel HD 520, 8 GB) in real Chrome on 20 Nov 2026: about 58 fps while tilting cards (vsync-capped), about 110 fps while scrolling the report.
- Tap targets ≥ 44px on phones, visible 2px teal focus ring, skip link first.
