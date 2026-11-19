import { type FormEvent, useState } from 'react'
import { ArrowRight, Bot, User } from 'lucide-react'
import { Button, Field, inputCls, Reveal } from '@/components/ui'
import { useArcPulse, useGeminiRisk, useProtocolRead } from '@/lib/hooks'
import { navigate } from '@/lib/route'
import { diptos, type EscrowMode } from '@/lib/sdk'

const DEADLINE_PRESETS = [
  { label: '2 MIN LIVE TEST', hours: 0.034 },
  { label: '24H', hours: 24 },
  { label: '7D', hours: 168 },
] as const

export function Hero() {
  const { data: gemini } = useGeminiRisk()
  const pulse = useArcPulse(4000)
  const feeBps = useProtocolRead<bigint>('DiptosEscrow', 'protocolFeeBps', [], 60_000)
  const settledCount = useProtocolRead<bigint>('DiptosRegistry', 'totalSettledMilestones', [], 10_000)

  const [title, setTitle] = useState('')
  const [scope, setScope] = useState('')
  const [amountUsdc, setAmountUsdc] = useState('2500')
  const [deadlineHours, setDeadlineHours] = useState<number>(24)
  const [mode, setMode] = useState<EscrowMode>('human')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const cleanTitle = title.trim()
    const cleanScope = scope.trim()
    const amt = Number(amountUsdc)

    if (cleanTitle.length < 2) {
      setError('Enter a deliverable title (at least 2 characters).')
      return
    }
    if (cleanScope.length < 4) {
      setError('Specify acceptance criteria for Grok AI verification.')
      return
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid positive USDC amount.')
      return
    }

    setSubmitting(true)
    try {
      const res = await diptos.createEscrowLink({
        title: cleanTitle,
        scope: cleanScope,
        amountUsdc: amt,
        deadlineHours: Math.max(1, Math.round(deadlineHours)),
        mode,
        tecdLambda: gemini?.recommendedLambda,
      })
      navigate(res.checkoutPath)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      id="top"
      className="relative overflow-hidden bg-black pb-24 pt-16 lg:pb-36 lg:pt-24"
    >
      {/* Subtle single deep-navy architectural horizon glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[540px] bg-[radial-gradient(60%_70%_at_75%_10%,rgba(2,6,100,0.42),transparent_70%)]"
      />

      <div className="relative mx-auto grid max-w-[1380px] items-start gap-14 px-6 lg:grid-cols-12 lg:gap-12 lg:px-10">
        {/* Left 62% (7 cols): Oversized Archivo Editorial Statement */}
        <div className="lg:col-span-7 lg:pt-2">
          <Reveal>
            <p className="rwa-hud inline-flex items-center gap-2.5 text-lime">
              <span className="size-1.5 rounded-full bg-lime" />
              ARC TESTNET (5042002) // NATIVE USDC SETTLEMENT
            </p>
          </Reveal>

          <Reveal delayMs={80}>
            <h1 className="rwa-display mt-7 text-[clamp(2.9rem,5.7vw,5.4rem)] uppercase text-paper">
              PROGRAMMABLE ESCROW.
              <br />
              <span className="text-paper/85">ATOMIC USDC SETTLEMENT.</span>
            </h1>
          </Reveal>

          <Reveal delayMs={160}>
            <p className="mt-7 max-w-[580px] text-[17px] leading-[1.6] text-paper/70">
              Replace 15% middleman fees and 60-day chargebacks with non-custodial Arc escrow links. Verified by Grok
              AI, risk-calibrated by Gemini Prediction Markets, and protected by Time-Entropic Collateral Decay.
            </p>
          </Reveal>

          <Reveal delayMs={220}>
            <div className="mt-10 flex flex-wrap items-center gap-3.5">
              <Button
                onClick={() => document.getElementById('composer')?.scrollIntoView({ behavior: 'smooth' })}
              >
                LAUNCH ESCROW LINK <ArrowRight className="size-4" />
              </Button>
              <a
                href="#escrows"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-paper/20 px-7 font-mono text-[11.5px] font-medium uppercase tracking-[0.14em] text-paper transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-lime hover:text-lime"
              >
                EXPLORE LIVE DEALS
              </a>
            </div>
          </Reveal>

          {/* 3-Column IBM Plex Mono Telemetry Strip */}
          <Reveal delayMs={280}>
            <div className="mt-14 grid grid-cols-1 divide-y divide-paper/10 border-y border-paper/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="py-6 sm:pr-6">
                <p className="rwa-hud text-secondary">01 / PROTOCOL FEE</p>
                <p className="mt-2 font-mono text-[26px] font-semibold tabular-nums text-paper">
                  {feeBps.status === 'ok' ? `${(Number(feeBps.value) / 100).toFixed(2)}%` : '0.50%'}
                </p>
                <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-secondary">
                  FLAT FEE · 99.5% PAYEE
                </p>
              </div>
              <div className="py-6 sm:px-6">
                <p className="rwa-hud text-secondary">02 / ARC FINALITY</p>
                <p className="mt-2 font-mono text-[26px] font-semibold tabular-nums text-lime">
                  {pulse.latency !== undefined ? `${pulse.latency}ms` : '< 1.0s'}
                </p>
                <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-secondary">
                  {pulse.blockNumber ? `LIVE BLOCK #${pulse.blockNumber.toString()}` : 'DETERMINISTIC ARC RPC'}
                </p>
              </div>
              <div className="py-6 sm:pl-6">
                <p className="rwa-hud text-secondary">03 / CHARGEBACKS</p>
                <p className="mt-2 font-mono text-[26px] font-semibold tabular-nums text-emerald">
                  0%
                </p>
                <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-secondary">
                  {settledCount.status === 'ok'
                    ? `${settledCount.value.toString()} SETTLED ON-CHAIN`
                    : 'ATOMIC EIP-712 DVP'}
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Right 38% (5 cols): Spacious Escrow Link Composer Card */}
        <div id="composer" className="lg:col-span-5">
          <Reveal delayMs={180}>
            <form onSubmit={handleSubmit} className="rwa-depth-card rounded-2xl p-7">
              <div className="flex items-start justify-between gap-3 border-b border-paper/10 pb-5">
                <div>
                  <p className="rwa-hud text-lime">LIVE COMPOSER</p>
                  <h2 className="mt-1.5 text-[22px] text-paper">Create Escrow Link</h2>
                </div>
                <span className="rounded-full border border-paper/15 bg-black/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-secondary">
                  λ {gemini ? gemini.recommendedLambda.toFixed(2) : '0.35'}
                </span>
              </div>

              <div className="mt-6 space-y-5">
                {/* Pill Mode Toggles */}
                <div className="grid grid-cols-2 gap-2 rounded-full border border-paper/12 bg-black/70 p-1">
                  <button
                    type="button"
                    onClick={() => setMode('human')}
                    className={`flex h-9 items-center justify-center gap-1.5 rounded-full font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      mode === 'human' ? 'bg-lime text-ink' : 'text-secondary hover:text-paper'
                    }`}
                  >
                    <User className="size-3.5" /> HUMAN FREELANCER
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('agent')}
                    className={`flex h-9 items-center justify-center gap-1.5 rounded-full font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      mode === 'agent' ? 'bg-lime text-ink' : 'text-secondary hover:text-paper'
                    }`}
                  >
                    <Bot className="size-3.5" /> AI AGENT API
                  </button>
                </div>

                <Field label="Deliverable Title" hint="diptos.xyz/pay/:id">
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      mode === 'agent' ? 'Autonomous PR Security Audit' : 'Design System & Arc Checkout UI'
                    }
                    className={inputCls}
                  />
                </Field>

                <Field label="Acceptance Scope" hint="Grok Oracle Criteria">
                  <textarea
                    rows={2}
                    required
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    placeholder="Merged GitHub PR passing Foundry fuzz tests with zero TypeScript errors."
                    className="w-full rounded-xl border border-paper/15 bg-black/60 px-3.5 py-2.5 font-mono text-[12.5px] text-paper outline-none transition-colors duration-300 placeholder:text-paper/30 focus:border-lime"
                  />
                </Field>

                <Field label="Escrow Amount (Native USDC)" hint="Arc 5042002">
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={amountUsdc}
                    onChange={(e) => setAmountUsdc(e.target.value)}
                    className={inputCls}
                  />
                </Field>

                <div>
                  <span className="block font-mono text-[11px] uppercase tracking-[0.1em] text-paper/90">
                    SLA Deadline Window
                  </span>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {DEADLINE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setDeadlineHours(preset.hours)}
                        className={`h-9 rounded-full border font-mono text-[10px] font-medium uppercase tracking-[0.1em] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          deadlineHours === preset.hours
                            ? 'border-lime bg-lime/15 text-lime'
                            : 'border-paper/15 bg-black/60 text-secondary hover:border-paper/35 hover:text-paper'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <p className="rounded-xl border border-crimson/35 bg-crimson/10 px-3.5 py-2.5 font-mono text-[11.5px] text-crimson">
                    {error}
                  </p>
                )}

                <Button type="submit" loading={submitting} className="w-full">
                  GENERATE ESCROW LINK <ArrowRight className="size-4" />
                </Button>
              </div>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
