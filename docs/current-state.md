# Current State

- **Current phase:** Phase 2 (Scoring Foundation & Organizer View).
- **Current stable branch:** main (contains complete Phase 1 Local Walking Skeleton).
- **Current active feature branch:** feat/scoring-organizer-results
- **Last verified commit:** c2d43a6 + WIP Phase 2.
- **What currently works:** Local Worker API, local D1, Vite proxy, server-side session, HttpOnly cookie, start QR gating, wrong-checkpoint protection, replay protection, persistent randomized question pools per checkpoint, scoring foundation, tie/rank logic, and minimal organizer view.
- **What is being built now:** Testing and validating scoring logic.
- **Known limitations:** Real UTN FRRe questions/locations, and production Cloudflare deployments are not yet implemented.
- **Next milestone:** QR camera reader or Cloudflare production deployment.
- **Do not work on yet:** PWA, complex admin CRUD, deployment (unless authorized).
- **Last verified validation commands/results:**
  - `npm run typecheck` (Passed)
  - `npm run build` (Passed)
  - `npm test` (Passed 16/16 shared, 7/7 web, 27/27 api integration)
