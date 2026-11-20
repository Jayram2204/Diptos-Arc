import { type FormEvent, useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Clock,
  Copy,
  Droplets,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User,
  Wallet,
} from 'lucide-react'
import { encodePacked, isAddress, keccak256, parseEther } from 'viem'
import { Button, CopyButton, Field, inputCls, PulseDot } from '@/components/ui'
import { explorerUrl, fmtAmount, shortHex } from '@/lib/chain'
import { useEscrows, useGeminiRisk } from '@/lib/hooks'
import { getApexUrl, getPayUrl, getSdkUrl, navigate } from '@/lib/route'
import { type EscrowMode } from '@/lib/sdk'
import { useWallet, WalletProvider } from './wallet'

const SLA_PRESETS = [
  { label: '2 Mins', hours: 0.033 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
]

function formatRemaining(deadlineIso: string, nowMs: number): { text: string; overdue: boolean } {
  const diffSec = Math.floor((new Date(deadlineIso).getTime() - nowMs) / 1000)
  const overdue = diffSec < 0
  const abs = Math.abs(diffSec)
  const hrs = Math.floor(abs / 3600)
  const mins = Math.floor((abs % 3600) / 60)
  const secs = abs % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    overdue,
    text: `${overdue ? '+' : ''}${pad(hrs)}:${pad(mins)}:${pad(secs)}`,
  }
}

function EscrowDashboardInner() {
  const { address, balanceUsdc, connecting, connect, disconnect, execute, txStage, error: walletError, clearError } =
    useWallet()
  const { escrows, loading, refresh } = useEscrows(4000)
  const { data: gemini } = useGeminiRisk()

  const [tab, setTab] = useState<'create' | 'list'>('create')
  const [title, setTitle] = useState('')
  const [scope, setScope] = useState('')
  const [amountInput, setAmountInput] = useState('0.05')
  const [deadlineHours, setDeadlineHours] = useState<number>(24)
  const [mode, setMode] = useState<EscrowMode>('human')
  const [payeeInput, setPayeeInput] = useState('0x742d35Cc6634C0532925a3b844Bc454e4438f44e')

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [faucetTxHash, setFaucetTxHash] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const liveLambda = gemini?.recommendedLambda ?? 0.35
  const parsedAmount = Math.max(0, Number(amountInput) || 0)
  const payeeInstantPayout = parsedAmount * 0.995
  const protocolFee = parsedAmount * 0.005

  const handleCreateEscrow = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    clearError()

    const cleanTitle = title.trim()
    const cleanScope = scope.trim()
    const amount = Number(amountInput)
    if (!cleanTitle || cleanTitle.length < 3) {
      setFormError('Enter a deliverable title (at least 3 characters).')
      return
    }
    if (!cleanScope || cleanScope.length < 8) {
      setFormError('Describe the acceptance criteria so Grok AI can audit it.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Enter a valid USDC amount greater than 0.')
      return
    }
    const cleanPayee = payeeInput.trim()
    if (!cleanPayee || !isAddress(cleanPayee)) {
      setFormError('Payee must be a valid 0x Ethereum/Arc address.')
      return
    }

    setSubmitting(true)
    try {
      let activeUser = address
      if (!activeUser) {
        activeUser = await connect('metamask')
        if (!activeUser) {
          setSubmitting(false)
          return
        }
      }

      const escrowId = keccak256(
        encodePacked(['address', 'string', 'uint256'], [activeUser, cleanTitle, BigInt(Date.now())]),
      )
      const deadlineUnix = Math.floor(Date.now() / 1000) + Math.max(120, Math.round(deadlineHours * 3600))
      const lambdaBps = Math.round(liveLambda * 10_000)

      const rc = await execute({
        kind: 'Create Escrow',
        contract: 'DiptosEscrow',
        functionName: 'createEscrowLink',
        args: [
          escrowId,
          cleanPayee,
          BigInt(deadlineUnix),
          BigInt(lambdaBps),
          mode === 'agent',
          cleanTitle,
          cleanScope,
        ],
        value: parseEther(String(amount)),
      })

      if (rc && rc.status === 'success') {
        await refresh()
        navigate(`/pay/${escrowId}`)
      }
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClaimTestnetFaucet = async () => {
    clearError()
    setFaucetTxHash(null)
    const rc = await execute({
      kind: 'Claim Faucet',
      contract: 'DiptosEscrow',
      functionName: 'faucetMint',
      args: [],
    })
    if (rc && rc.status === 'success') {
      setFaucetTxHash(rc.hash)
    }
  }

  return (
    <div className="min-h-screen bg-black text-paper">
      {/* Header Alignment (68px height, max-w-[1320px] mx-auto px-6) */}
      <header className="sticky top-0 z-50 h-[68px] border-b border-paper/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1320px] items-center justify-between gap-4 px-6">
          {/* Left: ← DIPTOS.XYZ (target="_blank") + APP.DIPTOS. wordmark */}
          <div className="flex items-center gap-3.5">
            <a
              href={getApexUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-paper/15 bg-surface px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-secondary transition-colors hover:border-lime hover:text-lime"
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">diptos.xyz</span>
            </a>

            <span className="rwa-display inline-flex items-baseline text-[18px] tracking-[-0.04em] text-paper">
              APP.DIPTOS<span className="ml-0.5 inline-block size-2 rounded-full bg-lime" />
            </span>
          </div>

          {/* Center: Segmented Pill Switcher */}
          <div className="hidden items-center rounded-full border border-paper/12 bg-surface p-1 md:flex">
            <button
              type="button"
              onClick={() => setTab('create')}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-4 font-mono text-[11px] font-medium uppercase tracking-[0.12em] transition-all duration-200 ${
                tab === 'create'
                  ? 'bg-lime text-ink font-semibold'
                  : 'text-secondary hover:text-paper'
              }`}
            >
              <Plus className="size-3" /> New Escrow Link
            </button>
            <button
              type="button"
              onClick={() => setTab('list')}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-4 font-mono text-[11px] font-medium uppercase tracking-[0.12em] transition-all duration-200 ${
                tab === 'list'
                  ? 'bg-lime text-ink font-semibold'
                  : 'text-secondary hover:text-paper'
              }`}
            >
              Active Arc Escrows ({escrows.length})
            </button>
          </div>

          {/* Right: SDK ↗ (target="_blank") + Connect Wallet pill button */}
          <div className="flex items-center gap-2.5">
            <a
              href={getSdkUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-9 items-center gap-1 rounded-full border border-paper/20 bg-transparent px-3.5 font-mono text-[11px] uppercase tracking-[0.12em] text-paper transition-colors hover:border-lime hover:text-lime sm:inline-flex"
            >
              SDK <ArrowUpRight className="size-3" />
            </a>

            <Button
              size="sm"
              variant="secondary"
              loading={txStage?.kind === 'Claim Faucet'}
              onClick={handleClaimTestnetFaucet}
              className="hidden lg:inline-flex"
            >
              <Droplets className="size-3.5 text-lime" />
              Faucet
            </Button>

            {address ? (
              <div className="flex h-9 items-center gap-2 rounded-full border border-paper/15 bg-surface pl-3.5 pr-1.5 font-mono text-[12px]">
                {balanceUsdc !== null && <span className="hidden text-lime sm:inline">{balanceUsdc} USDC</span>}
                <span className="rounded-full bg-elevated px-2.5 py-0.5 text-paper">{shortHex(address)}</span>
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
              <Button size="sm" variant="primary" loading={connecting === 'metamask'} onClick={() => void connect('metamask')}>
                <Wallet className="size-3.5" />
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Tab Switcher */}
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-2 px-6 pt-4 md:hidden">
        <div className="inline-flex w-full rounded-full border border-paper/12 bg-surface p-1">
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`flex-1 rounded-full py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] ${
              tab === 'create' ? 'bg-lime text-ink font-semibold' : 'text-secondary'
            }`}
          >
            New Escrow Link
          </button>
          <button
            type="button"
            onClick={() => setTab('list')}
            className={`flex-1 rounded-full py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] ${
              tab === 'list' ? 'bg-lime text-ink font-semibold' : 'text-secondary'
            }`}
          >
            Active Escrows ({escrows.length})
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <main className="mx-auto max-w-[1320px] px-6 py-8">
        {(faucetTxHash || walletError) && (
          <div className="mb-6">
            {faucetTxHash && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald/35 bg-emerald/10 px-4 py-2.5 font-mono text-[11.5px] text-emerald">
                <span>Claimed 0.25 Testnet USDC from DiptosEscrow on-chain faucet</span>
                <a
                  href={explorerUrl('tx', faucetTxHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline"
                >
                  {shortHex(faucetTxHash, 10, 6)} <ArrowUpRight className="size-3.5" />
                </a>
              </div>
            )}
            {walletError && (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-crimson/35 bg-crimson/10 px-4 py-3 font-mono text-[12px] text-crimson">
                <span>{walletError}</span>
                <button
                  type="button"
                  onClick={clearError}
                  className="shrink-0 rounded-full border border-crimson/30 px-2.5 py-0.5 text-[10px] uppercase hover:bg-crimson/20"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'create' ? (
          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
            {/* Left Card (lg:col-span-7): Compact Equal-Height Origination Form */}
            <div className="rwa-depth-card flex flex-col justify-between rounded-2xl p-7 lg:col-span-7">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper/10 pb-4">
                  <div>
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-lime">
                      01 // ON-CHAIN ESCROW ORIGINATION
                    </p>
                    <h1 className="rwa-display mt-1 text-[22px] uppercase text-paper sm:text-[26px]">
                      CREATE USDC ESCROW LINK
                    </h1>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-paper/12 bg-black/50 px-3 py-1 font-mono text-[10.5px] text-secondary">
                    <Sparkles className="size-3 text-lime" />
                    λ = {liveLambda.toFixed(2)}
                  </span>
                </div>

                <form id="escrow-create-form" onSubmit={handleCreateEscrow} className="mt-5 space-y-4">
                  {/* Row 1: Execution Mode clean 2-button toggle + Payee Wallet */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Execution Mode">
                      <div className="grid h-10 grid-cols-2 gap-1.5 rounded-xl border border-paper/12 bg-elevated p-1">
                        <button
                          type="button"
                          onClick={() => setMode('human')}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-mono text-[11px] uppercase tracking-[0.1em] transition-all ${
                            mode === 'human'
                              ? 'bg-lime text-ink font-semibold'
                              : 'text-secondary hover:text-paper'
                          }`}
                        >
                          <User className="size-3.5" /> Human Freelancer
                        </button>
                        <button
                          type="button"
                          onClick={() => setMode('agent')}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-mono text-[11px] uppercase tracking-[0.1em] transition-all ${
                            mode === 'agent'
                              ? 'bg-lime text-ink font-semibold'
                              : 'text-secondary hover:text-paper'
                          }`}
                        >
                          <Bot className="size-3.5" /> AI Agent API
                        </button>
                      </div>
                    </Field>

                    <Field label="Payee Wallet (Arc 0x)">
                      <input
                        type="text"
                        value={payeeInput}
                        onChange={(e) => setPayeeInput(e.target.value)}
                        placeholder="0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
                        className={`${inputCls} font-mono text-[12px]`}
                      />
                    </Field>
                  </div>

                  {/* Row 2: Deliverable Title */}
                  <Field label="Deliverable Title (Stored On-Chain)">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Ship Arc Testnet USDC Checkout Integration & Foundry Tests"
                      className={inputCls}
                    />
                  </Field>

                  {/* Row 3: Acceptance Criteria / Grok Audit Scope */}
                  <Field label="Acceptance Criteria / Grok Audit Scope (Stored On-Chain)" hint="Audited via POST /api/verify/grok">
                    <textarea
                      rows={2}
                      value={scope}
                      onChange={(e) => setScope(e.target.value)}
                      placeholder="1. Merge PR with passing Foundry tests&#10;2. Verify live settlement on Arc Testnet (5042002)"
                      className="w-full resize-none rounded-xl border border-paper/12 bg-elevated px-3.5 py-2.5 text-[13.5px] text-paper outline-none transition-colors placeholder:text-secondary/45 focus:border-lime"
                    />
                  </Field>

                  {/* Row 4 (3 equal columns grid-cols-3 gap-4): Amount (USDC) | SLA Window | Custom Hours */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label="Amount (USDC)">
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          value={amountInput}
                          onChange={(e) => setAmountInput(e.target.value)}
                          className={`${inputCls} pr-14 font-mono`}
                        />
                        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-[10.5px] text-secondary">
                          USDC
                        </span>
                      </div>
                    </Field>

                    <Field label="SLA Window">
                      <div className="grid h-10 grid-cols-3 gap-1 rounded-xl border border-paper/12 bg-elevated p-1">
                        {SLA_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setDeadlineHours(preset.hours)}
                            className={`rounded-lg font-mono text-[10.5px] uppercase transition-all ${
                              deadlineHours === preset.hours
                                ? 'bg-lime text-ink font-semibold'
                                : 'text-secondary hover:text-paper'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </Field>

                    <Field label="Custom Hours">
                      <input
                        type="number"
                        min={0.03}
                        max={720}
                        step="any"
                        value={deadlineHours}
                        onChange={(e) => setDeadlineHours(Math.max(0.03, Number(e.target.value) || 1))}
                        className={`${inputCls} font-mono`}
                      />
                    </Field>
                  </div>

                  {formError && (
                    <p className="rounded-xl border border-crimson/35 bg-crimson/10 px-3.5 py-2 font-mono text-[11.5px] text-crimson">
                      {formError}
                    </p>
                  )}

                  {txStage?.kind === 'Create Escrow' && (
                    <p className="font-mono text-[11.5px] text-lime">
                      {txStage.stage === 'switch'
                        ? 'Switching wallet to Arc Testnet (5042002)…'
                        : txStage.stage === 'simulate'
                          ? 'Simulating DiptosEscrow.createEscrowLink on Arc Testnet…'
                          : txStage.stage === 'sign'
                            ? 'Awaiting wallet signature to lock native USDC…'
                            : 'Confirming sub-second finality on Arc Testnet…'}
                    </p>
                  )}
                </form>
              </div>

              {/* Footer Action */}
              <div className="mt-6 border-t border-paper/10 pt-5">
                <Button
                  type="submit"
                  form="escrow-create-form"
                  variant="primary"
                  size="lg"
                  loading={submitting || txStage?.kind === 'Create Escrow'}
                  className="w-full"
                >
                  Generate Escrow Link <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>

            {/* Right Card (lg:col-span-5): Equal-Height Live Settlement & Risk Preview */}
            <div className="rwa-depth-card flex flex-col justify-between rounded-2xl p-7 lg:col-span-5">
              <div>
                <div className="flex items-center justify-between gap-2 border-b border-paper/10 pb-4">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-lime">
                    LIVE SETTLEMENT PREVIEW
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-paper/12 bg-black/50 px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-paper">
                    <PulseDot color="bg-lime" />
                    ARC 5042002
                  </span>
                </div>

                {/* Tabular Breakdown Rows */}
                <dl className="mt-2 divide-y divide-paper/10 font-mono text-[12px]">
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-secondary">Escrow Principal</dt>
                    <dd className="font-semibold text-paper">{fmtAmount(parsedAmount)} USDC</dd>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-secondary">Payee Instant Payout (99.5%)</dt>
                    <dd className="font-semibold text-emerald">{fmtAmount(payeeInstantPayout)} USDC</dd>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-secondary">Protocol Fee (0.5%)</dt>
                    <dd className="text-paper">{fmtAmount(protocolFee)} USDC</dd>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-secondary">Gemini Live Risk λ</dt>
                    <dd className="text-lime">{liveLambda.toFixed(3)} (Calibrated)</dd>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-secondary">Execution Guardrail</dt>
                    <dd className="text-paper">{mode === 'agent' ? 'AI Agent API' : 'Human Freelancer'}</dd>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-secondary">Checkout Endpoint</dt>
                    <dd className="text-secondary">app.diptos.xyz/pay/:id</dd>
                  </div>
                </dl>
              </div>

              {/* Bottom Section: Latest 2 Live On-Chain Arc Escrows */}
              <div className="mt-6 border-t border-paper/10 pt-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-lime">
                    LATEST ON-CHAIN ARC ESCROWS ({escrows.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setTab('list')}
                    className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-paper transition-colors hover:text-lime"
                  >
                    View All →
                  </button>
                </div>

                <div className="mt-3 space-y-2.5">
                  {escrows.slice(0, 2).map((esc) => {
                    const rem = formatRemaining(esc.deadline, nowMs)
                    return (
                      <div
                        key={esc.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-paper/12 bg-black/55 px-3.5 py-2.5 transition-colors hover:border-lime/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-paper">{esc.title}</p>
                          <div className="mt-0.5 flex items-center gap-2 font-mono text-[10.5px] text-secondary">
                            <span className="text-paper">{fmtAmount(esc.amountUsdc)} USDC</span>
                            <span>•</span>
                            <span className={rem.overdue ? 'text-crimson' : 'text-emerald'}>
                              {esc.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/pay/${esc.escrowIdBytes32}`)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-paper/15 bg-surface px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-paper transition-colors hover:border-lime hover:text-lime"
                        >
                          Open Checkout <ArrowRight className="size-3" />
                        </button>
                      </div>
                    )
                  })}
                  {escrows.length === 0 && (
                    <p className="rounded-xl border border-paper/10 bg-black/45 px-3.5 py-3 font-mono text-[11px] text-secondary">
                      Syncing deployed escrows from Arc Testnet (5042002)…
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Active Arc Escrows Tab — Symmetrical Equal-Height Card Grid */
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-paper/10 pb-5">
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-lime">
                  ON-CHAIN REGISTRY // DIPTOSESCROW.SOL
                </p>
                <h2 className="rwa-display mt-1 text-[24px] uppercase text-paper">
                  ACTIVE ARC ESCROWS ({escrows.length})
                </h2>
              </div>
              <div className="flex items-center gap-2.5">
                <Button size="sm" variant="secondary" onClick={() => void refresh()}>
                  <RefreshCw className="size-3.5" /> Refresh
                </Button>
                <Button size="sm" variant="primary" onClick={() => setTab('create')}>
                  <Plus className="size-3.5" /> New Escrow Link
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="h-52 animate-pulse rounded-2xl border border-paper/10 bg-surface"
                  />
                ))}
              </div>
            ) : (
              <div className="mt-6 grid items-stretch gap-5 md:grid-cols-2">
                {escrows.map((escrow) => {
                  const rem = formatRemaining(escrow.deadline, nowMs)
                  const shareUrl = getPayUrl(escrow.escrowIdBytes32)
                  return (
                    <article
                      key={escrow.id}
                      className="rwa-depth-card flex h-full flex-col justify-between rounded-2xl p-6 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:border-lime/50"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-paper/15 bg-black/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-lime">
                            {escrow.mode === 'agent' ? (
                              <>
                                <Bot className="size-3" /> AI AGENT
                              </>
                            ) : (
                              <>
                                <User className="size-3" /> FREELANCER
                              </>
                            )}
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase text-emerald">
                            <ShieldCheck className="size-3.5" /> {escrow.status}
                          </span>
                        </div>

                        <h3 className="mt-3.5 text-[18px] font-semibold text-paper">{escrow.title}</h3>
                        <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-[13px] text-secondary">
                          {escrow.scope}
                        </p>
                      </div>

                      <div>
                        <dl className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-paper/10 bg-black/50 p-3.5 font-mono">
                          <div>
                            <dt className="text-[10px] uppercase text-secondary">AMOUNT</dt>
                            <dd className="mt-0.5 text-[13px] font-semibold text-paper">
                              {fmtAmount(escrow.amountUsdc)} USDC
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase text-secondary">TECD λ</dt>
                            <dd className="mt-0.5 text-[13px] font-semibold text-lime">
                              {escrow.tecdLambda.toFixed(2)}
                            </dd>
                          </div>
                          <div>
                            <dt className="flex items-center gap-1 text-[10px] uppercase text-secondary">
                              <Clock className="size-2.5" /> SLA
                            </dt>
                            <dd
                              className={`mt-0.5 text-[13px] font-semibold ${
                                rem.overdue ? 'text-crimson' : 'text-emerald'
                              }`}
                            >
                              {rem.text}
                            </dd>
                          </div>
                        </dl>

                        <div className="mt-4 flex items-center justify-between gap-2">
                          <CopyButton value={shareUrl} label="Copy checkout link" />
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => navigate(`/pay/${escrow.escrowIdBytes32}`)}
                          >
                            Open Checkout <ArrowRight className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </article>
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
      <EscrowDashboardInner />
    </WalletProvider>
  )
}
