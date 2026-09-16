# Current State

- **Current phase:** Phase 3 (Admin Event Ops & LAN Testing) - FINAL CORRECTIONS COMPLETED.
- **Current active feature branch:** feat/admin-event-ops-lan-test
- **What currently works:** Local Worker API, local D1, Vite proxy, server-side session, HttpOnly cookie, start QR gating, wrong-checkpoint protection, replay protection, persistent randomized question pools per checkpoint, scoring foundation, tie/rank logic, Checkpoint-first Admin Console, player identity onboarding (Legajo/DNI), duplicate participation blocking, invalidate/release participants, and event lifecycle controls.
- **What is being built now:** Awaiting merge of Phase 3 final corrections into main.
- **Known limitations:** Cloudflare production deployment is not yet implemented. Real UTN FRRe questions/locations are pending.
- **Next milestone:** Cloudflare production deployment (Phase 4).
- **Do not work on yet:** PWA, advanced analytics.

## Current Phase
**Phase 3: Admin Event Ops & LAN Testing** (Completed Final Corrections)

Following the physical LAN test, several crucial adjustments were made:
- Replaced the static manual routing table with a dynamic, randomized checkpoint sequence generator (`session_steps`) to ensure unique paths for each player upon starting.
- Overhauled the Admin Console to feature a Checkpoint-first workflow, where questions are managed inline within each checkpoint, replacing `window.prompt` and `alert` with real React forms.
- Upgraded player onboarding to require Legajo/DNI, hashing the input (HMAC) to securely block duplicate participation.
- Added `INVALIDAR` and `REHABILITAR` actions in the Organizer view to handle cheaters or duplicate accounts.
- Event ranking correctly handles `EMPATE` explicitly for tied scores.

- **Last verified validation commands/results:**
  - `npm run typecheck` (Passed)
  - `npm run build` (Passed)
  - `npm test -w apps/api` (Passed)
