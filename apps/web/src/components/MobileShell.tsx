import type { ReactNode } from 'react'

interface MobileShellProps {
  children: ReactNode
}

/**
 * Root layout shell — mobile-first.
 *
 * - Phones (< 480 px): fills the full viewport width.
 * - Wider screens: centres a 480 px column. No alternate layout is introduced.
 * - min-h-dvh: covers the dynamic viewport height so the shell never ends
 *   above the bottom of the visible phone screen.
 */
export function MobileShell({ children }: MobileShellProps) {
  return (
    <div className="min-h-dvh bg-canvas flex justify-center">
      <div className="w-full max-w-[480px] min-h-dvh flex flex-col">
        {children}
      </div>
    </div>
  )
}
