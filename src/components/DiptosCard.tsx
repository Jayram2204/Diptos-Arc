import type { ComponentType, ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'

export type DiptosCardVariant = 'white' | 'lime' | 'graphite'

export interface DiptosCardProps {
  variant: DiptosCardVariant
  title: string
  subtitle?: string
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  href?: string
  external?: boolean
  onClick?: () => void
  className?: string
}

const VARIANT_STYLES: Record<
  DiptosCardVariant,
  {
    surface: string
    corner: string
    rule: string
    title: string
    subtitle: string
    icon: string
    gridLine: string
    arrow: string
  }
> = {
  white: {
    surface: 'bg-[#FFFFFF] text-[#000000] border border-black/10 hover:border-black/30',
    corner: 'text-black/35',
    rule: 'border-black/10',
    title: 'text-[#000000]',
    subtitle: 'text-black/65',
    icon: 'text-[#000000]',
    gridLine: 'rgba(0, 0, 0, 0.08)',
    arrow: 'text-black/60 group-hover:text-black',
  },
  lime: {
    surface: 'bg-[#CCFF00] text-[#000000] border border-black/15 hover:border-black/35',
    corner: 'text-black/40',
    rule: 'border-black/15',
    title: 'text-[#000000]',
    subtitle: 'text-black/75',
    icon: 'text-[#000000]',
    gridLine: 'rgba(0, 0, 0, 0.12)',
    arrow: 'text-black/70 group-hover:text-black',
  },
  graphite: {
    surface: 'bg-[#111111] text-[#FFFFFF] border border-[#222222] hover:border-white/30',
    corner: 'text-white/30',
    rule: 'border-white/10',
    title: 'text-[#FFFFFF]',
    subtitle: 'text-[#A3A3A3]',
    icon: 'text-[#FFFFFF]',
    gridLine: 'rgba(255, 255, 255, 0.08)',
    arrow: 'text-[#A3A3A3] group-hover:text-[#CCFF00]',
  },
}

/**
 * Compact architectural blueprint card styled strictly in Diptos's 3-color system
 * (Black/Graphite, White, Electric Lime) with top corner `+` marks and a centered 8x8 micro-grid.
 */
export function DiptosCard({
  variant,
  title,
  subtitle,
  icon: Icon,
  href,
  external = true,
  onClick,
  className = '',
}: DiptosCardProps) {
  const s = VARIANT_STYLES[variant]
  const interactive = Boolean(href || onClick)

  const content = (
    <>
      {/* Top-left & top-right `+` corner registration marks */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-3 top-2.5 font-mono text-[11px] leading-none select-none ${s.corner}`}
      >
        +
      </span>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute right-3 top-2.5 font-mono text-[11px] leading-none select-none ${s.corner}`}
      >
        +
      </span>

      {/* Centered 8x8 micro-grid holding one crisp 1.5px Lucide icon */}
      <div className="flex items-center justify-center py-5">
        <div
          className="grid size-[96px] place-items-center"
          style={{
            backgroundImage: `linear-gradient(to right, ${s.gridLine} 1px, transparent 1px), linear-gradient(to bottom, ${s.gridLine} 1px, transparent 1px)`,
            backgroundSize: '12px 12px',
          }}
        >
          <Icon className={`size-7 ${s.icon}`} strokeWidth={1.5} />
        </div>
      </div>

      {/* Thin internal rule + tight footer row */}
      <div className={`flex items-end justify-between gap-2.5 border-t pt-3 ${s.rule}`}>
        <div className="min-w-0">
          <p className={`truncate text-[14.5px] font-semibold tracking-[-0.015em] ${s.title}`}>{title}</p>
          {subtitle && (
            <p className={`mt-0.5 line-clamp-2 text-[13px] leading-snug ${s.subtitle}`}>{subtitle}</p>
          )}
        </div>
        {interactive && (
          <ArrowUpRight
            className={`size-4 shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 ${s.arrow}`}
            strokeWidth={1.5}
          />
        )}
      </div>
    </>
  )

  const baseClass = `group relative flex flex-col justify-between rounded-[12px] p-4 transition-all duration-200 ${
    interactive ? 'cursor-pointer hover:-translate-y-0.5' : ''
  } ${s.surface} ${className}`

  if (href) {
    return (
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className={baseClass}
      >
        {content}
      </a>
    )
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`text-left ${baseClass}`}>
        {content}
      </button>
    )
  }

  return <div className={baseClass}>{content}</div>
}

/**
 * Linear horizontal connector row for compact DiptosCard tiles:
 * connects cards with subtle 1px dotted rgba(255,255,255,0.22) paths on desktop and stacks cleanly on mobile.
 */
export function DiptosCardRow({ children, className = '' }: { children: ReactNode[]; className?: string }) {
  return (
    <div className={`flex flex-col items-stretch gap-3 md:flex-row md:items-stretch md:gap-0 ${className}`}>
      {children.map((child, idx) => (
        <div key={idx} className="flex flex-1 flex-col md:flex-row md:items-center">
          <div className="w-full flex-1">{child}</div>
          {idx < children.length - 1 && (
            <div
              aria-hidden="true"
              className="hidden w-6 shrink-0 border-t border-dotted border-white/25 md:block lg:w-8"
            />
          )}
        </div>
      ))}
    </div>
  )
}
