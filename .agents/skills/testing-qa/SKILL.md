---
name: testing-qa
description: How to run tests and validate changes manually.
---

# Testing & QA

## WHEN TO USE
Before finishing any task or when debugging integration issues.

## READ FIRST
- `docs/agent-workflow.md`

## PROCEDURE
1. Run root typechecks: `npm run typecheck`
2. Run shared & web tests: `npm test -w packages/shared`, `npm test -w apps/web`
3. Run API integration tests: `npm test -w apps/api`
   * Note: The API tests automatically create an isolated `.wrangler/test-state/` DB, wipe it, apply migrations/seeds, and run via `unstable_dev`.

## VALIDATION
For meaningful product changes, manually start `npm run dev` and test the flow locally via HTTP client or browser.

## DO NOT
- Do not write flaky tests that depend on probability or non-deterministic data.
- Do not skip tests because they are "hard to set up".

## HANDOFF EXPECTATIONS
Never hand off broken tests without reporting them.
