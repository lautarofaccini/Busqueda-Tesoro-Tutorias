/**
 * Visible banner marking a screen as a Phase 0 prototype.
 * Must not appear on any production route.
 */
export function DemoBadge() {
  return (
    <div
      className="w-full bg-yellow/25 border-b border-yellow/50 px-5 py-2"
      role="status"
      aria-label="Vista de prototipo"
    >
      <p className="text-[11px] font-mono text-foreground/60 tracking-wide">
        [DEMO] Vista de prototipo — no funcional
      </p>
    </div>
  )
}
