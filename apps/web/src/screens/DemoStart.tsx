import { useState } from 'react'
import type { FormEvent } from 'react'
import { MobileShell } from '../components/MobileShell'
import { BrandHeader } from '../components/BrandHeader'
import { DemoBadge } from '../components/DemoBadge'
import { Button } from '../components/Button'

/**
 * DemoStart — prototype for the screen reached after scanning the start QR.
 *
 * DEMO ONLY. Not connected to any backend.
 * Route: /demo/start
 */
export function DemoStart() {
  const [playerName, setPlayerName] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // Phase 0: no-op. Session creation will be wired in a later phase.
  }

  return (
    <MobileShell>
      <BrandHeader rightElement={<DemoBadge />} />
      <main className="flex-1 flex flex-col justify-between px-6 pt-7 pb-8">
        {/* Top: Header & checkpoint confirmation */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-2 h-2 rounded-xs bg-brand" aria-hidden="true" />
            <span className="text-xs font-bold tracking-widest text-brand uppercase">
              Punto de partida · Tutorías
            </span>
          </div>

          <h1 className="text-3xl font-black text-foreground tracking-tight leading-tight">
            Búsqueda del tesoro
          </h1>

          {/* Accent geometric lines */}
          <div className="flex items-center gap-1.5 mt-3 mb-6" aria-hidden="true">
            <div className="h-1 w-12 bg-brand rounded-full" />
            <div className="h-1 w-4 bg-yellow rounded-full" />
          </div>

          {/* Checkpoint validated notice */}
          <div className="border-l-4 border-l-brand bg-surface border border-border rounded-r-lg p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-mono text-muted mb-1">
              <span className="font-bold text-brand uppercase tracking-wider text-[10px]">
                Punto validado
              </span>
              <span className="text-[10px]">#00-INICIO</span>
            </div>
            <p className="text-sm text-foreground font-semibold">
              QR de inicio escaneado correctamente en Tutorías.
            </p>
          </div>
        </div>

        {/* Center: Structured input form */}
        <form onSubmit={handleSubmit} className="my-auto py-6 flex flex-col gap-4" noValidate>
          <div className="bg-surface border border-border rounded-xl p-5 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="player-name"
                className="text-sm font-bold text-foreground flex items-center justify-between"
              >
                <span>Tu nombre</span>
                <span className="text-xs font-mono font-normal text-muted">Requerido</span>
              </label>
              <input
                id="player-name"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Ingresá tu nombre"
                autoComplete="given-name"
                className="w-full min-h-[52px] px-4 py-3 rounded-lg border-2 border-border text-base text-foreground bg-surface-warm placeholder:text-muted/60 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all font-medium"
              />
            </div>

            <Button type="submit" disabled={!playerName.trim()}>
              Comenzar
            </Button>
          </div>
        </form>

        {/* Bottom brand footer */}
        <footer className="pt-4 border-t border-border/70 flex items-center justify-between text-xs text-muted">
          <span className="font-bold tracking-wider uppercase text-[10px]">
            UTN FRRe · Tutorías
          </span>
          <span className="font-mono text-[10px] text-muted/70">
            Registro de participante
          </span>
        </footer>
      </main>
    </MobileShell>
  )
}

