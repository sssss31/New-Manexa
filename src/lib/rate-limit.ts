// Enterprise rate limiter.
//
// When UPSTASH_REDIS_REST_URL/TOKEN are set → Upstash sliding-window (shared,
// correct across all Vercel serverless instances). Otherwise → in-memory
// fallback (per-instance; fine for local/dev, INADEQUATE on serverless — a
// startup warning is emitted once). Same async interface either way, so the
// call sites never care which backend is active.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { prisma } from "./prisma";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const redisEnabled = Boolean(url && token);

const redis = redisEnabled ? new Redis({ url: url!, token: token! }) : null;

// One Upstash limiter per (limit, windowSec) shape, memoized.
const limiters = new Map<string, Ratelimit>();
function limiterFor(limit: number, windowSec: number): Ratelimit {
  const k = `${limit}:${windowSec}`;
  let rl = limiters.get(k);
  if (!rl) {
    rl = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s` as `${number} s`),
      prefix: "mnx:rl",
      analytics: false,
    });
    limiters.set(k, rl);
  }
  return rl;
}

// ---- in-memory fallback (per-instance) ----
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
function memoryAllow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
}, 60_000).unref?.();

let warned = false;
function warnOnce() {
  if (!warned && process.env.NODE_ENV === "production") {
    warned = true;
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "rate limiter: UPSTASH_REDIS_REST_URL/TOKEN not set — using per-instance in-memory limiter, which is INEFFECTIVE on serverless. Set Upstash env vars for real protection.",
      })
    );
  }
}

// ---- durable DB fallback (cross-instance, no Redis needed) ----
// For LOW-frequency sensitive buckets (login/signup) only — one insert + one
// count per call. High-frequency buckets (face/api) must NOT use this.
async function dbAllow(key: string, limit: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  try {
    const recent = await prisma.rateLimitHit.count({ where: { key, at: { gte: since } } });
    if (recent >= limit) return false;
    await prisma.rateLimitHit.create({ data: { key } });
    // Opportunistic prune (~4% of calls) so the table doesn't grow unbounded.
    if (Math.random() < 0.04) {
      await prisma.rateLimitHit
        .deleteMany({ where: { at: { lt: new Date(Date.now() - 24 * 3600_000) } } })
        .catch(() => {});
    }
    return true;
  } catch {
    // DB unavailable → fall back to in-memory rather than lock everyone out.
    return memoryAllow(key, limit, windowMs);
  }
}

/**
 * Returns true if the request is ALLOWED (under the limit). Async.
 * Backend order: Upstash (if configured) → durable DB (opts.durable) → in-memory.
 * Pass `{ durable: true }` for login/signup so brute-force protection survives
 * on serverless even without Upstash.
 *
 *   if (!(await checkRateLimit(`login:${email}`, 5, 5*60_000, { durable: true }))) return locked();
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  opts?: { durable?: boolean }
): Promise<boolean> {
  if (redis) {
    try {
      const { success } = await limiterFor(limit, Math.max(1, Math.round(windowMs / 1000))).limit(key);
      return success;
    } catch {
      // Redis unreachable → fall through to the next available backend.
      if (opts?.durable) return dbAllow(key, limit, windowMs);
      return memoryAllow(key, limit, windowMs);
    }
  }
  // No Redis: durable buckets use the DB (works on serverless); the rest fall
  // back to the per-instance memory limiter (still emits the prod warning).
  if (opts?.durable) return dbAllow(key, limit, windowMs);
  warnOnce();
  return memoryAllow(key, limit, windowMs);
}

/** Named presets so every sensitive surface uses consistent, tuned limits. */
export const RATE_LIMITS = {
  login: { limit: 5, windowMs: 5 * 60_000 },
  signup: { limit: 5, windowMs: 10 * 60_000 },
  passwordReset: { limit: 3, windowMs: 15 * 60_000 },
  otp: { limit: 5, windowMs: 5 * 60_000 },
  ai: { limit: 30, windowMs: 60_000 },
  upload: { limit: 20, windowMs: 60_000 },
  api: { limit: 120, windowMs: 60_000 },
} as const;

/** @deprecated synchronous in-memory only — use `checkRateLimit` (async). Kept
 *  for any legacy sync caller; does NOT use Redis. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  return memoryAllow(key, limit, windowMs);
}
