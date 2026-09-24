# Production deployment (manual)

This repository is prepared for one same-origin Worker serving static React assets and `/api/*`. Do not run local reset commands against a remote database.

Production contains irreplaceable event history. Never run reset, seed, content import or destructive SQL against it. Migration 0011 is already applied. The manual-only scoring hotfix requires no database migration; do not rerun migrations for this release.

1. From `apps/api`, run `npx wrangler login` and `npx wrangler whoami`. Confirm `wrangler.toml` still targets Worker `tesoro`, D1 `busqueda-tesoro-tutorias-prod`, and its already configured production UUID. Do not create or replace the database.
2. Verify the reported historical counts read-only before release. Do not modify answer attempts, reviews, sessions or adjustments as part of verification.
3. Configure secrets interactively from `apps/api`: run `npx wrangler secret put ADMIN_USERNAME --env production` and enter `adminTutores21`; run `npx wrangler secret put ADMIN_PASSWORD --env production` and enter a new strong secret password; then verify the existing `ORGANIZER_SECRET` remains configured. Do not reuse the username as the password. Preserve `PARTICIPANT_ID_SECRET`, `ASSISTANCE_USERNAME`, and `ASSISTANCE_PASSWORD`; never print or commit their values.
4. From the repository root, check out the exact validated commit and run `npm run typecheck`, `npm run build`, and the documented tests. Run `cd apps/api` then `npx wrangler deploy --dry-run --env production`.
5. Deploy Worker and static assets from the same commit: from `apps/api`, run `npx wrangler deploy --env production`. Do not run `d1 migrations apply`, seed, import or reset commands.
6. Verify `https://tesoro.tutorias-frre.workers.dev/api/health`, load `/admin`, log in, and confirm Ema shows base/final score 345 with 14 raw errors before any manual adjustment. Confirm the ranking and career/event aggregates use the same value. Do not create a correction during this smoke test.
7. If verification fails, redeploy the prior known-good Worker while preserving D1. This hotfix has no schema rollback step because it changes no schema or historical data.

## Organizer access and LIVE safety

Organizer access requires the `ADMIN_USERNAME` and `ADMIN_PASSWORD` secrets. `ORGANIZER_SECRET` signs the session cookie and must remain independent. The production Worker has a dedicated rate-limit binding (`ADMIN_LOGIN_LIMITER`, 10 attempts per minute per source address); its account-local `namespace_id` in `wrangler.toml` must remain unique within the Cloudflare account. Cookies are HttpOnly, SameSite=Strict, Secure in production and expire after four hours.

The limited `/asistencia` panel uses its own `ASSISTANCE_USERNAME` and `ASSISTANCE_PASSWORD` secrets and a separate four-hour cookie. That role can only read and resolve assistance/review records; its cookie is not accepted by organizer routes.

Changing the event to LIVE is refused by the API until there is an active START checkpoint, every active non-start checkpoint has a primary navigation riddle, every active checkpoint has a playable active question, and no active question remains marked `REVISAR`. The organizer screen displays the returned checklist. Leave the event in DRAFT until that list is clear.

## Hotfix / rollback

Build and deploy the intended commit with the same `--env production`. Database migrations are additive; do not use local reset tooling or delete production content. If a release is faulty, deploy the prior known-good Worker and preserve the migrated database, then verify organizer access and read-only historical totals. Database recovery must use the verified Time Travel/backup point.

## Content import notes

The importer is intentionally non-destructive and one-shot: rerunning it inserts another content set. It does not reset a database and never runs remotely without `--remote --database ...`. Review flags come from explicit `confirmed: false` source values and fragment-like aliases; no answer text is silently repaired.
