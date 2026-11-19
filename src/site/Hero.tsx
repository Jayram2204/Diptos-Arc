import { type FormEvent, useState } from 'react'
import { ArrowRight, Bot, User } from 'lucide-react'
import { Button, Field, inputCls } from '@/components/ui'
import { createEscrow, type EscrowMode } from '@/lib/api'
import { navigate } from '@/lib/route'

export function Hero() {
  const [title, setTitle] = useState('')
  const [scope, setScope] = useState('')
  const [amountUsdc, setAmountUsdc] = useState('2500')
  const [deadlineHours, setDeadlineHours] = useState('24')
  const [mode, setMode] = useState<EscrowMode>('human')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const cleanTitle = title.trim()
    const cleanScope = scope.trim()
    const amt = Number(amountUsdc)
    const hours = Number(deadlineHours)

    if (cleanTitle.length < 2) {
      setError('Enter a deliverable title (at least 2 characters).')
      return
    }
    if (cleanScope.length < 4) {
      setError('Specify acceptance criteria / scope for Grok verification.')
      return
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid positive USDC amount.')
      return
    }
    if (!Number.isFinite(hours) || hours < 1 || hours > 720) {
      setError('Deadline must be between 1 and 720 hours.')
      return
    }

    setSubmitting(true)
    try {
      const res = await createEscrow({
        title: cleanTitle,
        scope: cleanScope,
        amountUsdc: amt,
        deadlineHours: hours,
        mode,
      })
      navigate(res.checkoutPath)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="top" className="mx-auto max-w-[1280px] px-4 pb-16 pt-12 sm:px-6 md:pb-24 md:pt-16">
      <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
        {/* Left 7 Columns: Value Proposition & Trust Strip */}
        <div className="lg:col-span-7 lg:pt-4">
          <p className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-surface px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-gold">
            ARC TESTNET (CHAIN ID 5042002) • NATIVE USDC SETTLEMENT
          </p>

          <h1 className="mt-6 text-[36px] font-bold leading-[1.08] tracking-[-0.03em] text-primary sm:text-[50px]">
            Programmable Escrow Links for Modern Work &amp; AI Agents.
          </h1>

          <p className="mt-5 max-w-[600px] text-[16px] leading-[1.6] text-secondary">
            Replace 15% platform fees and 60-day chargebacks with atomic USDC escrow on Arc. Verified by Grok AI,
            risk-priced by Gemini Prediction Markets, and protected by Time-Entropic Collateral Decay.
          </p>

          {/* 3-Column KPI Strip with 1px vertical hairline dividers */}
          <div className="mt-10 grid grid-cols-1 divide-y divide-white/[0.08] border-y border-white/[0.08] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="py-5 sm:pr-6">
              <p className="font-mono text-[28px] font-semibold tracking-[-0.02em] text-primary">0.5%</p>
              <p className="mt-1 text-[12px] text-secondary">Flat Protocol Fee (vs. 15% Upwork)</p>
            </div>
            <div className="py-5 sm:px-6">
              <p className="font-mono text-[28px] font-semibold tracking-[-0.02em] text-emerald">&lt; 1.0s</p>
              <p className="mt-1 text-[12px] text-secondary">Arc Deterministic Finality</p>
            </div>
            <div className="py-5 sm:pl-6">
              <p className="font-mono text-[28px] font-semibold tracking-[-0.02em] text-primary">0%</p>
              <p className="mt-1 text-[12px] text-secondary">Chargeback &amp; Double-Spend Risk</p>
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Embedded 1-Click Escrow Link Generator Card */}
        <div className="lg:col-span-5">
          <div className="rounded-[10px] border border-white/[0.1] bg-surface p-6">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div>
                <h2 className="text-[18px] font-semibold text-primary">Create Instant Escrow Link</h2>
                <p className="mt-0.5 text-[12px] text-secondary">
                  Originates a live <span className="font-mono text-primary/90">diptos.xyz/pay/:id</span> room
                </p>
              </div>
              <span className="rounded-md border border-emerald/25 bg-emerald/10 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald">
                0.5% FEE
              </span>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* Segmented Toggle: Human Freelancer vs AI Agent API */}
              <div>
                <span className="block text-[12px] font-medium text-primary/90">Execution Mode</span>
                <div
                  className="mt-1.5 grid grid-cols-2 rounded-lg border border-white/[0.08] bg-canvas p-1"
                  role="radiogroup"
                  aria-label="Execution mode"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === 'human'}
                    onClick={() => setMode('human')}
                    className={`flex h-9 items-center justify-center gap-1.5 rounded-md text-[12px] font-medium transition-colors ${
                      mode === 'human'
                        ? 'bg-elevated text-primary ring-1 ring-white/[0.12]'
                        : 'text-secondary hover:text-primary'
                    }`}
                  >
                    <User className="size-3.5 text-gold" />
                    Human Freelancer
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === 'agent'}
                    onClick={() => setMode('agent')}
                    className={`flex h-9 items-center justify-center gap-1.5 rounded-md text-[12px] font-medium transition-colors ${
                      mode === 'agent'
                        ? 'bg-elevated text-primary ring-1 ring-white/[0.12]'
                        : 'text-secondary hover:text-primary'
                    }`}
                  >
                    <Bot className="size-3.5 text-emerald" />
                    AI Agent API
                  </button>
                </div>
              </div>

              <Field label="Deliverable Title">
                <input
                  id="create-escrow-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    mode === 'agent'
                      ? 'Autonomous Solidity TECD Fuzzing Audit'
                      : 'Next.js Checkout Integration & Unit Tests'
                  }
                  className={inputCls}
                  required
                />
              </Field>

              <Field label="Acceptance Criteria / Scope" hint="Audited by Grok AI">
                <textarea
                  rows={3}
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  placeholder="Merged GitHub PR with passing CI checks, zero regressions, and live preview URL."
                  className="w-full resize-none rounded-lg border border-white/[0.08] bg-elevated px-3 py-2.5 text-[13px] text-primary outline-none transition-colors placeholder:text-secondary/45 focus:border-gold/60"
                  required
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount (USDC)" hint="Native Arc">
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={amountUsdc}
                    onChange={(e) => setAmountUsdc(e.target.value)}
                    className={`${inputCls} font-mono`}
                    required
                  />
                </Field>
                <Field label="Deadline (Hours)" hint="TECD SLA">
                  <input
                    type="number"
                    min="1"
                    max="720"
                    step="1"
                    value={deadlineHours}
                    onChange={(e) => setDeadlineHours(e.target.value)}
                    className={`${inputCls} font-mono`}
                    required
                  />
                </Field>
              </div>

              {error && (
                <p className="rounded-lg border border-crimson/35 bg-crimson/10 px-3 py-2 text-[12px] text-crimson">
                  {error}
                </p>
              )}

              <Button type="submit" variant="primary" loading={submitting} className="h-11 w-full text-[13px] font-bold">
                <span>Generate Live Escrow Link</span>
                <ArrowRight className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
