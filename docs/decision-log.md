# Decision Log

**Mobile-first 320–480 px**
- *Reason:* Target devices are exclusively student smartphones scanning physical QRs.
- *Status:* Accepted. No desktop-specific layout.

**React/Vite frontend**
- *Reason:* Standard, fast ecosystem.
- *Status:* Accepted.

**Worker is API-only / Cloudflare free-tier architecture / D1 database**
- *Reason:* Extremely low cost, handles traffic spikes well, edge deployment.
- *Status:* Accepted.

**Tutorías is start checkpoint, not route step**
- *Reason:* Start point is universal, gameplay route steps follow afterward.
- *Status:* Accepted.

**Opaque QR tokens / HttpOnly session**
- *Reason:* Prevents URL guessing, cheating, and token sharing.
- *Status:* Accepted.

**Server-authoritative current_step/unlocked_step & Answers stay server-side**
- *Reason:* Client cannot be trusted to self-report progression or validate answers.
- *Status:* Accepted.

**Deterministic answer normalization**
- *Reason:* Fast, predictable, doesn't require expensive/slow AI matching. No fuzzy answer matching.
- *Status:* Accepted.

**External phone camera is acceptable for MVP (No built-in camera/GPS)**
- *Reason:* Simplifies MVP. Most phones have native QR scanning.
- *Status:* Accepted.

**Real faculty facts are never invented**
- *Reason:* Prevent hallucinated information confusing players. Must be provided by real organizers.
- *Status:* Accepted.

**Question pools will be used to reduce answer-sharing usefulness**
- *Reason:* Anti-cheat mechanism without complex real-time tracking.
- *Status:* Accepted (Implemented).

**Scoring is server-authoritative and time is audit-only**
- *Reason:* Time must not determine ranking automatically because students may share answers or delay. Score is computed purely server-side from answer attempts. Configurable defaults: +100 correct, -10 wrong, floor of 0.
- *Status:* Accepted.

**Equal scores remain tied**
- *Reason:* Fast completion doesn't break ties due to offline game nature. Prize-position ties will be resolved externally/manual draw by organizers.
- *Status:* Accepted.

**Minimal Organizer Security**
- *Reason:* Environment-variable secret exchanged for a signed HttpOnly cookie. No complex OAuth needed.
- *Status:* Accepted.

**Unresolved product decisions**
- *Reason:* Final values for questions/routes, hint mechanics (if any), and printed QR logistics are still pending.
- *Status:* UNRESOLVED.

**Organizer username and password**
- *Reason:* Organizers requested a simpler login that remains safe for the public production console and does not depend on a separately enrolled authenticator.
- *Decision:* Require `ADMIN_USERNAME` and `ADMIN_PASSWORD` Cloudflare secrets. `ORGANIZER_SECRET` remains an independent cookie-signing secret so changing credentials does not silently invalidate the signing design or create a lockout dependency. Credential comparisons are timing-safe; rate limiting and signed HttpOnly/SameSite=Strict/Secure-in-production four-hour cookies remain mandatory. Production code must not be deployed before all three secrets are configured and verified.
- *Status:* Accepted; supersedes organizer TOTP authentication.

**Limited event assistance role**
- *Reason:* Tutors need to resolve answer reviews and physical QR incidents during the event without receiving full organizer privileges.
- *Decision:* `/asistencia` uses separate `ASSISTANCE_USERNAME` and `ASSISTANCE_PASSWORD` Worker secrets, a signed four-hour HttpOnly/Strict cookie, and the existing login rate limiter. The role can only read the unified assistance feed and approve/reject/resolve its items; organizer CRUD, lifecycle, score corrections, event editions, content and QR-token endpoints continue to require the independent organizer session.
- *Status:* Accepted.

**LIVE content preflight**
- *Reason:* Real navigation riddles and approved questions are operational requirements, not optional admin details.
- *Decision:* The server refuses a transition to LIVE unless required checkpoint, riddle, question, review, and event configuration checks pass. Content remains editable in DRAFT and PAUSED.
- *Status:* Accepted.

**Dynamic randomized sequence per session**
- *Reason:* Replaced global hardcoded routes with \session_steps\ to ensure each player receives a unique, randomized path through all active checkpoints, reducing bottlenecks and tailgating.
- *Status:* Accepted.

**Identity Verification (Legajo/DNI) with HMAC**
- *Reason:* Collects Legajo or DNI at the start to enforce a strict "one participation per person" rule. The identifier is securely hashed on the backend using a secret to prevent data leakage while still blocking duplicates.
- *Status:* Accepted.

**Invalidation and Release Controls**
- *Reason:* Gives organizers the power to strike cheaters or release accidentally locked identities without deleting database rows, preserving audit trails.
- *Status:* Accepted.

**Checkpoint-First Admin UX**
- *Reason:* A streamlined UI where questions are added/edited directly under their corresponding checkpoint simplifies real-world data entry.
- *Status:* Accepted.

**Checkpoint clues and optional notices**
- *Reason:* A randomized session must reveal only the current destination, while organizers need a clear place to manage its guidance and local conduct notice.
- *Decision:* Each active non-start checkpoint requires one primary clue; it may have one optional secondary clue and an optional instruction. Secondary navigation-clue use is server-side audited per session step and has no score effect. A question hint is separately persisted in `question_hint_usage` and uses the edition's configured `hint_penalty` in authoritative scoring.
- *Status:* Accepted.

**CLOSING grace period is derived from event settings**
- *Reason:* Closing registrations must not immediately interrupt participants who already started, and the deadline must work without a cron job or schema change.
- *Decision:* `event_settings.status = 'CLOSING'` blocks every new session immediately. The existing `event_settings.updated_at` value records entry into CLOSING and defines an exact 30-minute server-side grace period. A CLOSING-to-CLOSING settings save preserves that timestamp atomically. Existing active sessions may progress during the grace period; at the deadline they become effectively incomplete without mutating their persisted session or partial history. Only persisted completed sessions enter the competitive ranking.
- *Status:* Accepted.

**Event runs preserve historical participation**
- *Reason:* A global reset or a second LIVE cycle would either delete the first real event or mix its results with future play.
- *Decision:* `event_runs` owns lifecycle timestamps and an immutable scoring snapshot. `sessions.event_run_id` scopes participation and analytics; the global HMAC participant identity remains reusable. Migration 0011 assigns every existing session to Edition 1 without rebuilding sessions or changing IDs. A partial unique index enforces one non-abandoned session per participant per edition.
- *Status:* Accepted.

**Invalidation belongs to a participation, not a global identity**
- *Reason:* Invalidating one edition must not silently ban the same person from all future editions or retroactively alter unrelated results.
- *Decision:* Edition-aware invalidation is stored on `sessions`. Existing participant invalidations are copied onto their Edition 1 sessions during migration; legacy participant fields remain preserved but are no longer operational authority.
- *Status:* Accepted.

**Safe New Edition replaces hard reset**
- *Reason:* Starting another event should never require deleting participant or audit history.
- *Decision:* The normal admin action creates a DRAFT `event_run`, switches `event_settings.current_event_run_id`, and preserves all content, QR tokens, participants, sessions, attempts, hints, scans, reviews, and support rows. The legacy `/api/admin/reset` route is disabled with HTTP 410 and is absent from the UI.
- *Status:* Accepted.

**Append-only manual score correction ledger**
- *Reason:* Historical answer attempts and review decisions must remain truthful while organizers need to correct demonstrably unfair scoring outcomes.
- *Decision:* `score_adjustments` accepts only +10, +5, -10, or -5 entries with a required reason, organizer attribution and a unique idempotency key. Database triggers reject updates and deletes. Mistakes are corrected with a compensating entry that may reference the original. The score derived from attempts, approved reviews and question hints is floored at zero first; the sum of manual adjustments is then applied and the authoritative final score is floored at zero again. Detail, ranking and analytics use this same derivation.
- *Status:* Accepted.

**Historical feedback is reported only when persisted**
- *Reason:* Support requests are operational records, not evidence of an end-of-game opinion.
- *Decision:* The current schema has no student-feedback table or historical feedback write path. Organizer analytics therefore displays an honest empty state and does not reinterpret support data. A future feedback system requires its own explicit schema and collection flow.
- *Status:* Accepted.
