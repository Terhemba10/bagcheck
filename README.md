# Bagcheck

**Did the founders keep their promises, and can you still get out?**

Bagcheck is an AI agent for crypto holders, built on the [CoinMarketCap API](https://coinmarketcap.com/api/) for the *Build with CMC: API Hackathon* (AI Agents and Automation track). It covers the whole journey:

1. **Before you buy:** a plain-English risk report from live CMC data, plus a *Promise check* that reads the project's own website and roadmap.
2. **While you hold:** a watchlist that re-checks coins and warns you on Telegram while selling is still possible.
3. **If it went wrong:** a rescue plan: can you still sell, how to protect what's left, evidence and reporting, and a recovery-scam shield.

> Not financial advice. Bagcheck explains data. It never tells you to buy or sell.

**Live:** https://bagcheck-azure.vercel.app. Working today: the risk report, the Promise check, Ask Bag chat, the watchlist with Telegram alerts, the rescue plan and the MCP server. See [`docs/STATUS.md`](docs/STATUS.md).

## CoinMarketCap endpoints used

| Endpoint | Used for |
|---|---|
| `GET /v1/cryptocurrency/map` | Search (name / symbol / slug → id) |
| `GET /v2/cryptocurrency/info` | Official links, launch date, contract addresses |
| `GET /v3/cryptocurrency/quotes/latest` | Price, volume, market cap, supply, fully diluted value |
| `GET /v1/global-metrics/quotes/latest` | Market context |
| `GET /v5/cryptocurrency/ohlcv/historical` | Daily history |
| `GET /v1/dex/security/detail` | Contract warning signs (honeypot, taxes, blacklist, mint) |
| `GET /v1/dex/token/pools` | DEX liquidity |
| `GET /v1/key/info` | Credit governor |
| `GET /v2/cryptocurrency/market-pairs/latest`, `/v1/cryptocurrency/trending/*` | Startup-plan extras, detected at runtime |

Live status per endpoint, example responses and plan notes: [`docs/ENDPOINTS.md`](docs/ENDPOINTS.md). Real call log: [`docs/API_EVIDENCE.md`](docs/API_EVIDENCE.md) and the `/evidence` page. API feedback: [`docs/API_FEEDBACK.md`](docs/API_FEEDBACK.md).

## How it protects the API key and credits

- Every CMC call goes through the server ([`lib/cmc/client.ts`](lib/cmc/client.ts)). The key is read from an environment variable and is never sent to the browser, logged or committed.
- Responses are cached per endpoint (60 s – 24 h), plus a "last good copy" fallback.
- **Plan detection:** a `1006` response marks that endpoint as not in the plan, and the UI labels it instead of breaking.
- **Credit guard:** paid calls stop at a daily cap and a monthly reserve, read live from `/v1/key/info` ([`lib/cmc/guard.ts`](lib/cmc/guard.ts)).
- **Per-IP rate limits** on public API routes, with IPs stored only as hashes ([`lib/ratelimit.ts`](lib/ratelimit.ts)).

## Use it from an AI assistant (MCP)

[`mcp/`](mcp/) is a Model Context Protocol server with four tools: `check_token`, `promise_check`, `watch_token` and `rescue_plan`. It needs no API key: it calls Bagcheck's public API, with the same rate limits, credit guard and rules (no buy or sell advice; seed phrases and private keys are refused).

```bash
cd mcp
npm install
npm run build
npm run smoke            # optional: calls each tool against the live site
claude mcp add bagcheck -- node /path/to/bagcheck/mcp/dist/index.js
```

For Claude Desktop or other clients, add `{"mcpServers": {"bagcheck": {"command": "node", "args": ["/path/to/bagcheck/mcp/dist/index.js"]}}}` to the MCP config. Set `BAGCHECK_URL` to point it at a local server. The watchlist id is kept in `~/.bagcheck/mcp.json`.

## Run it locally

```bash
npm install
cp .env.example .env.local   # add CMC_API_KEY
npm run dev                  # http://localhost:3000
npm test                     # unit tests
```

Environment variables are documented in [`.env.example`](.env.example).

## Tech

Next.js (App Router) + TypeScript + Tailwind, React Three Fiber for Bag the agent (with a 2D fallback), Upstash Redis, Vitest and Playwright. Design system: [`design/DESIGN_SPEC.md`](design/DESIGN_SPEC.md), live at `/design`.

## Licence

MIT
