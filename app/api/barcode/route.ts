import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidGtin, sameGtin } from "@/lib/barcodes";
import { mapOff } from "@/lib/products";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getCached, saveProductRecord, setCached } from "@/lib/product-cache";

export const runtime = "nodejs";
export const revalidate = 0;

const codeSchema = z.string().trim().refine(isValidGtin, "Enter a valid EAN-8, UPC-A, EAN-13 or GTIN-14 barcode, including its check digit.");
const CACHE_TTL_SECONDS = 60 * 60;
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" };

export async function GET(req: NextRequest) {
  const blocked = await enforceRateLimit(req, "barcode");
  if (blocked) return blocked;
  const parsed = codeSchema.safeParse(req.nextUrl.searchParams.get("code") ?? "");
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid barcode." }, { status: 400 });
  }

  const code = parsed.data;
  const cacheKey = `barcode:${code}`;
  const cached = await getCached<ReturnType<typeof mapOff>>(cacheKey);
  if (cached) return NextResponse.json({ product: cached, cached: true }, { headers: CACHE_HEADERS });

  try {
    const fields = [
      "code", "product_name", "product_name_en", "brands", "categories", "quantity",
      "image_front_small_url", "image_url", "ingredients_text", "allergens", "allergens_tags",
      "nutriments", "additives_tags", "nutriscore_grade"
    ].join(",");
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${encodeURIComponent(fields)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "SnackSafe/1.2 (educational prototype)" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      return NextResponse.json({ error: "The product database is temporarily unavailable. Please try again." }, { status: 502 });
    }

    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("status" in data) || data.status !== 1 || !("product" in data) || !data.product || typeof data.product !== "object" || Array.isArray(data.product)) {
      return NextResponse.json({ error: "This barcode was not found in Open Food Facts. Try searching by product name or verify the printed code." }, { status: 404 });
    }

    const rawProduct = data.product as Record<string, unknown>;
    const returnedCode = typeof rawProduct.code === "string" ? rawProduct.code : "";
    if (returnedCode && !sameGtin(code, returnedCode)) {
      return NextResponse.json({ error: "The product database returned a different barcode. No product was selected; please verify the package code." }, { status: 502 });
    }

    const mapped = mapOff(rawProduct as Record<string, any>);
    const product = { ...mapped, id: code, barcode: code, sourceUrl: `https://world.openfoodfacts.org/product/${encodeURIComponent(code)}` };

    await setCached(cacheKey, product, CACHE_TTL_SECONDS);
    await saveProductRecord(product as ReturnType<typeof mapOff> & Record<string, unknown>);
    return NextResponse.json({ product, cached: false }, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json({ error: "Could not reach Open Food Facts. Check your connection and try again." }, { status: 502 });
  }
}
