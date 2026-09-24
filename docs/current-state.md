# Current State

- **Current phase:** Manual-only post-event scoring hotfix prepared after the historical-results rollout.
- **Current active feature branch:** feat/admin-event-ops-lan-test
- **What currently works:** Migration `0011_event_runs.sql` is reported as successfully applied in production. Historical rollout counts were 26 participants, 26 sessions, 18 completed, 8 incomplete, 175 attempts, 10 reviews and 0 manual adjustments. The hotfix calculates base score exclusively from raw attempts and question hints, then applies only explicit immutable `score_adjustments`; approved reviews remain visible evidence with no automatic score or raw-count effect.
- **Migration state:** Migration 0011 remains the current schema. This calculation/UI hotfix requires no new migration and must not reapply or replace 0011.
- **Known limitations:** Question/checkpoint reach is derived from persisted question assignments; it does not claim physical presence beyond that signal. No historical student-feedback flow exists. `resolveAnswerReview` still records `awarded_correct`/`reversed_wrong` and may advance an active legacy session for compatibility; those fields are excluded from every authoritative score, ranking and analytics calculation. The inherited full API suite contains legacy gameplay fixtures that assume the older step-zero flow.
- **Next milestone:** Deploy the validated hotfix commit only after explicit approval, then verify Ema's base score is 345 and confirm rankings/aggregates without changing historical rows or inserting automatic adjustments.
- **Do not work on yet:** PWA or unrelated infrastructure work.

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
  - Shared tests: 19/19 passed
  - Web tests: 77/77 passed
  - Focused API lifecycle/audit/analytics/authentication tests: 40/40 passed
  - Full API suite was not rerun for this focused hotfix; its last recorded result remains 51/70 passed, with 19 inherited failures in legacy `game.test.ts` and `scoring.test.ts` fixtures that assume the pre-existing step-one flow
  - `npm run typecheck` equivalent using the bundled TypeScript runtime: passed for shared, web and API
  - `npm run build` equivalent using the bundled Vite runtime: passed
  - `npx wrangler deploy --dry-run --env production` equivalent using Wrangler 4.135.0: passed; no deployment
