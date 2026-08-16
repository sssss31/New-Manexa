// General-purpose read cache for expensive, tenant-scoped aggregates (dashboard
// KPIs, health score, analytics). Tiered exactly like the rate limiter:
//   UPSTASH_REDIS_REST_URL/TOKEN set → Upstash Redis (shared across all
//   serverless instances) · otherwise → per-process in-memory TTL map.
// NEVER cache auth/session/live-mutating data here — only slow-moving reads.
// A cache failure never breaks the caller: it just computes fresh.
import { Redis } from "@upstash/redis";
import { logger } from "./logger";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

export function cacheBackend(): "redis" | "memory" {
  return redis ? "redis" : "memory";
}

// ── in-memory fallback (per-process; fine for a single instance / local dev) ──
type Entry = { value: unknown; expiresAt: number };
const mem = new Map<string, Entry>();
const MEM_MAX = 1000;

function memGet<T>(key: string): T | null {
  const e = mem.get(key);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    mem.delete(key);
    return null;
  }
  return e.value as T;
}
function memSet<T>(key: string, value: T, ttlSec: number) {
  if (mem.size >= MEM_MAX) {
    // Cheap eviction: drop the first (oldest-inserted) key.
    const first = mem.keys().next().value;
    if (first !== undefined) mem.delete(first);
  }
  mem.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

async function readCache<T>(key: string): Promise<T | null> {
  if (!redis) return memGet<T>(key);
  try {
    const v = await redis.get<T>(key);
    return v ?? null;
  } catch (e) {
    logger.warn("cache read failed — computing fresh", { key, err: (e as Error)?.message });
    return null;
  }
}

async function writeCache<T>(key: string, value: T, ttlSec: number): Promise<void> {
  if (!redis) {
    memSet(key, value, ttlSec);
    return;
  }
  try {
    await redis.set(key, value, { ex: ttlSec });
  } catch (e) {
    logger.warn("cache write failed", { key, err: (e as Error)?.message });
  }
}

/**
 * Return a cached value or compute + store it. The computed value must be
 * JSON-serialisable (no Date/Map/Set) so it survives Redis. `compute` should
 * never return null (null is treated as a miss and won't be cached).
 */
export async function cached<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  const hit = await readCache<T>(key);
  if (hit !== null) return hit;
  const fresh = await compute();
  if (fresh !== null && fresh !== undefined) await writeCache(key, fresh, ttlSeconds);
  return fresh;
}

/** Invalidate a cache key (e.g. after a mutation that must reflect immediately). */
export async function bustCache(key: string): Promise<void> {
  if (!redis) {
    mem.delete(key);
    return;
  }
  try {
    await redis.del(key);
  } catch {
    /* best-effort */
  }
}
