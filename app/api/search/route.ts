import { NextRequest, NextResponse } from "next/server";
import { mapOff } from "@/lib/products";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getCached, setCached } from "@/lib/product-cache";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const blocked = await enforceRateLimit(req, "search");
  if (blocked) return blocked;
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2 || q.length > 80) return NextResponse.json({ products: [], error: "Enter a search term between 2 and 80 characters." }, { status: 400 });
  const cacheKey = `search:${q.toLowerCase()}`;
  const cached = await getCached<{ products: ReturnType<typeof mapOff>[]; count: number }>(cacheKey);
  if (cached) return NextResponse.json({ ...cached, cached: true }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
  try {
    const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    url.searchParams.set("search_terms", q); url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process"); url.searchParams.set("json", "1");
    url.searchParams.set("page_size", "12"); url.searchParams.set("fields", "code,product_name,product_name_en,brands,categories,quantity,image_front_small_url,image_url,ingredients_text,allergens,allergens_tags,additives_tags,nutriscore_grade,nutriments");
    const response = await fetch(url, { headers: { "User-Agent": "SnackSafe/1.2 (educational prototype)" }, next: { revalidate: 3600 } });
    if (!response.ok) throw new Error("Product database is temporarily unavailable.");
    const data = await response.json();
    const result = { products: (data.products ?? []).filter((p: any) => p.product_name).map(mapOff), count: data.count ?? 0 };
    await setCached(cacheKey, result, 300);
    return NextResponse.json({ ...result, cached: false }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
  } catch (e) { return NextResponse.json({ products: [], error: e instanceof Error ? e.message : "Search failed." }, { status: 502 }); }
}
