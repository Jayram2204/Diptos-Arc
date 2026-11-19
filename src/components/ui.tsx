import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Check, Copy, LoaderCircle } from 'lucide-react'
import { useCopy } from '@/lib/hooks'
import { useReveal } from '@/lib/SmoothScroll'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'ink'
  size?: 'sm' | 'md'
  loading?: boolean
}

const BTN = {
  primary:
    'bg-lime text-ink font-semibold hover:bg-[#d8ff4d] hover:scale-[1.02] active:scale-[0.99] disabled:bg-elevated disabled:text-secondary/50',
  secondary:
    'border border-paper/20 bg-surface text-paper font-medium hover:border-lime hover:text-lime disabled:opacity-50',
  ghost:
    'border border-paper/15 bg-transparent text-paper/80 hover:border-paper/40 hover:text-paper disabled:opacity-40',
  danger:
    'border border-crimson/40 bg-crimson/10 text-crimson font-medium hover:bg-crimson/20 disabled:opacity-40',
  ink: 'bg-ink text-paper font-medium hover:bg-ink/85 hover:scale-[1.02] disabled:opacity-40',
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
      className={`inline-flex items-center justify-center gap-2 rounded-full font-mono uppercase tracking-[0.14em] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:cursor-not-allowed ${
        size === 'sm' ? 'h-9 px-4 text-[11px]' : 'h-12 px-7 text-[11.5px]'
      } ${BTN[variant]} ${className}`}
      {...rest}
    >
      {loading && <LoaderCircle className="size-3.5 animate-spin" />}
      {children}
    </button>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl border border-paper/10 bg-surface ${className}`}>{children}</div>
}

export function Eyebrow({
  children,
  tone = 'dark',
}: {
  children: ReactNode
  tone?: 'dark' | 'paper'
}) {
  return (
    <p
      className={`font-mono text-[11.5px] font-medium uppercase tracking-[0.14em] ${
        tone === 'paper' ? 'text-ink/60' : 'text-lime'
      }`}
    >
      {children}
    </p>
  )
}

export function Reveal({
  children,
  delayMs = 0,
  className = '',
}: {
  children: ReactNode
  delayMs?: number
  className?: string
}) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      data-visible={visible ? 'true' : 'false'}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`rwa-reveal ${className}`}
    >
      {children}
    </div>
  )
}

export function PulseDot({ color = 'bg-lime' }: { color?: string }) {
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
      className="grid size-8 shrink-0 place-items-center rounded-full border border-paper/15 bg-elevated text-secondary transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-lime hover:text-lime"
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
      <span className="flex items-baseline justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.1em] text-secondary">
        <span className="font-medium text-paper/90">{label}</span>
        {hint && <span className="text-[10px] text-secondary/70">{hint}</span>}
      </span>
      <div className="mt-2">{children}</div>
      {error && <span className="mt-1.5 block font-mono text-[11px] text-crimson">{error}</span>}
    </label>
  )
}

export const inputCls =
  'h-11 w-full rounded-xl border border-paper/15 bg-black/60 px-3.5 font-mono text-[13px] text-paper outline-none transition-colors duration-300 placeholder:text-paper/30 focus:border-lime'
