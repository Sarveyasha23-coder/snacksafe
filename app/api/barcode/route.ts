import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidGtin, sameGtin } from "@/lib/barcodes";
import { mapOff } from "@/lib/products";

export const runtime = "nodejs";
export const revalidate = 0;

const codeSchema = z.string().trim().refine(isValidGtin, "Enter a valid EAN-8, UPC-A, EAN-13 or GTIN-14 barcode, including its check digit.");
const cache = new Map<string, { expires: number; product: ReturnType<typeof mapOff> }>();
const TTL_MS = 60 * 60 * 1000;
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" };

export async function GET(req: NextRequest) {
  const parsed = codeSchema.safeParse(req.nextUrl.searchParams.get("code") ?? "");
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid barcode." }, { status: 400 });
  }

  const code = parsed.data;
  const cached = cache.get(code);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({ product: cached.product, cached: true }, { headers: CACHE_HEADERS });
  }
  if (cached) cache.delete(code);

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

    if (cache.size >= 500) {
      for (const [key, entry] of cache) {
        if (entry.expires <= Date.now()) cache.delete(key);
      }
      if (cache.size >= 500) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey) cache.delete(oldestKey);
      }
    }
    cache.set(code, { product, expires: Date.now() + TTL_MS });
    return NextResponse.json({ product, cached: false }, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json({ error: "Could not reach Open Food Facts. Check your connection and try again." }, { status: 502 });
  }
}
