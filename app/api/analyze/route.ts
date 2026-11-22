import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scoreNutrition } from "@/lib/scoring";
const schema = z.object({ energy:z.number().nonnegative().optional(), sugar:z.number().nonnegative().optional(), saturatedFat:z.number().nonnegative().optional(), salt:z.number().nonnegative().optional(), transFat:z.number().nonnegative().optional(), fiber:z.number().nonnegative().optional(), protein:z.number().nonnegative().optional() });
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null); const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error:"Invalid nutrition values." }, { status:400 });
  return NextResponse.json(scoreNutrition(parsed.data));
}
