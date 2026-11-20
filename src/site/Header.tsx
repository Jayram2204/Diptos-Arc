import { useEffect, useState } from 'react'
import { ArrowUpRight, Menu, Plus, X } from 'lucide-react'
import { PulseDot } from '@/components/ui'
import { getApexUrl, getAppUrl, getSdkUrl, navigate } from '@/lib/route'

const NAV_LINKS = [
  { num: '01', label: 'ESCROW', href: '#escrows' },
  { num: '02', label: 'ARCHITECTURE', href: '#architecture' },
  { num: '03', label: 'TECD RISK', href: '#tecd-risk' },
  { num: '04', label: 'CONTRACTS', href: '#registry' },
]

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 h-[72px] border-b transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        scrolled
          ? 'border-white/[0.08] bg-[#090A0D]/92 backdrop-blur-xl'
          : 'border-white/[0.06] bg-[#090A0D]/70 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex h-full max-w-[1320px] items-center justify-between gap-6 px-6 lg:px-8">
        {/* Left: Institutional Wordmark + Micro Status Dot + Arc HUD tag */}
        <div className="flex items-center gap-4">
          <a
            href={getApexUrl()}
            onClick={(e) => {
              e.preventDefault()
              navigate(getApexUrl())
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="rwa-display inline-flex items-baseline text-[20px] tracking-[-0.04em] text-[#F4F2EC]"
          >
            DIPTOS<span className="ml-1 inline-block size-1.5 rounded-full bg-emerald" />
          </a>
          <span className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-[#111318] px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-secondary sm:inline-flex">
            <PulseDot color="bg-emerald" />
            ARC TESTNET // 5042002
          </span>
        </div>

        {/* Center: Numbered Editorial Nav Links */}
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="group inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-secondary transition-colors duration-200 hover:text-[#F4F2EC]"
            >
              <span className="text-secondary/60 transition-colors group-hover:text-[#F4F2EC]">{item.num}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        {/* Right: Twin Subdomain Pill CTAs (open in new window/tab) */}
        <div className="flex items-center gap-2.5">
          <a
            href={getSdkUrl()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileOpen(false)}
            className="hidden h-9 items-center gap-1.5 rounded-full border border-white/15 bg-transparent px-4 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#F4F2EC] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:border-white/30 hover:bg-white/[0.06] sm:inline-flex"
          >
            SDK LAB <ArrowUpRight className="size-3.5" />
          </a>
          <a
            href={getAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileOpen(false)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#F4F2EC] px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[#090A0D] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:bg-white"
          >
            CREATE LINK <Plus className="size-3.5" />
          </a>
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
            className="grid size-9 place-items-center rounded-full border border-white/15 text-[#F4F2EC] lg:hidden"
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-b border-white/[0.08] bg-[#090A0D] px-6 py-5 lg:hidden">
          <ul className="space-y-3">
            {NAV_LINKS.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.12em] text-[#F4F2EC]"
                >
                  <span className="text-secondary">{item.num}</span>
                  {item.label}
                </a>
              </li>
            ))}
            <li className="pt-2">
              <a
                href={getSdkUrl()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-white/15 font-mono text-[11px] uppercase tracking-[0.12em] text-[#F4F2EC]"
              >
                SDK LAB <ArrowUpRight className="size-3.5" />
              </a>
            </li>
          </ul>
        </div>
      )}
    </header>
  )
}
