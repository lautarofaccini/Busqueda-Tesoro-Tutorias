import { MobileShell } from '../components/MobileShell'
import { BrandHeader } from '../components/BrandHeader'

/**
 * PublicEntry — shown when someone opens the site without a valid QR.
 *
 * Security: must not reveal checkpoint names, clue content, or any
 * information that could advance a player without physically scanning a QR.
 */
export function PublicEntry() {
  return (
    <MobileShell>
      <BrandHeader />
      <main className="flex-1 flex flex-col px-5 pt-8 pb-10">
        <h1 className="text-[2rem] font-bold text-foreground leading-tight tracking-tight">
          Búsqueda del tesoro
        </h1>
        <p className="mt-6 text-base text-foreground leading-relaxed">
          Para comenzar, buscá el QR de inicio en Tutorías.
        </p>
      </main>
    </MobileShell>
  )
}
