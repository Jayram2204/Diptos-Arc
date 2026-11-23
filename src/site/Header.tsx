import { useEffect, useState } from 'react'
import { ArrowUpRight, ChevronDown, Menu, Plus, X } from 'lucide-react'
import { WalletModal } from '@diptos/app/WalletModal'
import { useWallet } from '@/app/wallet'
import { InteractiveFlywheelEmblem } from '@/components/KineticFlywheel'
import { PulseDot } from '@/components/ui'
import { shortHex } from '@/lib/chain'
import { getApexUrl, getAppUrl, getSdkUrl, navigate } from '@/lib/route'

const NAV_LINKS = [
  { num: '01', label: 'HOW IT WORKS', href: '#how-it-works' },
  { num: '02', label: 'LIVE PROOF', href: '#escrows' },
  { num: '03', label: 'LATE-DELIVERY MATH', href: '#tecd-risk' },
  { num: '04', label: 'CONTRACTS', href: '#registry' },
]

export function Header() {
  const { address, isConnected, walletChainId } = useWallet()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const chainLabel =
    walletChainId && walletChainId !== 5042002
      ? `CHAIN ${walletChainId}`
      : 'ARC TESTNET // 5042002'

  return (
    <>
      <header
        className={`sticky top-0 z-50 h-[76px] border-b transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          scrolled
            ? 'border-paper/10 bg-black/88 backdrop-blur-xl'
            : 'border-paper/[0.06] bg-black/40 backdrop-blur-sm'
        }`}
      >
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 px-6 lg:px-8">
          {/* Left: DIPTOS. Wordmark + 28px White Flywheel + 1-Click Multi-Chain Switcher Pill */}
          <div className="flex items-center gap-3">
            <a
              href={getApexUrl()}
              onClick={(e) => {
                e.preventDefault()
                navigate(getApexUrl())
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="rwa-display inline-flex items-baseline text-[21px] tracking-[-0.04em] text-paper"
            >
              DIPTOS<span className="ml-0.5 inline-block size-2 rounded-full bg-lime" />
            </a>
            <InteractiveFlywheelEmblem size={28} ariaLabel="Spin Diptos header settlement wheel" />
            <button
              type="button"
              onClick={() => setWalletOpen(true)}
              className="hidden cursor-pointer items-center gap-2 rounded-full border border-paper/15 bg-surface px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-paper/85 transition-colors hover:border-lime/60 hover:text-lime sm:inline-flex"
            >
              <PulseDot color="bg-lime" />
              <span>{isConnected && address ? `${shortHex(address, 4, 4)} · ARC` : chainLabel}</span>
              <ChevronDown className="size-3 text-secondary" />
            </button>
          </div>

          {/* Center: Outcome-First Editorial Nav Links */}
          <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="group inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.11em] text-secondary transition-colors duration-300 hover:text-paper"
              >
                <span className="text-lime/80 transition-colors group-hover:text-lime">{item.num}</span>
                <span>{item.label}</span>
              </a>
            ))}
          </nav>

          {/* Right: Twin Subdomain Pill CTAs */}
          <div className="flex items-center gap-2.5">
            <a
              href={getSdkUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              className="hidden h-10 items-center gap-1.5 rounded-full border border-paper/25 px-4 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-paper transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-lime hover:text-lime sm:inline-flex"
            >
              SDK LAB <ArrowUpRight className="size-3.5" />
            </a>
            <a
              href={getAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-lime px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.03] hover:bg-[#d8ff4d]"
            >
              START IN 1 CLICK <Plus className="size-3.5" />
            </a>
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
              className="grid size-10 place-items-center rounded-full border border-paper/15 text-paper lg:hidden"
            >
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-b border-paper/10 bg-black px-6 py-5 lg:hidden">
            <ul className="space-y-3">
              {NAV_LINKS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.12em] text-paper"
                  >
                    <span className="text-lime">{item.num}</span>
                    {item.label}
                  </a>
                </li>
              ))}
              <li className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false)
                    setWalletOpen(true)
                  }}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-paper/20 font-mono text-[11px] uppercase tracking-[0.12em] text-paper"
                >
                  <PulseDot color="bg-lime" />
                  {isConnected && address ? shortHex(address, 6, 4) : 'SWITCH CHAIN / CONNECT'}
                </button>
                <a
                  href={getSdkUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-paper/25 font-mono text-[11px] uppercase tracking-[0.14em] text-paper"
                >
                  SDK LAB <ArrowUpRight className="size-3.5" />
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
