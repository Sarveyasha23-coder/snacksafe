import { NextRequest, NextResponse } from "next/server";
import { mapOff } from "@/lib/products";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getCached, setCached } from "@/lib/product-cache";

export const runtime = "nodejs";
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" };

export async function GET(req: NextRequest) {
  const blocked = await enforceRateLimit(req, "search");
  if (blocked) return blocked;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2 || q.length > 80) {
    return NextResponse.json(
      { products: [], error: "Enter a search term between 2 and 80 characters." },
      { status: 400 }
    );
  }

  const cacheKey = `search:${q.toLowerCase()}`;
  const cached = await getCached<{ products: ReturnType<typeof mapOff>[]; count: number }>(cacheKey);
  if (cached) {
    return NextResponse.json({ ...cached, cached: true }, { headers: CACHE_HEADERS });
  }

  try {
    const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    url.searchParams.set("search_terms", q);
    url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", "12");
    url.searchParams.set(
      "fields",
      "code,product_name,product_name_en,brands,categories,quantity,image_front_small_url,image_url,ingredients_text,allergens,allergens_tags,additives_tags,nutriscore_grade,nutriments"
    );

    const response = await fetch(url, {
      headers: { "User-Agent": "SnackSafe/1.3 (product nutrition lookup)" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 }
    });
    if (!response.ok) {
      return NextResponse.json(
        { products: [], error: "Product database is temporarily unavailable. Please try again." },
        { status: 502 }
      );
    }

    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("products" in data) || !Array.isArray(data.products)) {
      return NextResponse.json(
        { products: [], error: "The product database returned an unexpected response." },
        { status: 502 }
      );
    }

    const rawProducts = data.products.filter(
      (product): product is Record<string, unknown> =>
        !!product && typeof product === "object" && !Array.isArray(product)
        && typeof (product as Record<string, unknown>).product_name === "string"
    );
    const products = rawProducts.map(product => mapOff(product));
    const count = "count" in data && typeof data.count === "number" && Number.isFinite(data.count)
      ? Math.max(0, data.count)
      : products.length;
    const result = { products, count };

    await setCached(cacheKey, result, 300);
    return NextResponse.json({ ...result, cached: false }, { headers: CACHE_HEADERS });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      { products: [], error: timedOut
        ? "Product search took too long. Please try again."
        : "Could not reach the product database. Please try again." },
      { status: timedOut ? 504 : 502 }
    );
  }
}
