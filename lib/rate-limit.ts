import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

type Bucket = "search" | "barcode" | "analyze";
const limits: Record<Bucket, { requests: number; windowMs: number; redisWindow: `${number} ${"s" | "m" | "h"}` }> = {
  search: { requests: 30, windowMs: 60_000, redisWindow: "1 m" },
  barcode: { requests: 30, windowMs: 60_000, redisWindow: "1 m" },
  analyze: { requests: 20, windowMs: 60_000, redisWindow: "1 m" }
};

let redis: Redis | null = null;
const limiters = new Map<Bucket, Ratelimit>();
type MemoryEntry = { timestamps: number[]; touchedAt: number };
const memoryBuckets = new Map<string, MemoryEntry>();
const MAX_MEMORY_KEYS = 10_000;

function getLimiter(bucket: Bucket): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!redis) redis = new Redis({ url, token });
  const existing = limiters.get(bucket);
  if (existing) return existing;
  const config = limits[bucket];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.requests, config.redisWindow),
    prefix: `snacksafe:ratelimit:${bucket}`,
    analytics: false
  });
  limiters.set(bucket, limiter);
  return limiter;
}

function getClientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-forwarded-for");
  const forwardedIp = forwarded?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const candidate = forwardedIp || realIp;
  return candidate && candidate.length <= 64 && !/[\\s,]/.test(candidate)
    ? candidate
    : "unknown-client";
}

/** Bounded per-instance fallback; shared Redis remains the preferred limiter. */
function enforceMemoryLimit(bucket: Bucket, clientKey: string): boolean {
  const now = Date.now();
  const config = limits[bucket];
  const key = `${bucket}:${clientKey}`;
  let entry = memoryBuckets.get(key);
  if (!entry) {
    if (memoryBuckets.size >= MAX_MEMORY_KEYS) {
      for (const [existingKey, existing] of memoryBuckets) {
        if (now - existing.touchedAt > 2 * 60_000) memoryBuckets.delete(existingKey);
      }
      if (memoryBuckets.size >= MAX_MEMORY_KEYS) {
        const oldest = memoryBuckets.keys().next().value;
        if (oldest) memoryBuckets.delete(oldest);
      }
    }
    entry = { timestamps: [], touchedAt: now };
    memoryBuckets.set(key, entry);
  }
  entry.timestamps = entry.timestamps.filter(timestamp => now - timestamp < config.windowMs);
  entry.touchedAt = now;
  if (entry.timestamps.length >= config.requests) return false;
  entry.timestamps.push(now);
  return true;
}

export async function enforceRateLimit(request: NextRequest, bucket: Bucket): Promise<NextResponse | null> {
  const clientKey = getClientKey(request);
  const limiter = getLimiter(bucket);

  if (!limiter) {
    if (process.env.NODE_ENV === "production") {
      console.error("SnackSafe rate-limit store is not configured; using bounded instance fallback.");
    }
    return enforceMemoryLimit(bucket, clientKey)
      ? null
      : NextResponse.json({ error: "Too many requests. Please wait a moment and try again." }, { status: 429, headers: { "Retry-After": "60" } });
  }

  try {
    const result = await limiter.limit(clientKey);
    const headers = {
      "X-RateLimit-Limit": String(result.limit),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(result.reset)
    };
    if (!result.success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment and try again." },
        { status: 429, headers: { ...headers, "Retry-After": String(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))) } }
      );
    }
    return null;
  } catch (error) {
    console.error("SnackSafe rate-limit service unavailable; using bounded instance fallback.", error);
    return enforceMemoryLimit(bucket, clientKey)
      ? null
      : NextResponse.json({ error: "Too many requests. Please wait a moment and try again." }, { status: 429, headers: { "Retry-After": "60" } });
  }
}
