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
- *Status:* Being implemented.

**Scoring/winner model remains unresolved**
- *Reason:* Business logic for time penalties, hints, and winning rules are pending organizer confirmation.
- *Status:* UNRESOLVED.
