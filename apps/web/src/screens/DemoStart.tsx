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
      <DemoBadge />
      <BrandHeader />
      <main className="flex-1 flex flex-col px-5 pt-8 pb-10">
        <h1 className="text-[2rem] font-bold text-foreground leading-tight tracking-tight">
          Búsqueda del tesoro
        </h1>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="player-name"
              className="text-sm font-medium text-foreground"
            >
              Tu nombre
            </label>
            <input
              id="player-name"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Ingresá tu nombre"
              autoComplete="given-name"
              className={[
                'w-full min-h-[52px] px-4 py-3 rounded border',
                'text-base text-foreground bg-surface placeholder:text-muted/70',
                'border-border focus:outline-2 focus:outline-brand',
                'focus:outline-offset-0 focus:border-brand transition-colors duration-150',
              ].join(' ')}
            />
          </div>

          <Button type="submit" disabled={!playerName.trim()}>
            Comenzar
          </Button>
        </form>
      </main>
    </MobileShell>
  )
}
