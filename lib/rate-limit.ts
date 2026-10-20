import Redis from "ioredis";

/**
 * Rate limits that hold across serverless instances. Better Auth's default counter lives in memory, which on Vercel means
 * one counter per instance, so a limit of 5 becomes 5 per instance. This keeps the counters in Redis (Upstash, over TCP).
 *
 * It is used only when REDIS_URL is set (production); local development keeps the in-memory counter.
 * If Redis cannot be reached the request is allowed: sign-in must not go down with the counter.
 */
const g = globalThis as unknown as { __authRedis?: Redis };

function client() {
  g.__authRedis ??= new Redis(process.env.REDIS_URL!, {
    keyPrefix: "auth:rl:",
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    commandTimeout: 1500,
  });
  g.__authRedis.on("error", () => {});
  return g.__authRedis;
}

export const redisRateLimit = {
  async consume(key: string, rule: { window: number; max: number }) {
    try {
      const redis = client();
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, rule.window);
      if (count <= rule.max) return { allowed: true, retryAfter: null };
      const ttl = await redis.ttl(key);
      return { allowed: false, retryAfter: ttl > 0 ? ttl : rule.window };
    } catch (error) {
      console.error("[auth] rate limit store unavailable, allowing the request:", error instanceof Error ? error.message : error);
      return { allowed: true, retryAfter: null };
    }
  },
};

/** Used when Redis is not configured or cannot be reached: counts per server instance, which is better than not counting. */
const local = new Map<string, { count: number; until: number }>();

function bumpLocal(key: string, windowSeconds: number) {
  const now = Date.now();
  if (local.size > 5000) for (const [k, v] of local) if (v.until < now) local.delete(k);
  const entry = local.get(key);
  if (!entry || entry.until < now) {
    local.set(key, { count: 1, until: now + windowSeconds * 1000 });
    return 1;
  }
  return ++entry.count;
}

/**
 * A counter for one key over a window, for limits Better Auth's per-path rules cannot express (for example, failed
 * password attempts for one email address across every IP). Returns how many attempts there have been, including this one.
 * Without Redis it counts in this instance's memory: sign-in must not go down with the counter.
 */
export async function bump(key: string, windowSeconds: number) {
  if (!process.env.REDIS_URL) return bumpLocal(key, windowSeconds);
  try {
    const redis = client();
    const count = await redis.incr(`attempts:${key}`);
    if (count === 1) await redis.expire(`attempts:${key}`, windowSeconds);
    return count;
  } catch {
    return bumpLocal(key, windowSeconds);
  }
}

export async function clearAttempts(key: string) {
  local.delete(key);
  if (!process.env.REDIS_URL) return;
  try {
    await client().del(`attempts:${key}`);
  } catch {}
}
