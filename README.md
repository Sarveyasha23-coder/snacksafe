# SnackSafe v1.3

**Built by Sarveyasha Sodhiya**

A founder-led project focused on making packaged-food information easier to understand.

Next.js + React + TypeScript application for exploring packaged snack nutrition. PostgreSQL-backed caching and distributed API protection are available when production credentials are configured. Version 1.3 adds a per-100 g side-by-side product comparison and a local-device comparison list while preserving barcode scanning and the existing Open Food Facts product analysis flow.

## Requirements
- Node.js 20.9+
- npm
- Camera access requires HTTPS or localhost and camera permission. Manual barcode entry is available as a fallback.

## Run locally
```bash
cp .env.example .env
npm install
npm run dev
```

The app can run without database or Upstash credentials during local development. In that mode, cache and rate-limit fallbacks are process-local and are not suitable for production. To enable PostgreSQL locally, set DATABASE_URL, then run npm run db:dev to apply/create migrations.
Open http://localhost:3000.

## Run core tests
```bash
npm test
```
The test suite compiles the pure TypeScript domain modules and runs Node's built-in test runner. It covers GTIN check digits, UPC-A/EAN equivalence, score confidence, Open Food Facts field mapping, unit conversion, missing/implausible values, ingredient-source matching, demo-data labels, comparison leaders, missing-value handling, ties, and validation of browser-stored products.

## Features
- Search products through Open Food Facts.
- Look up retail barcodes through `GET /api/barcode?code=4006381333931`.
- Scan EAN-8, UPC-A, EAN-13 and GTIN-14 barcodes using ZXing in the browser. The GS1 modulo-10 check digit is validated before lookup. UPC-E is not supported in this version.
- Manual barcode entry is available when camera access is unavailable.
- View explicitly per-100 g nutrient values, missing-data warnings, and an experimental transparent concern indicator.
- View keyword-based ingredient, declared-allergen and additive-tag observations with the data source shown.
- Select up to three products and compare energy, total sugars, salt, saturated fat, trans fat, fibre and protein per 100 g.
- Save the comparison selection in browser local storage on the current device. This is not a user account or cloud-synchronised database.
- A metric leader is highlighted only when every compared product has a valid value for that metric. Missing values are never treated as zero or as a win.
- View experimental concern scores alongside the comparison, but the application does not rank products by that prototype score.
- Open the linked Open Food Facts product record for provenance.

## Production infrastructure
- Prisma ORM with PostgreSQL models for cached API responses (ProductCache) and fetched product records (ProductRecord).
- Barcode lookup uses a one-hour persistent database cache and saves the latest fetched product record when PostgreSQL is configured.
- Product search uses a five-minute shared database cache when configured.
- Upstash Redis sliding-window rate limits protect search (30/minute), barcode lookup (30/minute), and analysis (20/minute) endpoints. Production requests fail closed with HTTP 503 if Upstash credentials are missing or unavailable.
- Without DATABASE_URL, cache falls back to a bounded in-memory cache per process. Without Upstash credentials, rate limiting is skipped only in development; production endpoints return 503.
- Required production variables: DATABASE_URL, UPSTASH_REDIS_REST_URL, and UPSTASH_REDIS_REST_TOKEN. Copy .env.example and set real values in your hosting provider's encrypted environment-variable settings. Never commit .env or real credentials.
- Apply the committed schema migration during deployment with npm run db:migrate; generate the Prisma client with npm run db:generate (also run automatically during install/build).
- CI runs domain tests, ESLint and a production build. A production deployment is not complete until a real PostgreSQL database and Upstash Redis instance are provisioned and configured.

## API
- `GET /api/search?q=potato%20chips`
- `GET /api/barcode?code=4006381333931`
- `POST /api/analyze` with JSON such as `{"salt":1.2,"sugar":2,"saturatedFat":3,"energy":530,"fiber":4,"transFat":0}`

## Data quality and limitations
- Open Food Facts is community-contributed. Data can be incomplete, inaccurate, or absent. Verify the physical package.
- Missing nutrient values remain missing; they are not converted to zero. Implausible per-100 g macro values are omitted rather than scored.
- Energy is read from `energy-kcal_100g` or converted from `energy_100g` kJ. Salt is read from `salt_100g` or estimated from `sodium_100g × 2.5` when the converted value is plausible.
- Comparisons use per-100 g fields only. A leader is not identified for a metric if even one selected product is missing that value. “Lowest” or “highest” applies only to that nutrient, not to overall healthfulness. Total sugars are not necessarily the same as added/free sugars.
- Ingredient observations are deterministic keyword matches, not AI, toxicology analysis, allergen certification, or a regulatory compliance check. An additive's presence alone is not a health-danger verdict. Allergen notes should be cross-checked against the physical package and cross-contact warnings.
- The 0–100 concern indicator is experimental, educational, and based on provisional prototype thresholds. It is not an official FSSAI score, clinical risk score, or probability of illness. It needs category-specific review and validation by qualified nutrition professionals before public-health use.
- The bundled sample products contain illustrative values and are clearly marked as demo data; they are not real manufacturer labels.
- Database-backed cache is enabled only when DATABASE_URL is configured. Without it, the development fallback is in-memory and process-local. Monitor upstream Open Food Facts API limits and cache hit rates.
- The barcode route validates the GS1 check digit and checks that the returned product code is GTIN-equivalent to the requested code when the upstream record supplies one. UPC-E is not implemented.
- Browser comparison storage is local to the current browser/device. It is not backed by PostgreSQL and does not sync between devices.

## Operational endpoints and legal notices\n\n- Readiness probe: `GET /api/health` checks PostgreSQL and Upstash Redis connectivity and returns HTTP 503 until both required production dependencies are available. It does not expose credentials.\n- Privacy notice: `/privacy`. This is a prototype disclosure and requires operator/legal review before commercial launch.\n- Terms of use: `/terms`. These explain the limits of community-contributed food and allergen data; they are not jurisdiction-specific legal advice.\n- Security reporting and secret-handling guidance: [SECURITY.md](./SECURITY.md).\n\n## Next milestones
1. Provision PostgreSQL and Upstash Redis, configure encrypted deployment environment variables, and apply migrations.
2. Add browser end-to-end tests for camera permissions, camera lifecycle, barcode scanning, and manual fallback.
3. Add user accounts, consent-based dietary preference controls, and cloud-synchronised saved comparisons.
4. Replace prototype thresholds with category-specific, evidence-reviewed scoring rules.
5. Add monitoring, alerting, backup/restore drills, and a security review.

## Data source
Open Food Facts API. Respect its rate limits, identify your application with a User-Agent, and follow its attribution/licensing requirements. Product records are community-contributed and must be independently checked for safety-critical use.