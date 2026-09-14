import { useNavigate } from 'react-router-dom'
import { MobileShell } from '../components/MobileShell'
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
      <DemoBadge />
      <main className="flex-1 flex flex-col px-5 pt-8 pb-10">
        <div className="w-8 h-[3px] bg-error rounded" aria-hidden="true" />

        <h1 className="mt-6 text-2xl font-bold text-foreground leading-tight">
          Este no es tu próximo punto.
        </h1>

        <p className="mt-4 text-base text-foreground leading-relaxed">
          Seguí la pista actual.
        </p>

        <div className="mt-auto pt-10">
          <Button variant="ghost" onClick={() => { void navigate('/demo/game') }}>
            Volver a mi misión
          </Button>
        </div>
      </main>
    </MobileShell>
  )
}
