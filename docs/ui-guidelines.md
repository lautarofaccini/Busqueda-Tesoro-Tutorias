# UI Guidelines

## Design tokens

Defined in `apps/web/src/index.css` via Tailwind v4 `@theme {}`.

| Token (CSS var) | Value | Tailwind class | Use |
|---|---|---|---|
| `--color-canvas` | `#FAF8F5` | `bg-canvas` | Page background |
| `--color-surface` | `#FFFFFF` | `bg-surface` | Card / input background |
| `--color-foreground` | `#1A1A1A` | `text-foreground` | Primary text |
| `--color-muted` | `#555550` | `text-muted` | Secondary / label text |
| `--color-brand` | `#E8640A` | `bg-brand` / `text-brand` | Tutorías orange — primary actions |
| `--color-amber` | `#D97706` | `bg-amber` / `text-amber` | Warm amber accent |
| `--color-yellow` | `#F5C842` | `bg-yellow` / `text-yellow` | Highlight / demo badge |
| `--color-border` | `#E8E2D9` | `border-border` | Input and card borders |
| `--color-success` | `#16A34A` | `text-success` / `bg-success` | Correct answer feedback |
| `--color-error` | `#DC2626` | `text-error` / `bg-error` | Wrong checkpoint / error |

## Typography

Phase 0 uses `system-ui, -apple-system, sans-serif` — OS native sans-serif.
No external font dependencies.

Hierarchy:
- Screen title: `text-[2rem] font-bold` (32 px)
- Section heading: `text-2xl font-bold` (24 px)
- Body: `text-base` (16 px)
- Label / metadata: `text-sm font-medium` (14 px)
- Badge / micro: `text-xs` or `text-[11px]`

## Layout

Every screen wraps in `MobileShell`:

```tsx
<div className="min-h-dvh bg-canvas flex justify-center">
  <div className="w-full max-w-[480px] min-h-dvh flex flex-col">
    {children}
  </div>
</div>
```

- `min-h-dvh`: dynamic viewport height — handles mobile browser chrome.
- `max-w-[480px]`: caps the column. Fills phones, centres on wider screens.
- Content padding: `px-5` (20 px) horizontal.

## Touch targets

Minimum interactive height: **52 px** (`min-h-[52px]`).
Applied to: buttons, inputs, tappable rows.

## Component inventory (Phase 0)

| Component | File | Notes |
|---|---|---|
| `MobileShell` | `components/MobileShell.tsx` | Outer layout wrapper |
| `BrandHeader` | `components/BrandHeader.tsx` | "UTN FRRe · Tutorías" label |
| `DemoBadge` | `components/DemoBadge.tsx` | Prototype warning banner |
| `Button` | `components/Button.tsx` | primary + ghost variants |

## What to avoid

- Desktop navigation with multiple horizontal links
- Multi-column layouts at any breakpoint
- Decorative gradients
- Excessive box-shadow / elevation
- Overcrowded spacing
- Finished decorative illustrations (placeholder text is acceptable)
