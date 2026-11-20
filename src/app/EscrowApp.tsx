import { type FormEvent, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Bot, Clock, LogOut, Plus, RefreshCw, User, Wallet } from 'lucide-react'
import { Button, CopyButton, Field, inputCls, PulseDot } from '@/components/ui'
import { fmtAmount, shortHex } from '@/lib/chain'
import { useEscrows, useGeminiRisk } from '@/lib/hooks'
import { getApexUrl, getPayUrl, getSdkUrl, navigate } from '@/lib/route'
import { diptos, type EscrowMode } from '@/lib/sdk'
import { useWallet, WalletProvider } from './wallet'

const DEADLINE_PRESETS = [
  { label: '2 Mins (Judge Test)', hours: '0.0334' },
  { label: '24 Hours', hours: '24' },
  { label: '7 Days', hours: '168' },
] as const

function formatRemaining(deadlineIso: string, nowMs: number) {
  const diffSec = Math.floor((new Date(deadlineIso).getTime() - nowMs) / 1000)
  const overdue = diffSec < 0
  const abs = Math.abs(diffSec)
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return { overdue, text: `${overdue ? '+' : ''}${pad(h)}:${pad(m)}:${pad(s)}` }
}

function EscrowAppInner() {
  const { address, balanceUsdc, connecting, connect, disconnect } = useWallet()
  const { escrows, loading: escrowsLoading, refresh } = useEscrows(4000)
  const { data: gemini } = useGeminiRisk()

  const [tab, setTab] = useState<'create' | 'active'>('create')
  const [title, setTitle] = useState('')
  const [scope, setScope] = useState('')
  const [amountUsdc, setAmountUsdc] = useState('0.05')
  const [deadlineHours, setDeadlineHours] = useState('24')
  const [mode, setMode] = useState<EscrowMode>('human')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

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
    if (!Number.isFinite(hours) || hours < 0.03 || hours > 720) {
      setError('Deadline must be between 2 minutes and 720 hours.')
      return
    }

    setSubmitting(true)
    try {
      const res = await diptos.createEscrowLink({
        title: cleanTitle,
        scope: cleanScope,
        amountUsdc: amt,
        deadlineHours: hours,
        mode,
        tecdLambda: gemini?.recommendedLambda,
      })
      navigate(getPayUrl(res.checkoutPath))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-paper">
      {/* Dedicated App Top Bar */}
      <header className="sticky top-0 z-50 h-[72px] border-b border-paper/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(getApexUrl())}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-paper/15 px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-secondary transition-colors hover:border-lime hover:text-lime"
            >
              <ArrowLeft className="size-3.5" />
              diptos.xyz
            </button>
            <span className="rwa-display hidden items-baseline text-[18px] text-paper sm:inline-flex">
              APP.DIPTOS<span className="ml-0.5 inline-block size-1.5 rounded-full bg-lime" />
            </span>
          </div>

          <nav className="hidden items-center gap-1 rounded-full border border-paper/12 bg-surface p-1 md:flex">
            <button
              type="button"
              onClick={() => setTab('create')}
              className={`h-8 rounded-full px-4 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors ${
                tab === 'create' ? 'bg-lime font-semibold text-ink' : 'text-secondary hover:text-paper'
              }`}
            >
              New Escrow Link
            </button>
            <button
              type="button"
              onClick={() => setTab('active')}
              className={`h-8 rounded-full px-4 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors ${
                tab === 'active' ? 'bg-lime font-semibold text-ink' : 'text-secondary hover:text-paper'
              }`}
            >
              Active Arc Escrows ({escrows.length})
            </button>
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate(getSdkUrl())}
              className="hidden h-9 items-center rounded-full border border-paper/15 px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-secondary hover:border-lime hover:text-lime lg:inline-flex"
            >
              SDK
            </button>
            {address ? (
              <div className="flex h-9 items-center gap-2 rounded-full border border-paper/15 bg-surface pl-3.5 pr-1.5 font-mono text-[11px]">
                {balanceUsdc !== null && <span className="hidden text-lime sm:inline">{balanceUsdc} USDC</span>}
                <span className="rounded-full bg-black px-2.5 py-0.5 text-paper">{shortHex(address)}</span>
                <button
                  type="button"
                  onClick={disconnect}
                  aria-label="Disconnect wallet"
                  className="grid size-7 place-items-center rounded-full text-secondary hover:text-paper"
                >
                  <LogOut className="size-3.5" />
                </button>
              </div>
            ) : (
              <Button size="sm" variant="primary" loading={connecting === 'metamask'} onClick={() => connect('metamask')}>
                <Wallet className="size-3.5" />
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-5 py-12 sm:px-8">
        {/* Mobile Tab Switcher */}
        <div className="mb-8 flex gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`h-9 flex-1 rounded-full font-mono text-[11px] uppercase tracking-[0.1em] ${
              tab === 'create' ? 'bg-lime font-semibold text-ink' : 'border border-paper/15 text-secondary'
            }`}
          >
            New Escrow Link
          </button>
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`h-9 flex-1 rounded-full font-mono text-[11px] uppercase tracking-[0.1em] ${
              tab === 'active' ? 'bg-lime font-semibold text-ink' : 'border border-paper/15 text-secondary'
            }`}
          >
            Active ({escrows.length})
          </button>
        </div>

        {tab === 'create' ? (
          <div className="mx-auto max-w-2xl">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-paper/12 pb-6">
              <div>
                <p className="rwa-hud text-lime">APP.DIPTOS.XYZ // ORIGINATE</p>
                <h1 className="rwa-display mt-3 text-[28px] text-paper sm:text-[36px]">
                  CREATE ESCROW LINK.
                </h1>
                <p className="mt-2 text-[14px] text-secondary">
                  Originates a shareable <span className="font-mono text-paper">app.diptos.xyz/pay/:id</span> checkout
                  room calibrated with live Gemini TECD risk{' '}
                  <span className="font-mono text-lime">
                    (λ={gemini ? gemini.recommendedLambda.toFixed(2) : '0.35'})
                  </span>
                  .
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-paper/12 bg-surface px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-secondary">
                <PulseDot color="bg-lime" /> ARC 5042002
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <span className="block font-mono text-[11px] uppercase tracking-[0.12em] text-secondary">
                  Execution Mode
                </span>
                <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Execution mode">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === 'human'}
                    onClick={() => setMode('human')}
                    className={`flex h-11 items-center justify-center gap-2 rounded-lg border font-mono text-[12px] uppercase tracking-[0.08em] transition-colors ${
                      mode === 'human'
                        ? 'border-lime bg-lime/10 text-lime'
                        : 'border-paper/12 bg-surface text-secondary hover:text-paper'
                    }`}
                  >
                    <User className="size-4" />
                    Human Freelancer
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === 'agent'}
                    onClick={() => setMode('agent')}
                    className={`flex h-11 items-center justify-center gap-2 rounded-lg border font-mono text-[12px] uppercase tracking-[0.08em] transition-colors ${
                      mode === 'agent'
                        ? 'border-lime bg-lime/10 text-lime'
                        : 'border-paper/12 bg-surface text-secondary hover:text-paper'
                    }`}
                  >
                    <Bot className="size-4" />
                    AI Agent API
                  </button>
                </div>
              </div>

              <Field label="Deliverable Title">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    mode === 'agent'
                      ? 'Autonomous Solidity TECD Fuzzing Audit'
                      : 'Design System Sprint & React Implementation'
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
                  placeholder="Merged GitHub PR with passing Foundry & Vite tests and live deployment URL."
                  className="w-full resize-none rounded-lg border border-paper/12 bg-surface px-3.5 py-2.5 text-[13px] text-paper outline-none transition-colors placeholder:text-secondary/50 focus:border-lime"
                  required
                />
              </Field>

              <div>
                <span className="block font-mono text-[11px] uppercase tracking-[0.12em] text-secondary">
                  SLA Deadline Preset
                </span>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {DEADLINE_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setDeadlineHours(p.hours)}
                      className={`h-9 rounded-lg border font-mono text-[11px] transition-colors ${
                        deadlineHours === p.hours
                          ? 'border-lime bg-lime/10 text-lime'
                          : 'border-paper/12 bg-surface text-secondary hover:text-paper'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Amount (USDC)" hint="Native 18-dec Arc">
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    value={amountUsdc}
                    onChange={(e) => setAmountUsdc(e.target.value)}
                    className={`${inputCls} font-mono`}
                    required
                  />
                </Field>
                <Field label="Deadline (Hours)" hint="TECD SLA Window">
                  <input
                    type="number"
                    min="0.03"
                    max="720"
                    step="any"
                    value={deadlineHours}
                    onChange={(e) => setDeadlineHours(e.target.value)}
                    className={`${inputCls} font-mono`}
                    required
                  />
                </Field>
              </div>

              {error && (
                <p className="rounded-lg border border-crimson/40 bg-crimson/10 px-3.5 py-2.5 text-[12px] text-crimson">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                className="h-12 w-full rounded-full font-mono text-[12px] font-semibold uppercase tracking-[0.14em]"
              >
                <span>Generate Live Escrow Link</span>
                <ArrowRight className="size-4" />
              </Button>
            </form>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-paper/12 pb-6">
              <div>
                <p className="rwa-hud text-lime">ON-CHAIN DEAL FEED // ARC 5042002</p>
                <h1 className="rwa-display mt-3 text-[28px] text-paper sm:text-[36px]">
                  ACTIVE ARC ESCROWS.
                </h1>
              </div>
              <div className="flex items-center gap-2.5">
                <Button variant="ghost" size="sm" onClick={() => void refresh()}>
                  <RefreshCw className="size-3.5" />
                  Refresh
                </Button>
                <Button variant="primary" size="sm" onClick={() => setTab('create')}>
                  <Plus className="size-3.5" />
                  New Link
                </Button>
              </div>
            </div>

            {escrowsLoading ? (
              <p className="py-12 font-mono text-[12px] uppercase tracking-[0.12em] text-secondary">
                Querying DiptosEscrow.getEscrowsPaginated() on Arc Testnet…
              </p>
            ) : escrows.length === 0 ? (
              <div className="flex flex-col items-start justify-between gap-4 border-b border-paper/12 py-10 sm:flex-row sm:items-center">
                <p className="font-mono text-[13px] text-secondary">
                  No funded escrows found on Arc Testnet yet. Create a link to fund your first escrow on-chain.
                </p>
                <Button variant="primary" size="sm" onClick={() => setTab('create')}>
                  Create Escrow Link →
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-paper/10">
                {escrows.map((escrow) => {
                  const rem = formatRemaining(escrow.deadline, nowMs)
                  return (
                    <div
                      key={escrow.id}
                      className="flex flex-col justify-between gap-4 py-6 lg:flex-row lg:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em]">
                          <span className="text-lime">{escrow.mode === 'agent' ? 'AI AGENT' : 'FREELANCER'}</span>
                          <span className="text-paper/30">/</span>
                          <span className="text-emerald">{escrow.status}</span>
                          <span className="text-paper/30">/</span>
                          <span className="text-secondary">{shortHex(escrow.escrowIdBytes32, 10, 6)}</span>
                          <CopyButton value={escrow.escrowIdBytes32} label="Copy escrow ID" />
                        </div>
                        <h3 className="mt-2 text-[17px] font-semibold text-paper">{escrow.title}</h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-6 font-mono text-[12px]">
                        <div>
                          <span className="block text-[10px] text-secondary">AMOUNT</span>
                          <span className="text-paper">{fmtAmount(escrow.amountUsdc)} USDC</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-secondary">TECD λ</span>
                          <span className="text-lime">{escrow.tecdLambda.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="flex items-center gap-1 text-[10px] text-secondary">
                            <Clock className="size-3" /> SLA
                          </span>
                          <span className={rem.overdue ? 'text-crimson' : 'text-emerald'}>{rem.text}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(getPayUrl(escrow.id))}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-paper/20 px-4 font-mono text-[11px] uppercase tracking-[0.12em] text-paper transition-colors hover:border-lime hover:text-lime"
                        >
                          OPEN PAY <ArrowRight className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export function EscrowApp() {
  return (
    <WalletProvider>
      <EscrowAppInner />
    </WalletProvider>
  )
}
