import { Shield } from 'lucide-react'
import { useDynamicCookies } from '@/lib/cookies'

export function CookieConsentPill() {
  const { consent, setConsent } = useDynamicCookies()

  if (consent !== 'pending') return null

  return (
    <div
      role="region"
      aria-label="Cookie preferences"
      className="fixed bottom-4 right-4 z-50 flex max-w-[360px] flex-wrap items-center gap-2.5 rounded-full border border-paper/15 bg-[#0A0C12]/95 px-4 py-2 text-[11px] text-paper shadow-2xl backdrop-blur-md"
    >
      <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-secondary">
        <Shield className="size-3 text-lime" />
        Cookies
      </span>
      <button
        type="button"
        onClick={() => setConsent('essential')}
        className="rounded-full border border-paper/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-paper/80 transition-colors hover:border-paper/35 hover:text-paper"
      >
        Essential Only
      </button>
      <button
        type="button"
        onClick={() => setConsent('accepted')}
        className="rounded-full bg-lime px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-[#d8ff4d]"
      >
        Accept Preferences
      </button>
    </div>
  )
}
