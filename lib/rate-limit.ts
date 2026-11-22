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
    analytics: true
  });
  limiters.set(bucket, limiter);
  return limiter;
}

function getClientKey(request: NextRequest): string {
  // On Vercel, x-forwarded-for is supplied by the trusted platform proxy.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwarded || realIp || "unknown";
}

/**
 * Returns a response when the request must be stopped, otherwise null.
 * Production fails closed if shared rate-limit credentials are missing.
 */
export async function enforceRateLimit(request: NextRequest, bucket: Bucket): Promise<NextResponse | null> {
  const limiter = getLimiter(bucket);
  if (!limiter) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Service configuration is incomplete. Please try again later." },
        { status: 503, headers: { "Retry-After": "60" } }
      );
    }
    return null;
  }

  try {
    const result = await limiter.limit(getClientKey(request));
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
    console.error("SnackSafe rate-limit service unavailable.", error);
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again shortly." }, { status: 503 });
    }
    return null;
  }
}
