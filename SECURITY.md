# Security policy

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in public issues. Contact the repository owner privately through GitHub's private vulnerability reporting feature, if enabled, or use GitHub's security advisory workflow. Include:
- A clear description and affected route/component.
- Reproduction steps and impact.
- Any suggested mitigation.

Do not include real user data, passwords, API tokens, or production secrets in reports.

## Secret handling

- Never commit `.env`, production credentials, database URLs, Redis tokens, or private keys.
- Store deployment secrets in the hosting provider's encrypted environment-variable store.
- Rotate any credential that has been exposed.
- Do not expose server credentials through `NEXT_PUBLIC_*` variables.

## Production controls

SnackSafe's production API rate limiter depends on Upstash Redis. Production API routes fail closed when rate-limit credentials or a usable client address are unavailable. Deploy only behind a trusted proxy that normalizes the forwarding headers used by the application.

The `/api/health` endpoint reports whether PostgreSQL and Upstash Redis are reachable. It does not expose connection strings or credentials.

## Scope and limitations

SnackSafe uses community-contributed Open Food Facts product data. It is not an allergy-safety verification service or a medical device. A successful health check does not constitute a penetration test, compliance assessment, or guarantee of security.
