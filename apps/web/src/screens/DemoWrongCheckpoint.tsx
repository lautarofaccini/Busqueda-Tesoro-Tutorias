import { useNavigate } from 'react-router-dom'
import { MobileShell } from '../components/MobileShell'
import { BrandHeader } from '../components/BrandHeader'
import { DemoBadge } from '../components/DemoBadge'
import { Button } from '../components/Button'

/**
 * DemoWrongCheckpoint — prototype for scanning a QR that is not the next checkpoint.
 *
 * DEMO ONLY.
 * Route: /demo/wrong-checkpoint
 *
 * Security (production): must not reveal the scanned checkpoint name or
 * any information that could help a player skip ahead.
 */
export function DemoWrongCheckpoint() {
  const navigate = useNavigate()

  return (
    <MobileShell>
      <BrandHeader rightElement={<DemoBadge />} />
      <main className="flex-1 flex flex-col justify-between px-6 pt-6 pb-8">
        {/* Top: Status, heading, and guidance card */}
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-amber-100/90 border border-amber-300/80 mb-3">
            <span className="w-2 h-2 rounded-xs bg-amber" aria-hidden="true" />
            <span className="text-xs font-mono font-bold tracking-wider text-amber-950 uppercase">
              PUNTO NO CORRESPONDIENTE
            </span>
          </div>

          <h1 className="text-2xl font-black text-foreground tracking-tight leading-tight">
            Este no es tu próximo punto.
          </h1>

          {/* Accent geometric lines in amber & yellow */}
          <div className="flex items-center gap-1.5 mt-2.5 mb-5" aria-hidden="true">
            <div className="h-1 w-12 bg-amber rounded-full" />
            <div className="h-1 w-4 bg-yellow rounded-full" />
          </div>

          {/* Guidance card with warm surface and amber accent */}
          <div className="border border-border-warm bg-surface-warm rounded-xl p-5 border-l-4 border-l-amber shadow-xs relative">
            <p className="text-base text-foreground font-semibold leading-relaxed">
              Seguí la pista actual.
            </p>

            <p className="mt-2 text-sm text-muted leading-relaxed">
              Este código QR pertenece a otra parada del recorrido. Revisá tu pista activa para encontrar el lugar correcto.
            </p>
          </div>
        </div>

        {/* Center: Waypoint geometric motif */}
        <div className="my-auto py-5 flex flex-col items-center justify-center text-center" aria-hidden="true">
          <div className="relative w-14 h-14 rounded-xl bg-amber-100/80 border border-amber-300/70 flex items-center justify-center shadow-xs">
            <div className="w-7 h-7 rounded-full border-2 border-dashed border-amber/60 flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-brand rounded-xs rotate-45" />
            </div>
          </div>
          <p className="mt-3 text-xs font-mono font-medium tracking-wider text-muted uppercase">
            Verificá tu ubicación
          </p>
        </div>

        {/* Bottom: Action to return to current mission */}
        <div className="pt-4">
          <Button variant="primary" onClick={() => { void navigate('/demo/game') }}>
            Volver a mi misión
          </Button>
        </div>
      </main>
    </MobileShell>
  )
}

