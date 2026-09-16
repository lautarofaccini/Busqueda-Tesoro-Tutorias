# Agent Delegation / Orchestration

This folder contains orchestration instructions and delegation templates for multi-agent workflows.
The main agent must be able to delegate a task to another AI/model without relying on chat history.

## Model Routing Guidance
Do not make the project depend on specific commercial model names. Use capability classes:

**HIGH-REASONING MODEL:**
- backend state
- database migrations
- security
- concurrency
- architecture
- scoring logic
- production deployment
- difficult debugging
*(Examples: Gemini Pro High, Claude Sonnet/Opus Thinking)*

**FAST GENERAL MODEL:**
- frontend visual adjustments
- content entry
- documentation
- repetitive seeds/data
- simple refactors
*(Examples: Gemini Flash Medium)*

**INDEPENDENT REVIEW MODEL:**
- security review
- release review
- suspicious diff review
- final test/check before deploy

## Orchestration Rules
The orchestrating agent must:
- inspect delegated work after completion.
- review git diff.
- rerun relevant validation.
- never accept another agent's claim purely on trust.
- never have two agents concurrently edit overlapping files unless explicitly coordinated.
