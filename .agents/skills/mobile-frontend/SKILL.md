---
name: mobile-frontend
description: How to safely modify the React/Vite mobile-first frontend.
---

# Mobile Frontend

## WHEN TO USE
When altering the UI, components, or screens in `apps/web`.

## READ FIRST
- `docs/decision-log.md` (Mobile-first decisions)

## PROCEDURE
1. Work inside `apps/web/`.
2. Target 320–480px width (Mobile-only). Centered on larger screens.
3. Use Tailwind CSS v4. No PostCSS boilerplate needed.
4. UI must be driven strictly by the backend state returned from `/api/game/state` or scan endpoints.

## VALIDATION
Run `npm run build -w apps/web` to ensure Vite bundles without errors. Run `npm test -w apps/web`.

## DO NOT
- Do not add desktop-specific media queries.
- Do not let the frontend infer game state (e.g., guessing answers or advancing steps locally).
- Do not invent UTN FRRe assets.

## HANDOFF EXPECTATIONS
Ensure Vite build passes and React components are clean and type-safe.
