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

**Organizer password + TOTP**
- *Reason:* The public production organizer console requires stronger protection than one static password alone.
- *Decision:* Require `ORGANIZER_SECRET` and an independent RFC 6238-compatible six-digit TOTP secret. Authy is supported as a standard TOTP authenticator without an Authy API integration. Organizer cookies are signed, HttpOnly, same-site strict, secure in production, and expire after four hours.
- *Status:* Accepted.

**Limited event assistance role**
- *Reason:* Tutors need to resolve answer reviews and physical QR incidents during the event without receiving full organizer privileges.
- *Decision:* `/asistencia` uses separate `ASSISTANCE_USERNAME` and `ASSISTANCE_PASSWORD` Worker secrets, a signed four-hour HttpOnly/Strict cookie, and the existing login rate limiter. The role can only read the unified assistance feed and approve/reject/resolve its items; organizer CRUD, lifecycle, reset, content and QR-token endpoints continue to require the independent organizer TOTP session.
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
- *Decision:* Each active non-start checkpoint requires one primary clue; it may have one optional secondary clue and an optional instruction. Secondary-clue use is server-side audited per session step. The configured hint penalty remains unapplied until an explicit scoring decision and test are approved.
- *Status:* Accepted.
