import { MobileShell } from '../components/MobileShell'
import { BrandHeader } from '../components/BrandHeader'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { submitFallbackCode } from '../api/client'

/**
 * PublicEntry — shown when someone opens the site without a valid QR.
 *
 * Security: must not reveal checkpoint names, clue content, or any
 * information that could advance a player without physically scanning a QR.
 */
export function PublicEntry() {
  const navigate = useNavigate()
  const [fallbackOpen, setFallbackOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const submit = async () => {
    try {
      const state = await submitFallbackCode(code.trim())
      if (state.state === 'START_ALLOWED') void navigate(`/q/${state.startToken}`, { replace: true })
      else setMessage('Ese código no permite iniciar la búsqueda.')
    } catch { setMessage('No se pudo validar el código.') }
  }
  return (
    <MobileShell>
      <BrandHeader />
      <main className="flex-1 flex flex-col justify-between px-6 pt-7 pb-8">
        {/* Top: Header block & instruction */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-2 h-2 rounded-xs bg-brand" aria-hidden="true" />
            <span className="text-xs font-bold tracking-widest text-brand uppercase">
              Jornada institucional
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

          {/* Instruction callout */}
          <div className="border-l-4 border-l-brand bg-surface border border-border rounded-r-lg p-5 shadow-xs">
            <p className="text-base text-foreground font-semibold leading-relaxed">
              Para comenzar, buscá el QR de inicio en Tutorías.
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-2"><button className="rounded border border-brand px-4 py-3 text-sm font-bold text-brand" onClick={() => { setMessage(''); setFallbackOpen(true) }}>No puedo escanear el QR</button><button className="text-sm font-bold text-brand underline" onClick={() => setHelpOpen(true)}>¿Necesitás ayuda?</button></div>
        </div>

        {/* Center: Subtle QR geometric motif (CSS only) */}
        <div className="my-auto py-8 flex flex-col items-center justify-center" aria-hidden="true">
          <div className="relative w-44 h-44 rounded-xl border border-dashed border-border-warm bg-surface/70 p-4 flex items-center justify-center shadow-xs">
            {/* Corner brackets */}
            <div className="absolute top-2.5 left-2.5 w-4 h-4 border-t-2 border-l-2 border-brand" />
            <div className="absolute top-2.5 right-2.5 w-4 h-4 border-t-2 border-r-2 border-brand" />
            <div className="absolute bottom-2.5 left-2.5 w-4 h-4 border-b-2 border-l-2 border-brand" />
            <div className="absolute bottom-2.5 right-2.5 w-4 h-4 border-b-2 border-r-2 border-brand" />

            {/* Stylized QR cell matrix */}
            <div className="grid grid-cols-3 gap-2.5 opacity-85">
              <div className="w-8 h-8 rounded-xs bg-foreground flex items-center justify-center">
                <div className="w-3 h-3 bg-surface rounded-xs" />
              </div>
              <div className="w-8 h-8 rounded-xs bg-amber/70 flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-foreground/60 rounded-xs" />
              </div>
              <div className="w-8 h-8 rounded-xs bg-foreground flex items-center justify-center">
                <div className="w-3 h-3 bg-surface rounded-xs" />
              </div>
              <div className="w-8 h-8 rounded-xs bg-yellow/90" />
              <div className="w-8 h-8 rounded-xs border-2 border-brand flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-brand rounded-xs" />
              </div>
              <div className="w-8 h-8 rounded-xs bg-foreground/80" />
              <div className="w-8 h-8 rounded-xs bg-foreground flex items-center justify-center">
                <div className="w-3 h-3 bg-surface rounded-xs" />
              </div>
              <div className="w-8 h-8 rounded-xs bg-brand/80" />
              <div className="w-8 h-8 rounded-xs bg-amber" />
            </div>
          </div>
          <p className="mt-4 text-xs font-mono font-medium tracking-wider text-muted uppercase">
            Punto de inicio físico
          </p>
        </div>

        {/* Bottom brand footer */}
        <footer className="pt-4 border-t border-border/70 flex items-center justify-between text-xs text-muted">
          <span className="font-bold tracking-wider uppercase text-[10px]">
            Tutorías · UTN FRRe
          </span>
          <span className="font-mono text-[10px] text-muted/70">
            Resistencia, Chaco
          </span>
        </footer>
      </main>
      {fallbackOpen && <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-4"><div className="w-full rounded-xl bg-white p-5"><h2 className="text-xl font-bold">¿No podés escanear el QR?</h2><p className="mt-2 text-sm text-muted">Escribí el código que aparece debajo del QR de Tutorías.</p><input className="mt-4 w-full rounded border p-3 uppercase" value={code} onChange={e => setCode(e.target.value)} autoFocus />{message && <p className="mt-2 text-sm text-red-600">{message}</p>}<div className="mt-4 flex gap-2"><button className="flex-1 rounded border p-3" onClick={() => setFallbackOpen(false)}>Cancelar</button><button className="flex-1 rounded bg-brand p-3 font-bold text-white" onClick={() => void submit()}>Continuar</button></div></div></div>}
      {helpOpen && <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-4"><div className="w-full rounded-xl bg-white p-5"><h2 className="font-bold">¿Necesitás ayuda?</h2><button className="mt-3 w-full rounded border p-3 text-left" onClick={() => { setHelpOpen(false); setFallbackOpen(true) }}>No puedo escanear el QR</button><p className="mt-3 text-sm">Si el QR de Tutorías está dañado, fue quitado o no funciona, acercate a la oficina de Tutorías y te ayudamos a comenzar.</p><button className="mt-4 w-full rounded border p-2" onClick={() => setHelpOpen(false)}>Cerrar</button></div></div>}
    </MobileShell>
  )
}
