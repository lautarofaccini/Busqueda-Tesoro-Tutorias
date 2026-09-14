import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

/**
 * Base button component.
 *
 * - Full width — designed for single-column mobile layouts.
 * - Minimum height 52 px to meet mobile touch target guidelines.
 * - Two variants: primary (filled brand orange) and ghost (outlined).
 */
export function Button({
  children,
  variant = 'primary',
  className = '',
  ...rest
}: ButtonProps) {
  const base = [
    'w-full min-h-[52px] px-6 py-3 rounded',
    'text-base font-semibold',
    'transition-colors duration-150',
    'focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ].join(' ')

  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-brand text-white hover:bg-brand/90 active:bg-brand/80',
    ghost: 'bg-transparent text-brand border border-brand hover:bg-brand/10 active:bg-brand/20',
  }

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  )
}
