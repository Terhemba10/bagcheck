import { Redis } from "@upstash/redis";

/**
 * Tiny key/value facade. Uses Upstash Redis when configured, otherwise an
 * in-memory store (fine for local dev and tests, not for production: memory is
 * per serverless instance).
 */
export interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Push to the front of a list and keep only the newest `max` items. */
  pushCapped<T>(key: string, value: T, max: number): Promise<void>;
  list<T>(key: string, count: number): Promise<T[]>;
  /** Atomically add 1 and return the new value; the TTL is set when the key is created. */
  incr(key: string, ttlSeconds: number): Promise<number>;
}

class MemoryKV implements KV {
  private map = new Map<string, { value: unknown; expires: number | null }>();

  async get<T>(key: string): Promise<T | null> {
    const hit = this.map.get(key);
    if (!hit) return null;
    if (hit.expires !== null && hit.expires < Date.now()) {
      this.map.delete(key);
      return null;
    }
    return structuredClone(hit.value) as T;
  }
  async set<T>(key: string, value: T, ttlSeconds?: number) {
    this.map.set(key, {
      value: structuredClone(value),
      expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }
  async del(key: string) {
    this.map.delete(key);
  }
  async pushCapped<T>(key: string, value: T, max: number) {
    const current = ((await this.get<T[]>(key)) ?? []) as T[];
    current.unshift(value);
    await this.set(key, current.slice(0, max));
  }
  async list<T>(key: string, count: number): Promise<T[]> {
    return ((await this.get<T[]>(key)) ?? []).slice(0, count);
  }
  async incr(key: string, ttlSeconds: number): Promise<number> {
    const hit = this.map.get(key);
    if (!hit || (hit.expires !== null && hit.expires < Date.now())) {
      this.map.set(key, { value: 1, expires: Date.now() + ttlSeconds * 1000 });
      return 1;
    }
    hit.value = (hit.value as number) + 1;
    return hit.value as number;
  }
}

class UpstashKV implements KV {
  constructor(private redis: Redis) {}
  async get<T>(key: string) {
    return (await this.redis.get<T>(key)) ?? null;
  }
  async set<T>(key: string, value: T, ttlSeconds?: number) {
    if (ttlSeconds) await this.redis.set(key, value, { ex: ttlSeconds });
    else await this.redis.set(key, value);
  }
  async del(key: string) {
    await this.redis.del(key);
  }
  async pushCapped<T>(key: string, value: T, max: number) {
    await this.redis.pipeline().lpush(key, value).ltrim(key, 0, max - 1).exec();
  }
  async list<T>(key: string, count: number) {
    return (await this.redis.lrange<T>(key, 0, count - 1)) ?? [];
  }
  async incr(key: string, ttlSeconds: number) {
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, ttlSeconds);
    return n;
  }
}

let instance: KV | null = null;

// Next.js can load this module more than once per process (pages and route
// handlers are bundled separately), so the in-memory store lives on globalThis
// to keep one shared copy.
const g = globalThis as unknown as { __bagcheckMemoryKV?: MemoryKV };

/** Upstash's own variable names, or the ones Vercel's Upstash integration sets. */
function redisEnv() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
  };
}

export function kv(): KV {
  if (instance) return instance;
  const { url, token } = redisEnv();
  if (url && token) instance = new UpstashKV(new Redis({ url, token }));
  else instance = g.__bagcheckMemoryKV ??= new MemoryKV();
  return instance;
}

export function storeBackend(): "upstash" | "memory" {
  const { url, token } = redisEnv();
  return url && token ? "upstash" : "memory";
}

/** Test helper: swap the store. */
export function __setKV(next: KV | null) {
  instance = next;
}

export function memoryKV(): KV {
  return new MemoryKV();
}
