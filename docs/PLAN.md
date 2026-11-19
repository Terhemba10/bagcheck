# Bagcheck — Build Plan (draft for approval)

Status: **approved 19 Nov 2026** (with Basic mode + Gemini changes). Written 19 Nov 2026. Target: submission-ready **5 Dec**, hard deadline **9 Dec 23:59 UTC**.

---

## 0. Decisions already made

| Topic | Decision | Why |
|---|---|---|
| Design path | **Code fallback** (§5 of brief). `design/DESIGN_SPEC.md` → tokens/components → `/design` living style guide → screens → Playwright screenshots (1440 / 390) in `design/screens/`. | Figma `whoami`: your seat on "Terhemba Alumo's team" is **View** (starter tier), so writes would fail. That check was read-only and used no write call. |
| Scheduler | **GitHub Actions `schedule`** (hourly) → `POST /api/cron/check` with a bearer secret. **Vercel Cron** (Hobby: max 1 run/day) as a daily backup. | Vercel Hobby cron is once a day only. GitHub Actions is free and unlimited for public repos. Note: GH schedules can start a few minutes late. That's fine for hourly checks. |
| Storage | **Upstash Redis** (free tier) | Simple key/value fits watchlists, snapshots (sorted sets by time), promises and chat IDs. It has an HTTP client that works on Vercel. |
| LLM | **Google Gemini** (free key, AI Studio) via a swappable adapter (`lib/llm/`), with an Anthropic provider kept as an option. Structured JSON output, zod-validated, prompts in `/prompts`. | Your choice. Free tier. |
| Hosting | Vercel Hobby, Next.js App Router + TS + Tailwind | As in the brief. |

---

## 1. CMC API — what your Startup tier ($79/mo) gives us

Startup: **450,000 credits/month, 600 calls/min**, intraday history 1 month, **daily history back to 2010**, trending endpoints unlocked (Startup+).

### Endpoints we'll use (all confirmed in the docs as available on Startup)

| # | Endpoint | Used for | Credit cost |
|---|---|---|---|
| 1 | `GET /v1/cryptocurrency/map` | Search: resolve name / symbol / slug to CMC id | **free** |
| 2 | `GET /v2/cryptocurrency/info` | Website, technical_doc, twitter, reddit, explorer, source_code URLs; `date_added`, `date_launched`; `platform.token_address`; lookup **by contract address** (`address=`) | 1 / 250 |
| 3 | `GET /v3/cryptocurrency/quotes/latest` | Price, volume, mcap, circulating / total / max supply, `fully_diluted_market_cap`, `unlocked_circulating_supply`, `self_reported_*` | 1 / 250 |
| 4 | `GET /v2/cryptocurrency/market-pairs/latest` | Concentration (volume share per exchange / pair), pair count, `aux=effective_liquidity,market_score,market_reputation`, sort by `effective_liquidity` → **"Can I still sell?"** | 1 / 250 pairs |
| 5 | `GET /v1/global-metrics/quotes/latest` | Market context (total-market % change) for "price vs market" | 1 |
| 6 | `GET /v2/cryptocurrency/price-performance-stats/latest` | 24h / 7d / 30d / 90d / all-time performance in one call | 1 / 250 |
| 7 | `GET /v5/cryptocurrency/ohlcv/historical` (daily) | **Real history from day one** for Health trend charts and "Lessons", so we don't have to wait for our own snapshots | 1 / 100 candles |
| 8 | `GET /v1/cryptocurrency/trending/gainers-losers` + `/most-visited` | Home "trending coins worth a check" (Startup+) | 1 / 250 |
| 9 | `GET /v1/dex/security/detail` | **Contract warning signs:** honeypot, buy/sell tax, mintable, freezable, unverified contract, fake-token flag, reported/flagged-by-vendor | ~1 |
| 10 | `GET /v1/dex/token/pools` | DEX pools, `liqUsd` per pool, 24h volume, exchange name | ~1 |
| 11 | `GET /v1/dex/token-liquidity/query` | **DEX liquidity time series:** powers the "liquidity draining" alert and the before/after chart | ~1 |
| 12 | `GET /v4/dex/spot-pairs/latest` / `/v4/dex/pairs/quotes/latest` | DEX pair liquidity, holders, taxes for contract tokens | ~1 |
| 13 | `GET /v1/key/info` | Credit-usage meter on the API Evidence page | free |

This is a much richer "interesting use of the API" story than the brief assumed. The **DEX security + liquidity history** endpoints are the standout features: they let Bagcheck spot warning signs (honeypot, high sell tax, mint authority, liquidity pulls) that a plain price API can't.

### To verify on the first live call (I'll record the results in `docs/API_FEEDBACK.md`)
- Whether `market-pairs/latest` returns order-book depth (`depth_negative_two` / `depth_positive_two`) on Startup. The current docs don't list those fields. If they're missing, "price impact" comes from DEX pool `liqUsd` (constant-product estimate) and `effective_liquidity`, labelled "estimate", and pairs with no depth data say so.
- `/v2/cryptocurrency/quotes/latest` (named in the brief) vs `/v3` (the current docs). Plan: use v3, fall back to v2 if needed.
- Exact credit cost of the DEX endpoints (the docs examples show `credit_count: 1`).

### Credit budget (defaults, deliberately low)
- One full report ≈ 8–12 credits (cached 60–300 s).
- **Watchlist default (Startup):** up to **30 coins, every 3 h**. Quotes are batched into 1 credit per run. Pairs and DEX liquidity calls (1 each per coin) run every 3rd run, or every run for coins already flagged. That's roughly 21 credits per run × 240 runs ≈ **~5k credits/month**, about 1% of Startup. The ceiling is set by the credit governor (§1b), not by this estimate.

### Client rules
Server-only `lib/cmc/` client; key in `CMC_API_KEY`. Typed responses (zod). Two cache layers: an in-memory LRU plus Redis, with a TTL per endpoint (map 24 h, info 6 h, quotes 60 s, pairs 120 s, global 300 s). Exponential backoff with jitter on 5xx. On `1008` it waits 60 s and shows a friendly "busy, retrying" state. `1006` / `1009` / `1010` give a clear message. Every call writes `{endpoint, params(minus key), ts, credit_count, elapsed, trimmed body}` to a Redis ring buffer for `/evidence`. A script exports this to `docs/API_EVIDENCE.md`.

---

## 1b. Basic mode (judging runs 10–25 Dec on the free tier)

Your Startup access ends when submissions close (9 Dec). Judges will use the app while the key is on **Basic: 15,000 credits/month, 50 calls/min, 1 key, history 1 month intraday / 1 year daily, 1 currency conversion per call, plus a daily credit allowance** (the docs don't publish the number, but `/v1/key/info` reports it in `usage.current_day.credits_left`).

**What Basic still covers.** According to the current docs, map, info, quotes/latest, market-pairs/latest, price-performance-stats, OHLCV, global-metrics, key/info and the single-token DEX GET endpoints (security, pools, liquidity, spot-pairs) are all listed as "Basic and up". What's lost: **trending** (CMC + DEX lists, Startup+), DEX batch POSTs (Builder+), daily history older than 1 year, and multi-currency conversion. We don't trust the docs alone. Access is **detected live**, per endpoint:

1. **Plan detection per endpoint.** `lib/cmc/capabilities.ts` keeps a capability record in Redis: `{endpoint → available | plan_blocked | unknown, checkedAt}`. A response with `error_code 1006` (or 403 / "not authorized for your plan") marks that endpoint `plan_blocked` for 24 h and returns a typed `PlanBlockedError`. Nothing crashes.
2. **Graceful degradation in the UI.** Every signal and feature declares which endpoint it needs. If that endpoint is blocked, the card shows a small "Needs a paid CMC plan · live data unavailable" label, or the demo recording if one exists. It never shows a fake number. The overall score is computed only from the signals that are available, and the report says "scored on 5 of 7 signals". The **core report** (dilution, volume sanity, age & momentum, links health, promise check) needs only map + info + quotes, all Basic endpoints. Home "trending" falls back to a curated list ordered by our own last-seen data.
3. **Credit governor** (`lib/cmc/budget.ts`). The cron calls `/v1/key/info` (free) at the start of each run and computes:
   - `perDayAllowance = 0.35 × credits_left_month ÷ days_until_reset`, also capped by `current_day.credits_left − reserve`. The other 65% is kept for judges' live reports.
   - Based on the allowance, it picks a **mode**: `full` (Startup defaults) → `lean` (every 6 h, max 15 coins, deep checks every 4th run) → `basic` (every 12 h, max 10 coins, quotes batch only, plus one rotating deep check per run) → `paused` (below a 300-credit floor: cron stops, the UI shows "Monitoring paused to save API credits; reports still work").
   - The GitHub Action still fires hourly. The endpoint returns early when the mode says "not due yet", so the frequency adapts without touching the workflow.
   - Live reports also respect a **reserve**. If the day's credits run low, reports serve the cache (marked with its age) instead of making new calls.
   - The current mode, credits left and next run time appear on `/evidence` and `/watchlist`, which also shows judges that the governor exists.
4. **Demo recordings (made before 9 Dec, on Startup).** `scripts/record-demo.ts` records real responses for 4–5 showcase coins: one healthy large-cap, one heavily diluted, one with thin/concentrated liquidity, and one DEX token with security flags and a liquidity history drop. It stores every endpoint response used, plus a replay of snapshot history that fires real alert rules. These live in `data/demo/*.json`, committed (keys stripped; the files contain only public market data). Any feature that's `plan_blocked` live can show its recording with a clear banner: **"Recorded from the live CMC API on <date>. This data needs a paid plan, so it isn't live right now."** The recorded calls also go into `docs/API_EVIDENCE.md`.
5. **Test it before it matters.** A `CMC_FORCE_PLAN=basic` env flag simulates 1006 for the Startup-only endpoints, so Basic mode can be tested end to end (e2e covers it) before 9 Dec. On **8 Dec** we'll run the deployed app in forced-Basic mode as a dress rehearsal.

The judging-period budget on Basic: 15k/month ≈ 500/day. Monitoring takes ≤ 35% (≈ 175/day, e.g. 10 coins × 2 runs/day ≈ 30–60/day in practice). The rest covers about 30 uncached live reports a day, and the cache stretches that much further.

---

## 2. Architecture

```
            ┌───────────── Next.js on Vercel ─────────────────────────┐
 Browser ──▶│ app/ (pages, R3F agent)   app/api/*  (route handlers)    │
            │        │                       │                         │
 Telegram ─▶│ /api/telegram/webhook ─────────┤                         │
            │                                ▼                         │
 GH Actions▶│ /api/cron/check  ──▶  lib/core  (report, scoring,        │
 (hourly)   │                       alert rules, rescue, promises)     │
            │                        │        │          │             │
            └────────────────────────┼────────┼──────────┼─────────────┘
                                     ▼        ▼          ▼
                               lib/cmc    lib/llm    lib/store (Upstash)
                               (CMC API)  (Anthropic|Gemini)
 MCP client ──▶ mcp/ (bagcheck-mcp, stdio) ──HTTP──▶ /api/v1/* (same core)
```

**Code decides, AI explains.** `lib/core/score.ts` and `lib/core/alerts/*.ts` are pure functions that turn CMC data into numbers. The LLM only gets those computed signals for writing explanations, plus page text for extracting promises. It never produces a score.

---

## 3. Folder layout

```
app/
  page.tsx                      Home (agent hero, search, stage cards, trending)
  coin/[id]/page.tsx            Report + promise timeline + Watch
  watchlist/page.tsx            Sparklines + latest alerts
  alerts/[alertId]/page.tsx     Before/after chart, meaning, next steps
  rescue/[id]/page.tsx          Can I still sell? / protect wallet / evidence / shield
  connect/page.tsx              Telegram deep link + MCP config copy-paste
  evidence/page.tsx             Last real CMC calls
  design/page.tsx               Living style guide
  api/
    search, report/[id], promises/[id], watchlist, rescue/[id], evidence
    cron/check                  (bearer-protected)
    telegram/webhook            (secret-token header)
    v1/*                        public JSON API used by the MCP server
components/  agent/ (R3F orb + 2D fallback), ui/ (glass card, signal card, status pill…), charts/
lib/
  cmc/      client.ts, cache.ts, evidence.ts, types.ts (zod), endpoints/*.ts
  core/     score.ts, signals/*.ts, alerts/*.ts, rescue.ts, priceImpact.ts, lessons.ts
  promises/ fetchSite.ts (safe server fetch, size/time limits, no private IPs), extract.ts
  llm/      index.ts (adapter), anthropic.ts, gemini.ts
  store/    redis.ts, watchlist.ts, snapshots.ts
  safety/   seedPhrase.ts (BIP-39 wordlist + private-key/regex detector), disclaimers.ts
  telegram/ bot.ts, commands.ts, format.ts
prompts/    explain-report.md, extract-promises.md, lessons.md
mcp/        package.json, src/index.ts (check_token, promise_check, watch_token, rescue_plan)
tests/      unit (vitest), e2e (playwright, mocked CMC via fixtures/)
design/     DESIGN_SPEC.md, screens/
docs/       PLAN.md, ENDPOINTS.md, API_EVIDENCE.md, API_FEEDBACK.md
video/      script.md, record.ts (Playwright), tts + ffmpeg scripts
.github/workflows/ ci.yml, cron.yml
README.md  SUBMISSION.md  X_POST.md  LICENSE (MIT)  .env.example
```

---

## 4. Scoring (computed in code, unit-tested)

Each signal → `{value, level: ok|watch|concern|unknown, meaning, whyItMatters}`. Overall = weighted points → **Low / Medium / High concern**. Missing data → `unknown`, never a guess.

| Signal | Source | Example thresholds (tunable) |
|---|---|---|
| Dilution | circ / max (or total); FDV / mcap | circ < 30% or FDV/mcap > 3 → concern |
| Volume sanity | vol24h / mcap | > 1.0 (possible fake volume) or < 0.005 (illiquid) |
| Concentration | top exchange's share of volume | > 60% → concern |
| Liquidity | effective_liquidity + DEX `liqUsd` | < $50k → concern |
| Contract flags | dex/security | honeypot / sell tax > 10% / mintable → concern |
| Age & momentum | date_added; 7d / 30d vs market | < 90 days; underperforms market by > 30 pts |
| Links health | HEAD/GET website + socials | any official link dead |

Alert rules (Stage 2) compare consecutive snapshots: overdue promise, volume falling N=3 runs in a row, pair count drop ≥ 20%, liquidity −30% or below the floor, circulating supply +5% in one step, link down 2 checks in a row, price vs market gap ≥ 25 pts over 7 days. All rules sit in one config file and are tested.

---

## 5. Phases and dates (each ends with a checkpoint demo + commit)

| Phase | Dates | Deliverable / checkpoint |
|---|---|---|
| **a** CMC client + cache + `/evidence` | 20–21 Nov | Live calls to map/info/quotes/pairs/global/DEX; evidence page; `ENDPOINTS.md`; first `API_FEEDBACK.md` notes (depth fields answered) |
| **b** Design spec + `/design` + 3D agent | 22–24 Nov | Tokens, components, all 6 agent states, 2D / reduced-motion fallback, perf check on Intel graphics |
| **c** Stage 1 report + Promise check | 25–27 Nov | Search → report → score → promise timeline, LLM explanations |
| **d** Stage 2 watchlist + cron + Telegram | 28–30 Nov | Snapshots, 7 alert rules, health charts, bot commands + pushed alerts |
| **e** Stage 3 Rescue plan | 1 Dec | Liquidity ranking + impact estimate, wallet steps, evidence download, scam shield, seed-phrase blocker, Lessons |
| **f** MCP server | 2 Dec | `bagcheck-mcp` with 4 tools, tested in Claude Desktop/Code |
| **g** Tests + CI + docs | 3 Dec | Vitest + Playwright (mocked CMC), CI workflow, README + diagram |
| **h** Deploy + video + submission | 4–5 Dec | Vercel live, ~3 min video, `SUBMISSION.md`, `X_POST.md` |
| **demo recordings** | 5–7 Dec | `scripts/record-demo.ts` run on Startup; `data/demo/` committed |
| **Basic dress rehearsal** | 8 Dec | Deployed app in `CMC_FORCE_PLAN=basic`; fix anything that degrades badly |
| buffer | 6–9 Dec | Polish, fixes, you submit + post |

---

## 6. Safety (built in from phase a)
Disclaimer component on every report and in every alert footer. The words "scam" and "rug pull" are never applied to a coin: the copy says "warning signs" and shows the evidence. Every input field goes through the seed-phrase / private-key blocker, including Telegram messages. Rescue links come only from a hard-coded allowlist of official URLs. The promise fetcher is SSRF-safe: http(s) only, no private IPs, size and time limits.

---

## 7. What I need from you (and when)

| Needed | When | Where to get it |
|---|---|---|
| **Gemini API key** | before phase c | aistudio.google.com → "Get API key" → Create API key (free). Put it in `.env.local` as `GEMINI_API_KEY` |
| **CMC API key** | start of phase a | pro.coinmarketcap.com → Account → API Key. Put it in `.env.local` yourself; never paste it in chat |
| **Upstash Redis** URL + token | phase a (evidence log) | console.upstash.com → Create database (free) → REST URL + token |
| **Telegram bot token** | phase d | Telegram → @BotFather → /newbot |
| **Vercel account** linked to GitHub | phase h (I'll ask before deploying) | vercel.com |
| **OK to create public repo `Terhemba10/bagcheck`** | when you want to push (I'll ask) | — |

Nothing in this plan costs money beyond your existing CMC Startup plan; every other service is a free tier.
