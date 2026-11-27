-- Create the persistent product cache and product record tables.
CREATE TABLE "ProductCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductCache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductRecord" (
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "payload" JSONB NOT NULL,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductRecord_pkey" PRIMARY KEY ("barcode")
);

CREATE UNIQUE INDEX "ProductCache_cacheKey_key" ON "ProductCache"("cacheKey");
CREATE INDEX "ProductCache_expiresAt_idx" ON "ProductCache"("expiresAt");
CREATE INDEX "ProductRecord_name_idx" ON "ProductRecord"("name");
CREATE INDEX "ProductRecord_lastFetchedAt_idx" ON "ProductRecord"("lastFetchedAt");
