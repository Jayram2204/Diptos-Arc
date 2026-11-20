import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Check, Copy, LoaderCircle } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'emerald'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-lime text-ink font-semibold hover:bg-[#d8ff4d] hover:-translate-y-[1px] active:scale-[0.98]',
  secondary:
    'bg-transparent hover:bg-paper/10 text-paper border border-paper/25 hover:border-lime hover:text-lime',
  ghost: 'bg-transparent hover:bg-paper/8 text-secondary hover:text-paper',
  danger: 'bg-crimson/15 text-crimson border border-crimson/35 hover:bg-crimson/25',
  emerald: 'bg-emerald/15 text-emerald border border-emerald/40 hover:bg-emerald/25',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-[11px] gap-1.5 rounded-full font-mono uppercase tracking-[0.12em]',
  md: 'h-11 px-5 text-[11.5px] gap-2 rounded-full font-mono uppercase tracking-[0.12em]',
  lg: 'h-12 px-7 text-[12px] gap-2.5 rounded-full font-mono uppercase tracking-[0.14em]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex cursor-pointer items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] select-none disabled:pointer-events-none disabled:opacity-45 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {loading && <LoaderCircle className="size-3.5 animate-spin" />}
      {children}
    </button>
  )
}

export function Card({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-paper/10 bg-surface ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`rwa-hud inline-flex items-center gap-2.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.14em] text-lime ${className}`}
    >
      <span className="size-1.5 rounded-full bg-lime" />
      {children}
    </span>
  )
}

export function CopyButton({
  value,
  label = 'Copy',
  className = '',
}: {
  value: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      }}
      title={label}
      aria-label={label}
      className={`inline-flex cursor-pointer items-center gap-1 rounded-full border border-paper/15 bg-black/50 px-2.5 py-1 font-mono text-[10.5px] text-secondary transition-colors hover:border-lime/60 hover:text-lime ${className}`}
    >
      {copied ? <Check className="size-3 text-lime" /> : <Copy className="size-3" />}
      {copied ? 'COPIED' : ''}
    </button>
  )
}

export function PulseDot({ color = 'bg-lime' }: { color?: string }) {
  return (
    <span className="relative inline-flex size-2">
      <span className={`absolute inline-flex h-full w-full animate-pulse-dot rounded-full ${color}`} />
      <span className={`relative inline-flex size-2 rounded-full ${color}`} />
    </span>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-secondary">
          {label}
        </span>
        {hint && <span className="font-mono text-[10px] text-secondary/75">{hint}</span>}
      </div>
      {children}
    </label>
  )
}

export const inputCls =
  'h-10 w-full rounded-xl border border-paper/12 bg-elevated px-3.5 text-[13.5px] text-paper placeholder:text-secondary/45 outline-none transition-colors focus:border-lime'

/** IntersectionObserver scroll-triggered reveal wrapper */
export function Reveal({
  children,
  className = '',
  delayMs = 0,
}: {
  children: ReactNode
  className?: string
  delayMs?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            io.disconnect()
            break
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      data-visible={visible}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={`rwa-reveal ${className}`}
    >
      {children}
    </div>
  )
}
