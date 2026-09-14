# Security Model

## QR code design

Physical QR codes embed only an **opaque token**:

```
https://<domain>/q/<opaque-token>
```

A QR must NOT contain:
- The checkpoint name or location
- Any challenge content or hints
- The correct answer
- Route or sequence information

The token is a random, unguessable identifier mapped to a checkpoint
only in the D1 database.

## Scan outcomes (server-side)

All game progression is enforced server-side.
The client never receives the complete answer key or the full sequence.

| Situation | Server response | Client shows |
|---|---|---|
| No active session | Neutral acknowledgement | "Para comenzar, buscá el QR de inicio en Tutorías." |
| Active session, wrong checkpoint | Rejection, no details | "Este no es tu próximo punto. Seguí la pista actual." |
| Active session, correct checkpoint | Challenge payload | Challenge content for this checkpoint |

In the "wrong checkpoint" case the response must NOT reveal:
- Which checkpoint was scanned
- How far from the expected one it is
- Anything about the scan token

## Answer validation

Answers are normalised before comparison:
- Lowercase
- Trim whitespace
- Collapse duplicate spaces
- Remove diacritics (configurable per challenge)
- Ignore selected punctuation (configurable per challenge)
- Explicit aliases per challenge (e.g. "French", "French 414")

Safe normalisation only — no fuzzy matching that could accept arbitrary wrong answers.

## Client-side constraints

- Client never stores or receives the answer key.
- Session tokens must be treated as secrets — never logged, never in URLs.
- Demo routes (`/demo/*`) must not exist in production builds.

## Cloudflare infrastructure

- Worker enforces all progression logic.
- D1 is not directly accessible from clients.
- CORS must be restricted to the Pages domain in production.
