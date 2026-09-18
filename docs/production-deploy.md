# Production deployment (manual)

This repository is prepared for one same-origin Worker serving static React assets and `/api/*`. Do not run local reset commands against a remote database.

1. `cd apps/api` then `npx wrangler login` and `npx wrangler whoami`.
2. Create the database: `npx wrangler d1 create busqueda-tesoro-tutorias-prod`.
3. Paste its returned ID into `apps/api/wrangler.toml` under `env.production.d1_databases`.
4. Confirm `[env.production.vars]` remains `ENVIRONMENT = "production"`.
5. Set secrets interactively: `npx wrangler secret put ORGANIZER_SECRET --env production` and `npx wrangler secret put PARTICIPANT_ID_SECRET --env production`. Use separate secret values.
6. From repository root, run `npm run build`.
7. Apply migrations: `cd apps/api && npx wrangler d1 migrations apply busqueda-tesoro-tutorias-prod --remote --env production`.
8. Import content once, without reset: `cd ../.. && npm run content:import:remote`. It requires the explicit remote flag internally, preserves DRAFT, and leaves needs-review questions inactive.
9. Deploy Worker and static assets: `npm run deploy:production -w apps/api`.
10. Record the displayed `workers.dev` URL. Verify `/`, `/admin`, `/q/<token>`, and `/api/health` are same-origin.
11. Confirm the event is DRAFT, log in as organizer, and run production smoke tests.
12. Use the organizer reset action after smoke testing; leave the event in DRAFT.
13. Review every `REVISAR` question, correct/approve it, then explicitly activate approved questions.
14. Export final QR files only after deployment, using the public Worker URL. Do not print local/LAN QR URLs.
15. On event day, an organizer manually changes the event to LIVE.

## Hotfix / rollback

Build and deploy the intended commit with the same `--env production`. Database migrations are additive; do not use local reset tooling or delete production content. If a release is faulty, deploy the prior known-good commit, then verify DRAFT and organizer access again.

## Content import notes

The importer is intentionally non-destructive and one-shot: rerunning it inserts another content set. It does not reset a database and never runs remotely without `--remote --database ...`. Review flags come from explicit `confirmed: false` source values and fragment-like aliases; no answer text is silently repaired.
