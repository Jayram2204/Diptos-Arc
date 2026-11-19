import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Check, Copy, LoaderCircle } from 'lucide-react'
import { useCopy } from '@/lib/hooks'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  loading?: boolean
}

const BTN = {
  primary: 'bg-gold text-canvas font-semibold hover:bg-[#edb955] disabled:bg-elevated disabled:text-secondary/50',
  secondary:
    'border border-white/[0.1] bg-elevated text-primary font-medium hover:border-white/[0.22] disabled:opacity-50',
  ghost: 'border border-white/[0.08] bg-transparent text-secondary hover:border-white/[0.18] hover:text-primary disabled:opacity-40',
  danger: 'border border-crimson/40 bg-crimson/10 text-crimson font-medium hover:bg-crimson/20 disabled:opacity-40',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className = '',
  children,
  disabled,
  ...rest
}: BtnProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg transition-colors disabled:cursor-not-allowed ${
        size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-10 px-4 text-[13px]'
      } ${BTN[variant]} ${className}`}
      {...rest}
    >
      {loading && <LoaderCircle className="size-3.5 animate-spin" />}
      {children}
    </button>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-[10px] border border-white/[0.08] bg-surface ${className}`}>{children}</div>
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-gold">{children}</p>
  )
}

export function PulseDot({ color = 'bg-emerald' }: { color?: string }) {
  return (
    <span className="relative flex size-2">
      <span className={`absolute inset-0 animate-pulse-dot rounded-full ${color}`} />
      <span className={`relative size-2 rounded-full ${color}`} />
    </span>
  )
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const { copied, copy } = useCopy()
  const done = copied === value
  return (
    <button
      type="button"
      onClick={() => copy(value)}
      aria-label={done ? 'Copied' : label}
      title={done ? 'Copied' : label}
      className="grid size-7 shrink-0 place-items-center rounded-md border border-white/[0.08] bg-elevated text-secondary transition-colors hover:border-white/[0.2] hover:text-primary"
    >
      {done ? <Check className="size-3.5 text-emerald" /> : <Copy className="size-3.5" />}
    </button>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: ReactNode
  error?: string | null
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3 text-[12px] text-secondary">
        <span className="font-medium text-primary/90">{label}</span>
        {hint && <span className="font-mono text-[10px] text-secondary/70">{hint}</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {error && <span className="mt-1 block text-[11px] text-crimson">{error}</span>}
    </label>
  )
}

export const inputCls =
  'h-10 w-full rounded-lg border border-white/[0.08] bg-elevated px-3 text-[13px] text-primary outline-none transition-colors placeholder:text-secondary/45 focus:border-gold/60'
