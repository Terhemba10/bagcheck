# Status (updated 20 Nov 2026)

**Live:** https://bagcheck-azure.vercel.app (Vercel project `sanix2/bagcheck`; every push to `main` auto-deploys to production)
**Repo:** https://github.com/Terhemba10/bagcheck (public)
**CMC key:** Basic plan (15,000 credits/month). The hackathon Startup upgrade had not arrived as of 20 Nov (14,834 credits left at the start of phase f).
**Storage:** Upstash Redis via Vercel (`KV_REST_API_URL` / `KV_REST_API_TOKEN`). Locally, without those, an in-memory store is used.
**LLM:** Google Gemini via `lib/llm` (REST, key in a header). Default `gemini-3.5-flash-lite` with minimal thinking, falling back to `gemini-flash-lite-latest` (override: `GEMINI_MODEL`). Tested 19 Nov: full Flash models timed out (>40 s) and `gemini-2.5-flash` is closed to new keys.

## Done
- **Phase a:** CMC client (`lib/cmc/*`): caching, last-good fallback, per-endpoint plan detection (1006), credit governor (`budget.ts`, Basic schedule cap on small plans), credit guard (`guard.ts`, daily cap 400 + monthly reserve 1000), evidence log + `/evidence` page, `docs/ENDPOINTS.md`, `docs/API_EVIDENCE.md`, `docs/API_FEEDBACK.md`.
- **Phase b:** design spec, tokens, UI components (`components/ui`), `/design` style guide, screenshots in `design/screens`.
- **Agent v2** (`components/agent`): R3F glass orb with High/Low quality (auto, `?quality=` / `?fps=` overrides), heartbeat, listening, scanning steps, speaking verdict, danger shield; 2D fallback with cross-fade; measured 30 fps on Intel HD 520 (`design/AGENT_PERF.md`).
- **Public-site protection:** per-IP rate limits (`lib/ratelimit.ts`), CDN caching on search, admin probe locked without `CRON_SECRET`.
- **Home:** hero, search with example chips (solid dropdown), stage cards; Watchlist/Rescue/Connect are "Coming soon" pages hidden from the nav.
- **Phase c:** "Coins worth a check" row (`lib/core/worthACheck.ts`, `/api/worth-a-check`; trending on Startup, listings fallback on Basic).
- **Coin report `/coin/[id]`:** 7 signals (`lib/core/signals.ts`), score + verdict (`lib/core/score.ts`), report builder with a 5-min cache (`lib/core/report.ts`, ~4 credits per fresh report), rate-limited `/api/report/[id]`, SSRF-safe fetch (`lib/net/safeFetch.ts`), links health (`lib/core/links.ts`). Page: Bag scans with live steps then speaks the verdict; signal cards; contract scan; DEX pools; official links.

- **Promise check:** `lib/promises/*` + `prompts/extractPromises.ts` + `/api/promises/[id]` (rate-limited, cached 24 h). Reads the official site, roadmap/whitepaper links (or `/roadmap`), focusing long pages on the roadmap section. AI extracts items; **code keeps only quotes found word-for-word on the cited page**, normalises dates, computes status, and only marks "delivered" when the quote itself says so. Timeline on the report.
- **Ask Bag (corner chat):** `components/agent/CornerAgent.tsx`, `lib/client/bagContext.ts`, `/api/chat`, `lib/chat/facts.ts`, `prompts/askBag.ts`. Answers only from the report facts; **code rejects answers with advice or numbers not in the facts** and falls back to report text. Seed phrases / private keys are blocked in the browser (never sent) and on the server (`lib/safety/secrets.ts`, BIP-39 list from `@scure/bip39`).

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

- **Phase f (MCP server):** `mcp/` package `bagcheck-mcp` (stdio, `@modelcontextprotocol/sdk`, bundled with esbuild to `mcp/dist/index.js`, not committed). Tools: `check_token`, `promise_check`, `watch_token` (watch/unwatch/list + Telegram link), `rescue_plan` (with optional `amount_usd` impact estimate). It calls the public Bagcheck API (no keys; same limits and credit guard), keeps an anonymous watchlist id in `~/.bagcheck/mcp.json`, refuses seed phrases/keys, and ends every answer with the disclaimer. `npm run smoke` calls every tool against the live site (6/6 passed 20 Nov). Setup on `/connect` and in the README.

## Next (in order)
1. Phases g–h per `docs/PLAN.md`: tests/CI/docs, video + submission. Before 9 Dec: demo snapshots (PLAN §1b).

## Known polish items
- Amber (concern) state: the bloomed core lowers the face's contrast on High quality.
- "Watch this coin" is disabled until phase d.
- PDF whitepapers aren't read yet (many projects only publish PDFs).
- Promise checks for JS-only websites return "couldn't read" honestly.

## Open questions for the user
- None blocking. The user approves pushes per change; deploys happen on push to `main`.
