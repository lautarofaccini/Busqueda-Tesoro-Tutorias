# Production deployment (manual)

This repository is prepared for one same-origin Worker serving static React assets and `/api/*`. Do not run local reset commands against a remote database.

1. `cd apps/api` then `npx wrangler login` and `npx wrangler whoami`.
2. Create the database: `npx wrangler d1 create busqueda-tesoro-tutorias-prod`.
3. Paste its returned ID into `apps/api/wrangler.toml` under `env.production.d1_databases`.
4. Confirm `[env.production.vars]` remains `ENVIRONMENT = "production"`.
5. Enroll a local authenticator before deploying the security hotfix: from the repository root run `npm run admin:totp:setup`, scan `.local-totp/organizer-totp-enrollment.png` with Authy (or another RFC 6238 app), then delete `.local-totp/` after confirming it. Set all three independent secrets interactively: `npx wrangler secret put ORGANIZER_SECRET --env production`, `npx wrangler secret put ORGANIZER_TOTP_SECRET --env production`, and `npx wrangler secret put PARTICIPANT_ID_SECRET --env production`. Never add secrets to this repository or `wrangler.toml`.
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

## Organizer access and LIVE safety

Organizer access requires the password secret plus an RFC 6238 TOTP code (six digits, 30 seconds). The production Worker has a dedicated rate-limit binding (`ADMIN_LOGIN_LIMITER`, 10 attempts per minute per source address); its account-local `namespace_id` in `wrangler.toml` must remain unique within the Cloudflare account.

Changing the event to LIVE is refused by the API until there is an active START checkpoint, every active non-start checkpoint has a primary navigation riddle, every active checkpoint has a playable active question, and no active question remains marked `REVISAR`. The organizer screen displays the returned checklist. Leave the event in DRAFT until that list is clear.

## Hotfix / rollback

Build and deploy the intended commit with the same `--env production`. Database migrations are additive; do not use local reset tooling or delete production content. If a release is faulty, deploy the prior known-good commit, then verify DRAFT and organizer access again.

## Content import notes

The importer is intentionally non-destructive and one-shot: rerunning it inserts another content set. It does not reset a database and never runs remotely without `--remote --database ...`. Review flags come from explicit `confirmed: false` source values and fragment-like aliases; no answer text is silently repaired.
