import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scoreNutrition } from "@/lib/scoring";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  energy: z.number().finite().min(0).max(1000).optional(),
  sugar: z.number().finite().min(0).max(100).optional(),
  saturatedFat: z.number().finite().min(0).max(100).optional(),
  salt: z.number().finite().min(0).max(100).optional(),
  transFat: z.number().finite().min(0).max(100).optional(),
  fiber: z.number().finite().min(0).max(100).optional(),
  protein: z.number().finite().min(0).max(100).optional()
}).strict();

export async function POST(req: NextRequest) {
  const blocked = await enforceRateLimit(req, "analyze");
  if (blocked) return blocked;

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide valid per-100 g nutrition values. Values must be within realistic label ranges." },
      { status: 400 }
    );
  }

  return NextResponse.json(scoreNutrition(parsed.data), {
    headers: { "Cache-Control": "no-store" }
  });
}
