/**
 * Subtle development-only indicator pill.
 * Placed neatly within or near the brand header.
 */
export function DemoBadge() {
  return (
    <span
      role="status"
      aria-label="Vista de prototipo"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider text-amber-900 bg-amber-100/90 border border-amber-300/70"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
      PROTOTIPO
    </span>
  )
}

