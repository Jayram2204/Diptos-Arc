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
    'bg-[#F4F2EC] text-[#090A0D] font-semibold hover:bg-white hover:-translate-y-[1px] active:translate-y-0 disabled:bg-[#161922] disabled:text-secondary/50',
  secondary:
    'border border-white/15 bg-[#111318] text-[#F4F2EC] font-medium hover:bg-white/[0.06] hover:border-white/25 hover:-translate-y-[1px] disabled:opacity-50',
  ghost:
    'border border-white/[0.08] bg-transparent text-paper/80 hover:bg-white/[0.05] hover:text-paper disabled:opacity-40',
  danger:
    'border border-crimson/40 bg-crimson/10 text-crimson font-medium hover:bg-crimson/20 disabled:opacity-40',
  ink: 'bg-[#090A0D] text-[#F4F2EC] font-medium hover:bg-[#161922] hover:-translate-y-[1px] disabled:opacity-40',
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
      className={`inline-flex items-center justify-center gap-2 rounded-full font-mono uppercase tracking-[0.12em] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:cursor-not-allowed ${
        size === 'sm' ? 'h-9 px-4 text-[11px]' : 'h-11 px-6 text-[11.5px]'
      } ${BTN[variant]} ${className}`}
      {...rest}
    >
      {loading && <LoaderCircle className="size-3.5 animate-spin" />}
      {children}
    </button>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-xl border border-white/[0.08] bg-[#111318] ${className}`}>{children}</div>
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
      className={`font-mono text-[11px] font-medium uppercase tracking-[0.14em] ${
        tone === 'paper' ? 'text-ink/60' : 'text-paper/65'
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

export function PulseDot({ color = 'bg-emerald' }: { color?: string }) {
  return (
    <span className="relative flex size-1.5">
      <span className={`absolute inset-0 animate-pulse-dot rounded-full ${color}`} />
      <span className={`relative size-1.5 rounded-full ${color}`} />
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
      className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-[#161922] text-secondary transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-white/25 hover:text-paper"
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
      <span className="flex items-baseline justify-between gap-3 font-mono text-[10.5px] uppercase tracking-[0.1em] text-secondary">
        <span className="font-medium text-paper/90">{label}</span>
        {hint && <span className="text-[10px] text-secondary/70">{hint}</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {error && <span className="mt-1 block font-mono text-[11px] text-crimson">{error}</span>}
    </label>
  )
}

export const inputCls =
  'h-10 w-full rounded-lg border border-white/[0.08] bg-[#090A0D] px-3.5 font-mono text-[13px] text-paper outline-none transition-colors duration-200 placeholder:text-paper/30 focus:border-white/30'
