---
name: handoff-recovery
description: Protocol for stopping work due to context limits or errors.
---

# Handoff & Recovery

## WHEN TO USE
When you hit context limits, tool limits, time limits, or cannot complete the delegated task.

## READ FIRST
- `AGENTS.md` (Handoff Rule)

## PROCEDURE
1. Commit any working code with `[WIP]` or logical commit messages.
2. If the current changes break the build, stash them or explicitly mention the breakage in the handoff report.
3. Produce a final report containing:
   - branch
   - git status
   - files changed
   - commits created
   - what works & what does not work
   - commands already run
   - failing commands/errors
   - next exact safe action

## VALIDATION
Read the final report you generated to ensure it contains everything another agent needs to pick up seamlessly.

## DO NOT
- Do not reset, `git checkout -- .`, or delete incomplete work merely to make the repository look clean.

## HANDOFF EXPECTATIONS
A seamless continuation experience for the next agent.
