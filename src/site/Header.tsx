import { useState } from 'react'
import { Code2, Menu, Plus, X } from 'lucide-react'
import { Wordmark } from '@/components/Logo'
import { PulseDot } from '@/components/ui'
import { useArcPulse } from '@/lib/hooks'
import { navigate } from '@/lib/route'
import { SdkModal } from './SdkModal'

const NAV_LINKS = [
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'architecture', label: 'Live Sandbox' },
  { id: 'tecd-risk', label: 'TECD & Risk' },
  { id: 'registry', label: 'Arc Contracts' },
] as const

export function Header() {
  const pulse = useArcPulse(6000)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sdkOpen, setSdkOpen] = useState(false)

  const focusCreator = () => {
    setMenuOpen(false)
    navigate('/')
    requestAnimationFrame(() => {
      const el = document.getElementById('create-escrow-title')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        ;(el as HTMLInputElement).focus()
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    })
  }

  return (
    <>
      <header className="sticky top-0 z-50 h-16 border-b border-white/[0.08] bg-[#090A0D]/90 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
          {/* Left: Logo + Verified Arc Testnet Badge */}
          <div className="flex items-center gap-3">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault()
                navigate('/')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              aria-label="Diptos home"
            >
              <Wordmark />
            </a>
            <span
              className="hidden items-center gap-2 rounded-md border border-white/[0.08] bg-surface px-2.5 py-1 font-mono text-[11px] text-primary sm:inline-flex"
              title={
                pulse.blockNumber !== undefined
                  ? `Arc Testnet live block #${pulse.blockNumber.toLocaleString('en-US')}`
                  : 'Arc Testnet (Chain ID 5042002)'
              }
            >
              <PulseDot color={pulse.error && pulse.blockNumber === undefined ? 'bg-crimson' : 'bg-emerald'} />
              <span>Arc Testnet • 5042002</span>
            </span>
          </div>

          {/* Center: 4 Clean Anchor Links */}
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
            {NAV_LINKS.map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                className="text-[13px] font-medium text-secondary transition-colors hover:text-primary"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* Right: SDK Docs + Create Escrow Link */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSdkOpen(true)}
              className="hidden h-9 items-center gap-1.5 rounded-lg border border-white/[0.1] bg-transparent px-3.5 text-[13px] font-medium text-primary transition-colors hover:border-white/[0.22] sm:inline-flex"
            >
              <Code2 className="size-3.5 text-secondary" />
              SDK Docs
            </button>
            <button
              type="button"
              onClick={focusCreator}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gold px-3.5 text-[13px] font-bold text-canvas transition-colors hover:bg-[#edb955]"
            >
              <Plus className="size-3.5 stroke-[2.5]" />
              <span>Create Escrow Link</span>
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
              className="grid size-9 place-items-center rounded-lg border border-white/[0.08] text-primary lg:hidden"
            >
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-b border-white/[0.08] bg-[#090A0D]/95 px-4 pb-4 pt-2 backdrop-blur-md lg:hidden">
            <ul className="grid gap-1">
              {NAV_LINKS.map((l) => (
                <li key={l.id}>
                  <a
                    href={`#${l.id}`}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm text-primary hover:bg-surface"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    setSdkOpen(true)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-secondary hover:bg-surface hover:text-primary"
                >
                  <Code2 className="size-4" />
                  SDK Docs (@diptos/sdk)
                </button>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <SdkModal open={sdkOpen} onClose={() => setSdkOpen(false)} />
    </>
  )
}
