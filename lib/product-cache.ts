import { getPrisma } from "@/lib/prisma";

type CacheEntry = { payload: unknown; expiresAt: number };
const memory = new Map<string, CacheEntry>();
const MAX_MEMORY_ENTRIES = 250;

function memoryGet<T>(key: string): T | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.payload as T;
}

function memorySet(key: string, payload: unknown, ttlSeconds: number) {
  if (memory.size >= MAX_MEMORY_ENTRIES && !memory.has(key)) {
    const oldest = memory.keys().next().value;
    if (oldest) memory.delete(oldest);
  }
  memory.set(key, { payload, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/**
 * Shared persistent cache when DATABASE_URL is configured. In-memory fallback
 * keeps local development usable; it is per-process and is not durable.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  const prisma = getPrisma();
  if (prisma) {
    try {
      const row = await prisma.productCache.findUnique({ where: { cacheKey: key } });
      if (row && row.expiresAt.getTime() > Date.now()) return row.payload as T;
      if (row) await prisma.productCache.delete({ where: { cacheKey: key } }).catch(() => undefined);
    } catch (error) {
      console.error("SnackSafe persistent cache read failed; using local fallback.", error);
    }
  }
  return memoryGet<T>(key);
}

export async function setCached(key: string, payload: unknown, ttlSeconds: number): Promise<void> {
  memorySet(key, payload, ttlSeconds);
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    await prisma.productCache.upsert({
      where: { cacheKey: key },
      create: { cacheKey: key, payload: payload as object, expiresAt: new Date(Date.now() + ttlSeconds * 1000) },
      update: { payload: payload as object, expiresAt: new Date(Date.now() + ttlSeconds * 1000) }
    });
  } catch (error) {
    console.error("SnackSafe persistent cache write failed; local fallback retained.", error);
  }
}

export async function saveProductRecord(product: {
  barcode?: string;
  name: string;
  brand: string;
  sourceUrl?: string;
} & Record<string, unknown>): Promise<void> {
  if (!product.barcode || !/^\d{8,14}$/.test(product.barcode)) return;
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    await prisma.productRecord.upsert({
      where: { barcode: product.barcode },
      create: {
        barcode: product.barcode,
        name: product.name,
        brand: product.brand,
        sourceUrl: product.sourceUrl,
        payload: product as object
      },
      update: {
        name: product.name,
        brand: product.brand,
        sourceUrl: product.sourceUrl,
        payload: product as object,
        lastFetchedAt: new Date()
      }
    });
  } catch (error) {
    console.error("SnackSafe product record persistence failed.", error);
  }
}
