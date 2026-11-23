import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Droplets,
  FileText,
  Layers,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  Wallet,
} from 'lucide-react'
import { encodePacked, isAddress, keccak256, parseEther } from 'viem'
import { ESCROW_CONTRACT_ADDRESS, REGISTRY_CONTRACT_ADDRESS } from '@/config/protocol'
import { explorerUrl, fmtAmount, shortHex } from '@/lib/chain'
import { useDynamicCookies } from '@/lib/cookies'
import { useArcPulse, useEscrows } from '@/lib/hooks'
import { getApexUrl, getPayUrl, getSdkUrl, navigate } from '@/lib/route'
import { diptos, type EscrowMode, type EscrowRecord } from '@/lib/sdk'
import { useWallet, WalletProvider } from '@/app/wallet'
import { WalletModal } from './WalletModal'

type WorkspaceView = 'ledger' | 'originate' | 'faucet'
type LedgerFilter = 'all' | 'funded' | 'settled' | 'refunded'

const SLA_PRESETS = [
  { label: '2 Mins (Demo)', hours: 0.033 },
  { label: '24 Hours', hours: 24 },
  { label: '3 Days', hours: 72 },
  { label: '7 Days', hours: 168 },
]

const PROTECTION_PRESETS = [
  { id: 'strict', label: 'Strict Sprint', lambda: 0.8 },
  { id: 'standard', label: 'Standard Milestone', lambda: 0.5 },
  { id: 'agent', label: 'AI Agent SLA', lambda: 0.35 },
] as const

const APP_CHAINS = [
  { id: 5042002, name: 'Arc Testnet', status: 'live' as const },
  { id: 8453, name: 'Base', status: 'coming_next' as const },
]

function formatSlaCountdown(deadlineIso: string, nowMs: number): { text: string; overdue: boolean } {
  const diffSec = Math.floor((new Date(deadlineIso).getTime() - nowMs) / 1000)
  const overdue = diffSec < 0
  const abs = Math.abs(diffSec)
  const days = Math.floor(abs / 86400)
  const hrs = Math.floor((abs % 86400) / 3600)
  const mins = Math.floor((abs % 3600) / 60)
  const secs = abs % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  const core = days > 0 ? `${days}d ${pad(hrs)}h ${pad(mins)}m` : `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
  return { overdue, text: overdue ? `+${core} overdue` : core }
}

function getLifecycleStep(status: string): number {
  const s = status.toLowerCase()
  if (s === 'settled' || s === 'refunded' || s === 'cancelled') return 4
  if (s === 'funded' || s === 'active') return 2
  return 1
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  if (s === 'settled') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#10B981]/30 bg-[#10B981]/10 px-2.5 py-0.5 font-mono text-[10.5px] font-medium text-[#10B981]">
        <span className="size-1.5 rounded-full bg-[#10B981]" />
        Settled
      </span>
    )
  }
  if (s === 'refunded' || s === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[10.5px] font-medium text-[#A1A6B5]">
        <span className="size-1.5 rounded-full bg-[#8E93A4]" />
        {status}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8FF00]/30 bg-[#C8FF00]/10 px-2.5 py-0.5 font-mono text-[10.5px] font-medium text-[#C8FF00]">
      <span className="size-1.5 rounded-full bg-[#C8FF00]" />
      Funded
    </span>
  )
}

function LifecycleStepper({ status }: { status: string }) {
  const step = getLifecycleStep(status)
  const isRefunded = status.toLowerCase() === 'refunded' || status.toLowerCase() === 'cancelled'
  const labels = ['Created', 'Funded', 'Verified', isRefunded ? 'Refunded' : 'Settled']

  return (
    <div className="flex items-center gap-1">
      {labels.map((label, idx) => {
        const done = idx + 1 <= step
        return (
          <span
            key={label}
            title={label}
            className={`h-1.5 w-5 rounded-full ${
              done
                ? isRefunded && idx === 3
                  ? 'bg-[#8E93A4]'
                  : 'bg-[#10B981]'
                : 'bg-white/[0.1]'
            }`}
          />
        )
      })}
      <span className="ml-1.5 font-mono text-[10px] text-[#7F8596]">{labels[Math.min(step - 1, 3)]}</span>
    </div>
  )
}

function EscrowEngineInner() {
  const {
    address,
    isConnected,
    balanceUsdc,
    execute,
    txStage,
    error: walletError,
    clearError,
  } = useWallet()
  const { escrows, loading, refresh } = useEscrows(5000)
  const pulse = useArcPulse(5000)
  const { mode: savedMode, setPreference } = useDynamicCookies()

  const [view, setView] = useState<WorkspaceView>('ledger')
  const [walletOpen, setWalletOpen] = useState(false)
  const [filter, setFilter] = useState<LedgerFilter>('all')
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  // Origination form state
  const [selectedChainId, setSelectedChainId] = useState<number>(5042002)
  const [mode, setMode] = useState<EscrowMode>(savedMode ?? 'human')
  const [selectedLambda, setSelectedLambda] = useState<number>(0.5)
  const [title, setTitle] = useState('')
  const [scope, setScope] = useState('')
  const [payeeInput, setPayeeInput] = useState('')
  const [amountInput, setAmountInput] = useState('250')
  const [deadlineHours, setDeadlineHours] = useState<number>(24)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [faucetTxHash, setFaucetTxHash] = useState<string | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const parsedAmount = Math.max(0, Number(amountInput) || 0)

  const tecdSchedule = useMemo(() => {
    const totalSec = Math.max(120, Math.round(deadlineHours * 3600))
    return [
      { label: 'On-Time (Δt = 0)', delaySec: 0 },
      { label: '+25% Overdue', delaySec: Math.round(totalSec * 0.25) },
      { label: '+50% Overdue', delaySec: Math.round(totalSec * 0.5) },
    ].map((pt) => ({
      label: pt.label,
      ...diptos.calculateTECD({
        principalUsdc: parsedAmount,
        lambda: selectedLambda,
        delaySeconds: pt.delaySec,
        totalDurationSeconds: totalSec,
        gamma: 1.5,
      }),
    }))
  }, [parsedAmount, selectedLambda, deadlineHours])

  const metrics = useMemo(() => {
    let activeCount = 0
    let settledCount = 0
    for (const e of escrows) {
      const s = e.status.toLowerCase()
      if (s === 'funded' || s === 'active') activeCount++
      else if (s === 'settled') settledCount++
    }
    return { activeCount, settledCount, totalCount: escrows.length }
  }, [escrows])

  const avgFinalityLabel =
    pulse.latency !== undefined ? `${(Math.min(980, Math.max(320, pulse.latency)) / 1000).toFixed(2)}s` : '< 1.0s'

  const filteredEscrows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return escrows.filter((e: EscrowRecord) => {
      const s = e.status.toLowerCase()
      if (filter === 'funded' && s !== 'funded' && s !== 'active') return false
      if (filter === 'settled' && s !== 'settled') return false
      if (filter === 'refunded' && s !== 'refunded' && s !== 'cancelled') return false
      if (!q) return true
      return (
        (e.title ?? '').toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        (e.payer ?? '').toLowerCase().includes(q) ||
        (e.payee ?? '').toLowerCase().includes(q)
      )
    })
  }, [escrows, filter, search])

  const handleModeChange = (next: EscrowMode) => {
    setMode(next)
    setPreference('diptos_mode', next)
    if (next === 'agent') setSelectedLambda(0.35)
  }

  const handleCopyPayLink = async (id: string) => {
    try {
      const url = getPayUrl(id)
      const full = url.startsWith('http') ? url : `${window.location.origin}${url}`
      await navigator.clipboard.writeText(full)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      // ignore clipboard errors
    }
  }

  const handleCreateEscrow = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    clearError()

    if (selectedChainId !== 5042002) {
      setFormError('Base settlement is coming next. Select Arc Testnet (5042002) for live on-chain settlement.')
      return
    }

    const cleanTitle = title.trim()
    const cleanScope = scope.trim()
    const amount = Number(amountInput)
    if (cleanTitle.length < 3) {
      setFormError('Enter a deliverable title (minimum 3 characters).')
      return
    }
    if (cleanScope.length < 8) {
      setFormError('Provide objective acceptance criteria for deterministic verification.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Enter a valid USDC principal greater than 0.')
      return
    }
    const cleanPayee = payeeInput.trim()
    if (!isAddress(cleanPayee)) {
      setFormError('Counterparty payee must be a valid 0x EVM address.')
      return
    }

    if (!isConnected || !address) {
      setWalletOpen(true)
      return
    }

    setSubmitting(true)
    try {
      const escrowId = keccak256(
        encodePacked(['address', 'string', 'uint256'], [address, cleanTitle, BigInt(Date.now())]),
      )
      const deadlineUnix = Math.floor(Date.now() / 1000) + Math.max(120, Math.round(deadlineHours * 3600))
      const lambdaBps = Math.round(selectedLambda * 10_000)

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

  const handleClaimFaucet = async () => {
    clearError()
    setFaucetTxHash(null)
    if (!isConnected) {
      setWalletOpen(true)
      return
    }
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
    <div className="flex min-h-screen bg-[#000000] text-[#E6E4DD] antialiased">
      {/* Persistent Institutional Left Sidebar */}
      <aside className="hidden w-[236px] shrink-0 flex-col justify-between border-r border-white/[0.08] bg-[#06070A] lg:flex">
        <div>
          <div className="flex h-14 items-center justify-between border-b border-white/[0.08] px-5">
            <a
              href={getApexUrl()}
              className="rwa-display inline-flex items-baseline text-[17px] tracking-[-0.04em] text-[#F4F2EC]"
            >
              DIPTOS<span className="ml-0.5 inline-block size-1.5 rounded-full bg-[#C8FF00]" />
            </a>
            <span className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-[#8E93A4]">
              Engine
            </span>
          </div>

          <nav className="space-y-1 p-3" aria-label="Workspace navigation">
            <button
              type="button"
              onClick={() => setView('ledger')}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                view === 'ledger'
                  ? 'bg-white/[0.08] text-[#F4F2EC]'
                  : 'text-[#8E93A4] hover:bg-white/[0.03] hover:text-[#E6E4DD]'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <Layers className="size-4" />
                Escrow Ledger
              </span>
              <span className="font-mono text-[11px] text-[#7F8596]">{metrics.totalCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setView('originate')}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                view === 'originate'
                  ? 'bg-white/[0.08] text-[#F4F2EC]'
                  : 'text-[#8E93A4] hover:bg-white/[0.03] hover:text-[#E6E4DD]'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <Plus className="size-4" />
                Create Link
              </span>
            </button>

            <button
              type="button"
              onClick={() => setView('faucet')}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                view === 'faucet'
                  ? 'bg-white/[0.08] text-[#F4F2EC]'
                  : 'text-[#8E93A4] hover:bg-white/[0.03] hover:text-[#E6E4DD]'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <Droplets className="size-4" />
                Testnet Faucet
              </span>
            </button>
          </nav>
        </div>

        <div className="space-y-2 border-t border-white/[0.08] p-4 text-[12px] text-[#8E93A4]">
          <a
            href={getSdkUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-[#F4F2EC]"
          >
            <span className="inline-flex items-center gap-2">
              <FileText className="size-3.5" />
              SDK Docs
            </span>
            <ArrowUpRight className="size-3" />
          </a>
          <a
            href={explorerUrl('address', ESCROW_CONTRACT_ADDRESS)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-[#F4F2EC]"
          >
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-3.5" />
              ArcScan Contract
            </span>
            <ArrowUpRight className="size-3" />
          </a>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar (56px) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-white/[0.08] bg-[#000000]/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <a
              href={getApexUrl()}
              className="rwa-display inline-flex items-baseline text-[16px] tracking-[-0.04em] text-[#F4F2EC] lg:hidden"
            >
              DIPTOS<span className="ml-0.5 inline-block size-1.5 rounded-full bg-[#C8FF00]" />
            </a>
            <div className="hidden items-center gap-2 text-[13px] lg:flex">
              <span className="text-[#7F8596]">Guaranteed Outcome Protection</span>
              <span className="text-white/20">/</span>
              <span className="font-medium text-[#F4F2EC]">
                {view === 'ledger'
                  ? 'Escrow Ledger'
                  : view === 'originate'
                    ? 'Create Protection Link'
                    : 'Testnet Faucet'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {view !== 'originate' && (
              <button
                type="button"
                onClick={() => setView('originate')}
                className="hidden h-8 items-center gap-1.5 rounded-full bg-[#C8FF00] px-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[#07080C] transition-colors hover:bg-[#d8ff4d] sm:inline-flex"
              >
                <Plus className="size-3.5" />
                Start in 1 Click
              </button>
            )}

            {/* 1-Click Multi-Chain Wallet Trigger */}
            <button
              type="button"
              onClick={() => setWalletOpen(true)}
              className={`inline-flex h-8 items-center gap-2 rounded-full border px-3.5 font-mono text-[11.5px] transition-colors ${
                isConnected && address
                  ? 'border-white/[0.14] bg-white/[0.04] text-[#F4F2EC] hover:border-white/[0.28]'
                  : 'border-[#C8FF00]/50 bg-[#C8FF00]/10 text-[#C8FF00] hover:bg-[#C8FF00]/20'
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${isConnected ? 'bg-[#10B981]' : 'bg-[#C8FF00]'}`}
              />
              {isConnected && address ? (
                <>
                  <span className="hidden text-[#8E93A4] sm:inline">Arc 5042002</span>
                  <span className="hidden text-white/20 sm:inline">|</span>
                  <span>{balanceUsdc ?? '—'} USDC</span>
                  <span className="text-white/20">|</span>
                  <span>{shortHex(address, 5, 4)}</span>
                </>
              ) : (
                <>
                  <Wallet className="size-3.5" />
                  <span>Connect Wallet</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Mobile View Tabs */}
        <div className="flex border-b border-white/[0.08] bg-[#06070A] px-4 lg:hidden">
          {(['ledger', 'originate', 'faucet'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setView(tab)}
              className={`border-b-2 px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] ${
                view === tab
                  ? 'border-[#C8FF00] text-[#F4F2EC]'
                  : 'border-transparent text-[#8E93A4]'
              }`}
            >
              {tab === 'ledger' ? 'Ledger' : tab === 'originate' ? 'Create Link' : 'Faucet'}
            </button>
          ))}
        </div>

        {/* Workspace Content */}
        <main className="mx-auto w-full max-w-[1220px] flex-1 px-4 py-7 sm:px-8">
          {txStage && (
            <div className="mb-5 flex items-center gap-3 rounded-lg border border-[#C8FF00]/30 bg-[#C8FF00]/[0.07] px-4 py-3 font-mono text-[12px] text-[#F4F2EC]">
              <LoaderCircle className="size-4 animate-spin text-[#C8FF00]" />
              <span>
                {txStage.kind}:{' '}
                {txStage.stage === 'switch'
                  ? 'Switching wallet to Arc Testnet (5042002)…'
                  : txStage.stage === 'simulate'
                    ? 'Simulating contract execution on Arc RPC…'
                    : txStage.stage === 'sign'
                      ? 'Confirm transaction in your wallet…'
                      : 'Waiting for deterministic Arc finality (<1.0s)…'}
              </span>
            </div>
          )}

          {(walletError || formError) && (
            <div className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-[12.5px] text-red-200">
              <span>{formError || walletError}</span>
              <button
                type="button"
                onClick={() => {
                  setFormError(null)
                  clearError()
                }}
                className="font-mono text-[11px] text-red-300 underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* VIEW 1: INSTITUTIONAL ESCROW LEDGER */}
          {view === 'ledger' && (
            <div className="space-y-6">
              {/* Live Operational KPI Strip (Never displays tiny testnet TVL balances) */}
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.08] md:grid-cols-4">
                <div className="bg-[#0B0D12] p-4 sm:p-5">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#7F8596]">
                    LIVE NETWORK
                  </p>
                  <p className="mt-1.5 font-mono text-[20px] font-semibold text-[#F4F2EC]">
                    ARC 5042002
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-[#10B981]">
                    {pulse.blockNumber !== undefined ? `Block #${pulse.blockNumber.toString()}` : 'RPC Syncing…'}
                  </p>
                </div>
                <div className="bg-[#0B0D12] p-4 sm:p-5">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#7F8596]">
                    VERIFIED SETTLEMENTS
                  </p>
                  <p className="mt-1.5 font-mono text-[22px] font-semibold tabular-nums text-[#F4F2EC]">
                    {metrics.settledCount}{' '}
                    <span className="text-[12px] font-normal text-[#7F8596]">
                      / {metrics.totalCount} total
                    </span>
                  </p>
                </div>
                <div className="bg-[#0B0D12] p-4 sm:p-5">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#7F8596]">
                    AVG FINALITY
                  </p>
                  <p className="mt-1.5 font-mono text-[22px] font-semibold tabular-nums text-[#C8FF00]">
                    {avgFinalityLabel}
                  </p>
                </div>
                <div className="bg-[#0B0D12] p-4 sm:p-5">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#7F8596]">
                    PROTOCOL FEE
                  </p>
                  <p className="mt-1.5 font-mono text-[22px] font-semibold tabular-nums text-[#F4F2EC]">
                    0.50% <span className="text-[12px] text-[#10B981]">FLAT</span>
                  </p>
                </div>
              </div>

              {/* Filter & Search Toolbar */}
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="inline-flex rounded-lg border border-white/[0.08] bg-[#0B0D12] p-1">
                  {(['all', 'funded', 'settled', 'refunded'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={`rounded-md px-3 py-1 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors ${
                        filter === f
                          ? 'bg-white/[0.1] text-[#F4F2EC]'
                          : 'text-[#8E93A4] hover:text-[#E6E4DD]'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-[260px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#6E7485]" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filter by title, ID, or 0x…"
                      className="h-9 w-full rounded-lg border border-white/[0.09] bg-[#0B0D12] pl-9 pr-3 text-[12.5px] text-[#F4F2EC] placeholder:text-[#6E7485] focus:border-white/[0.22] focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => refresh()}
                    aria-label="Refresh on-chain escrows"
                    className="grid size-9 place-items-center rounded-lg border border-white/[0.09] bg-[#0B0D12] text-[#8E93A4] hover:text-white"
                  >
                    <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Institutional Escrow Table */}
              <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0B0D12]">
                <table className="w-full min-w-[820px] text-left">
                  <thead className="border-b border-white/[0.08] bg-white/[0.02] font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#7F8596]">
                    <tr>
                      <th className="px-5 py-3 font-medium">Deliverable / ID</th>
                      <th className="px-4 py-3 font-medium">Principal</th>
                      <th className="px-4 py-3 font-medium">Lifecycle</th>
                      <th className="px-4 py-3 font-medium">SLA Window</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-[13px]">
                    {loading && escrows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center font-mono text-[12px] text-[#7F8596]">
                          Syncing live escrows from Arc Testnet (5042002)…
                        </td>
                      </tr>
                    ) : filteredEscrows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-[13px] text-[#7F8596]">
                          No matching escrows found. Click{' '}
                          <button
                            type="button"
                            onClick={() => setView('originate')}
                            className="text-[#C8FF00] underline"
                          >
                            Create Link
                          </button>{' '}
                          to originate a protected escrow on Arc Testnet.
                        </td>
                      </tr>
                    ) : (
                      filteredEscrows.map((esc) => {
                        const sla = formatSlaCountdown(esc.deadline, nowMs)
                        const isSettled = esc.status.toLowerCase() === 'settled'
                        return (
                          <tr key={esc.id} className="transition-colors hover:bg-white/[0.02]">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-[#F4F2EC]">
                                  {esc.title || `Escrow ${shortHex(esc.id, 6, 4)}`}
                                </span>
                                {esc.mode === 'agent' && (
                                  <span className="inline-flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9.5px] text-[#B8BCC9]">
                                    <Bot className="size-2.5" /> Agent
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 font-mono text-[11px] text-[#7F8596]">
                                {esc.payer ? shortHex(esc.payer, 6, 4) : 'Open Payer'} → {shortHex(esc.payee, 6, 4)} •{' '}
                                {shortHex(esc.id, 6, 4)}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 font-mono font-semibold tabular-nums text-[#F4F2EC]">
                              {fmtAmount(esc.amountUsdc)}{' '}
                              <span className="text-[11px] font-normal text-[#7F8596]">USDC</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <LifecycleStepper status={esc.status} />
                            </td>
                            <td className="px-4 py-3.5 font-mono text-[11.5px] tabular-nums">
                              {isSettled ? (
                                <span className="text-[#7F8596]">Completed</span>
                              ) : (
                                <span className={sla.overdue ? 'text-amber-400' : 'text-[#C8CCD8]'}>
                                  <Clock className="mr-1 inline size-3" />
                                  {sla.text}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <StatusBadge status={esc.status} />
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleCopyPayLink(esc.id)}
                                  title="Copy guarantee link"
                                  className="inline-flex h-7 items-center gap-1 rounded border border-white/[0.1] bg-white/[0.02] px-2 font-mono text-[10.5px] text-[#A1A6B5] hover:text-white"
                                >
                                  {copiedId === esc.id ? (
                                    <Check className="size-3 text-[#10B981]" />
                                  ) : (
                                    <Copy className="size-3" />
                                  )}
                                  Link
                                </button>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/pay/${esc.id}`)}
                                  className="inline-flex h-7 items-center gap-1 rounded border border-white/[0.14] bg-white/[0.05] px-2.5 font-mono text-[10.5px] font-medium text-[#F4F2EC] hover:border-[#C8FF00]/50 hover:text-[#C8FF00]"
                                >
                                  Open <ArrowRight className="size-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 2: STRUCTURED ESCROW ORIGINATION WORKBENCH */}
          {view === 'originate' && (
            <form onSubmit={handleCreateEscrow} className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-7">
                {/* Step 1: Network & Parties */}
                <section className="rounded-xl border border-white/[0.08] bg-[#0B0D12] p-5">
                  <div className="flex items-center justify-between border-b border-white/[0.07] pb-3.5">
                    <h2 className="text-[14px] font-semibold text-[#F4F2EC]">
                      1. Settlement Rail &amp; Counterparties
                    </h2>
                    <span className="font-mono text-[10.5px] text-[#7F8596]">Zero Platform Custody</span>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.06em] text-[#8E93A4]">
                        Settlement Network
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        {APP_CHAINS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            disabled={c.status !== 'live'}
                            onClick={() => setSelectedChainId(c.id)}
                            className={`rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                              selectedChainId === c.id
                                ? 'border-[#C8FF00]/50 bg-[#C8FF00]/[0.07] text-[#F4F2EC]'
                                : 'cursor-not-allowed border-white/[0.06] bg-white/[0.01] text-[#7F8596] opacity-65'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[12.5px] font-medium">{c.name}</span>
                              <span
                                className={`font-mono text-[9.5px] uppercase ${
                                  c.status === 'live' ? 'text-[#10B981]' : 'text-[#7F8596]'
                                }`}
                              >
                                {c.status === 'live' ? 'Live' : 'Coming Next'}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.06em] text-[#8E93A4]">
                        Execution Mode
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleModeChange('human')}
                          className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left ${
                            mode === 'human'
                              ? 'border-[#C8FF00]/50 bg-[#C8FF00]/[0.07] text-[#F4F2EC]'
                              : 'border-white/[0.08] bg-white/[0.015] text-[#8E93A4]'
                          }`}
                        >
                          <User className="size-4" />
                          <div>
                            <p className="text-[12.5px] font-medium">Human Checkout</p>
                            <p className="text-[11px] text-[#7F8596]">Shareable /pay/:id receipt</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleModeChange('agent')}
                          className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left ${
                            mode === 'agent'
                              ? 'border-[#C8FF00]/50 bg-[#C8FF00]/[0.07] text-[#F4F2EC]'
                              : 'border-white/[0.08] bg-white/[0.015] text-[#8E93A4]'
                          }`}
                        >
                          <Bot className="size-4" />
                          <div>
                            <p className="text-[12.5px] font-medium">Autonomous AI Agent</p>
                            <p className="text-[11px] text-[#7F8596]">x402 + deterministic guardrail</p>
                          </div>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.06em] text-[#8E93A4]">
                        Payee Recipient Address (0x)
                      </label>
                      <input
                        type="text"
                        value={payeeInput}
                        onChange={(e) => setPayeeInput(e.target.value)}
                        placeholder="0x..."
                        className="h-10 w-full rounded-lg border border-white/[0.1] bg-[#07080B] px-3.5 font-mono text-[12.5px] text-[#F4F2EC] placeholder:text-[#5B6070] focus:border-[#C8FF00]/50 focus:outline-none"
                      />
                    </div>
                  </div>
                </section>

                {/* Step 2: Deliverable Terms & SLA Protection Preset */}
                <section className="rounded-xl border border-white/[0.08] bg-[#0B0D12] p-5">
                  <div className="flex items-center justify-between border-b border-white/[0.07] pb-3.5">
                    <h2 className="text-[14px] font-semibold text-[#F4F2EC]">
                      2. Objective Scope &amp; SLA Protection
                    </h2>
                    <span className="font-mono text-[10.5px] text-[#7F8596]">Stored On-Chain</span>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.06em] text-[#8E93A4]">
                        Deliverable Title
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Smart Contract Security Audit & Test Suite"
                        className="h-10 w-full rounded-lg border border-white/[0.1] bg-[#07080B] px-3.5 text-[13px] text-[#F4F2EC] placeholder:text-[#5B6070] focus:border-[#C8FF00]/50 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.06em] text-[#8E93A4]">
                        Objective Acceptance Criteria (Deterministic Proof)
                      </label>
                      <textarea
                        rows={3}
                        value={scope}
                        onChange={(e) => setScope(e.target.value)}
                        placeholder="Define verifiable proof requirements (GitHub PR passes CI, live URL deployed, tests pass)"
                        className="w-full rounded-lg border border-white/[0.1] bg-[#07080B] p-3.5 text-[13px] text-[#F4F2EC] placeholder:text-[#5B6070] focus:border-[#C8FF00]/50 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.06em] text-[#8E93A4]">
                        SLA Protection Preset (Automatic Late-Delivery Rebate)
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {PROTECTION_PRESETS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedLambda(p.lambda)}
                            className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                              selectedLambda === p.lambda
                                ? 'border-[#C8FF00]/50 bg-[#C8FF00]/[0.08] text-[#F4F2EC]'
                                : 'border-white/[0.08] bg-[#07080B] text-[#8E93A4] hover:text-white'
                            }`}
                          >
                            <p className="text-[11.5px] font-medium">{p.label}</p>
                            <p className="font-mono text-[10px] text-[#C8FF00]">λ = {p.lambda.toFixed(2)}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.06em] text-[#8E93A4]">
                          Principal Amount (USDC)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          value={amountInput}
                          onChange={(e) => setAmountInput(e.target.value)}
                          className="h-10 w-full rounded-lg border border-white/[0.1] bg-[#07080B] px-3.5 font-mono text-[13.5px] text-[#F4F2EC] focus:border-[#C8FF00]/50 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.06em] text-[#8E93A4]">
                          SLA Delivery Window
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {SLA_PRESETS.map((p) => (
                            <button
                              key={p.label}
                              type="button"
                              onClick={() => setDeadlineHours(p.hours)}
                              className={`h-10 rounded-lg border font-mono text-[11px] transition-colors ${
                                deadlineHours === p.hours
                                  ? 'border-[#C8FF00]/50 bg-[#C8FF00]/[0.08] text-[#F4F2EC]'
                                  : 'border-white/[0.08] bg-[#07080B] text-[#8E93A4] hover:text-white'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Sticky Right Settlement Summary & Plain-English Guarantee Receipt */}
              <div className="lg:col-span-5">
                <div className="sticky top-20 rounded-xl border border-white/[0.09] bg-[#0B0D12] p-5">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
                    <div>
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#8E93A4]">
                        Guarantee Terms
                      </p>
                      <p className="mt-0.5 text-[14px] font-semibold text-[#F4F2EC]">
                        Atomic DvP + Automatic SLA Rebate
                      </p>
                    </div>
                    <span className="rounded bg-[#10B981]/15 px-2 py-0.5 font-mono text-[10px] text-[#10B981]">
                      λ = {selectedLambda.toFixed(2)}
                    </span>
                  </div>

                  <dl className="mt-3 divide-y divide-white/[0.06] font-mono text-[12px]">
                    <div className="flex justify-between py-2.5">
                      <dt className="text-[#8E93A4]">Principal Locked</dt>
                      <dd className="font-semibold text-[#F4F2EC]">{fmtAmount(parsedAmount)} USDC</dd>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <dt className="text-[#8E93A4]">On-Time Payee Payout (99.5%)</dt>
                      <dd className="font-semibold text-[#10B981]">
                        {fmtAmount(parsedAmount * 0.995)} USDC
                      </dd>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <dt className="text-[#8E93A4]">Protocol Fee (0.5%)</dt>
                      <dd className="text-[#C8CCD8]">{fmtAmount(parsedAmount * 0.005)} USDC</dd>
                    </div>
                  </dl>

                  {/* Late-Delivery Rebate Schedule */}
                  <div className="mt-4 rounded-lg border border-white/[0.07] bg-[#07080B] p-3.5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#7F8596]">
                      Automatic Late-Delivery Rebate Schedule
                    </p>
                    <div className="mt-2.5 space-y-2 font-mono text-[11px]">
                      {tecdSchedule.map((row) => (
                        <div key={row.label} className="flex items-center justify-between">
                          <span className="text-[#8E93A4]">{row.label}</span>
                          <span className="text-[#F4F2EC]">
                            Payee {fmtAmount(row.payeePayoutUsdc)} • Rebate{' '}
                            <span className="text-[#C8FF00]">{fmtAmount(row.buyerRebateUsdc)}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Plain-English Security & Guarantee Receipt directly above Sign/Lock CTA */}
                  <div className="mt-4 rounded-lg border border-[#C8FF00]/25 bg-[#C8FF00]/[0.05] px-3.5 py-2.5">
                    <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[#C8FF00]">
                      <ShieldCheck className="size-3.5" />
                      Security &amp; Guarantee Receipt
                    </p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-[#E6E4DD]">
                      Zero platform custody • Hardware-pinned verification • Automatic late-delivery rebate.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#C8FF00] font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-[#07080C] transition-colors hover:bg-[#d8ff4d] disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Signing Transaction…
                      </>
                    ) : isConnected ? (
                      <>
                        Lock {fmtAmount(parsedAmount)} USDC &amp; Create Link
                        <ArrowRight className="size-4" />
                      </>
                    ) : (
                      <>
                        <Wallet className="size-4" />
                        Connect Wallet in 1 Click
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* VIEW 3: TESTNET FAUCET & VERIFIED CONTRACTS */}
          {view === 'faucet' && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-white/[0.08] bg-[#0B0D12] p-6">
                <div className="flex items-center gap-2.5">
                  <Droplets className="size-5 text-[#C8FF00]" />
                  <h2 className="text-[16px] font-semibold text-[#F4F2EC]">
                    On-Chain Arc Testnet USDC Faucet
                  </h2>
                </div>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-[#9FA4B4]">
                  Claim testnet native USDC directly from DiptosEscrow.sol (faucetMint) to test protected
                  settlement links on Arc Testnet (5042002).
                </p>

                <div className="mt-4 rounded-lg border border-[#C8FF00]/20 bg-[#C8FF00]/[0.04] px-3.5 py-2.5 text-[11.5px] text-[#E6E4DD]">
                  Zero platform custody • Hardware-pinned verification • Automatic late-delivery rebate.
                </div>

                <button
                  type="button"
                  onClick={handleClaimFaucet}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-[#C8FF00] px-5 font-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#07080C] hover:bg-[#d8ff4d]"
                >
                  <Droplets className="size-4" />
                  {isConnected ? 'Claim Testnet USDC' : 'Connect Wallet to Claim'}
                </button>

                {faucetTxHash && (
                  <div className="mt-4 flex items-center justify-between rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-3.5 py-2.5 font-mono text-[11.5px] text-[#10B981]">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="size-4" /> Faucet claimed
                    </span>
                    <a
                      href={explorerUrl('tx', faucetTxHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline"
                    >
                      ArcScan <ArrowUpRight className="size-3" />
                    </a>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#0B0D12] p-6">
                <h2 className="text-[16px] font-semibold text-[#F4F2EC]">
                  Verified Arc Testnet Contracts
                </h2>
                <dl className="mt-4 space-y-3 font-mono text-[12px]">
                  <div className="rounded-lg border border-white/[0.07] bg-[#07080B] p-3">
                    <dt className="text-[10.5px] uppercase text-[#7F8596]">DiptosEscrow.sol</dt>
                    <dd className="mt-1 flex items-center justify-between gap-2 text-[#F4F2EC]">
                      <span className="truncate">{ESCROW_CONTRACT_ADDRESS}</span>
                      <a
                        href={explorerUrl('address', ESCROW_CONTRACT_ADDRESS)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-[#C8FF00]"
                      >
                        <ArrowUpRight className="size-3.5" />
                      </a>
                    </dd>
                  </div>
                  <div className="rounded-lg border border-white/[0.07] bg-[#07080B] p-3">
                    <dt className="text-[10.5px] uppercase text-[#7F8596]">DiptosRegistry.sol</dt>
                    <dd className="mt-1 flex items-center justify-between gap-2 text-[#F4F2EC]">
                      <span className="truncate">{REGISTRY_CONTRACT_ADDRESS}</span>
                      <a
                        href={explorerUrl('address', REGISTRY_CONTRACT_ADDRESS)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-[#C8FF00]"
                      >
                        <ArrowUpRight className="size-3.5" />
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </main>
      </div>

      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  )
}

export function EscrowEngine() {
  return (
    <WalletProvider>
      <EscrowEngineInner />
    </WalletProvider>
  )
}
