import { useEffect, useState } from 'react'
import { ArrowUpRight, ChevronDown, LogOut, Menu, Plus, X } from 'lucide-react'
import { WalletModal } from '@diptos/app/WalletModal'
import { useWallet } from '@/app/wallet'
import { InteractiveFlywheelEmblem } from '@/components/KineticFlywheel'
import { PulseDot } from '@/components/ui'
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
  const { address, isConnected, walletChainId, disconnect } = useWallet()
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

  const chainLabel =
    walletChainId === 8453
      ? 'BASE // 8453'
      : walletChainId && walletChainId !== 5042002
        ? `CHAIN ${walletChainId}`
        : 'ARC + BASE'

  return (
    <>
      <header
        className={`sticky top-0 z-50 h-[76px] border-b transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          scrolled
            ? 'border-paper/10 bg-black/90 backdrop-blur-xl'
            : 'border-paper/[0.06] bg-black/50 backdrop-blur-sm'
        }`}
      >
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 px-5 lg:px-8">
          {/* Left: DIPTOS. Wordmark + 28px White Flywheel + Clickable Multi-Chain Status Pill */}
          <div className="flex items-center gap-3">
            <a
              href={getApexUrl()}
              onClick={(e) => {
                e.preventDefault()
                navigate(getApexUrl())
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="rwa-display inline-flex items-baseline rounded text-[21px] tracking-[-0.04em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
            >
              DIPTOS<span className="ml-0.5 inline-block size-2 rounded-full bg-lime" />
            </a>
            <InteractiveFlywheelEmblem size={28} ariaLabel="Spin Diptos header settlement wheel" />
            <button
              type="button"
              onClick={() => setWalletOpen(true)}
              aria-label="Open multi-chain wallet and network switcher"
              className="hidden cursor-pointer items-center gap-2 rounded-full border border-paper/20 bg-surface px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[#E5E7EB] transition-colors hover:border-lime hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime sm:inline-flex"
            >
              <PulseDot color="bg-lime" />
              <span>{isConnected && address ? `${shortHex(address, 4, 4)} · ${chainLabel}` : chainLabel}</span>
              <ChevronDown className="size-3 text-[#E5E7EB]" />
            </button>
            {isConnected && address && (
              <button
                type="button"
                onClick={() => void disconnect()}
                aria-label="Disconnect wallet and revoke session"
                title="Disconnect wallet"
                className="hidden h-7 items-center gap-1 rounded-full border border-paper/20 bg-surface px-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#E5E7EB] transition-colors hover:border-crimson/60 hover:text-crimson focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime sm:inline-flex"
              >
                <LogOut className="size-3" />
                <span>Disconnect</span>
              </button>
            )}
          </div>

          {/* Center: Clear User Destinations */}
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded text-[13.5px] font-medium text-[#E5E7EB] transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right: AI Agents + SDK Docs + Start in 1 Click */}
          <div className="flex items-center gap-2.5">
            <a
              href={getAgentUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              className="hidden h-10 items-center gap-1.5 rounded-full border border-lime/35 bg-lime/[0.06] px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-lime transition-colors hover:border-lime hover:bg-lime/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime md:inline-flex"
            >
              AI Agents <ArrowUpRight className="size-3.5" />
            </a>
            <a
              href={getSdkUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              className="hidden h-10 items-center gap-1.5 rounded-full border border-paper/25 px-4 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-white transition-colors hover:border-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime sm:inline-flex"
            >
              SDK Docs <ArrowUpRight className="size-3.5" />
            </a>
            <a
              href={getAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                setMobileOpen(false)
                trackFunnelEvent('landing_cta_click', { location: 'header' })
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-lime px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink transition-all duration-200 hover:scale-[1.02] hover:bg-[#d8ff4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Start in 1 Click <Plus className="size-3.5" />
            </a>
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle navigation menu"
              className="grid size-10 place-items-center rounded-full border border-paper/20 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime lg:hidden"
            >
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-b border-paper/10 bg-black px-5 py-5 lg:hidden">
            <ul className="space-y-3">
              {NAV_LINKS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="block py-1 text-[14px] font-medium text-[#E5E7EB] hover:text-white"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false)
                    setWalletOpen(true)
                  }}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-paper/25 font-mono text-[11px] uppercase tracking-[0.12em] text-white"
                >
                  <PulseDot color="bg-lime" />
                  {isConnected && address ? shortHex(address, 6, 4) : 'Switch Chain / Connect'}
                </button>
                <a
                  href={getSdkUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-paper/25 font-mono text-[11px] uppercase tracking-[0.12em] text-white"
                >
                  SDK Docs <ArrowUpRight className="size-3.5" />
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
