# Current State

- **Current phase:** Live-event closing-grace hotfix prepared and validated locally; production data remains untouched.
- **Current active feature branch:** feat/admin-event-ops-lan-test
- **What currently works:** Local Worker API, local D1, Vite proxy, server-side session, HttpOnly cookie, start QR gating, wrong-checkpoint protection, replay protection, persistent randomized question pools per checkpoint, scoring, tie/rank logic, Checkpoint-first Admin Console, player identity onboarding (DNI), duplicate participation blocking, invalidate/release participants, assistance/review flows, and DRAFT/LIVE/PAUSED/CLOSING/ENDED lifecycle controls. CLOSING blocks new participants immediately, lets existing sessions continue for 30 minutes from `event_settings.updated_at`, and classifies unfinished sessions as incomplete after the effective deadline without changing their stored state.
- **What is being built now:** Nothing beyond the scoped live-event closing-grace hotfix; it is awaiting an explicitly authorized deployment.
- **Known limitations:** Production is live, so deployment itself can interrupt in-flight requests briefly and any unexpected runtime incompatibility would affect active participants. The full D1 integration suites create isolated local databases by applying migrations, so they were not run under this task's absolute no-migration constraint; focused route tests cover the new lifecycle behavior without a database migration.
- **Next milestone:** Review and explicitly deploy the Worker/assets only, then smoke-test CLOSING behavior without migrations, imports, content changes, or remote database writes.
- **Do not work on yet:** PWA, advanced analytics.

## Current Phase
**Phase 3: Admin Event Ops & LAN Testing** (Completed Final Corrections)

Following the physical LAN test, several crucial adjustments were made:
- Replaced the static manual routing table with a dynamic, randomized checkpoint sequence generator (`session_steps`) to ensure unique paths for each player upon starting.
- Overhauled the Admin Console to feature a Checkpoint-first workflow, where questions are managed inline within each checkpoint, replacing `window.prompt` and `alert` with real React forms.
- Upgraded player onboarding to require Legajo/DNI, hashing the input (HMAC) to securely block duplicate participation.
- Added `INVALIDAR` and `REHABILITAR` actions in the Organizer view to handle cheaters or duplicate accounts.
- Event ranking correctly handles `EMPATE` explicitly for tied scores.
- Checkpoint content is now: name, active flag, optional instruction, required primary clue for active playable checkpoints, optional secondary clue, stable opaque QR token, and its question pool. Secondary-clue reveals are persisted in `hint_usage`; hint penalties are configured but intentionally not yet applied to scoring.
- Each checkpoint card provides QR preview and SVG download from its stable token. Bulk QR export/ZIP does not yet exist; obtaining all production-printable QR files in one operation remains a production blocker.

- **Last verified validation commands/results:**
  - Shared, web, and focused API lifecycle/session tests (Passed)
  - `npm run typecheck` equivalent using the bundled TypeScript runtime (Passed)
  - `npm run build` equivalent using the bundled Vite runtime (Passed)
  - `npx wrangler deploy --dry-run --env production` equivalent using the bundled Wrangler runtime (Passed; no deployment)
