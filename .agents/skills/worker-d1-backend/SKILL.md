---
name: worker-d1-backend
description: How to work with the Cloudflare Worker and D1 local database.
---

# Worker & D1 Backend

## WHEN TO USE
When adding endpoints, modifying game state, or writing D1 database migrations.

## READ FIRST
- `docs/agent-context.md` (Security Model)

## PROCEDURE
1. Work inside `apps/api/` or `migrations/`.
2. New tables/columns require a new SQL migration file (e.g., `0003_feature.sql`).
3. Update `packages/shared/src/types.ts` to match backend changes.
4. Keep all business logic and state authoritative on the server.
5. Use `npm run db:migrate:local` and `npm run db:seed:local` to apply changes locally.

## VALIDATION
Run API integration tests with `npm test -w apps/api`.

## DO NOT
- Do not trust client payloads for progression.
- Do not deploy to production Cloudflare unless explicitly authorized.

## HANDOFF EXPECTATIONS
Commit migrations and endpoint changes together. Ensure the local DB is testable.
