# Bagcheck design spec

Code-first design system (Figma seat is view-only, so this file is the source of truth).
Implemented in `app/globals.css` (tokens) and `components/ui/*`, shown live on **`/design`**.

## 1. Principles

1. **One calm assistant.** Bag, the agent, is always there: big in the hero, small in the corner of every page and in alerts. It sounds steady, never alarmist.
2. **Explain every number in one sentence.** Each value comes with what it means and why it matters.
3. **Status is never colour alone.** Every status uses **icon + label + colour**.
4. **Honest about data.** Every data block shows where it came from: live, cached (with age), saved copy, recorded demo, or "needs a paid CMC plan". We never show a made-up number.
5. **Information, not advice.** Bagcheck never says "buy" or "sell". Every report and alert ends with the disclaimer.

## 2. Tokens

### Colour (dark only; deep navy, glass surfaces)

| Token | Value | Use | Contrast on `bg` (computed, WCAG 2.x) |
|---|---|---|---|
| `--bg` | `#070B18` | Page background | — |
| `--bg-raised` | `#0C1328` | Panels, table heads | — |
| `--glass` | `rgb(255 255 255 / 0.045)` | Glass card fill (+ 12px backdrop blur) | — |
| `--glass-strong` | `rgb(255 255 255 / 0.08)` | Hover / selected | — |
| `--line` | `rgb(255 255 255 / 0.09)` | Borders, dividers | — |
| `--text` | `#E9EEF9` | Body text | 16.9 : 1 |
| `--text-muted` | `#A3B0CC` | Secondary text | 9.0 : 1 |
| `--text-faint` | `#7C89A6` | Captions, timestamps (≥ 14 px only) | 5.6 : 1 |
| `--teal` | `#3EE6C8` | Brand, agent idle, primary button | 12.5 : 1 |
| `--ok` | `#4ADE80` | Low concern / all clear | 11.3 : 1 |
| `--warn` | `#FBBF24` | Medium concern | 11.8 : 1 |
| `--danger` | `#FF8094` | High concern | 8.2 : 1 |
| `--rescue` | `#7AB2FF` | Rescue mode | 9.0 : 1 |
| `--info` | `#B49CFF` | Recorded demo data | 8.5 : 1 |

Each status colour also has a `-soft` variant (14% alpha) for pill and card backgrounds. Primary button: dark text `#062019` on teal = 10.9 : 1. All text colours stay ≥ 5.3 : 1 on `--bg-raised` too.
Gradients: the hero uses `radial-gradient(60% 50% at 50% 0%, rgb(62 230 200 / .14), transparent)`, plus a faint grid. Surfaces never get busy gradients.

### Typography
- **Inter** (via `next/font`, self-hosted, `display: swap`). Numbers use `font-variant-numeric: tabular-nums`.
- Scale (px / line-height / weight): display 56/60/650 (40/44 on mobile) · h1 40/46/650 · h2 28/34/600 · h3 20/28/600 · body 16/26/400 · small 14/22/400 · micro 12/16/500 (uppercase labels, +4% tracking).
- **Big readable numbers:** `stat` 32/36/650, tabular.

### Space, radius, depth
- Spacing on a 4-px base: 4, 8, 12, 16, 20, 24, 32, 40, 56, 80.
- Radius: `sm` 8 (pills, inputs inside cards) · `md` 12 (buttons, inputs) · `lg` 16 (cards) · `xl` 24 (hero panels) · `full`.
- Shadows: `--shadow-card: 0 1px 0 rgb(255 255 255 / .04) inset, 0 12px 32px -12px rgb(0 0 0 / .6)`. A glow is used only for the agent and the focused search bar.
- Layout: max width 1152 px. Gutters 16 px mobile, 24 px ≥ 640, 32 px ≥ 1024. Grid: 1 col < 640, 2 cols ≥ 640, 3 cols ≥ 1024.

### Motion
- Durations 120 / 200 / 320 ms, easing `cubic-bezier(.2,.8,.2,1)`.
- `prefers-reduced-motion: reduce` turns off agent animation (static orb), skeleton shimmer and smooth scroll. Nothing flashes more than 3 times per second, ever.

## 3. Components (`components/ui`)

| Component | Variants / props | Notes |
|---|---|---|
| `Button` | `primary` (teal on dark text), `secondary` (glass), `ghost`, `danger-ghost`; sizes `md` / `lg`; `asChild` link | Min 44×44 px target; visible focus ring (2 px teal, 2 px offset) |
| `SearchBar` | hero (`lg`) / compact | Label "Check any coin"; placeholder "Name, symbol or contract address"; `role=combobox` with results listbox, ↑ ↓ Enter Esc |
| `GlassCard` | default / interactive / highlighted(status) | 16 px radius, glass fill, 1 px line border |
| `StatusPill` | `ok` · `watch` · `concern` · `danger` · `unknown` · `rescue` | Icon + label + colour, e.g. ✓ "Low concern", ▲ "Medium concern", ⬣ "High concern", ? "Not enough data" |
| `ScoreBadge` | Low / Medium / High concern | Large: pill + "Scored on 5 of 7 signals" |
| `SignalCard` | `level`, `title`, `value`, `meaning`, `why`, `source` | Value big; one-sentence meaning; "Why it matters" (expands on mobile); source tag in footer |
| `SourceTag` | `live` · `cached(age)` · `saved(date)` · `recorded(date)` · `paid-plan` | Small icon + text; `recorded` uses `--info`; `paid-plan` says "Needs a paid CMC plan" |
| `Notice` | `info` · `warn` · `danger` · `rescue` | Banner with icon; used for the scam shield, plan notices and the forced-plan banner |
| `Disclaimer` | inline / footer | Exactly: "Not financial advice. Bagcheck explains data. It never tells you to buy or sell." |
| `Skeleton` | line / block / card | Shimmer, removed under reduced motion |
| `StateView` | `loading` (agent scanning + caption) · `empty` · `error` · `rate-limited` · `plan-blocked` | Every screen uses these; copy below |
| `PromiseItem` | `upcoming` · `due-soon` · `overdue` · `delivered` · `no-date` | Timeline row: date, promise, ≤ 15-word quote, source link |
| `Sparkline` | status colour | SVG, `aria-label` with a text summary |
| `DataTable` | — | Scrolls horizontally on mobile inside its card (never the page) |
| `Agent` | see §4 | |
| `CornerAgent` | — | 2D orb, fixed bottom-right, opens a short "what Bag is doing" status |

## 4. Bag, the agent

An original character: a soft glassy orb with a gentle face made of light (two rounded-capsule eyes and a small smile arc), floating with a slow bob. It isn't based on any existing mascot.

| State | When | Glow | Motion | Face | Caption example |
|---|---|---|---|---|---|
| `idle` | Home, nothing running | teal | slow breathing (4 s) + bob | soft smile | "Hi, I'm Bag. Ask me about any coin." |
| `scanning` | Data loading | teal → brighter | 2–3 rings orbit, eyes glance side to side | focused | "Checking supply… reading the roadmap…" |
| `clear` | Low concern | green | one soft pulse, then idle | smile | "No major warning signs in the data." |
| `concern` | Medium concern | amber | slight lean (≈ 8°) | flat mouth | "A few things are worth a closer look." |
| `danger` | High concern | coral | gentle sway (≤ 2°, 1.2 Hz), **no flashing** | small "o" | "Several warning signs. Here's the evidence." |
| `rescue` | Rescue plan | calm blue | very slow breathing | soft, steady | "Let's take this one step at a time." |

**Rendering**
- **3D (hero only):** React Three Fiber, lazy-loaded with `next/dynamic` (`ssr: false`). It mounts only after the page is idle and in view. Geometry: outer sphere (48 segments, physical material with clearcoat and *no* transmission, which is too expensive for integrated graphics), an emissive inner core, emissive face meshes, and torus rings for scanning. No environment maps or post-processing. `dpr` is capped at 1.5. The frame loop pauses when the hero is off-screen or the tab is hidden. Target: 60 fps on Intel UHD graphics with 8 GB RAM.
- **Measured 19 Nov 2026** on the target hardware (Intel HD Graphics 520, Direct3D 11 via ANGLE): the 3D hero held the browser pane's 30 fps cap with a worst frame of 33.5 ms. With 3D switched off the pane also ran at 30.2 fps, so the scene adds no measurable cost at that cap. It still needs checking in full Chrome at 60 Hz.
- **2D fallback (everywhere else, and when 3D is off):** an SVG + CSS orb with the same states. It's used for the corner agent, alerts, `prefers-reduced-motion`, no WebGL, `navigator.deviceMemory < 4` or `hardwareConcurrency <= 2`, and when the user toggles "Use simple graphics" (saved in `localStorage`).
- Accessibility: the agent is decorative (`aria-hidden`). Its caption is a real `<p>` inside an `aria-live="polite"` region, so state changes are announced once.

## 5. Copy rules
- Plain, short sentences. Explain jargon on first use ("fully diluted value (the price × all tokens that will ever exist)").
- Say "warning signs", never "scam" or "rug pull" about a coin.
- Number explanations follow the pattern **fact → meaning → why**: "Only 18% of all tokens exist today. The other 82% can still be released, which often pushes the price down."

## 6. Screens

All screens share: a top nav (logo, Check a coin, Watchlist, Rescue, Connect, API evidence), the corner agent, and a footer with the disclaimer and a CMC attribution.

1. **Home `/`:** hero with the 3D agent (left on desktop, top on mobile), headline "Did the founders keep their promises — and can you still get out?", sub-line, and the large search bar. Then three stage cards (Before you buy · While you hold · If it went wrong), each with icon, two lines and a link. Then "Coins worth a check": top movers from **listings** (Basic). Trending appears only if the key has Startup, tagged "Startup extra". Footer.
2. **Coin report `/coin/[id]`:** header (logo, name, symbol, price, 24 h), agent in its result state with caption, ScoreBadge, "Watch this coin" button. Signal grid (7 cards). Contract check (DEX security) card. Liquidity card (DEX pools; CEX pairs as a "Startup extra"). Promise timeline. Data sources footnote plus disclaimer.
3. **Watchlist `/watchlist`:** monitoring status line (governor mode, next check, credits used), then a coin list with health sparkline, StatusPill and latest alert. Empty state: "Nothing watched yet. Check a coin and press Watch."
4. **Alert detail `/alerts/[id]`:** what changed (before → after numbers), before/after chart, "What it means", "What to check next", link to the report and Rescue. Disclaimer.
5. **Rescue `/rescue/[id]`:** agent in `rescue`. Scam shield notice first. Then: "Can I still sell?" (liquidity table, impact estimate or "no depth data"), protect-your-wallet steps, evidence checklist + download, where to report, lessons.
6. **Connect `/connect`:** Telegram deep link + steps. MCP setup with copy-paste config blocks.
7. **API evidence `/evidence`:** already built in phase a; restyled with the components above.
8. **States (every screen):**
   - Loading: agent `scanning` + caption + skeletons.
   - Empty: friendly line + one action.
   - Error: "Something went wrong on our side. Your data is safe. Try again." + Retry.
   - Rate-limited: "CoinMarketCap is busy with our requests. Please try again in a minute." + countdown.
   - Plan-blocked: "This part needs a paid CoinMarketCap plan, so it isn't live right now." + a recorded demo if one exists.

## 7. Breakpoints and checks
- Screenshot widths **1440** and **390** (Playwright) for every screen, saved in `design/screens/`.
- No horizontal page scroll at 390. Tap targets ≥ 44 px. Everything is reachable by keyboard in a logical order, with a skip link first.
