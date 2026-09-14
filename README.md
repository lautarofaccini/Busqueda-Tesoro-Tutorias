# busqueda-tesoro-tutorias

Mobile treasure hunt application for **UTN FRRe Tutorías** — Student Day.

Students walk through the faculty, scan physical QR codes, and solve
challenges at each location.

> **Implementation environment**: Antigravity
> **Status**: Phase 0 — bootstrap

---

## Quick start

```bash
npm install
npm run dev        # starts Vite dev server
```

Open [http://localhost:5173](http://localhost:5173) in a browser set to
390 px width (or use mobile DevTools).

Demo routes available in Phase 0:

| URL | Screen |
|---|---|
| `/` | Public entry (no QR) |
| `/demo/start` | Start QR prototype |
| `/demo/game` | Active game prototype |
| `/demo/wrong-checkpoint` | Wrong checkpoint prototype |

---

## Repository structure

```
busqueda-tesoro-tutorias/
├── apps/
│   ├── web/          React + Vite + Tailwind v4  →  Cloudflare Pages
│   └── api/          Cloudflare Worker (Hono)    →  API only
├── packages/
│   └── shared/       Zod schemas + TypeScript types
├── migrations/       D1 SQL migrations (not yet applied)
└── docs/             Architecture, principles, UI guidelines, security
```

## Root scripts

| Command | Description |
|---|---|
| `npm run dev` | Frontend dev server |
| `npm run build` | Production frontend build |
| `npm run typecheck` | Type-check all workspaces |
| `npm test` | Run all tests |

## Technology

- **Frontend**: React 19, Vite 6, Tailwind CSS v4
- **API**: Cloudflare Worker, Hono
- **Database**: Cloudflare D1 — not yet provisioned
- **Validation**: Zod (shared)
- **Hosting**: Cloudflare Pages + Cloudflare Worker
- **Testing**: Vitest, Testing Library

## Design

Mobile-only. Target: 390 × 844 px. Supported: 320 – 480 px.
Wider screens: same interface centred in a narrow column.

Palette: Tutorías orange (`#E8640A`) · amber · yellow · warm off-white.

See [`docs/ui-guidelines.md`](docs/ui-guidelines.md).

## Documentation

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/product-principles.md`](docs/product-principles.md)
- [`docs/ui-guidelines.md`](docs/ui-guidelines.md)
- [`docs/security-model.md`](docs/security-model.md)
- [`docs/walking-skeleton.md`](docs/walking-skeleton.md)

## GitHub remote

Repository will be: `lautarofaccini/busqueda-tesoro-tutorias` (private).

`gh` CLI is not currently installed. To create the remote once installed
and authenticated as `lautarofaccini`:

```bash
gh repo create lautarofaccini/busqueda-tesoro-tutorias --private --source=. --remote=origin --push
```

---

*Real faculty content (room numbers, names, locations, dates) must never
be invented. All placeholder content is clearly marked `[PLACEHOLDER]`
or `[DEMO]`.*
