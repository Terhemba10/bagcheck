# CMC endpoints used by Covex

Checked with live calls on **19 Nov 2026**. The key reported its plan through `GET /v1/key/info`: **Basic tier, 15,000 credits/month, 50 calls/min**, monthly reset on 1 Dec 2026.
The full request/response log is in [`API_EVIDENCE.md`](API_EVIDENCE.md), and live on the `/evidence` page.

Legend: ✅ works on this key · ⛔ `1006` plan not authorized · ⚠️ reachable but not yet working

| Endpoint | Status (Basic key) | Credits seen | What Covex uses it for |
|---|---|---|---|
| `GET /v1/cryptocurrency/map` | ✅ | 0 | Search: name / symbol / slug → CMC id (compact copy cached 24 h) |
| `GET /v2/cryptocurrency/info` | ✅ | 1 | Official website, whitepaper, socials, explorers, `date_added`, `date_launched`, contract addresses per chain; lookup by contract address |
| `GET /v3/cryptocurrency/quotes/latest` | ✅ | 1 (batched ids) | Price, 24 h volume, market cap, **fully diluted value**, circulating / total / max supply, `num_market_pairs`, % change 1 h → 90 d, CEX vs DEX volume |
| `GET /v2/cryptocurrency/quotes/latest` | (fallback) | — | Used only if v3 fails |
| `GET /v3/cryptocurrency/listings/latest` | ✅ (checked 19 Nov) | 1 per 250 | Home "coins worth a check" on Basic: top 200 by market cap, filtered by our warning-sign rules (`lib/core/worthACheck.ts`). Same shape as v3 quotes (`quote` is an array) |
| `GET /v1/global-metrics/quotes/latest` | ✅ | 1 | Market context: total market cap and its change vs yesterday, BTC dominance |
| `GET /v5/cryptocurrency/ohlcv/historical` | ✅ | 1 per ≤100 candles | Daily price / volume / market-cap history for health trends and "Lessons" |
| `GET /v1/dex/security/detail` | ✅ | 1 | Contract warning signs: security level, buy/sell tax, blacklist / whitelist / mint / proxy checks, honeypot & fake-token status |
| `GET /v1/dex/token/pools` | ✅ | 1 | DEX pools per token: liquidity in USD per side, 24 h volume, DEX name, pool age |
| `GET /v1/key/info` | ✅ | 0 | Credit governor: credits left today / this month, rate limit |
| `GET /v2/cryptocurrency/market-pairs/latest` | ⛔ 1006 (also on the paid key, see below) | 0 | (Standard) CEX volume concentration, liquidity per market for "Can I still sell?" |
| `GET /v2/cryptocurrency/price-performance-stats/latest` | ⛔ 1006 | 0 | (Startup) Not needed: quotes already include 1 h → 90 d changes |
| `GET /v1/cryptocurrency/trending/gainers-losers` | ⛔ 1006 | 0 | (Startup) Home "coins worth a check" |
| `GET /v1/cryptocurrency/trending/most-visited` | not called yet (Startup+ per docs) | — | Home "coins worth a check" |
| `GET /v1/dex/token-liquidity/query` | ⚠️ HTTP 400 "Parameter error" | 0 | Planned: DEX liquidity history. No documented parameter combination worked (see API_FEEDBACK.md). Fallback: our own snapshots of `token/pools` liquidity |

## Plan upgrade (20 Nov 2026)

`/v1/key/info` changed during the day: **450,000 credits/month, 600 calls/min** (it was 15,000 and 50 that morning). CMC doesn't return a plan name, so Covex shows "Paid plan". One small live call per formerly blocked endpoint (`scripts/plan-upgrade.ts`, 3 credits):

| Endpoint | On the upgraded key |
|---|---|
| `GET /v1/cryptocurrency/trending/gainers-losers` | ✅ now available (home "coins worth a check" uses it, with the listings fallback kept) |
| `GET /v1/cryptocurrency/trending/most-visited` | ✅ now available |
| `GET /v2/cryptocurrency/price-performance-stats/latest` | ✅ now available (not used by a feature: quotes already carry 1 h → 90 d changes) |
| `GET /v2/cryptocurrency/market-pairs/latest` | ⛔ still `1006` on this plan (re-tested again 09:13 UTC: same). Covex says "needs a higher CMC plan (Standard)" on the card, the activity step and the API evidence page, so it doesn't contradict the "Paid plan" pill. The Exchange concentration signal stays "not enough data" until it answers |

Demo snapshots of the newly available responses (Bitcoin, Pepe, OFFICIAL TRUMP; public market data only, no key) are saved in [`data/demo/2026-11-20/`](../data/demo/2026-11-20/) for the judging period, in case the key returns to Basic.

**Two docs-vs-reality mismatches:** `market-pairs/latest` and `price-performance-stats/latest` are documented as "Basic and up", but a live Basic key gets `1006`. Covex learns this at runtime (`lib/cmc/capabilities.ts`), so the same code works on Basic and Startup without changes.

---

## Example responses (trimmed, from real calls)

### `GET /v3/cryptocurrency/quotes/latest?id=1&convert=USD`
Note: `quote` is an **array** of `{symbol, …}`, not the `{ "USD": {…} }` object shown in the docs. Covex normalises both shapes (`normalizeQuoteField`).
```json
{
  "data": [{
    "id": 1, "name": "Bitcoin", "symbol": "BTC", "slug": "bitcoin",
    "circulating_supply": 20113903, "total_supply": 20113903, "max_supply": 21000000,
    "date_added": "2010-07-13T00:00:00.000Z", "num_market_pairs": 12782, "cmc_rank": 1,
    "quote": [{
      "id": 2781, "symbol": "USD", "price": 62886.78301487964,
      "volume_24h": 31765915804.25481, "cex_volume_24h": 31708744400.53467, "dex_volume_24h": 57171403.72013807,
      "percent_change_24h": -0.241904925801, "percent_change_7d": -11.797150279142, "percent_change_30d": -23.635611453453,
      "market_cap": 1264898653543.3367, "fully_diluted_market_cap": 1320622443312.47,
      "last_updated": "2026-11-19T15:48:01.000Z"
    }]
  }],
  "status": { "error_code": "0", "error_message": "", "credit_count": 1 }
}
```

### `GET /v2/cryptocurrency/info?id=24478` (Pepe)
Note: `platform.id` is a **string** (`"1027"`).
```json
{
  "data": { "24478": {
    "id": 24478, "name": "Pepe", "symbol": "PEPE", "category": "token",
    "urls": { "website": ["https://www.pepe.vip/"], "twitter": ["https://twitter.com/pepecoineth"], "explorer": ["https://etherscan.io/token/0x6982508145454ce325ddbe47a25d4ec3d2311933", "…"] },
    "platform": { "id": "1027", "name": "Ethereum", "slug": "ethereum", "token_address": "0x6982508145454ce325ddbe47a25d4ec3d2311933" },
    "contract_address": [{ "contract_address": "0x6982508145454ce325ddbe47a25d4ec3d2311933", "platform": { "name": "Ethereum" } }, "…"]
  } },
  "status": { "error_code": 0, "credit_count": 1 }
}
```

### `GET /v1/dex/security/detail?platformName=ethereum&address=0x6982…1933` (Pepe)
```json
{
  "data": [{
    "platformName": "Ethereum", "platformId": 1,
    "securityLevel": "safe", "categoryLevel": "safe",
    "extra": { "buyTax": "0", "sellTax": "0", "source": "BINANCE" },
    "securityItems": [
      { "code": "Whitelist Restrictions Not Found", "riskCode": "whitelist_function", "riskyLevel": "g", "isHit": false },
      { "code": "Blacklist Restrictions Found", "riskCode": "blacklist_function", "riskyLevel": "y", "isHit": true,
        "des": "Blacklist restrictions allow the contract to restrict users' transactions by blacklisting their addresses." },
      "… 13 more items"
    ],
    "evmDisplay": { "honeypotStatus": "Unknown", "unverifiedContractStatus": "No", "rugPullStatus": "Unknown", "fakeTokenStatus": "Unknown" }
  }],
  "status": { "error_code": "0", "credit_count": 1 }
}
```

### `GET /v1/dex/token/pools?platform=ethereum&address=0x6982…1933&size=20` (Pepe)
Numbers come back as **strings**; Covex converts them.
```json
{
  "data": [{
    "addr": "0xa43fe16908251ee70ef74718545e4fe6c5ccec9f", "exn": "Uniswap v2", "pubAt": "1681492871000",
    "v24": "1807757.49", "liqUsd": "24638589.39",
    "t0": { "sym": "PEPE", "liqUsd": "12300786.99" },
    "t1": { "sym": "WETH", "liqUsd": "12337802.39" },
    "top": true
  }, "…"]
}
```

### `GET /v5/cryptocurrency/ohlcv/historical?id=1&interval=1d&count=30`
Each candle is a 10-value array: open, high, low, close, volume, market cap, time_open, time_high, time_low, time_close. Adding `convert=USD` makes the call fail with `4001 Invalid parameter.` (the same call without `convert` succeeds).
```json
{ "data": [[81853.54, 83287.80, 81107.23, 82941.00, 26999680268.16, 1667028961197.13,
            "2026-10-20T00:00:00.000Z", "2026-10-20T14:58:00.000Z", "2026-10-20T01:15:00.000Z", "2026-10-20T23:59:59.999Z"], "…"] }
```

### `GET /v1/key/info`
```json
{
  "data": {
    "plan": { "credit_limit_monthly": 15000, "credit_limit_monthly_reset_timestamp": "2026-12-01T00:00:00.000Z", "rate_limit_minute": 50 },
    "usage": { "current_minute": { "requests_made": 7, "requests_left": 43 }, "current_day": { "credits_used": 6 }, "current_month": { "credits_used": 24, "credits_left": 14976 } }
  },
  "status": { "error_code": 0, "credit_count": 0 }
}
```

### Plan block (`GET /v2/cryptocurrency/market-pairs/latest`)
```json
{ "status": { "error_code": 1006, "error_message": "Your API Key subscription plan doesn't support this endpoint.", "credit_count": 0 } }
```
