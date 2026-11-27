# SnackSafe production deployment

This runbook prepares the public SnackSafe launch on **Vercel + Neon PostgreSQL + Upstash Redis**. It does not create provider accounts, provision cloud resources, or deploy the application. Those actions must be completed in the owner's provider accounts.

## 1. Architecture

- **Web application:** Vercel, using the Next.js framework preset and the repository's `main` branch as the Production Branch.
- **Relational database:** Neon PostgreSQL. Use a pooled connection for application traffic and a direct connection for Prisma migrations.
- **Distributed rate limiting:** Upstash Redis REST API. The search, barcode, and analysis routes require it in production.
- **Product data:** Open Food Facts remains the external product data source.

## 2. Create the services

1. Sign in to [Vercel](https://vercel.com/) and import `Sarveyasha23-coder/snacksafe` from GitHub.
2. Keep the project root at the repository root. Select the **Next.js** framework preset, Node.js 22.x, and the default build command `npm run build`. The build script already runs `prisma generate` before `next build`.
3. Create a PostgreSQL project in [Neon](https://neon.tech/). Choose a region close to the Vercel deployment region and create a dedicated production database/role.
4. In Neon, copy both connection strings:
   - **Pooled** connection string (hostname contains `-pooler`) → `DATABASE_URL`.
   - **Direct** connection string (hostname without `-pooler`) → `DIRECT_URL`.
5. Create a Redis database in [Upstash](https://upstash.com/), preferably in a region close to the Vercel deployment. Copy its REST URL and REST token.

Do not paste credentials into GitHub issues, pull requests, source files, or chat. Add them only through the provider's encrypted environment-variable settings.

## 3. Configure Vercel environment variables

Add these variables under **Vercel → Project → Settings → Environment Variables**:

| Variable | Production | Preview | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Required | Required if preview uses DB | Neon pooled URL |
| `DIRECT_URL` | Required for migrations | Required if preview migrations run | Neon direct URL |
| `UPSTASH_REDIS_REST_URL` | Required | Required for functional API previews | Upstash REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Required | Required for functional API previews | Upstash REST token |

For Preview, use a **separate Neon branch/database and separate Upstash database**. Never point untrusted preview deployments at production data or production rate-limit state. Add local development values to an ignored `.env.local` file; never commit it.

The sample file `.env.example` documents the expected names. It contains placeholders only.

## 4. Prepare and apply database migrations

Prisma Client uses `DATABASE_URL` for runtime queries and `DIRECT_URL` for migration operations.

Before the first production release:

1. Check that the repository contains the intended SQL migration(s) under `prisma/migrations/`.
2. If the schema has not yet been captured in a migration, create one in a local development environment against a disposable/development Neon database using `npm run db:dev -- --name init`, review the generated SQL, and commit the migration. Do not generate a new migration against production.
3. With the production `DIRECT_URL` available in a secure local environment, run `npm run db:migrate` once to apply committed migrations.
4. Verify the tables and indexes exist in Neon. Back up the database before later schema changes.

On Windows PowerShell, set the connection strings for the current terminal session before running the migration command:

```powershell
$env:DATABASE_URL = "your-pooled-neon-connection-string"
$env:DIRECT_URL = "your-direct-neon-connection-string"
npm run db:migrate
```

Do not put real connection strings in shell history or screenshots. Prefer a secure secret manager or a local ignored environment file when possible.

## 5. Deploy

1. Merge the reviewed deployment-preparation changes into `main`.
2. Vercel's Git integration will create deployments from Git pushes. Confirm the Production Branch is `main`.
3. Confirm the Production environment variables are present, then trigger a fresh deployment so the build receives them.
4. Do not announce the public launch until the checks below pass.

Vercel creates Preview deployments for non-production branches and Production deployments from the configured production branch. Keep Preview connected to non-production services.

## 6. Production verification

After deployment, verify:

- `https://YOUR-DOMAIN/api/health` returns HTTP 200 and reports `database: "ok"` and `rateLimitStore: "ok"`.
- The home page loads without browser console errors.
- Product search works against Open Food Facts.
- Manual barcode lookup works; camera scanning is tested on HTTPS with camera permission granted and denied.
- Comparison works with missing nutrient fields and on a fresh browser session.
- Search, barcode, and analysis APIs return controlled 429 responses when rate limits are exceeded.
- Invalid input and upstream API failures produce safe, non-sensitive responses.
- Vercel function logs show no leaked credentials or repeated database/Redis errors.
- A database backup/restore process and an uptime alert are configured before meaningful public traffic.

The health endpoint only checks database and Redis connectivity. It does not prove migrations, backups, product-source availability, or every API route are healthy.

## 7. Launch gates and known product limitations

- The privacy notice and terms pages are prototype disclosures and need operator details, contact information, retention disclosures, and legal review for the markets where the service will be offered.
- The experimental nutrition concern indicator is not an official FSSAI rating, medical assessment, or allergy-safety guarantee. Keep this limitation prominent; obtain qualified nutrition and regulatory review before making safety claims.
- Open Food Facts is community-contributed. Users must be told to verify product packaging, ingredients, allergens, and cross-contact warnings.
- Saved comparisons currently live in browser local storage; there are no accounts or cloud synchronization.
- Configure monitoring, alerting, database backups, and a tested restore procedure. Set budget/usage alerts for Vercel, Neon, and Upstash.

## Official provider references

- [Vercel: Deploying a project from the CLI](https://vercel.com/docs/projects/deploy-from-cli)
- [Vercel: Deployment environments](https://vercel.com/docs/deployments/environments)
- [Neon: Prisma ORM v6 connection guide](https://www.prisma.io/docs/orm/v6/overview/databases/neon)
- [Upstash: Redis with Next.js](https://upstash.com/docs/redis/tutorials/nextjs_with_redis)
- [Upstash: Vercel integration](https://upstash.com/docs/redis/howto/vercelintegration)
