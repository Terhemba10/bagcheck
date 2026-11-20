# CoinMarketCap API feedback

What we ran into while building Covex on the CMC API (Nov 2026), written so the CMC team can act on it. Everything below was found with live calls on a **Basic** key (15,000 credits/month, 50 calls/min) unless noted. The real call log is in [`API_EVIDENCE.md`](API_EVIDENCE.md), and per-endpoint status is in [`ENDPOINTS.md`](ENDPOINTS.md).

## Summary for the submission note

1. **Two endpoints documented as "Basic and up" return `1006` on a Basic key:** `/v2/cryptocurrency/market-pairs/latest` and `/v2/cryptocurrency/price-performance-stats/latest`. Trending is blocked too, as documented.
2. **v3 quotes return `quote` as an array**, but the docs show an object keyed by currency.
3. **v5 OHLCV rejects `convert=USD`** with a bare `4001 Invalid parameter`, and gives no hint which parameter is wrong.
4. **`/v1/dex/token-liquidity/query` returned `400 Parameter error` for every parameter set we tried.** The reference doesn't list the allowed values.
5. **Market-pair depth fields (`depth_negative_two` / `depth_positive_two`) aren't in the current reference**, and we couldn't confirm them live because the endpoint is blocked on Basic. Our price-impact estimate uses DEX pool liquidity instead.
6. **Types and status objects drift between versions:** error codes are numbers in v1/v2 and strings in v3/v5/DEX, and `platform.id` is a string in info but a number in DEX security.
7. **The free DEX endpoints were the highlight:** security detail and token pools work on Basic and made contract warning signs and "can I still sell?" possible.

## Plan access (Basic key, 19–20 Nov 2026)

| Endpoint | Docs say | Live on Basic |
|---|---|---|
| `/v2/cryptocurrency/market-pairs/latest` | Basic and up | `1006` "Your API Key subscription plan doesn't support this endpoint." |
| `/v2/cryptocurrency/price-performance-stats/latest` | Basic and up | `1006` |
| `/v1/cryptocurrency/trending/gainers-losers`, `/most-visited` | Startup | `1006` (as documented) |
| `/v1/dex/security/detail`, `/v1/dex/token/pools` | not stated on every page | ✅ works |
| `/v3/cryptocurrency/listings/latest`, `/v3/.../quotes/latest`, `/v2/.../info`, `/v5/.../ohlcv/historical`, `/v1/global-metrics/quotes/latest` | Basic | ✅ works |

- `1006` responses cost 0 credits, which made it safe to detect plan access at runtime. Covex marks an endpoint as unavailable for 24 h after a `1006` and labels the feature in the UI ("needs a paid CoinMarketCap plan"), so the same code runs on Basic and Startup.
- **Suggestion:** one machine-readable list of endpoints per plan (or a field in `/v1/key/info` listing what the key can call) would remove the guesswork. The pricing page's matrix and the per-endpoint reference pages don't fully agree, and some DEX pages (`/v1/dex/search`, `/v1/dex/liquidity-change/list`) show no tier at all.
- The Basic **daily** credit limit isn't published. `/v1/key/info` reports `current_day.credits_used`, but not a daily allowance for Basic, so we set our own cap of 400 per day.

## Response shapes

- **v3 quotes (`/v3/cryptocurrency/quotes/latest`):** `quote` is an **array** (`[{ "symbol": "USD", "price": … }]`), while the docs (and v2) show an object keyed by currency (`{ "USD": { … } }`). A strict schema silently dropped all prices until we normalised both shapes.
- **v3 status object:** `error_code` is a string (`"0"`), and `error_message` is `""` rather than `null`. In v1/v2 it's a number (`0`) and `null`. Any client sharing one error classifier across versions has to handle both.
- **v2 info:** `platform.id` is a string (`"1027"`), but `/v1/dex/security/detail` uses a numeric `platformId`.
- **DEX pools (`/v1/dex/token/pools`):** numbers arrive as strings (`"liqUsd": "24638589.39…"`), and keys are abbreviated (`exn`, `v24`, `t0`, `t1`, `pubAt`, `liq`, `hld`, `own`, `sts`) with no glossary in the reference.
- **DEX pools need filtering to be meaningful.** Many pools pair a token with another tiny token (for Pepe: ARRKY, LOOP, KEK, and others). Their "liquidity" is priced from that tiny token, so a raw sum overstates what can be sold. We count only pools paired with major assets (ETH/WETH, stablecoins, BTC wrappers, native L1 tokens) and show the rest as "not counted". A `quoteAsset` classification, or a "paired with major asset" flag, would help.
- **DEX security taxes have no unit:** `extra.buyTax` / `extra.sellTax` are strings (`"0"`), with no note on whether `"0.05"` means 5% or 0.05%. We read values below 1 as fractions, and show the computed % next to the raw value.
- **DEX `platform` names aren't listed.** `ethereum` and `solana` work for pools and security (verified). Other chains are mapped from the `/v2/cryptocurrency/info` platform name and are unverified.

## Parameters

- **History currency (`/v5/cryptocurrency/ohlcv/historical`):** `convert=USD` returns `4001 Invalid parameter.` with no `error_detail`. The same call without `convert` works and returns USD. Other v5 validation errors are helpful (e.g. "interval must be one of [15m, 1h, 4h, 1d, 1w, 1M]"), so this one stands out. Older docs and guides still pass `convert`.
- **Liquidity history (`/v1/dex/token-liquidity/query`):** every combination returned `400 Parameter error`:
  - `platform` as name, slug and id;
  - `interval` as `1h`, `4h`, `1d`, `1D`, `day` and `24h`;
  - with and without `limit`;
  - `to` in seconds and in milliseconds;
  - with and without `needLatest`.

  The reference lists no allowed values, and its example has no parameters. We would have used this for the "liquidity draining" alert. Instead, Covex stores its own snapshots of `/v1/dex/token/pools` liquidity and compares those. **Suggestion:** a working example request and an `error_detail` naming the bad parameter.
- **Version drift:** quotes and listings are documented at `/v3/...`, but many guides (and our own first plan) use `/v2/...`. A short migration note would help.

## Fields we wanted but couldn't confirm

- **Market-pair depth** (`depth_negative_two` / `depth_positive_two`, ±2% order-book depth): useful for "how much can I sell before the price drops 2%?", but missing from the current reference for `/v2/cryptocurrency/market-pairs/latest`, and we couldn't confirm it live because that endpoint is blocked on Basic. Covex's rescue estimate uses a 50/50 pool model on DEX liquidity instead, and is labelled as an estimate.
- **Global metrics:** the documented example has no percent change for total market cap. For "versus the market" we compare with Bitcoin's 7- and 30-day change from the quotes call.

## What worked well

- **`/v1/key/info` and `/v1/cryptocurrency/map` cost 0 credits.** This let Covex budget its own background monitoring (it adapts the schedule to the credits left) and keep search free.
- **DEX security detail on the free plan:** honeypot, taxes, blacklist, mintable/freezable and vendor flags in one call. This is what lets a beginner see contract-level warning signs.
- **DEX token pools on the free plan:** live liquidity per pool, which powers "Can I still sell?", the price-impact estimate and the liquidity alert.
- **v3 quotes split `cex_volume_24h` and `dex_volume_24h`**, which is useful for spotting coins that trade on only one kind of venue.
- **`/v2/cryptocurrency/info` gives official website and whitepaper links**, so the Promise check reads promises from the project's own pages rather than a third party.
- **Batched quotes** (many ids in one call) keep a 10-coin watchlist check to about 1 credit.

## Practical notes

- The full `/v1/cryptocurrency/map` response is several MB, too large for a free Redis value. We store a compact copy (id, name, symbol, slug, rank).
- Rate limit (50/min) was never the bottleneck. Credits were, which is why caching and the governor matter more than throttling.
