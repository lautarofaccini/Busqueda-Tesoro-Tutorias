---
name: deployment-release
description: How to deploy the application to Cloudflare.
---

# Deployment & Release

## WHEN TO USE
When the user explicitly authorizes deploying to production.

## READ FIRST
- `docs/decision-log.md` (Hosting direction)

## PROCEDURE
1. Ensure all local tests pass.
2. Confirm the D1 production UUID is configured in `wrangler.toml` (if applicable) or passed dynamically.
3. Deploy frontend using Cloudflare Pages.
4. Deploy API using Cloudflare Workers (`npm run deploy -w apps/api`).

## VALIDATION
Verify the production URL works as expected.

## DO NOT
- Do not deploy automatically.
- Do not deploy to paid infrastructure.

## HANDOFF EXPECTATIONS
Document the live URLs and any environment variable changes needed.
