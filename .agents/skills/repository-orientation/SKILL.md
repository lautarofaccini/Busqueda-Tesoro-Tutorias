---
name: repository-orientation
description: How to safely navigate and understand the busqueda-tesoro-tutorias repository.
---

# Repository Orientation

## WHEN TO USE
When an agent first enters the repository or needs to understand the project structure and architectural boundaries.

## READ FIRST
- `AGENTS.md` (Root)
- `docs/current-state.md`

## PROCEDURE
1. Inspect `git status`, `git branch --show-current`, and `git log --oneline -5`.
2. Do not reset or clean uncommitted changes without explicit permission.
3. Understand the monorepo structure:
   - `apps/web`: Frontend (React/Vite).
   - `apps/api`: Backend (Cloudflare Worker/Hono).
   - `packages/shared`: Shared types and logic.
   - `migrations`: D1 schemas.
4. Check `package.json` for available scripts.

## VALIDATION
Check that `npm run typecheck` passes to confirm the repository is in a healthy state.

## DO NOT
- Do not assume chat history contains the truth; read the repository files.
- Do not modify architecture globally without permission.

## HANDOFF EXPECTATIONS
Leave the git status clear. Ensure the next agent knows what branch you were on and what to read next.
