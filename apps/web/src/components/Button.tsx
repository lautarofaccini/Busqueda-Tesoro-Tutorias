import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

/**
 * Base button component.
 *
 * - Full width for single-column mobile layouts.
 * - Min-height 52px for comfortable tap targets on phones.
 * - Primary: filled brand orange with high-contrast text.
 * - Ghost: neutral outlined button on warm surface.
 */
export function Button({
  children,
  variant = 'primary',
  className = '',
  ...rest
}: ButtonProps) {
  const base = [
    'w-full min-h-[52px] px-6 py-3.5 rounded-lg',
    'text-base font-bold text-center select-none',
    'transition-all duration-150',
    'focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2',
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none',
    'active:scale-[0.99]',
  ].join(' ')

  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-brand text-white shadow-xs hover:bg-brand-dark active:bg-brand-dark',
    ghost:
      'bg-surface text-foreground border-2 border-border hover:border-brand/50 hover:bg-surface-warm active:bg-border/20',
  }

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  )
}

