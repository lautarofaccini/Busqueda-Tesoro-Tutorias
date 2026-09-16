# Project: Búsqueda del Tesoro — Tutorías UTN FRRe

Real event deadline: Sunday
Mobile-first application used physically inside UTN FRRe.
Players walk around the faculty, follow clues, scan QR codes, answer challenges and advance.
Language: Spanish (Argentina) for player-facing UI. Technical documentation/code may be English.

## AUTHORITATIVE DOCUMENTS
Read these in order before starting work:
1. `AGENTS.md` (This file)
2. `docs/current-state.md`
3. `docs/agent-context.md`
4. `docs/decision-log.md`
5. task-specific docs

## STARTUP CHECKLIST
Every agent must begin by inspecting:
- `git status`
- `git branch --show-current`
- `git log --oneline -5`

Then inspect existing implementation BEFORE proposing replacements.

## RULES
- Never assume chat context exists. Repository state is the source of truth.
- Never invent UTN FRRe facts, locations, answers, names, dates, room numbers or institutional information.
- Unknown real-world content must remain explicit PLACEHOLDER/TODO.
- Never discard uncommitted work without explicit user authorization.
- Never reset/clean/checkout destructively without understanding existing work.
- Never deploy or mutate remote infrastructure unless the task explicitly authorizes it.
- Never create paid infrastructure.
- Never merge a feature branch into main unless explicitly authorized by the task/user.
- Never force push.
- Never expose correct answers to the frontend.
- Never put session IDs in QR URLs/query strings/localStorage.
- Never let frontend state control game progression.
- Always preserve server-authoritative progression.
- Always validate changes with repository-defined commands.
- Report actual results, not expected results.
- Do not claim a command/test passed unless it was actually executed.
- Prefer simple maintainable solutions because the event deadline is close.

## MVP PRIORITY
**Critical before Sunday:**
- real routes
- checkpoint question pools
- randomized persistent question assignment
- scoring/winner rules once approved
- minimal organizer results view
- production Cloudflare deployment
- real QR generation/printing
- real content
- physical mobile testing

**Backlog / optional:**
- integrated camera scanner
- fancy PWA features
- complex animations
- GPS
- advanced analytics
- generic admin CRUD
- user accounts
- infrastructure abstraction

## HANDOFF RULE
If an agent cannot finish because of quota, context, model failure, time, or tooling, it MUST leave the repository recoverable and report:
- branch
- git status
- files changed
- commits created
- what works & what does not work
- commands already run
- failing commands/errors
- next exact safe action

It must NOT reset or delete incomplete work merely to make the repo look clean.
