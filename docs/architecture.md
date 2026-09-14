# Architecture

**Project**: busqueda-tesoro-tutorias
**Implementation environment**: Antigravity
**Status**: Phase 0 — skeleton

## Overview

```
┌──────────────────────────────────────────────────┐
│  Student's phone                                  │
│  Scans QR → opens URL in mobile browser          │
└──────────────────────┬───────────────────────────┘
                       │ HTTPS
                       ▼
┌──────────────────────────────────────────────────┐
│  Cloudflare Pages                                 │
│  Static React/Vite build  (apps/web)             │
│  Mobile-first SPA — no server-side rendering     │
└──────────────────────┬───────────────────────────┘
                       │ fetch() API calls
                       ▼
┌──────────────────────────────────────────────────┐
│  Cloudflare Worker  (apps/api)                   │
│  Hono router — API ONLY                          │
│  All game progression enforced server-side       │
└──────────────────────┬───────────────────────────┘
                       │ D1 SQL
                       ▼
┌──────────────────────────────────────────────────┐
│  Cloudflare D1 (SQLite-compatible)               │
│  Tables: checkpoints, sessions, attempts         │
└──────────────────────────────────────────────────┘
```

## Repository layout

```
busqueda-tesoro-tutorias/
├── apps/
│   ├── web/          React + Vite + Tailwind v4  →  Cloudflare Pages
│   └── api/          Cloudflare Worker (Hono)    →  API only
├── packages/
│   └── shared/       Zod schemas + TypeScript types (used by both)
├── migrations/       D1 SQL migrations (not yet applied)
└── docs/             Project documentation
```

## Technology decisions

| Concern | Choice | Rationale |
|---|---|---|
| Frontend | React + Vite | Widely known, fast HMR, static build |
| Styling | Tailwind CSS v4 + @tailwindcss/vite | No PostCSS boilerplate |
| Frontend hosting | Cloudflare Pages | Free tier, global CDN |
| API runtime | Cloudflare Worker + Hono | Free tier, edge, no cold starts |
| Database | Cloudflare D1 | Free tier, SQLite, co-located with Worker |
| Validation | Zod | Runtime + compile-time, shared frontend/API |
| Package manager | npm workspaces | Simple, no extra tooling |
| Testing | Vitest + Testing Library | Vite-native, fast |

## Cost constraint

The entire production system must stay within **Cloudflare free tiers**.
No paid services. No services requiring billing information.
Do not add Supabase, Firebase, Vercel databases, or external SaaS.

## What the Worker must NOT do

The Worker is **API-only**. It must never:
- Render the frontend HTML
- Serve the React application
- Act as a reverse proxy for the frontend

React/Vite is deployed and served independently through Cloudflare Pages.
