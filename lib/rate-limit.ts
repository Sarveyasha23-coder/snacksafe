import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

type Bucket = "search" | "barcode" | "analyze";
const limits: Record<Bucket, { requests: number; window: `${number} ${"s" | "m" | "h"}` }> = {
  search: { requests: 30, window: "1 m" },
  barcode: { requests: 30, window: "1 m" },
  analyze: { requests: 20, window: "1 m" }
};

let redis: Redis | null = null;
const limiters = new Map<Bucket, Ratelimit>();

// Bounded per-instance fallback: keeps core product features available during
// a transient Upstash outage while retaining a basic sliding-window guard.
// Vercel instances do not share this memory, so Redis remains the primary store.
const fallbackEvents = new Map<string, number[]>();
const MAX_FALLBACK_KEYS = 5000;

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
    limiter: Ratelimit.slidingWindow(config.requests, config.window),
    prefix: `snacksafe:ratelimit:${bucket}`,
    analytics: false
  });
  limiters.set(bucket, limiter);
  return limiter;
}

/** Prefer the address supplied by Vercel's trusted proxy. */
function getClientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-forwarded-for");
  const forwardedIp = forwarded?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const candidate = forwardedIp || realIp;
  // If a proxy omits the address, use a shared fallback bucket rather than
  // taking the entire product API offline.
  if (!candidate || candidate.length > 64 || /[\\s,]/.test(candidate)) return "unknown-client";
  return candidate;
}

function enforceLocalFallback(clientKey: string, bucket: Bucket): NextResponse | null {
  const config = limits[bucket];
  const windowMs = 60_000;
  const now = Date.now();
  const key = `${bucket}:${clientKey}`;
  const recent = (fallbackEvents.get(key) ?? []).filter(timestamp => now - timestamp < windowMs);
  if (recent.length >= config.requests) {
    fallbackEvents.set(key, recent);
    const reset = recent[0] + windowMs;
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((reset - now) / 1000))), "X-RateLimit-Limit": String(config.requests), "X-RateLimit-Remaining": "0" } }
    );
  }
  recent.push(now);
  if (fallbackEvents.size >= MAX_FALLBACK_KEYS && !fallbackEvents.has(key)) {
    const oldest = fallbackEvents.keys().next().value;
    if (oldest) fallbackEvents.delete(oldest);
  }
  fallbackEvents.set(key, recent);
  return null;
}

/**
 * Uses shared Upstash rate limiting when available, then a bounded local
 * fallback during configuration gaps or transient Redis failures. The fallback
 * is per server instance and is intentionally not presented as distributed.
 */
export async function enforceRateLimit(request: NextRequest, bucket: Bucket): Promise<NextResponse | null> {
  const clientKey = getClientKey(request);
  const limiter = getLimiter(bucket);
  if (!limiter) {
    if (process.env.NODE_ENV === "production") {
      console.warn("SnackSafe rate-limit store is not configured; using bounded instance fallback.");
    }
    return enforceLocalFallback(clientKey, bucket);
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
    return enforceLocalFallback(clientKey, bucket);
  }
}
