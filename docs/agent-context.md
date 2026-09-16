# Agent Context: Búsqueda del Tesoro — Tutorías UTN FRRe

## PRODUCT CONTEXT
- Tutorías UTN FRRe Student Day treasure hunt
- asynchronous participation during the day
- physical checkpoints distributed around the faculty
- possible areas include: Tutorías, CET, Planeamiento, SAU, Cantina, Biblioteca, Polideportivo, classrooms, stairs, halls, institutional areas. (Do NOT present those as confirmed game stations unless confirmed later).

## GAME PHILOSOPHY
- QR alone should not provide useful information.
- no-session player scanning ordinary QR should be sent toward Tutorías.
- active player scanning wrong checkpoint must not get checkpoint identity/content.
- players may receive different routes.
- checkpoints will eventually contain multiple possible environment-based questions.
- question assignment should reduce usefulness of sharing answers.
- game does not require live staff supervision.

## ARCHITECTURE
- **apps/web**: Frontend (React + Vite + TypeScript + Tailwind) - Static application.
- **apps/api**: Backend (Cloudflare Worker + Hono) - API only.
- **packages/shared**: Zod schemas and shared types.
- **migrations**: D1 schema and seeds.
- **docs**: Documentation.
- **Database**: Cloudflare D1.
- **Testing**: Vitest + local Worker/D1 integration strategy.
- **Hosting direction**: Cloudflare free-tier only.

## SECURITY MODEL
- opaque checkpoint tokens
- HttpOnly session cookie
- current_step (what the user is looking for)
- unlocked_step (what the user has scanned and can answer)
- route progression is server-side
- answer checking is server-side
- audit logs for scans and answer attempts
- replay protection
- no future checkpoint token exposure

## ANSWER NORMALIZATION
Deterministic matching:
- lowercase
- trim
- remove accents
- collapse spaces
- controlled punctuation removal
- explicit aliases only
- no AI matching
- no fuzzy/Levenshtein acceptance

## SCORING MODEL
- computed purely server-side from audit logs (answer attempts).
- configurable points: +100 correct, -10 wrong attempt (defaults).
- floor of 0.
- duration is audit-only and does not break ties automatically (to prevent speedrunning/sharing advantages).
- equal scores are explicitly represented as ties in the organizer view.
- suspicious durations (< 5 mins) are visually flagged for manual organizer review.

## CURRENT OPEN PRODUCT DECISIONS (UNRESOLVED)
- how many stations per route
- exact real stations
- exact production questions
- prize handling
(Do not invent these decisions).
