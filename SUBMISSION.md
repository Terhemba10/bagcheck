# Covex: submission

**Build with CMC: API Hackathon · AI Agents and Automation track**

> Did the founders keep their promises, and can you still get out?

| | |
|---|---|
| Live app | https://covex-ai.vercel.app (no sign-up, no wallet) |
| Code | https://github.com/Terhemba10/covex (MIT) |
| Demo video | https://youtu.be/HydfNouc0Eg (2:37) · file: `video/covex-demo.mp4` |
| Telegram bot | [@BagcheckAlertsBot](https://t.me/BagcheckAlertsBot) (display name Covex) |
| MCP server | `npx -y https://raw.githubusercontent.com/Terhemba10/covex/main/mcp/covex-mcp.tgz` |

## The problem

Crypto founders promise roadmaps, launches and listings. Many dates slip, and buyers usually find out too late. Most tools show the price, not the promises, and when something goes wrong, people get little help except from "recovery experts", who are often scammers themselves.

## What Covex does

Covex is an AI agent that covers the whole journey of holding a coin:

1. **Before you buy:** a plain-English risk report from live CoinMarketCap data. Seven warning-sign checks: dilution, volume sanity, exchange concentration, DEX liquidity, age and momentum, links health and contract security. There's also a **Promise check** that reads the project's own website and roadmap and lists each dated promise with its status and a word-for-word quote linked to the source.
2. **While you hold:** a watchlist (no account needed) that Covex re-checks on a schedule. It alerts you in the app and on Telegram when a warning sign appears: falling volume, fewer markets, draining liquidity, a supply jump, the website going down, or a promise date passing.
3. **If it went wrong:** a rescue plan. It shows where the coin can still be traded and an estimated price impact for your amount, then gives steps to protect what's left, an evidence summary built in your browser, where to report, and a recovery-scam shield. Links are official only, from a hard-coded allowlist.

A **Risk board** ranks the top 200 coins by concern: quick checks from live market data (or a recent full report's verdict), 7-day charts, each coin's top warning sign and promise counts. It filters to memes or the top 100, and any row opens straight into its report.

You can watch the agent work. While it builds a report, an **agent activity** panel streams each real step (pending → running → done) with the CoinMarketCap endpoint it used. These are real server events from the report builder, not a timed animation.

## How it uses the CoinMarketCap API

| Endpoint | What Covex uses it for |
|---|---|
| `/v1/cryptocurrency/map` | Search by name, symbol, slug or contract (0 credits) |
| `/v5/cryptocurrency/ohlcv/historical` | 7-day sparklines on the Risk board (daily candles, cached 24 h) |
| `/v2/cryptocurrency/info` | Official links (what the Promise check reads), contracts, launch date |
| `/v3/cryptocurrency/quotes/latest` | Price, CEX/DEX volume, market cap, supply, markets, 7/30-day change; batched for the watchlist |
| `/v3/cryptocurrency/listings/latest` | The Risk board (top 200, every 15 min) and "Coins worth a check" on the home page |
| `/v1/cryptocurrency/trending/gainers-losers` | "Coins worth a check" when the plan allows |
| `/v1/dex/security/detail` | Contract warning signs: honeypot, taxes, blacklist, mint/freeze, vendor flags |
| `/v1/dex/token/pools` | DEX liquidity (pools paired with major assets only), rescue price impact, the liquidity-draining alert |
| `/v1/key/info` | The credit governor and the plan pill (0 credits) |
| `/v2/cryptocurrency/market-pairs/latest` | Exchange concentration, when the plan allows (detected at runtime) |

Every call goes through one server-side client with caching, a "last good copy" fallback, **runtime plan detection** (a `1006` marks an endpoint as unavailable and the UI says so), and a **credit governor** that adapts background monitoring to the credits left. A daily cap and a monthly reserve protect judges' live reports. The live `/evidence` page lists the real calls and credits.

## The agent and the AI

- **Code decides, AI explains.** Scores, thresholds and alerts are computed in TypeScript from CMC data. Gemini only:
  - extracts promises: code keeps a quote only if it appears word for word on the cited page, and works out dates and statuses itself;
  - explains answers in Ask Covex: code rejects any advice, or any number that isn't in the report.
- **Autonomous monitoring:** GitHub Actions runs hourly and Vercel Cron daily. The governor decides whether a run is due, re-checks watched coins, stores snapshots, evaluates seven alert rules and messages Telegram.
- **Three ways to use the agent:** the website, the Telegram bot (`/check`, `/watch`, `/rescue`…), and an MCP server (`check_token`, `promise_check`, `watch_token`, `rescue_plan`) that runs in Claude or any MCP client with one command.

## Safety

- Never "buy" or "sell", never "scam" about a coin. Every report and alert ends with: *Not financial advice. Covex explains data. It never tells you to buy or sell.*
- **Seed phrases and private keys are blocked everywhere:** in the browser before anything is sent, on the server, in the bot (the message is deleted), and in the MCP server.
- Project pages are fetched through an SSRF-safe fetcher. Per-IP rate limits use hashed IPs.
- Rescue links come from a hard-coded official allowlist. The recovery-scam warning comes first.

## Engineering

Next.js 16, TypeScript, Tailwind v4, Motion, Upstash Redis, Google Gemini and the MCP TypeScript SDK. 288 unit tests. CI runs typecheck, lint, tests, the build, and a check that the committed MCP bundle matches its source. Pure black UI meeting WCAG 2.2 AA contrast, with a keyboard-first sidebar and command palette, and reduced-motion plus "Simple graphics" support. Measured smooth on an 8 GB laptop with Intel HD 520 graphics.

## Feedback on the CMC API

Full notes: [`docs/API_FEEDBACK.md`](docs/API_FEEDBACK.md).
1. Market pairs and price-performance are documented as "Basic and up" but return `1006` on Basic. Market pairs still returns `1006` on a 450k-credit paid key.
2. v3 quotes return `quote` as an array, while the docs show an object.
3. v5 OHLCV rejects `convert=USD` with a bare `4001`.
4. `/v1/dex/token-liquidity/query` returned `400` for every parameter combination we tried.
5. Error codes are numbers in v1/v2 but strings in v3/v5/DEX.
6. The free DEX security and pools endpoints made contract warning signs and "can I still sell?" possible.

## Team

Terhemba Alumo ([@Terhemba10](https://github.com/Terhemba10)).

*Not financial advice. Covex explains data. It never tells you to buy or sell.*
