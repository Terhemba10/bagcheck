# CMC API feedback (running log)

Notes on what the CoinMarketCap API made possible and where it got in the way. This feeds the submission note.

## What it made possible
- **DEX security detail** (`/v1/dex/security/detail`): honeypot, buy/sell tax, mintable/freezable and "flagged by vendor" checks in one call. This lets Bagcheck show contract-level warning signs, not just market data.
- **DEX liquidity history** (`/v1/dex/token-liquidity/query`): a real time series for liquidity, so "liquidity draining" alerts compare against history instead of waiting days for our own snapshots.
- **`/v1/key/info` costs no credits**, so the app can budget its own background monitoring and degrade safely when the key moves to a smaller plan.
- `/v1/cryptocurrency/map` costs no credits, which makes search cheap.

## Where it got in the way
- **Docs (19 Nov 2026):** the pricing page has an endpoint matrix, but it doesn't clearly say which tier each endpoint is in. Tier info sits on each endpoint's reference page instead, and some DEX endpoints (`/v1/dex/search`, `/v1/dex/liquidity-change/list`) don't show a tier at all.
- **Version drift:** quotes are now documented at `/v3/cryptocurrency/quotes/latest`. Older guides, and our brief, use `/v2`. The v3 status object uses string error codes (`"0"`, `""`), while v1/v2 use numbers (`0`, `null`), so our classifier has to handle both.
- **Market-pair depth fields:** the current reference doesn't list `depth_negative_two` / `depth_positive_two` for `/v2/cryptocurrency/market-pairs/latest`, so price-impact estimates may have to come from DEX pool liquidity instead. *(To be checked on the first live call.)*
- **Global metrics** has no `total_market_cap` percent-change field in the documented example, so "price vs market" needs another source (e.g. BTC/ETH change or `*_yesterday_percentage_change` if present). *(To be checked live.)*
- **Basic plan daily limit:** `/v1/key/info` reports `current_day.credits_left`, but the pricing page doesn't publish the daily figure for Basic.
- **The full id map is several MB.** We store a compact copy (id/name/symbol/slug/rank) because the raw response is too large for a free Redis value.
- DEX endpoint abbreviations (`liq`, `hld`, `own`, `sts`) aren't explained in the reference.
