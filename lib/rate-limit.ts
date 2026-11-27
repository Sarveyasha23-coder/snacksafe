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
    // Rate limiting does not depend on optional analytics writes. Keeping
    // analytics disabled avoids extra Redis commands on every request.
    analytics: false
  });
  limiters.set(bucket, limiter);
  return limiter;
}

/**
 * Read the address supplied by the deployment's trusted reverse proxy.
 * Never use arbitrary user input as a rate-limit identity. Configure the host
 * to overwrite/normalize forwarding headers before exposing this application.
 */
function getClientKey(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-forwarded-for");
  const forwardedIp = forwarded?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const candidate = forwardedIp || realIp;
  if (!candidate || candidate.length > 64 || /[\s,]/.test(candidate)) return null;
  return candidate;
}

/**
 * Returns a response when the request must be stopped, otherwise null.
 * Production fails closed if shared rate-limit credentials or a trusted
 * client address are unavailable. Local development remains convenient.
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

  const clientKey = getClientKey(request);
  if (!clientKey) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Request protection could not identify this connection. Please try again later." },
        { status: 503 }
      );
    }
    return null;
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
    console.error("SnackSafe rate-limit service unavailable.", error);
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again shortly." }, { status: 503 });
    }
    return null;
  }
}
