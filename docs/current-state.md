# Current State

- **Current phase:** Phase 3 (Admin Event Ops & LAN Testing) - COMPLETED.
- **Current stable branch:** main (contains complete Phase 1, Phase 2, and Phase 3).
- **Current active feature branch:** main (ready for next feature branch).
- **Last verified commit:** Phase 3 completion.
- **What currently works:** Local Worker API, local D1, Vite proxy, server-side session, HttpOnly cookie, start QR gating, wrong-checkpoint protection, replay protection, persistent randomized question pools per checkpoint, scoring foundation, tie/rank logic, Admin Console, and event lifecycle controls.
- **What is being built now:** Awaiting physical LAN test.
- **Known limitations:** Real UTN FRRe questions/locations, and production Cloudflare deployments are not yet implemented.
- **Next milestone:** Physical LAN test or Cloudflare production deployment.
- **Do not work on yet:** PWA, deployment (unless authorized).

## Current Phase
**Phase 3: Admin Event Ops & LAN Testing** (Completed - Awaiting physical LAN test)

The application has been outfitted with a new `event_settings` table to control the game lifecycle (`DRAFT`, `LIVE`, `PAUSED`, `ENDED`), dynamically routing player traffic and strictly guarding progression. The Organizer UI has been expanded into a fully functional Admin Console with tabs for Checkpoints, Challenges, Routes, and QR Code generation. All tests pass successfully.

A clean test setup of 4 demo stations (Demo A, B, C, D) has been scripted into the local database, allowing local LAN Wi-Fi testing.

## Recent Work
- **Admin Event Ops**: Built the CRUD dashboard (`/admin`) utilizing the existing Organizer auth.
- **Event Lifecycle**: Refactored `scan.ts`, `session.ts`, `answer.ts`, and `game.ts` to strictly obey `event_settings.status`.
- **UI Enhancements**: Created `EventPausedEndedView` for the player frontend to intercept `PAUSED` and `ENDED` states seamlessly.
- **LAN Ready**: Added `npm run dev:lan`, refactored `seed_demo.sql` to represent a clean LAN test setup, and isolated the integration tests with `test_seed.sql`.

- **Last verified validation commands/results:**
  - `npm run typecheck` (Passed)
  - `npm run build` (Passed)
  - `npm test` (Passed 16/16 shared, 7/7 web, 27/27 api integration)
