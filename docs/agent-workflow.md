# Agent Workflow

Define a reusable workflow for agents entering this repository.

## START
1. Read `AGENTS.md`
2. Read `docs/current-state.md`
3. Read `docs/agent-context.md`
4. Inspect git (`git status`, `git branch`, `git log`)
5. Inspect relevant code
6. Confirm scope
7. Work on dedicated branch unless task says otherwise

## IMPLEMENT
- change the smallest necessary surface
- preserve working architecture
- avoid unrelated refactors
- add tests for meaningful state/security behavior
- keep real content separate from demo content

## FINISH
- typecheck (`npm run typecheck`)
- build (`npm run build`)
- tests (`npm test`)
- manual check when relevant
- inspect git diff
- commit logically
- update `docs/current-state.md` if phase materially changed
- report exact status
