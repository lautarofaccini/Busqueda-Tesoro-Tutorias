# Walking Skeleton

A walking skeleton is the thinnest possible slice that connects all
architectural components end-to-end, proving the build pipeline and
integration points work before adding real functionality.

## Phase 0 — Bootstrap (current)

**Goal**: repository structure, mobile UI prototype, passing build/typecheck/test.

**Done**:
- npm workspaces monorepo (apps/web, apps/api, packages/shared)
- Tailwind v4 + Vite + React frontend skeleton
- Four prototype screens with correct mobile shell layout
- Design token system (orange/amber/yellow palette, 100dvh shell)
- Cloudflare Worker skeleton with Hono (health only; others return 501)
- D1 schema in migrations/0001_init.sql (not yet applied)
- Shared Zod schemas and TypeScript types
- Documentation: architecture, product principles, UI guidelines, security, walking skeleton
- Git initialised, .gitignore in place

**Not done (intentional)**:
- No real checkpoint validation
- No session management
- No D1 provisioned
- No QR code scanning
- No answer submission
- No admin interface
- No real game content

## Phase 1 — Recommended next step

Connect the scan flow end-to-end with one test checkpoint:

1. Provision D1: `wrangler d1 create busqueda-tesoro-db`
2. Apply schema: `wrangler d1 execute ... --file=migrations/0001_init.sql`
3. Seed one start checkpoint with a known token.
4. Implement `POST /api/session/start`.
5. Implement `GET /api/checkpoint/:token` with sequence enforcement.
6. Wire DemoStart form to the real API.
7. Replace DemoGame placeholder with real clue from server.
8. Deploy Worker: `wrangler deploy`.
9. Deploy frontend to Cloudflare Pages.

## Phase 2 — Answer submission

- Challenge detail screen with answer input
- `POST /api/answer` with server-side normalisation
- Correct → advance session; incorrect → feedback only

## Phase 3 — Full hunt

- All checkpoints seeded with confirmed faculty content
- Real QR codes printed
- End screen when all checkpoints completed
- Optional: read-only organiser progress view
