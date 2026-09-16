---
name: game-content
description: Managing game checkpoints, challenges, and demo content.
---

# Game Content

## WHEN TO USE
When adding or modifying routes, checkpoints, questions, and normalization rules.

## READ FIRST
- `docs/agent-context.md` (Game Philosophy)

## PROCEDURE
1. Local demo data lives in `migrations/seed_demo.sql`.
2. Do not invent real UTN FRRe questions/locations. Use generic `[DEMO]` placeholders.
3. Answer normalization logic is in `packages/shared/src/normalize.ts`.

## VALIDATION
Run `npm test -w packages/shared` to verify normalization behavior.

## DO NOT
- Do not implement fuzzy matching or AI validation for answers.
- Do not leak correct answers or pool data in API responses.

## HANDOFF EXPECTATIONS
Demo seeds must remain explicitly marked as demo content.
