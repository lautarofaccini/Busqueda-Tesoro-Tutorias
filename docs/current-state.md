# Current State

- **Current phase:** Production security hotfix prepared; production remains DRAFT.
- **Current active feature branch:** feat/admin-event-ops-lan-test
- **What currently works:** Local Worker API, local D1, Vite proxy, server-side session, HttpOnly cookie, start QR gating, wrong-checkpoint protection, replay protection, persistent randomized question pools per checkpoint, scoring foundation, tie/rank logic, Checkpoint-first Admin Console, player identity onboarding (Legajo/DNI), duplicate participation blocking, invalidate/release participants, and event lifecycle controls.
- **What is being built now:** Final audit correction pass for checkpoint clues, lifecycle blocking, and cleanup before a real-phone regression test.
- **Known limitations:** Production content is intentionally still empty and all real navigation riddles remain pending organizer input. The full API test command retains legacy fixture/concurrency failures documented in the hotfix handoff.
- **Next milestone:** Manually enroll organizer TOTP, set the new secret, deploy this branch, then import/review content while DRAFT.
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
  - `npm run typecheck` (Passed)
  - `npm run build` (Passed)
  - `npm test -w apps/api` (Passed)
