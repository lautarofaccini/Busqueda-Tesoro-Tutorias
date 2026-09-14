import { MobileShell } from '../components/MobileShell'
import { BrandHeader } from '../components/BrandHeader'
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
      <BrandHeader rightElement={<DemoBadge />} />
      <main className="flex-1 flex flex-col justify-between px-6 pt-6 pb-8">
        {/* Top: Status, heading, and clue container */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-amber-100/90 border border-amber-300/80">
              <span className="w-2 h-2 rounded-xs bg-brand" aria-hidden="true" />
              <span className="text-xs font-mono font-bold tracking-wider text-amber-950 uppercase">
                MISIÓN 1 DE 6
              </span>
            </div>
            <span className="text-xs font-mono font-semibold text-muted">
              EN CURSO
            </span>
          </div>

          <h1 className="text-2xl font-black text-foreground tracking-tight leading-tight">
            Tu próxima pista
          </h1>

          {/* Accent geometric lines */}
          <div className="flex items-center gap-1.5 mt-2.5 mb-5" aria-hidden="true">
            <div className="h-1 w-12 bg-brand rounded-full" />
            <div className="h-1 w-4 bg-yellow rounded-full" />
          </div>

          {/* Clue card with warm surface and brand accent */}
          <div className="border border-border-warm bg-surface-warm rounded-xl p-5 border-l-4 border-l-brand shadow-xs relative">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/60">
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-brand bg-brand/10 px-2 py-0.5 rounded">
                PISTA ACTIVA
              </span>
              <span className="text-[10px] font-mono font-semibold tracking-wider text-muted/70 uppercase">
                [PLACEHOLDER]
              </span>
            </div>

            <p className="text-base text-foreground font-medium leading-relaxed">
              Esta es una pista de demostración. El contenido real será definido
              junto con el equipo de Tutorías.
            </p>

            <div className="mt-4 pt-3 border-t border-dashed border-border/80 flex items-center gap-2 text-xs text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-amber" aria-hidden="true" />
              <span>Buscá el código QR en la ubicación descrita</span>
            </div>
          </div>
        </div>

        {/* Center: Walking prompt motif */}
        <div className="my-auto py-5 flex flex-col items-center justify-center text-center" aria-hidden="true">
          <div className="w-11 h-11 rounded-full bg-amber-100/70 border border-amber-300/60 flex items-center justify-center mb-2">
            <span className="text-xs font-mono font-black text-amber-900">QR</span>
          </div>
          <p className="text-xs text-muted font-medium max-w-[240px] leading-relaxed">
            Al llegar al punto físico, escaneá el código para continuar.
          </p>
        </div>

        {/* Bottom: Actions */}
        <div className="pt-4 flex flex-col gap-2.5">
          <Button variant="primary">
            Escanear QR
          </Button>
          <button
            type="button"
            className="w-full min-h-[46px] py-2.5 text-sm font-bold text-brand bg-transparent hover:bg-brand/5 active:bg-brand/10 rounded-lg transition-colors text-center focus-visible:outline-2 focus-visible:outline-brand"
          >
            Ver pista
          </button>
        </div>
      </main>
    </MobileShell>
  )
}

