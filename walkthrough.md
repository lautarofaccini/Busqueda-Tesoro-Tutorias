# Phase 3 Walkthrough

**Goal**: Implement Admin Event Ops and prepare for local LAN testing.

## Summary of Changes

### Database schema and configuration
- Added `event_settings` table to control event status (`DRAFT`, `LIVE`, `PAUSED`, `ENDED`), name, and scoring multipliers.
- Added `active` flag to `routes`, `checkpoints`, and `challenges`.

### Backend Lifecycle Enforcement
- Enforced event status in `scan.ts`, `session.ts`, and `answer.ts`:
  - `DRAFT`: blocks new sessions.
  - `PAUSED`: blocks new sessions, checkpoint scans, and answer submissions.
  - `ENDED`: blocks new sessions, checkpoint scans, and answer submissions.
- `session.ts` assigns new sessions to a random active route, resolving the bottleneck of a single static default route.

### Admin Dashboard (Frontend & Backend)
- **API**: Created a new `/api/admin/*` Hono router guarded by the organizer authentication cookie.
  - CRUD operations for event settings, checkpoints, challenges, and routes.
  - Secure token regeneration for individual checkpoints.
- **Frontend UI**: Built a tabbed operational console (`/admin`) incorporating the old `OrganizerView` (Resumen) alongside new tabs for Evento, Checkpoints, Preguntas, Rutas, and QR export.
- Reused existing robust organizer authentication.

### UI Handlers for Game Lifecycle
- Created `EventPausedEndedView` for the player frontend. 
- Integrated this view into `GameScreen` and `CheckpointScan` so players receive clear visual feedback when an organizer pauses or ends the event.

### LAN Test Ready
- Wrote `docs/lan-phone-test.md` with step-by-step Wi-Fi testing instructions.
- Configured a new command `npm run dev:lan` to securely bind Vite to the local network `0.0.0.0`.
- Implemented a QR generator in the Admin UI which accepts the base URL dynamically and issues warnings when testing via `localhost`.
- Replaced the old demo seed content (`migrations/seed_demo.sql`) with a clean test setup comprising 1 start point, 4 distinct stations (DEMO A-D), and 2 interwoven active routes.

## Validation Results
- Verified automated tests pass.
- Verified TypeScript compilation (`npm run typecheck`).
- The repository is fully ready for physical testing this weekend!
