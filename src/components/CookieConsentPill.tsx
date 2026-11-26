import { useEffect, useState } from 'react'
import { Shield, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { clearCookie, useDynamicCookies } from '@/lib/cookies'

export const OPEN_COOKIE_CONTROLS_EVENT = 'diptos:open-cookie-controls'

interface ServerSessionInfo {
  authenticated: boolean
  address: string | null
  chainId: number | null
}

export function CookieConsentPill() {
  const { consent, splashSeen, chain, mode, setConsent } = useDynamicCookies()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [serverSession, setServerSession] = useState<ServerSessionInfo | null>(null)

  useEffect(() => {
    const onOpen = () => setDrawerOpen(true)
    window.addEventListener(OPEN_COOKIE_CONTROLS_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_COOKIE_CONTROLS_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!drawerOpen) return
    fetch('/api/auth/session', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setServerSession(data)
      })
      .catch(() => {})
  }, [drawerOpen])

  const handleClearNonEssential = () => {
    clearCookie('diptos_chain')
    clearCookie('diptos_mode')
    clearCookie('diptos_ref')
    setConsent('essential')
  }

  return (
    <>
      {consent === 'pending' && !drawerOpen && (
        <div
          role="region"
          aria-label="Cookie preferences"
          className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap rounded-full border border-paper/20 bg-[#0A0C12]/95 px-3.5 py-2 text-[11px] text-white shadow-2xl backdrop-blur-md"
        >
          <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10.5px] text-[#E5E7EB]">
            <Shield className="size-3 text-lime" />
            Cookies
          </span>
          <button
            type="button"
            onClick={() => setConsent('essential')}
            className="shrink-0 whitespace-nowrap rounded-full border border-paper/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#E5E7EB] transition-colors hover:border-paper/40 hover:text-white"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => setConsent('accepted')}
            className="shrink-0 whitespace-nowrap rounded-full bg-lime px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-[#d8ff4d]"
          >
            Accept all
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open Cookie and Session Controls"
            className="grid size-6 shrink-0 place-items-center rounded-full text-[#E5E7EB] hover:bg-white/10 hover:text-white"
          >
            <SlidersHorizontal className="size-3" />
          </button>
        </div>
      )}

      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Cookie and Session Controls"
        >
          <div
            className="w-full max-w-[380px] rounded-2xl border border-paper/15 bg-[#0A0C12] p-5 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-paper/10 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-lime" />
                <h2 className="font-mono text-[12px] font-semibold uppercase tracking-[0.1em]">
                  Cookie &amp; Session Controls
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close cookie controls"
                className="grid size-7 place-items-center rounded-lg text-[#E5E7EB] hover:bg-white/10"
              >
                <X className="size-4" />
              </button>
            </div>

            <dl className="mt-3.5 divide-y divide-paper/10 font-mono text-[11px]">
              <div className="flex justify-between py-2">
                <dt className="text-[#E5E7EB]/80">SIWE Session (diptos_sid)</dt>
                <dd className={serverSession?.authenticated ? 'text-emerald' : 'text-[#E5E7EB]'}>
                  {serverSession?.authenticated ? 'HttpOnly Active' : 'Signed Out'}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-[#E5E7EB]/80">Consent Mode</dt>
                <dd className="text-lime uppercase">{consent}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-[#E5E7EB]/80">diptos_splash_seen</dt>
                <dd className="text-white">{splashSeen ? '1 (Session)' : 'Not set'}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-[#E5E7EB]/80">diptos_chain</dt>
                <dd className="text-white">{chain ?? 'Not stored'}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-[#E5E7EB]/80">diptos_mode</dt>
                <dd className="text-white">{mode ?? 'Not stored'}</dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setConsent(consent === 'accepted' ? 'essential' : 'accepted')}
                className="flex-1 rounded-full bg-lime px-3 py-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink hover:bg-[#d8ff4d]"
              >
                {consent === 'accepted' ? 'Switch to Essential Only' : 'Enable Personalization'}
              </button>
              <button
                type="button"
                onClick={handleClearNonEssential}
                className="inline-flex items-center gap-1 rounded-full border border-paper/20 px-3 py-2 font-mono text-[10.5px] uppercase text-[#E5E7EB] hover:border-crimson/60 hover:text-crimson"
              >
                <Trash2 className="size-3" />
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
