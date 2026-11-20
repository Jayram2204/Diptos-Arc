import { type FormEvent, useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  LogOut,
  RefreshCw,
  User,
  Wallet,
} from 'lucide-react'
import { Button, Field, inputCls, PulseDot } from '@/components/ui'
import { fmtAmount, shortHex } from '@/lib/chain'
import { useEscrows, useGeminiRisk } from '@/lib/hooks'
import { getApexUrl, getPayUrl, getSdkUrl, openInNewTab } from '@/lib/route'
import { diptos, type EscrowMode } from '@/lib/sdk'
import { useWallet, WalletProvider } from './wallet'

const SLA_PRESETS = [
  { label: '2 Mins', hours: '0.0334' },
  { label: '24h', hours: '24' },
  { label: '7d', hours: '168' },
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
  const { address, walletName, balanceUsdc, connecting, connect, disconnect, error: walletError } =
    useWallet()
  const { escrows, loading: escrowsLoading, refresh } = useEscrows(4000)
  const { data: gemini } = useGeminiRisk()

  const [tab, setTab] = useState<'create' | 'active'>('create')
  const [title, setTitle] = useState('')
  const [scope, setScope] = useState('')
  const [amountUsdc, setAmountUsdc] = useState('250')
  const [deadlineHours, setDeadlineHours] = useState('24')
  const [mode, setMode] = useState<EscrowMode>('human')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const parsedAmount = Math.max(0, Number(amountUsdc) || 0)
  const payeePayout = parsedAmount * 0.995
  const protocolFee = parsedAmount * 0.005
  const liveLambda = gemini?.recommendedLambda ?? 0.35

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
        tecdLambda: liveLambda,
      })
      openInNewTab(getPayUrl(res.checkoutPath))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#090A0D] text-[#F4F2EC]">
      {/* Header Alignment (68px height, max-w-[1320px] mx-auto px-6) */}
      <header className="sticky top-0 z-50 h-[68px] border-b border-white/[0.08] bg-[#090A0D]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1320px] items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-4">
            <a
              href={getApexUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-secondary transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/[0.06] hover:text-[#F4F2EC]"
            >
              <ArrowLeft className="size-3.5" />
              diptos.xyz
            </a>
            <span className="rwa-display hidden items-baseline text-[17px] text-[#F4F2EC] sm:inline-flex">
              APP.DIPTOS<span className="ml-1 inline-block size-1.5 rounded-full bg-emerald" />
            </span>
          </div>

          {/* Center Segmented Pill Switcher */}
          <nav className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-[#111318] p-1">
            <button
              type="button"
              onClick={() => setTab('create')}
              className={`h-8 rounded-full px-4 font-mono text-[11px] uppercase tracking-[0.1em] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                tab === 'create'
                  ? 'bg-white/[0.1] font-medium text-[#F4F2EC]'
                  : 'text-secondary hover:text-[#F4F2EC]'
              }`}
            >
              New Escrow Link
            </button>
            <button
              type="button"
              onClick={() => setTab('active')}
              className={`h-8 rounded-full px-4 font-mono text-[11px] uppercase tracking-[0.1em] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                tab === 'active'
                  ? 'bg-white/[0.1] font-medium text-[#F4F2EC]'
                  : 'text-secondary hover:text-[#F4F2EC]'
              }`}
            >
              Active Arc Escrows ({escrows.length})
            </button>
          </nav>

          {/* Right: SDK ↗ + Connect Wallet */}
          <div className="flex items-center gap-2.5">
            <a
              href={getSdkUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-9 items-center gap-1 rounded-full border border-white/15 px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[#F4F2EC] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/[0.06] sm:inline-flex"
            >
              SDK <ArrowUpRight className="size-3.5" />
            </a>
            {address ? (
              <div className="flex h-9 items-center gap-2 rounded-full border border-white/15 bg-[#111318] pl-3.5 pr-1.5 font-mono text-[11px]">
                {balanceUsdc !== null && (
                  <span className="hidden tabular-nums text-emerald sm:inline">{balanceUsdc} USDC</span>
                )}
                <span
                  className="rounded-full bg-[#090A0D] px-2.5 py-0.5 text-[#F4F2EC]"
                  title={walletName ?? undefined}
                >
                  {shortHex(address)}
                </span>
                <button
                  type="button"
                  onClick={disconnect}
                  aria-label="Disconnect wallet"
                  className="grid size-7 place-items-center rounded-full text-secondary hover:text-[#F4F2EC]"
                >
                  <LogOut className="size-3.5" />
                </button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="primary"
                loading={connecting !== null}
                onClick={() => void connect('metamask')}
              >
                <Wallet className="size-3.5" />
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
        {walletError && (
          <div className="border-b border-crimson/30 bg-crimson/10 px-6 py-2 text-center font-mono text-[11px] text-crimson">
            {walletError}
          </div>
        )}
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-[1320px] px-6 py-5">
        {tab === 'create' ? (
          <div className="animate-fade-up grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
            {/* Left Card (7 cols): Balanced Compact Form */}
            <form
              onSubmit={handleSubmit}
              className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#111318] p-6 lg:col-span-7"
            >
              <div>
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
                  <div>
                    <p className="rwa-hud text-secondary">PROGRAMMABLE ESCROW COMPOSER</p>
                    <h1 className="mt-1 text-[19px] font-semibold text-[#F4F2EC]">
                      Create Non-Custodial USDC Escrow Link
                    </h1>
                  </div>
                  <span className="rounded-full border border-white/[0.08] bg-[#090A0D] px-3 py-1 font-mono text-[10.5px] text-secondary">
                    0.50% flat fee
                  </span>
                </div>

                <div className="mt-4 space-y-3.5">
                  {/* Row 1: Execution Mode */}
                  <div>
                    <span className="block font-mono text-[10.5px] uppercase tracking-[0.1em] text-paper/90">
                      Execution Mode
                    </span>
                    <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-lg border border-white/[0.08] bg-[#090A0D] p-1">
                      <button
                        type="button"
                        onClick={() => setMode('human')}
                        className={`flex h-9 items-center justify-center gap-2 rounded-md font-mono text-[11px] uppercase tracking-[0.1em] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          mode === 'human'
                            ? 'bg-white/[0.1] font-medium text-[#F4F2EC]'
                            : 'text-secondary hover:text-[#F4F2EC]'
                        }`}
                      >
                        <User className="size-3.5" /> Human Freelancer
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('agent')}
                        className={`flex h-9 items-center justify-center gap-2 rounded-md font-mono text-[11px] uppercase tracking-[0.1em] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          mode === 'agent'
                            ? 'bg-white/[0.1] font-medium text-[#F4F2EC]'
                            : 'text-secondary hover:text-[#F4F2EC]'
                        }`}
                      >
                        <Bot className="size-3.5" /> AI Agent API
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Deliverable Title */}
                  <Field label="Deliverable Title" hint="Displayed on checkout link">
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={
                        mode === 'agent'
                          ? 'Autonomous Solidity Invariant Audit'
                          : 'Frontend Design System & Checkout Room'
                      }
                      className={inputCls}
                    />
                  </Field>

                  {/* Row 3: Acceptance Criteria */}
                  <Field label="Acceptance Criteria / Grok Audit Scope" hint="Verified via EIP-712">
                    <textarea
                      rows={2}
                      required
                      value={scope}
                      onChange={(e) => setScope(e.target.value)}
                      placeholder="Submit merged GitHub PR passing all Foundry fuzz tests and TypeScript checks."
                      className="w-full rounded-lg border border-white/[0.08] bg-[#090A0D] px-3.5 py-2 font-mono text-[12.5px] text-[#F4F2EC] outline-none transition-colors duration-200 placeholder:text-paper/30 focus:border-white/30"
                    />
                  </Field>

                  {/* Row 4: 3 Equal Columns (Amount | SLA Presets | Custom Hours) */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label="Amount (USDC)">
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
                      <span className="block font-mono text-[10.5px] uppercase tracking-[0.1em] text-paper/90">
                        SLA Window
                      </span>
                      <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg border border-white/[0.08] bg-[#090A0D] p-1">
                        {SLA_PRESETS.map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => setDeadlineHours(p.hours)}
                            className={`h-8 rounded font-mono text-[10px] uppercase transition-all duration-200 ${
                              deadlineHours === p.hours
                                ? 'bg-white/[0.12] font-medium text-[#F4F2EC]'
                                : 'text-secondary hover:text-[#F4F2EC]'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Field label="Custom Hours">
                      <input
                        type="number"
                        step="any"
                        min="0.03"
                        max="720"
                        required
                        value={deadlineHours}
                        onChange={(e) => setDeadlineHours(e.target.value)}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                </div>
              </div>

              {/* Footer Action */}
              <div className="mt-5 border-t border-white/[0.08] pt-4">
                {error && (
                  <p className="mb-3 rounded-lg border border-crimson/35 bg-crimson/10 px-3 py-2 font-mono text-[11.5px] text-crimson">
                    {error}
                  </p>
                )}
                <Button type="submit" loading={submitting} className="w-full">
                  Generate Escrow Link <ArrowRight className="size-4" />
                </Button>
              </div>
            </form>

            {/* Right Card (5 cols): Equal-Height Live Settlement & Risk Preview */}
            <aside className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#111318] p-6 lg:col-span-5">
              <div>
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                  <span className="rwa-hud text-paper/90">LIVE SETTLEMENT PREVIEW</span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#090A0D] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-secondary">
                    <PulseDot color="bg-emerald" />
                    ARC 5042002
                  </span>
                </div>

                <dl className="mt-2 divide-y divide-white/[0.06] font-mono text-[12px]">
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-secondary">Escrow Principal</dt>
                    <dd className="font-semibold tabular-nums text-[#F4F2EC]">
                      {fmtAmount(parsedAmount)} USDC
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-secondary">Payee Instant Payout (99.5%)</dt>
                    <dd className="font-semibold tabular-nums text-emerald">
                      {fmtAmount(payeePayout)} USDC
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-secondary">Protocol Fee (0.5%)</dt>
                    <dd className="tabular-nums text-[#F4F2EC]">{fmtAmount(protocolFee)} USDC</dd>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-secondary">Gemini Live Risk λ</dt>
                    <dd className="tabular-nums text-[#F4F2EC]">
                      {liveLambda.toFixed(2)} (Calibrated)
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-secondary">Checkout Endpoint</dt>
                    <dd className="text-secondary">app.diptos.xyz/pay/:id</dd>
                  </div>
                </dl>
              </div>

              {/* Bottom Section: Latest 2 Live On-Chain Arc Escrows */}
              <div className="mt-6 border-t border-white/[0.08] pt-4">
                <div className="flex items-center justify-between">
                  <span className="rwa-hud text-secondary">
                    RECENT ON-CHAIN ESCROWS ({escrows.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => void refresh()}
                    className="inline-flex items-center gap-1 font-mono text-[10.5px] text-secondary hover:text-[#F4F2EC]"
                  >
                    <RefreshCw className={`size-3 ${escrowsLoading ? 'animate-spin' : ''}`} /> Sync
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {escrows.slice(0, 2).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-[#090A0D] px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium text-[#F4F2EC]">{item.title}</p>
                        <p className="font-mono text-[10.5px] text-secondary">
                          {fmtAmount(item.amountUsdc)} USDC · {item.status.toUpperCase()}
                        </p>
                      </div>
                      <a
                        href={getPayUrl(`/pay/${item.id}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[#F4F2EC] transition-colors hover:bg-white/[0.08]"
                      >
                        Open Checkout <ArrowUpRight className="size-3" />
                      </a>
                    </div>
                  ))}
                  {escrows.length === 0 && (
                    <p className="rounded-lg border border-white/[0.06] bg-[#090A0D] px-3.5 py-3 font-mono text-[11px] text-secondary">
                      Syncing live escrows from DiptosEscrow.sol on Arc Testnet…
                    </p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        ) : (
          /* Active Arc Escrows Tab */
          <div className="animate-fade-up space-y-6">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <p className="rwa-hud text-secondary">DIRECT ARC TESTNET ENUMERATION</p>
                <h1 className="mt-1 text-[22px] font-semibold text-[#F4F2EC]">
                  Active Arc Escrows ({escrows.length})
                </h1>
              </div>
              <Button size="sm" variant="secondary" onClick={() => void refresh()}>
                <RefreshCw className={`size-3.5 ${escrowsLoading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>

            <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
              {escrows.map((e) => {
                const rem = formatRemaining(e.deadline, nowMs)
                return (
                  <article
                    key={e.id}
                    className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#111318] p-6 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:border-white/20"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-[#090A0D] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#F4F2EC]">
                          <span className="size-1.5 rounded-full bg-emerald" />
                          {e.status}
                        </span>
                        <span className="font-mono text-[10.5px] uppercase text-secondary">
                          {e.mode}
                        </span>
                      </div>
                      <h2 className="mt-4 text-[17px] font-semibold text-[#F4F2EC]">{e.title}</h2>
                      <p className="mt-1.5 line-clamp-2 text-[13px] text-secondary">{e.scope}</p>
                    </div>

                    <div className="mt-6 border-t border-white/[0.08] pt-4">
                      <div className="flex items-baseline justify-between font-mono">
                        <span className="text-[18px] font-semibold tabular-nums text-[#F4F2EC]">
                          {fmtAmount(e.amountUsdc)} USDC
                        </span>
                        <span className="text-[11px] tabular-nums text-secondary">{rem.text}</span>
                      </div>
                      <a
                        href={getPayUrl(`/pay/${e.id}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-white/15 font-mono text-[11px] uppercase tracking-[0.12em] text-[#F4F2EC] transition-colors hover:bg-white/[0.08]"
                      >
                        Open Checkout <ArrowUpRight className="size-3.5" />
                      </a>
                    </div>
                  </article>
                )
              })}
            </div>
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
