import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Check = "ok" | "missing" | "error";

export async function GET() {
  const checks: { database: Check; rateLimitStore: Check } = {
    database: "missing",
    rateLimitStore: "missing"
  };

  const prisma = getPrisma();
  if (prisma) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch (error) {
      checks.database = "error";
      console.error("SnackSafe readiness: database check failed.", error);
    }
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (redisUrl && redisToken) {
    try {
      const redis = new Redis({ url: redisUrl, token: redisToken });
      const pong = await redis.ping();
      checks.rateLimitStore = pong === "PONG" ? "ok" : "error";
    } catch (error) {
      checks.rateLimitStore = "error";
      console.error("SnackSafe readiness: rate-limit store check failed.", error);
    }
  }

  const ready = checks.database === "ok" && checks.rateLimitStore === "ok";
  return NextResponse.json(
    {
      status: ready ? "ready" : "not_ready",
      checks,
      timestamp: new Date().toISOString()
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
