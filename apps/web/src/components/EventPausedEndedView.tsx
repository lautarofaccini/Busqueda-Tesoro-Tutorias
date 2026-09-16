import { MobileShell } from './MobileShell'
import { BrandHeader } from './BrandHeader'

export function EventPausedEndedView({ state }: { state: 'EVENT_PAUSED' | 'EVENT_ENDED' }) {
  const isPaused = state === 'EVENT_PAUSED'
  
  return (
    <MobileShell>
      <BrandHeader />
      <main className="flex-1 flex flex-col justify-center px-6 pt-6 pb-8 text-center">
        <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center bg-amber-100 text-amber-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isPaused ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            )}
          </svg>
        </div>
        <h1 className="text-2xl font-black text-foreground mb-3">
          {isPaused ? 'Juego Pausado' : 'Juego Finalizado'}
        </h1>
        <p className="text-base text-muted font-medium leading-relaxed max-w-sm mx-auto">
          {isPaused 
            ? 'Los organizadores han pausado la búsqueda del tesoro temporalmente. Mantené esta pantalla abierta, podrás continuar tu progreso cuando se reanude.'
            : 'Los organizadores han finalizado la búsqueda del tesoro. ¡Gracias por participar! Acercate al stand de Tutorías para conocer los resultados.'}
        </p>
      </main>
    </MobileShell>
  )
}
