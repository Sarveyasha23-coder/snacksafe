# SnackSafe production setup

**Built by Sarveyasha Sodhiya**

This guide configures the infrastructure code already present in the repository. The application does not create cloud accounts or provision paid services automatically.

## 1. Provision PostgreSQL

Create a PostgreSQL database with a managed provider (for example, Neon, Supabase, or a managed PostgreSQL service from your cloud provider). Copy its pooled/runtime connection string and direct migration connection string if your provider gives separate values.

Set DATABASE_URL in your hosting provider's encrypted environment variables. Do not put credentials in GitHub source files.

Apply migrations from a trusted deployment environment:

```bash
npm install
npm run db:migrate
```

The initial migration creates:
- ProductCache: JSON cache payloads with expiry timestamps.
- ProductRecord: latest fetched product data keyed by barcode.

Schedule periodic cleanup of expired ProductCache rows. The app also deletes expired rows when their keys are read, but a scheduled cleanup prevents unused expired keys from accumulating.

## 2. Provision Upstash Redis

Create a Redis database in Upstash and copy its REST URL and REST token. Set these as encrypted environment variables:

- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN

The current sliding-window policies are:
- Search: 30 requests per minute per client IP.
- Barcode lookup: 30 requests per minute per client IP.
- Nutrition analysis: 20 requests per minute per client IP.

Production APIs return HTTP 503 when Redis rate-limit protection is not configured or unavailable. This is intentional fail-closed behavior. Review thresholds against real traffic before launch.

## 3. Configure deployment

For a Vercel deployment:
1. Import this GitHub repository into Vercel.
2. Set the production environment variables listed above in Project Settings → Environment Variables.
3. Deploy the application.
4. Run npm run db:migrate against the production database before enabling traffic (for example, from a secure release job or trusted deployment environment).
5. Confirm the latest GitHub Actions workflow passes and test search/barcode endpoints on the deployed URL.

Set the same variables in Preview only if you intend previews to use a separate non-production database and Redis instance. Never point preview deployments at production data unless you have explicitly designed access controls and data isolation.

## 4. Security and operations before public launch

- Keep all secrets out of the repository and client-side NEXT_PUBLIC_* variables.
- Restrict database network access where the provider supports it.
- Use a dedicated database role with only the permissions required by Prisma migrations/runtime.
- Configure automated database backups and test a restore.
- Monitor 429 and 503 rates, upstream Open Food Facts failures, cache hit rate, database connections, and Redis usage.
- Consider a managed connection pooler for serverless workloads.
- Review trusted proxy/IP headers for the chosen host. The rate limiter uses platform-provided x-vercel-forwarded-for or x-real-ip; do not deploy behind an untrusted proxy without reviewing this.
- Add account-level abuse controls if user accounts are introduced. IP limits alone are not an identity system.
- Have a qualified security reviewer inspect the app before collecting personal or sensitive data.

## Current product limitations

- Product records are persisted from barcode lookups only; search results are cached but not all inserted into the product history table.
- Saved comparisons remain local to each browser. PostgreSQL persistence for user accounts and cross-device comparisons is not implemented.
- The nutrition indicator remains an experimental educational heuristic, not a medical or FSSAI-approved rating.
- Database/Redis resources and deployment credentials must be created and configured by the repository owner. Their presence cannot be inferred from a successful GitHub file upload.
