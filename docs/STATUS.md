# Status (updated 20 Nov 2026, after the Covex redesign)

**Live:** https://covex-ai.vercel.app (Vercel project `sanix2/covex-ai`; the old https://bagcheck-azure.vercel.app redirects there; every push to `main` auto-deploys)
**Repo:** https://github.com/Terhemba10/covex (public)
**CMC key:** paid plan since 20 Nov 2026 (450,000 credits/month, 600 calls/min; was Basic 15,000/50). Trending and price-performance now work; market pairs still `1006`. Demo snapshots: `data/demo/2026-11-20/`. Every feature still works on Basic.
**Storage:** Upstash Redis via Vercel (`KV_REST_API_URL` / `KV_REST_API_TOKEN`). Locally, without those, an in-memory store is used.
**LLM:** Google Gemini via `lib/llm` (REST, key in a header). Default `gemini-3.5-flash-lite` with minimal thinking, falling back to `gemini-flash-lite-latest` (override: `GEMINI_MODEL`). Tested 19 Nov: full Flash models timed out (>40 s) and `gemini-2.5-flash` is closed to new keys.

## Done
- **Phase a:** CMC client (`lib/cmc/*`): caching, last-good fallback, per-endpoint plan detection (1006), credit governor (`budget.ts`, Basic schedule cap on small plans), credit guard (`guard.ts`, daily cap 400 + monthly reserve 1000), evidence log + `/evidence` page, `docs/ENDPOINTS.md`, `docs/API_EVIDENCE.md`, `docs/API_FEEDBACK.md`.
- **Phase b:** design spec, tokens, UI components (`components/ui`), `/design` style guide, screenshots in `design/screens`.
- **Agent v2 (3D orb):** replaced in the Covex redesign (see below).
- **Public-site protection:** per-IP rate limits (`lib/ratelimit.ts`), CDN caching on search, admin probe locked without `CRON_SECRET`.
- **Home:** hero, search with example chips (solid dropdown), stage cards; Watchlist/Rescue/Connect are "Coming soon" pages hidden from the nav.
- **Phase c:** "Coins worth a check" row (`lib/core/worthACheck.ts`, `/api/worth-a-check`; trending on Startup, listings fallback on Basic).
- **Coin report `/coin/[id]`:** 7 signals (`lib/core/signals.ts`), score + verdict (`lib/core/score.ts`), report builder with a 5-min cache (`lib/core/report.ts`, ~4 credits per fresh report), rate-limited `/api/report/[id]`, SSRF-safe fetch (`lib/net/safeFetch.ts`), links health (`lib/core/links.ts`). Page: Covex scans with live steps then speaks the verdict; signal cards; contract scan; DEX pools; official links.

- **Promise check:** `lib/promises/*` + `prompts/extractPromises.ts` + `/api/promises/[id]` (rate-limited, cached 24 h). Reads the official site, roadmap/whitepaper links (or `/roadmap`), focusing long pages on the roadmap section. AI extracts items; **code keeps only quotes found word-for-word on the cited page**, normalises dates, computes status, and only marks "delivered" when the quote itself says so. Timeline on the report.
- **Ask Covex (corner chat):** `components/agent/CornerAgent.tsx`, `lib/client/bagContext.ts`, `/api/chat`, `lib/chat/facts.ts`, `prompts/askBag.ts`. Answers only from the report facts; **code rejects answers with advice or numbers not in the facts** and falls back to report text. Seed phrases / private keys are blocked in the browser (never sent) and on the server (`lib/safety/secrets.ts`, BIP-39 list from `@scure/bip39`).

- **Phase d (watchlist + scheduler + Telegram):**
  - Anonymous web identity (`bc_uid` httpOnly cookie, `lib/uid.ts`); Telegram identity = chat id; one-time link codes (`/api/telegram/link` → `t.me/BagcheckAlertsBot?start=<code>`).
  - Store: `lib/monitor/store.ts` (watchlists max 10, snapshots, alerts, cooldowns, delivered marks, links).
  - Rules: `lib/monitor/rules.ts` (promise date passed, volume falling, pairs dropping, liquidity draining, supply jump, website down, underperforming vs BTC), unit-tested.
  - Run: `lib/monitor/run.ts`: one batched quotes call + rotating deep checks (DEX liquidity, website, cached promise check) → snapshots → rules → Telegram. Governor decides if a run is due (Basic: every 12 h, max 10 coins, 1 deep check/run).
  - Scheduler: GitHub Actions hourly (`.github/workflows/monitor.yml`, secret `CRON_SECRET`) + Vercel Cron daily backup (`vercel.json`) → `/api/cron/check` (Bearer `CRON_SECRET`).
  - Bot @BagcheckAlertsBot: `/api/telegram/webhook` (header secret `TELEGRAM_WEBHOOK_SECRET`): /start [code], /check, /watch, /unwatch, /list, /rescue, /stop, /help; deletes messages containing seed phrases/keys.
  - Web: Watch button on reports, `/watchlist`, `/alerts/[id]` (before/after chart, meaning, next steps, mark delivered), `/connect`.
  - `/api/admin/test-alert?coinId=` (Bearer CRON_SECRET) sends a clearly labelled [Test] alert for demos.

- **Phase e (rescue plan):** `/rescue` (any coin via search + general steps) and `/rescue/[id]` (`/api/rescue/[id]`, `lib/rescue/*`): recovery-scam shield at the top; "Can I still sell?" (DEX pools by our token's side, CEX markets when the plan allows, price-impact ESTIMATE from a 50/50 pool model, thin-liquidity fact); protect-your-wallet steps with the fake-revoke warning above them; official links from a hard-coded allowlist (`lib/rescue/links.ts`, verified 19–20 Nov); evidence summary built and downloaded in the browser with the secret blocker on every field; where to report (exchange, IC3, local police cybercrime unit); lessons from snapshots/alerts only. Bot `/rescue [coin]` links to the same page. Guard test scans the rescue copy for advice wording and non-allowlisted links.

- **Liquidity counts major-asset pools only** (`lib/core/pools.ts`, one list): report signal, rescue estimate and the watchlist liquidity rule (snapshots tagged `liqMethod: "major"`; older snapshots are ignored so the change can't fire a false alert). Other pools are shown collapsed as "not counted".

- **Phase f (MCP server):** `mcp/` package `covex-mcp` (stdio, `@modelcontextprotocol/sdk`, bundled with esbuild to `mcp/dist/index.js`, not committed). Tools: `check_token`, `promise_check`, `watch_token` (watch/unwatch/list + Telegram link), `rescue_plan` (with optional `amount_usd` impact estimate). It calls the public Covex API (no keys; same limits and credit guard), keeps an anonymous watchlist id in `~/.covex/mcp.json`, refuses seed phrases/keys, and ends every answer with the disclaimer. `npm run smoke` calls every tool against the live site (6/6 passed 20 Nov). Setup on `/connect` and in the README.

- **Phase g (tests, CI, docs):** `.github/workflows/ci.yml` (typecheck, lint, unit tests, build; MCP job builds the server, checks the committed `mcp/covex-mcp.tgz` matches the source, offline smoke), badge in the README. MCP runs with one command: `npx -y https://raw.githubusercontent.com/Terhemba10/covex/main/mcp/covex-mcp.tgz` (self-contained bundle, no runtime deps; rebuild with `npm run pack` in `mcp/`). README rewritten (try-it, 3 example coins, scan GIF + screenshots from `scripts/record-demo.ts`, architecture diagram, endpoint table, MCP setup). `docs/API_FEEDBACK.md` ready for the submission note. Fixed: search said "No coins match" while loading; same-millisecond watchlist adds reordered.
- **Note:** polling the live site with curl (~80 requests in 10 min) got this machine's IP a temporary Vercel "Security Checkpoint" 403 (automatic DDoS mitigation; attack mode and bot protection are off, other users unaffected). Check deploys with `npx vercel ls` and CI with `gh`.

- **Redesign + rename to Covex (20 Nov):** pure black theme, left sidebar (icon rail on tablets and when collapsed, remembered; drawer + bottom bar on phones), Ctrl+K command palette, Ask Covex side sheet, plan + credits pill (`/api/plan`), "Simple graphics" toggle. The 3D orb is gone (React Three Fiber removed); presence is the geometric Covex mark (breathes while working, verdict colour on the core). Reports stream real step events (`/api/report/:id?stream=1`, NDJSON from `buildReport`) into the **agent activity** checklist; cards assemble with depth; tilt ≤ 4° + light edge; count-up numbers; motion tokens in `lib/motion.ts`. New pages: `/alerts`, `/disclaimer`. Spec: `design/DESIGN_SPEC.md`. Checks: `scripts/check-shell.ts` (21 interaction checks; 58 fps tilting, 110 fps scrolling on the HD 520), screenshots at 1440/1024/390. MCP renamed `covex-mcp` (`mcp/covex-mcp.tgz`; old `BAGCHECK_*` env and `~/.bagcheck` still read). Telegram bot username stays @BagcheckAlertsBot (usernames can't change); display name Covex.

- **Risk board (`/risk`, 20 Nov):** top 200 by market cap from CMC listings (refreshed ≤ every 15 min, only when visited), 7-day sparklines from daily OHLCV (top 100, one call per coin, cached 24 h, budget-gated), a "quick check" verdict from the 3 signals listing data supports (same scoring and wording as reports) or the last full report's verdict (kept 7 days in `board:verdicts:v1`), and promise counts from the last promise check (`board:promises:v1`). Filters All / Memes (CMC `memes` tag) / Top 100; default sort highest concern first. Motion: rows dealt in from depth, hover lift + ≤3° tilt + compositor-only light sweep, FLIP re-sort with a small lift, sparklines draw in, pills pop with a verdict glow, glass header with parallax, row → report shared-element View Transition. Virtualised (only rows in view are in the DOM), flat under Simple graphics / reduced motion. `scripts/check-risk.ts`. Credit guard is now plan-aware: 400/day on Basic, 2,000/day on a paid key (`CMC_DAILY_CREDIT_CAP` still overrides). Fixed: a report kept building (and caching) when the visitor left mid-stream.

## Next (in order)
1. Phase h per `docs/PLAN.md`: tests/CI/docs, video + submission. Before 9 Dec: demo snapshots (PLAN §1b).

## Known polish items
- Amber (concern) state: the bloomed core lowers the face's contrast on High quality.
- "Watch this coin" is disabled until phase d.
- PDF whitepapers aren't read yet (many projects only publish PDFs).
- Promise checks for JS-only websites return "couldn't read" honestly.

## Open questions for the user
- None blocking. The user approves pushes per change; deploys happen on push to `main`.
