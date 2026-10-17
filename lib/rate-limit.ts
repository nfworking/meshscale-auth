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
