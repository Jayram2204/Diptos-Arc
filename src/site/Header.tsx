import { useEffect, useState } from 'react'
import { ArrowUpRight, LogOut, Menu, Plus, X } from 'lucide-react'
import { WalletModal } from '@diptos/app/WalletModal'
import { useWallet } from '@/app/wallet'
import { trackFunnelEvent } from '@/lib/analytics'
import { shortHex } from '@/lib/chain'
import { getAgentUrl, getApexUrl, getAppUrl, getSdkUrl, navigate } from '@/lib/route'

const NAV_LINKS = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Live Proof', href: '#escrows' },
  { label: 'Rebate Math', href: '#tecd-risk' },
  { label: 'Contracts', href: '#registry' },
]

export function Header() {
  const { address, isConnected, disconnect } = useWallet()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(() => {
        const next = window.scrollY > 24
        setScrolled((prev) => (prev === next ? prev : next))
        ticking = false
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header
        className={`sticky top-0 z-50 h-[76px] transition-all duration-300 ${
          scrolled
            ? 'border-b border-white/10 bg-black/92 backdrop-blur-xl'
            : 'bg-black/75 backdrop-blur-sm'
        }`}
      >
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-6 px-5 lg:px-8">
          {/* Left: Clean DIPTOS. Wordmark (no ARC + BASE pill, no non-tappable decorative icons) */}
          <div className="flex items-center gap-3">
            <a
              href={getApexUrl()}
              onClick={(e) => {
                e.preventDefault()
                navigate(getApexUrl())
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="rwa-display inline-flex items-baseline rounded text-[22px] tracking-[-0.03em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
            >
              DIPTOS<span className="ml-0.5 inline-block size-2 rounded-full bg-lime" />
            </a>
            {isConnected && address && (
              <div className="hidden items-center gap-1.5 sm:inline-flex">
                <button
                  type="button"
                  onClick={() => setWalletOpen(true)}
                  className="inline-flex h-7 items-center rounded-full border border-white/15 bg-[#111111] px-3 font-mono text-[12px] text-white transition-colors hover:border-lime"
                >
                  {shortHex(address, 4, 4)}
                </button>
                <button
                  type="button"
                  onClick={() => void disconnect()}
                  aria-label="Disconnect wallet"
                  title="Disconnect"
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-white/15 bg-[#111111] px-2.5 font-mono text-[11px] text-[#A3A3A3] transition-colors hover:border-white hover:text-white"
                >
                  <LogOut className="size-3" strokeWidth={1.5} />
                </button>
              </div>
            )}
          </div>

          {/* Center: Clean Section Navigation */}
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded text-[14px] font-medium tracking-[-0.01em] text-[#A3A3A3] transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right: 3 Clearly Distinct Treatments — AI Agents, SDK Docs, Start in 1 Click */}
          <div className="flex shrink-0 items-center gap-3">
            <a
              href={getAgentUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              className="hidden h-9 shrink-0 items-center gap-1 whitespace-nowrap px-2 text-[14px] font-medium tracking-[-0.01em] text-white transition-colors hover:text-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime md:inline-flex"
            >
              AI Agents
              <ArrowUpRight className="size-3.5 text-[#A3A3A3]" strokeWidth={1.5} />
            </a>
            <a
              href={getSdkUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              className="hidden h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/25 bg-[#111111] px-4 font-mono text-[12px] font-medium tracking-[0.02em] text-white transition-colors hover:border-lime hover:text-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime sm:inline-flex"
            >
              SDK Docs
              <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
            </a>
            <a
              href={getAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                setMobileOpen(false)
                trackFunnelEvent('landing_cta_click', { location: 'header' })
              }}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-lime px-4.5 font-mono text-[12px] font-semibold tracking-[0.02em] text-ink transition-all duration-200 hover:bg-[#d8ff4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Start in 1 Click
              <Plus className="size-3.5" strokeWidth={2} />
            </a>
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle navigation menu"
              className="grid size-10 place-items-center rounded-full border border-white/20 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime lg:hidden"
            >
              {mobileOpen ? <X className="size-4" strokeWidth={1.5} /> : <Menu className="size-4" strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-b border-white/10 bg-black px-5 py-5 lg:hidden">
            <ul className="space-y-3">
              {NAV_LINKS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="block py-1 text-[15px] font-medium text-white hover:text-lime"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li className="flex flex-col gap-2.5 pt-3">
                <a
                  href={getAgentUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-white/20 font-mono text-[12.5px] text-white"
                >
                  AI Agents <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
                </a>
                <a
                  href={getSdkUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-white/20 font-mono text-[12.5px] text-white"
                >
                  SDK Docs <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
                </a>
              </li>
            </ul>
          </div>
        )}
      </header>

      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </>
  )
}
