import { useState } from 'react'

export function GameplayRulesButton() {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className="text-sm font-bold text-brand underline" onClick={() => setOpen(true)}>Reglas</button>
    {open && <div className="fixed inset-0 z-[60] flex items-end bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Reglas del juego">
      <div className="mx-auto w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-xl font-black">Reglas</h2>
        <ul className="mt-3 space-y-2 text-sm text-neutral-700">
          <li>Seguí las pistas, encontrá cada estación, escaneá su QR y respondé el desafío.</li>
          <li>Todas las estaciones están dentro de las instalaciones de la facultad.</li>
          <li>Correcta +100 · Incorrecta -10 · Pista -5.</li>
          <li>La pista se habilita después del primer intento incorrecto y solo descuenta si la abrís.</li>
          <li>El tiempo no influye en tu puntaje.</li>
          <li>Jugá una sola vez y recorré la facu sin interrumpir clases ni actividades.</li>
        </ul>
        <button type="button" className="mt-5 w-full rounded bg-brand p-3 font-bold text-white" onClick={() => setOpen(false)}>Cerrar</button>
      </div>
    </div>}
  </>
}
