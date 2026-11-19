import { z } from "zod";

/**
 * Typed shapes for the CMC fields Bagcheck relies on. Schemas are lenient
 * (unknown keys pass through, most fields nullable) because CMC returns many
 * nulls for small coins. We validate what we use and nothing more.
 */
const num = z.number().nullable().optional();
const str = z.string().nullable().optional();

export const MapEntry = z.looseObject({
  id: z.number(),
  name: z.string(),
  symbol: z.string(),
  slug: z.string(),
  rank: num,
  is_active: num,
  first_historical_data: str,
  last_historical_data: str,
  platform: z
    .looseObject({ id: num, name: str, symbol: str, slug: str, token_address: str })
    .nullable()
    .optional(),
});
export type MapEntry = z.infer<typeof MapEntry>;

export const CoinInfo = z.looseObject({
  id: z.number(),
  name: z.string(),
  symbol: z.string(),
  slug: z.string(),
  category: str,
  description: str,
  logo: str,
  date_added: str,
  date_launched: str,
  tags: z.array(z.string()).nullable().optional(),
  urls: z
    .looseObject({
      website: z.array(z.string()).optional(),
      technical_doc: z.array(z.string()).optional(),
      twitter: z.array(z.string()).optional(),
      reddit: z.array(z.string()).optional(),
      message_board: z.array(z.string()).optional(),
      announcement: z.array(z.string()).optional(),
      chat: z.array(z.string()).optional(),
      explorer: z.array(z.string()).optional(),
      source_code: z.array(z.string()).optional(),
    })
    .optional(),
  platform: z
    .looseObject({ id: num, name: str, slug: str, symbol: str, token_address: str })
    .nullable()
    .optional(),
  contract_address: z
    .array(
      z.looseObject({
        contract_address: z.string(),
        platform: z.looseObject({ name: str, coin: z.looseObject({ id: z.union([z.string(), z.number()]).optional(), slug: str, symbol: str }).optional() }).optional(),
      }),
    )
    .optional(),
});
export type CoinInfo = z.infer<typeof CoinInfo>;

export const UsdQuote = z.looseObject({
  price: num,
  volume_24h: num,
  volume_change_24h: num,
  percent_change_1h: num,
  percent_change_24h: num,
  percent_change_7d: num,
  percent_change_30d: num,
  percent_change_90d: num,
  market_cap: num,
  market_cap_dominance: num,
  fully_diluted_market_cap: num,
  last_updated: str,
});
export type UsdQuote = z.infer<typeof UsdQuote>;

export const CoinQuote = z.looseObject({
  id: z.number(),
  name: z.string(),
  symbol: z.string(),
  slug: z.string(),
  cmc_rank: num,
  num_market_pairs: num,
  date_added: str,
  circulating_supply: num,
  total_supply: num,
  max_supply: num,
  infinite_supply: z.boolean().nullable().optional(),
  self_reported_circulating_supply: num,
  self_reported_market_cap: num,
  last_updated: str,
  quote: z.record(z.string(), UsdQuote),
});
export type CoinQuote = z.infer<typeof CoinQuote>;

export const MarketPair = z.looseObject({
  exchange: z.looseObject({ id: num, name: z.string(), slug: str }),
  market_id: num,
  market_pair: z.string(),
  category: str,
  fee_type: str,
  market_url: str,
  market_score: z.union([z.number(), z.string()]).nullable().optional(),
  market_reputation: num,
  outlier_detected: num,
  quote: z.record(
    z.string(),
    z.looseObject({
      price: num,
      volume_24h: num,
      effective_liquidity: num,
      depth_negative_two: num,
      depth_positive_two: num,
      last_updated: str,
    }),
  ),
});
export type MarketPair = z.infer<typeof MarketPair>;

export const MarketPairs = z.looseObject({
  id: z.number(),
  name: z.string(),
  symbol: z.string(),
  num_market_pairs: num,
  market_pairs: z.array(MarketPair),
});
export type MarketPairs = z.infer<typeof MarketPairs>;

export const GlobalMetrics = z.looseObject({
  btc_dominance: num,
  eth_dominance: num,
  active_cryptocurrencies: num,
  active_exchanges: num,
  active_market_pairs: num,
  last_updated: str,
  quote: z.record(
    z.string(),
    z.looseObject({
      total_market_cap: num,
      total_volume_24h: num,
      total_market_cap_yesterday_percentage_change: num,
      total_volume_24h_yesterday_percentage_change: num,
      altcoin_market_cap: num,
      last_updated: str,
    }),
  ),
});
export type GlobalMetrics = z.infer<typeof GlobalMetrics>;
