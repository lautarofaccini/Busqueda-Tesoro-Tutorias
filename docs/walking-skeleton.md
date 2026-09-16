# Walking Skeleton

A walking skeleton is the thinnest possible slice that connects all
architectural components end-to-end, proving the build pipeline and
integration points work before adding real functionality.

## Phase 0 — Bootstrap (DONE)

**Goal**: repository structure, mobile UI prototype, passing build/typecheck/test.

**Done**:
- npm workspaces monorepo (apps/web, apps/api, packages/shared)
- Tailwind v4 + Vite + React frontend skeleton
- Four prototype screens with correct mobile shell layout
- Design token system (orange/amber/yellow palette, 100dvh shell)
- Cloudflare Worker skeleton with Hono (health only; others return 501)
- D1 schema in migrations/0001_init.sql
- Shared Zod schemas and TypeScript types
- Documentation: architecture, product principles, UI guidelines, security, walking skeleton
- Git initialised, .gitignore in place

## Phase 1 — Local Walking Skeleton + Question Pools (DONE)

Connect the scan flow end-to-end and implement anti-cheat:

**Done**:
- Local D1 migrations applied
- Real session management via HttpOnly cookies
- `POST /api/session/start` implemented
- `POST /api/scan/:token` implemented with sequence enforcement
- Demo frontend wired to live local API
- `POST /api/challenge/:challengeId/answer` with server-side normalisation
- Persistent randomized question pools per checkpoint
- Anti-substitution challenge validation
- Agent operating context (`AGENTS.md`, `.agents/skills`)
- Full Vitest API integration test suite passing

## Phase 2 — Next Steps (Current Focus)

- Scoring rules, tie breakers, hint penalties
- Camera QR scanning integration
- Admin UI / organizer results view
- Final frontend cleanup
- Cloudflare production deployment

## Phase 3 — Full hunt

- All checkpoints seeded with confirmed faculty content
- Real QR codes printed
- Physical mobile test
- Event launch
