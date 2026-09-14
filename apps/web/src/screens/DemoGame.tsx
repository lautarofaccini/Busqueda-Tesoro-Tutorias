import { MobileShell } from '../components/MobileShell'
import { DemoBadge } from '../components/DemoBadge'
import { Button } from '../components/Button'

/**
 * DemoGame — prototype for an active game state showing a placeholder clue.
 *
 * DEMO ONLY. All content is clearly marked as placeholder.
 * Route: /demo/game
 */
export function DemoGame() {
  return (
    <MobileShell>
      <DemoBadge />
      <main className="flex-1 flex flex-col px-5 pt-8 pb-10">
        {/* Checkpoint position indicator */}
        <p className="text-xs font-semibold tracking-widest uppercase text-muted">
          Punto 1 de N {/* [PLACEHOLDER] */}
        </p>

        <h1 className="mt-1 text-2xl font-bold text-foreground leading-tight">
          Tu próxima pista
        </h1>

        {/* Clue card */}
        <div className="mt-6 border border-border rounded bg-surface p-5">
          <p className="text-[10px] font-mono font-semibold tracking-widest uppercase text-muted/70 mb-3">
            [PLACEHOLDER — contenido de ejemplo]
          </p>
          <p className="text-base text-foreground leading-relaxed">
            Esta es una pista de demostración. El contenido real será definido
            junto con el equipo de Tutorías.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-auto pt-10 flex flex-col gap-3">
          <Button>Escanear QR</Button>
          <button
            type="button"
            className="w-full py-3 text-sm font-medium text-brand text-center hover:underline focus-visible:outline-2 focus-visible:outline-brand rounded"
          >
            Ver pista
          </button>
        </div>
      </main>
    </MobileShell>
  )
}
