# Current State

- **Current phase:** Historical audit, corrected scoring, final analytics, simplified organizer auth and safe event editions implemented locally; production data remains untouched.
- **Current active feature branch:** feat/admin-event-ops-lan-test
- **What currently works:** Local Worker API, local D1, Vite proxy, server-side session, HttpOnly cookies, player lifecycle controls, append-only manual score corrections, audit suggestions/review state, one authoritative adjusted score across detail/ranking/analytics, historical edition selection, career/question/checkpoint analytics, safe new editions, username/password organizer login, and the separate limited assistance role. CLOSING behavior remains unchanged.
- **Prepared but not applied:** Migration `0011_event_runs.sql` backfills Edition 1, snapshots its scoring configuration, moves invalidation authority to the participation, adds audit state and creates the immutable `score_adjustments` ledger. It has only been exercised against disposable local D1 data. It has not been applied to production.
- **Known limitations:** Deployment requires applying migration 0011 before deploying code that reads its new tables/columns. Question/checkpoint reach is derived from persisted question assignments; it does not claim physical presence beyond that signal. No historical student-feedback table or collection flow exists, so the organizer view correctly reports an empty state. The inherited full API suite still contains legacy gameplay fixtures that assume the older step-zero flow; focused lifecycle, audit, analytics and authentication coverage is the release signal until those fixtures are modernized.
- **Next milestone:** After separate explicit approval, verify D1 Time Travel/backup readiness, configure `ADMIN_USERNAME`, `ADMIN_PASSWORD` and the existing `ORGANIZER_SECRET`, manually apply migration 0011, compare Edition 1 counts, deploy the exact validated commit, and perform read-only verification before any correction is entered.
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
  - Focused API lifecycle/audit/analytics/authentication tests: 35/35 passed
  - Full API suite: 51/70 passed; 19 inherited failures remain in legacy `game.test.ts` and `scoring.test.ts` fixtures that assume the pre-existing step-one flow
  - `npm run typecheck` equivalent using the bundled TypeScript runtime: passed for shared, web and API
  - `npm run build` equivalent using the bundled Vite runtime: passed
  - `npx wrangler deploy --dry-run --env production` equivalent using Wrangler 4.135.0: passed; no deployment
