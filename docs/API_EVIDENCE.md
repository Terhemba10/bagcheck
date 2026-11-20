# API evidence

Real CoinMarketCap API calls made by Covex (then still called Bagcheck), exported 2026-11-19T15:55:23.534Z from http://localhost:3000/evidence.
Responses are trimmed (arrays cut to 3 items). The API key is sent only as a server-side header and is never logged.

## Re-tests after the plan upgrade (20 Nov 2026)

On 20 Nov 2026 `/v1/key/info` reported a paid plan (450,000 credits/month, 600 calls/min). Each endpoint that was blocked on Basic was called once more with the same key:

| Endpoint | Time (UTC) | HTTP | CMC status | Credits |
|---|---|---|---|---|
| `GET /v2/cryptocurrency/price-performance-stats/latest` (ids 1, 24478, 35336) | 2026-11-20T08:50:26Z | 200 | `0` | 1 |
| `GET /v1/cryptocurrency/trending/gainers-losers` | 2026-11-20T08:50:27Z | 200 | `0` | 1 |
| `GET /v1/cryptocurrency/trending/most-visited` | 2026-11-20T08:50:28Z | 200 | `0` | 1 |
| `GET /v2/cryptocurrency/market-pairs/latest` (ids 1, 24478, 35336) | 2026-11-20T08:50Z | 403 | `1006` "Your API Key subscription plan doesn't support this endpoint." | 0 |
| `GET /v2/cryptocurrency/market-pairs/latest` (ids 24478, 1; `limit=5`) | 2026-11-20T09:13Z | 403 | `1006` (same message) | 0 |

Market pairs needs a higher plan than this key (Covex labels it "needs a higher CMC plan (Standard)"). The full responses of the three newly available endpoints are saved in [`data/demo/2026-11-20/`](../data/demo/2026-11-20/).

## Original export (Basic key, 19 Nov 2026)

| Endpoint | Time (UTC) | HTTP | Credits | CMC elapsed |
|---|---|---|---|---|
| `GET /v1/key/info` | 2026-11-19T15:55:06.395Z | 200 | 0 | 6 ms |
| `GET /v5/cryptocurrency/ohlcv/historical` | 2026-11-19T15:55:01.175Z | 200 | 1 | 12 ms |
| `GET /v3/cryptocurrency/quotes/latest` | 2026-11-19T15:55:00.350Z | 200 | 1 | 4 ms |
| `GET /v2/cryptocurrency/info` | 2026-11-19T15:55:00.124Z | 200 | 1 | 59 ms |
| `GET /v1/dex/token-liquidity/query` | 2026-11-19T15:54:59.681Z | 400 | 0 | 181 ms |
| `GET /v1/dex/token/pools` | 2026-11-19T15:54:58.883Z | 200 | 1 | 221 ms |
| `GET /v1/dex/security/detail` | 2026-11-19T15:54:58.047Z | 200 | 1 | 180 ms |
| `GET /v1/cryptocurrency/trending/gainers-losers` | 2026-11-19T15:54:57.561Z | 403 | 0 | 1 ms |
| `GET /v2/cryptocurrency/price-performance-stats/latest` | 2026-11-19T15:54:55.915Z | 403 | 0 | 0 ms |
| `GET /v1/global-metrics/quotes/latest` | 2026-11-19T15:54:55.084Z | 200 | 1 | 9 ms |
| `GET /v2/cryptocurrency/market-pairs/latest` | 2026-11-19T15:54:54.857Z | 403 | 0 | 0 ms |
| `GET /v1/cryptocurrency/map` | 2026-11-19T15:54:52.623Z | 200 | 0 | 22 ms |

## `GET /v1/key/info`

- Called: 2026-11-19T15:55:06.395Z
- Params: `(none)`
- Status: HTTP 200, credit_count 0

```json
{
  "data": {
    "plan": {
      "credit_limit_monthly": 15000,
      "credit_limit_monthly_reset": "In 11 days, 8 hours, 4 minutes",
      "credit_limit_monthly_reset_timestamp": "2026-12-01T00:00:00.000Z",
      "rate_limit_minute": 50
    },
    "usage": {
      "current_minute": {
        "requests_made": 9,
        "requests_left": 41
      },
      "current_day": {
        "credits_used": 25
      },
      "current_month": {
        "credits_used": 43,
        "credits_left": 14957
      }
    }
  },
  "status": {
    "timestamp": "2026-11-19T15:55:10.145Z",
    "error_code": 0,
    "error_message": null,
    "elapsed": 6,
    "credit_count": 0,
    "notice": null
  }
}
```

## `GET /v5/cryptocurrency/ohlcv/historical`

- Called: 2026-11-19T15:55:01.175Z
- Params: `id=1&interval=1d&count=30`
- Status: HTTP 200, credit_count 1

```json
{
  "data": [
    [
      81853.53791171625,
      83287.80409858041,
      81107.23411990245,
      "… 7 more items"
    ],
    [
      82941.0021276786,
      84840.04326249336,
      82543.44271964973,
      "… 7 more items"
    ],
    [
      84011.96842646891,
      84301.28048209668,
      80841.27335905955,
      "… 7 more items"
    ],
    "… 27 more items"
  ],
  "status": {
    "timestamp": "2026-11-19T15:55:04.952Z",
    "error_code": "0",
    "error_message": "",
    "elapsed": 12,
    "credit_count": 1
  }
}
```

## `GET /v3/cryptocurrency/quotes/latest`

- Called: 2026-11-19T15:55:00.350Z
- Params: `id=1&convert=USD`
- Status: HTTP 200, credit_count 1

```json
{
  "data": [
    {
      "tags": [
        {
          "slug": "mineable",
          "name": "Mineable",
          "category": "OTHERS"
        },
        {
          "slug": "pow",
          "name": "PoW",
          "category": "ALGORITHM"
        },
        {
          "slug": "sha-256",
          "name": "SHA-256",
          "category": "ALGORITHM"
        },
        "… 34 more items"
      ],
      "id": 1,
      "name": "Bitcoin",
      "symbol": "BTC",
      "slug": "bitcoin",
      "is_active": 1,
      "infinite_supply": false,
      "is_fiat": 0,
      "circulating_supply": 20113956,
      "total_supply": 20113956,
      "max_supply": 21000000,
      "date_added": "2010-07-13T00:00:00.000Z",
      "num_market_pairs": 12782,
      "cmc_rank": 1,
      "last_updated": "2026-11-19T15:54:48.462Z",
      "tvl_ratio": null,
      "platform": null,
      "self_reported_circulating_supply": null,
      "self_reported_market_cap": null,
      "minted_market_cap": 1265626417673.47,
      "quote": [
        {
          "id": 2781,
          "symbol": "USD",
          "price": 62922.79935749413,
          "volume_24h": 31743021258.265915,
          "volume_change_24h": 9.010134155374,
          "cex_volume_24h": 31686495389.40106,
          "dex_volume_24h": 56525868.864856035,
          "percent_change_1h": -1.263672253289,
          "percent_change_24h": -0.2839633161,
          "percent_change_7d": -11.952808056318,
          "percent_change_30d": -23.614424489684,
          "percent_change_60d": -22.20729323516,
          "percent_change_90d": -18.61430850866,
          "market_cap": 1265626417673.465,
          "market_cap_dominance": 58.9183,
          "fully_diluted_market_cap": 1321378786507.38,
          "minted_market_cap": 1265626417673.47,
          "tvl": null,
          "last_updated": "2026-11-19T15:54:01.000Z"
        }
      ]
    }
  ],
  "status": {
    "timestamp": "2026-11-19T15:55:04.125Z",
    "error_code": "0",
    "error_message": "",
    "elapsed": 4,
    "credit_count": 1
  }
}
```

## `GET /v2/cryptocurrency/info`

- Called: 2026-11-19T15:55:00.124Z
- Params: `id=1&skip_invalid=true`
- Status: HTTP 200, credit_count 1

```json
{
  "data": {
    "1": {
      "id": 1,
      "name": "Bitcoin",
      "symbol": "BTC",
      "category": "coin",
      "description": "Bitcoin (BTC) is a cryptocurrency launched in 2010. Users are able to generate BTC through the process of mining. Bitcoin has a current supply of 20,113,956. Th… (414 chars)",
      "slug": "bitcoin",
      "logo": "https://s2.coinmarketcap.com/static/img/coins/64x64/1.png",
      "subreddit": "bitcoin",
      "notice": "",
      "tags": [
        "mineable",
        "pow",
        "sha-256",
        "… 34 more items"
      ],
      "tag-names": [
        "Mineable",
        "PoW",
        "SHA-256",
        "… 34 more items"
      ],
      "tag-groups": [
        "OTHERS",
        "ALGORITHM",
        "ALGORITHM",
        "… 34 more items"
      ],
      "urls": {
        "website": [
          "https://bitcoin.org/"
        ],
        "twitter": [],
        "message_board": [
          "https://bitcointalk.org"
        ],
        "chat": [],
        "facebook": [],
        "explorer": [
          "https://blockchain.info/",
          "https://live.blockcypher.com/btc/",
          "https://blockchair.com/bitcoin",
          "… 2 more items"
        ],
        "reddit": [
          "https://reddit.com/r/bitcoin"
        ],
        "technical_doc": [
          "https://bitcoin.org/bitcoin.pdf"
        ],
        "source_code": [
          "https://github.com/bitcoin/bitcoin"
        ],
        "announcement": []
      },
      "platform": {
        "id": "1",
        "name": "Bitcoin",
        "symbol": "BTC",
        "slug": "bitcoin"
      },
      "date_added": "2010-07-13T00:00:00.000Z",
      "twitter_username": "",
      "is_hidden": 0,
      "date_launched": "2010-07-13T00:00:00.000Z",
      "infinite_supply": false
    }
  },
  "status": {
    "timestamp": "2026-11-19T15:55:03.901Z",
    "error_code": 0,
    "error_message": null,
    "elapsed": 59,
    "credit_count": 1,
    "notice": null
  }
}
```

## `GET /v1/dex/token-liquidity/query`

- Called: 2026-11-19T15:54:59.681Z
- Params: `platform=ethereum&address=0x6982508145454ce325ddbe47a25d4ec3d2311933&interval=1d&limit=30`
- Status: HTTP 400, credit_count 0, error 400 (Parameter error)

```json
{
  "status": {
    "timestamp": "2026-11-19T15:55:03.457Z",
    "error_code": "400",
    "error_message": "Parameter error",
    "elapsed": 181,
    "credit_count": 0
  }
}
```

## `GET /v1/dex/token/pools`

- Called: 2026-11-19T15:54:58.883Z
- Params: `platform=ethereum&address=0x6982508145454ce325ddbe47a25d4ec3d2311933&size=20`
- Status: HTTP 200, credit_count 1

```json
{
  "data": [
    {
      "addr": "0xa43fe16908251ee70ef74718545e4fe6c5ccec9f",
      "v24": "1805898.12220994700584684",
      "pubAt": "1681492871000",
      "t0": {
        "addr": "0x6982508145454ce325ddbe47a25d4ec3d2311933",
        "lg": "https://s2.coinmarketcap.com/static/img/coins/64x64/24478.png",
        "n": "Pepe",
        "sym": "PEPE",
        "liq": "3253037477438.447479538800505307",
        "liqUsd": "12366830.578316794392618322"
      },
      "t1": {
        "addr": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        "lg": "https://s2.coinmarketcap.com/static/img/coins/64x64/2396.png",
        "n": "Wrapped Ether",
        "sym": "WETH",
        "liq": "6916.822038167306892833",
        "liqUsd": "12331147.018532309499464496"
      },
      "bidx": 0,
      "exid": 1069,
      "exn": "Uniswap v2",
      "liqUsd": "24697977.596849103892082817",
      "fa": "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f",
      "top": true,
      "mi": false
    },
    {
      "addr": "0x11950d141ecb863f01007add7d1a342041227b58",
      "v24": "15648.562809097056041931",
      "pubAt": "1681942955000",
      "t0": {
        "addr": "0x6982508145454ce325ddbe47a25d4ec3d2311933",
        "lg": "https://s2.coinmarketcap.com/static/img/coins/64x64/24478.png",
        "n": "Pepe",
        "sym": "PEPE",
        "liq": "536516674788.820394228624900607",
        "liqUsd": "2039761.055045023627559254"
      },
      "t1": {
        "addr": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        "lg": "https://s2.coinmarketcap.com/static/img/coins/64x64/2396.png",
        "n": "Wrapped Ether",
        "sym": "WETH",
        "liq": "63.876333830831273442",
        "liqUsd": "113902.802965207354980746"
      },
      "bidx": 0,
      "exid": 1348,
      "exn": "Uniswap v3 (Ethereum)",
      "liqUsd": "2153663.85801023098254",
      "fa": "0x1f98431c8ad98523631ae4a59f267346ea31f984",
      "top": true,
      "mi": false
    },
    {
      "addr": "0xce26223d3a383e41c2315f5e360532bf290c513f",
      "v24": "42721.16063190352613128",
      "pubAt": "1792746275000",
      "t0": {
        "addr": "0x6982508145454ce325ddbe47a25d4ec3d2311933",
        "lg": "https://s2.coinmarketcap.com/static/img/coins/64x64/24478.png",
        "n": "Pepe",
        "sym": "PEPE",
        "liq": "31785480081.804120468757755379",
        "liqUsd": "120808.270211531844137073"
      },
      "t1": {
        "addr": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        "lg": "https://s2.coinmarketcap.com/static/img/coins/64x64/2396.png",
        "n": "Wrapped Ether",
        "sym": "WETH",
        "liq": "23.388605857742557356",
        "liqUsd": "41729.948211434506598876"
      },
      "bidx": 0,
      "liqUsd": "162538.218422966350735948",
      "fa": "0xf4fd2e6c5b60c5b365cd1b96dd6245e6d60414c2",
      "top": true,
      "mi": false
    },
    "… 17 more items"
  ],
  "status": {
    "timestamp": "2026-11-19T15:55:02.658Z",
    "error_code": "0",
    "error_message": "",
    "elapsed": 221,
    "credit_count": 1
  }
}
```

## `GET /v1/dex/security/detail`

- Called: 2026-11-19T15:54:58.047Z
- Params: `platformName=ethereum&address=0x6982508145454ce325ddbe47a25d4ec3d2311933`
- Status: HTTP 200, credit_count 1

```json
{
  "data": [
    {
      "platformName": "Ethereum",
      "platformId": 1,
      "tokenContractAddress": "0x6982508145454ce325ddbe47a25d4ec3d2311933",
      "securityLevel": "safe",
      "categoryLevel": "safe",
      "extra": {
        "buyTax": "0",
        "sellTax": "0",
        "source": "BINANCE"
      },
      "securityItems": [
        {
          "code": "Whitelist Restrictions Not Found",
          "riskCode": "whitelist_function",
          "riskyLevel": "g",
          "isHit": false,
          "order": 1,
          "des": "Whitelist restrictions allow the contract to restrict users' transactions by excluding their address from the whitelist.",
          "groupId": "CONTRACT_RISK"
        },
        {
          "code": "Cooling-Off Restrictions Not Found",
          "riskCode": "cooldown_function",
          "riskyLevel": "g",
          "isHit": false,
          "order": 2,
          "des": "Cooling-off period means that users may not be able to buy or sell the token in a certain period of time.",
          "groupId": "CONTRACT_RISK"
        },
        {
          "code": "Blacklist Restrictions Found",
          "riskCode": "blacklist_function",
          "riskyLevel": "y",
          "isHit": true,
          "order": 3,
          "des": "Blacklist restrictions allow the contract to restrict users' transactions by blacklisting their addresses.",
          "groupId": "CONTRACT_RISK"
        },
        "… 13 more items"
      ],
      "evmDisplay": {
        "honeypotStatus": "Unknown",
        "unverifiedContractStatus": "No",
        "rugPullStatus": "Unknown",
        "fakeTokenStatus": "Unknown"
      },
      "tags": []
    }
  ],
  "status": {
    "timestamp": "2026-11-19T15:55:01.739Z",
    "error_code": "0",
    "error_message": "",
    "elapsed": 180,
    "credit_count": 1
  }
}
```

## `GET /v1/cryptocurrency/trending/gainers-losers`

- Called: 2026-11-19T15:54:57.561Z
- Params: `time_period=24h&limit=20&convert=USD`
- Status: HTTP 403, credit_count 0, error 1006 (Your API Key subscription plan doesn't support this endpoint.)

```json
{
  "status": {
    "timestamp": "2026-11-19T15:55:01.338Z",
    "error_code": 1006,
    "error_message": "Your API Key subscription plan doesn't support this endpoint.",
    "elapsed": 1,
    "credit_count": 0,
    "notice": null
  }
}
```

## `GET /v2/cryptocurrency/price-performance-stats/latest`

- Called: 2026-11-19T15:54:55.915Z
- Params: `id=24478&time_period=24h%2C7d%2C30d%2C90d%2Call_time&convert=USD`
- Status: HTTP 403, credit_count 0, error 1006 (Your API Key subscription plan doesn't support this endpoint.)

```json
{
  "status": {
    "timestamp": "2026-11-19T15:54:59.671Z",
    "error_code": 1006,
    "error_message": "Your API Key subscription plan doesn't support this endpoint.",
    "elapsed": 0,
    "credit_count": 0,
    "notice": null
  }
}
```

## `GET /v1/global-metrics/quotes/latest`

- Called: 2026-11-19T15:54:55.084Z
- Params: `convert=USD`
- Status: HTTP 200, credit_count 1

```json
{
  "data": {
    "quote": {
      "USD": {
        "total_market_cap": 2147457578671.9885,
        "total_volume_24h": 70395888100.21,
        "total_volume_24h_reported": 562604926194.73,
        "altcoin_volume_24h": 38680640339.58632,
        "altcoin_volume_24h_reported": 362795824472.0932,
        "altcoin_market_cap": 883052813650.2279,
        "defi_volume_24h": 9424450100.871605,
        "defi_market_cap": 63509353860.43708,
        "defi_volume_24h_reported": 187896720072.76932,
        "defi_24h_percentage_change": -8.1568595225,
        "stablecoin_volume_24h": 73116221914.93495,
        "stablecoin_volume_24h_reported": 549929690092.4813,
        "stablecoin_market_cap": 267958165149.4127,
        "stablecoin_24h_percentage_change": 1.2899850953,
        "derivatives_volume_24h": 784192350954.0917,
        "derivatives_volume_24h_reported": 813217358575.8748,
        "derivatives_24h_percentage_change": -2.2365290038,
        "total_market_cap_yesterday": 2153038267947.3389,
        "total_volume_24h_yesterday": 69422223655.81,
        "total_market_cap_yesterday_percentage_change": -0.25920065,
        "total_volume_24h_yesterday_percentage_change": 1.40252558,
        "last_updated": "2026-11-19T15:53:59.999Z"
      }
    },
    "btc_dominance": 58.879149817883,
    "eth_dominance": 10.093819362735,
    "active_cryptocurrencies": 7961,
    "total_cryptocurrencies": 40238,
    "active_market_pairs": 106573,
    "active_exchanges": 989,
    "total_exchanges": 13434,
    "last_updated": "2026-11-19T15:53:59.999Z",
    "eth_dominance_yesterday": 10.02679959,
    "btc_dominance_yesterday": 58.95728886,
    "eth_dominance_24h_percentage_change": 0.067019772735,
    "btc_dominance_24h_percentage_change": -0.078139042117,
    "defi_volume_24h": 9424450100.871605,
    "defi_volume_24h_reported": 187896720072.76932,
    "defi_market_cap": 63509353860.43708,
    "defi_24h_percentage_change": -8.1568595225,
    "stablecoin_volume_24h": 73116221914.93495,
    "stablecoin_volume_24h_reported": 549929690092.4813,
    "stablecoin_market_cap": 267958165149.4127,
    "stablecoin_24h_percentage_change": 1.289985095268,
    "derivatives_volume_24h": 784192350954.0917,
    "derivatives_volume_24h_reported": 813217358575.8748,
    "derivatives_24h_percentage_change": -2.23652900376,
    "total_crypto_dex_currencies": 66502153,
    "today_incremental_crypto_number": 0,
    "past_24h_incremental_crypto_number": 75967,
    "past_7d_incremental_crypto_number": 410584,
    "past_30d_incremental_crypto_number": 2079903,
    "today_change_percent": 0.000090222724,
    "tracked_yearly_number": {
      "maxIncrementalNumber": 7681147,
      "minIncrementalNumber": 61,
      "maxIncrementalDate": "2026-03-19T00:00:00.000Z",
      "minIncrementalDate": "2026-11-19T00:00:00.000Z"
    }
  },
  "status": {
    "timestamp": "2026-11-19T15:54:58.860Z",
    "error_code": 0,
    "error_message": null,
    "elapsed": 9,
    "credit_count": 1,
    "notice": null
  }
}
```

## `GET /v2/cryptocurrency/market-pairs/latest`

- Called: 2026-11-19T15:54:54.857Z
- Params: `id=24478&limit=20&category=spot&sort=cmc_rank_advanced&aux=effective_liquidity%2Cmarket_score%2Cmarket_reputation%2Cnum_market_pairs%2Cmarket_url&convert=USD`
- Status: HTTP 403, credit_count 0, error 1006 (Your API Key subscription plan doesn't support this endpoint.)

```json
{
  "status": {
    "timestamp": "2026-11-19T15:54:58.634Z",
    "error_code": 1006,
    "error_message": "Your API Key subscription plan doesn't support this endpoint.",
    "elapsed": 0,
    "credit_count": 0,
    "notice": null
  }
}
```

## `GET /v1/cryptocurrency/map`

- Called: 2026-11-19T15:54:52.623Z
- Params: `listing_status=active&aux=is_active`
- Status: HTTP 200, credit_count 0

```json
{
  "data": [
    {
      "id": 1,
      "name": "Bitcoin",
      "symbol": "BTC",
      "slug": "bitcoin",
      "rank": 1,
      "is_active": 1
    },
    {
      "id": 2,
      "name": "Litecoin",
      "symbol": "LTC",
      "slug": "litecoin",
      "rank": 21,
      "is_active": 1
    },
    {
      "id": 3,
      "name": "Namecoin",
      "symbol": "NMC",
      "slug": "namecoin",
      "rank": 797,
      "is_active": 1
    },
    "… 7946 more items"
  ],
  "status": {
    "timestamp": "2026-11-19T15:54:56.068Z",
    "error_code": 0,
    "error_message": null,
    "elapsed": 22,
    "credit_count": 0,
    "notice": null
  }
}
```
