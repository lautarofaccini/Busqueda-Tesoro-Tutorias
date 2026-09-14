import type { ReactNode } from 'react'

interface BrandHeaderProps {
  rightElement?: ReactNode
}

/**
 * Compact institutional brand header.
 * Shows "UTN | FRRe" and "TUTORÍAS" with simple typographic alignment.
 */
export function BrandHeader({ rightElement }: BrandHeaderProps) {
  return (
    <header className="pt-6 pb-4 px-6 flex items-center justify-between border-b border-border/70 select-none">
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span className="text-sm font-black tracking-wider text-foreground">UTN</span>
          <span className="text-muted/40 font-light text-xs">|</span>
          <span className="text-xs font-bold tracking-widest text-muted">FRRe</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="w-1.5 h-1.5 rounded-xs bg-brand" aria-hidden="true" />
          <span className="text-[11px] font-extrabold tracking-[0.22em] text-brand uppercase leading-none">
            TUTORÍAS
          </span>
        </div>
      </div>

      {rightElement && (
        <div className="flex items-center">
          {rightElement}
        </div>
      )}
    </header>
  )
}

