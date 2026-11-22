# SnackSafe v1.3

**Built by Sarveyasha Sodhiya**

A founder-led project focused on making packaged-food information easier to understand.

Next.js + React + TypeScript prototype for exploring packaged snack nutrition. Version 1.3 adds a per-100 g side-by-side product comparison and a local-device comparison list while preserving barcode scanning and the existing Open Food Facts product analysis flow.

## Requirements
- Node.js 20.9+
- npm
- Camera access requires HTTPS or localhost and camera permission. Manual barcode entry is available as a fallback.

## Run locally
```bash
npm install
npm run dev
```
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
- A one-hour in-memory barcode cache is used per server process, with HTTP cache headers. It is not a persistent shared cache; production should use Redis or a database cache, add rate limiting, and monitor upstream API limits.
- The barcode route validates the GS1 check digit and checks that the returned product code is GTIN-equivalent to the requested code when the upstream record supplies one. UPC-E is not implemented.
- Browser comparison storage is local to the current browser/device. It is not backed by PostgreSQL and does not sync between devices.

## Next milestones
1. Add PostgreSQL + Prisma persistent product cache, saved comparisons, and provenance/audit history.
2. Add rate limiting and a shared cache for serverless deployment.
3. Add browser end-to-end tests for camera permissions, camera lifecycle, barcode scanning, and manual fallback.
4. Replace prototype thresholds with category-specific, evidence-reviewed scoring rules.
5. Add user accounts, consent-based dietary preference controls, and shareable comparisons.

## Data source
Open Food Facts API. Respect its rate limits, identify your application with a User-Agent, and follow its attribution/licensing requirements. Product records are community-contributed and must be independently checked for safety-critical use.