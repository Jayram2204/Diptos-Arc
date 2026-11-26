import { type FormEvent, Fragment, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  Droplets,
  FileText,
  Info,
  Layers,
  LoaderCircle,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  User,
  Wallet,
  X,
} from 'lucide-react'
import { encodePacked, isAddress, keccak256, parseEther } from 'viem'
import { DiptosVerifiedBadge } from '@/components/DiptosVerifiedBadge'
import { ESCROW_CONTRACT_ADDRESS, REGISTRY_CONTRACT_ADDRESS } from '@/config/protocol'
import { trackFunnelEvent } from '@/lib/analytics'
import { explorerUrl, fmtAmount, shortHex } from '@/lib/chain'
import { useDynamicCookies } from '@/lib/cookies'
import { useArcPulse, useEscrows } from '@/lib/hooks'
import { getAgentUrl, getApexUrl, getPayUrl, getSdkUrl, navigate } from '@/lib/route'
import { diptos, type EscrowMode, type EscrowRecord } from '@/lib/sdk'
import { useWallet, WalletProvider } from '@/app/wallet'
import { WalletModal } from './WalletModal'

type WorkspaceView = 'ledger' | 'originate' | 'faucet'
type LedgerFilter = 'all' | 'funded' | 'settled' | 'refunded'
type SortKey = 'amount' | 'deadline' | 'status'

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
  { id: 5042002, name: 'Arc Testnet (5042002)', detail: '18-dec Native USDC', status: 'live' as const },
  { id: 8453, name: 'Base (8453)', detail: '6-dec ERC-20 USDC + x402', status: 'coming_next' as const },
]

const GLOSSARY_TIPS = {
  TECD: 'Time-Entropic Collateral Decay automatically rebates the buyer on a smooth math curve if delivery passes the deadline.',
  lambda: 'Lambda (λ) controls how steeply the late-delivery buyer rebate increases after the SLA deadline.',
  AtomicDvP: 'Atomic Delivery-vs-Payment releases 99.5% to the payee and 0.5% fee in one indivisible transaction the second proof passes.',
} as const

function InfoTip({ term, text }: { term: string; text: string }) {
  return (
    <span className="group relative inline-flex items-center">
      <button
        type="button"
        aria-label={`Explain ${term}: ${text}`}
        className="ml-1 inline-flex size-4 items-center justify-center rounded-full text-[#E5E7EB]/80 hover:text-[#C8FF00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
      >
        <Info className="size-3" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 hidden w-60 -translate-x-1/2 rounded-lg border border-white/15 bg-[#0D1017] p-2.5 text-left font-sans text-[11.5px] font-normal normal-case tracking-normal leading-relaxed text-[#E5E7EB] shadow-xl group-hover:block group-focus-within:block"
      >
        <strong className="font-mono text-[10.5px] text-[#C8FF00]">{term}: </strong>
        {text}
      </span>
    </span>
  )
}

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
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#10B981]/35 bg-[#10B981]/15 px-2.5 py-0.5 font-mono text-[10.5px] font-medium text-[#10B981]">
        <span className="size-1.5 rounded-full bg-[#10B981]" />
        Settled
      </span>
    )
  }
  if (s === 'refunded' || s === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.05] px-2.5 py-0.5 font-mono text-[10.5px] font-medium text-[#E5E7EB]">
        <span className="size-1.5 rounded-full bg-[#E5E7EB]" />
        {status}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8FF00]/40 bg-[#C8FF00]/10 px-2.5 py-0.5 font-mono text-[10.5px] font-medium text-[#C8FF00]">
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
              done ? (isRefunded && idx === 3 ? 'bg-[#E5E7EB]' : 'bg-[#10B981]') : 'bg-white/15'
            }`}
          />
        )
      })}
      <span className="ml-1.5 font-mono text-[10.5px] text-[#E5E7EB]/85">
        {labels[Math.min(step - 1, 3)]}
      </span>
    </div>
  )
}

function downloadEscrowReceipt(esc: EscrowRecord) {
  const payload = {
    protocol: 'Diptos Condition-Verified USDC Settlement',
    chainId: 5042002,
    contract: ESCROW_CONTRACT_ADDRESS,
    escrowId: esc.id,
    title: esc.title,
    payer: esc.payer ?? null,
    payee: esc.payee,
    amountUsdc: esc.amountUsdc,
    tecdLambda: esc.tecdLambda,
    deadline: esc.deadline,
    status: esc.status,
    mode: esc.mode,
    exportedAt: new Date().toISOString(),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `diptos-receipt-${esc.id.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function EscrowEngineInner() {
  const {
    address,
    isConnected,
    balanceUsdc,
    disconnect,
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
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [filter, setFilter] = useState<LedgerFilter>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('deadline')
  const [sortAsc, setSortAsc] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
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
      { label: 'On-Time (0h)', delaySec: 0 },
      { label: '+25% Overdue', delaySec: Math.round(totalSec * 0.25) },
      { label: '+50% Overdue', delaySec: Math.round(totalSec * 0.5) },
      { label: '+100% Overdue', delaySec: totalSec },
      { label: '+200% Overdue', delaySec: totalSec * 2 },
    ].map((pt) => {
      const calc = diptos.calculateTECD({
        principalUsdc: parsedAmount,
        lambda: selectedLambda,
        delaySeconds: pt.delaySec,
        totalDurationSeconds: totalSec,
        gamma: 1.5,
      })
      const fee = Math.round(calc.protocolFeeUsdc * 100) / 100
      const payee =
        pt.delaySec === 0
          ? Math.max(0, Math.round((parsedAmount - fee) * 100) / 100)
          : Math.round(calc.payeePayoutUsdc * 100) / 100
      const rebate =
        pt.delaySec === 0
          ? 0
          : Math.max(0, Math.round((parsedAmount - payee - fee) * 100) / 100)
      return {
        label: pt.label,
        payeePayoutUsdc: payee,
        buyerRebateUsdc: rebate,
        protocolFeeUsdc: fee,
      }
    })
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
    const list = escrows.filter((e: EscrowRecord) => {
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

    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'amount') {
        cmp = Number(a.amountUsdc) - Number(b.amountUsdc)
      } else if (sortBy === 'deadline') {
        cmp = new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      } else {
        cmp = a.status.localeCompare(b.status)
      }
      return sortAsc ? cmp : -cmp
    })
  }, [escrows, filter, search, sortBy, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortAsc((v) => !v)
    } else {
      setSortBy(key)
      setSortAsc(false)
    }
  }

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
      setFormError('Base settlement contracts are queued next. Select Arc Testnet (5042002) for live on-chain locking.')
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
        trackFunnelEvent('link_created', { mode, amountUsdc: amount })
        trackFunnelEvent('escrow_funded', { chainId: 5042002, amountUsdc: amount })
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
    <div className="flex min-h-screen bg-[#000000] text-white antialiased">
      {/* Persistent Institutional Left Sidebar */}
      <aside className="hidden w-[236px] shrink-0 flex-col justify-between border-r border-white/10 bg-[#06070A] lg:flex">
        <div>
          <div className="flex h-14 items-center justify-between border-b border-white/10 px-5">
            <a
              href={getApexUrl()}
              className="rwa-display inline-flex items-baseline rounded text-[17px] tracking-[-0.04em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
            >
              DIPTOS<span className="ml-0.5 inline-block size-1.5 rounded-full bg-[#C8FF00]" />
            </a>
            <span className="rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[#E5E7EB]">
              Engine
            </span>
          </div>

          <nav className="space-y-1 p-3" aria-label="Workspace navigation">
            <button
              type="button"
              onClick={() => setView('ledger')}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime ${
                view === 'ledger'
                  ? 'bg-white/[0.1] text-white'
                  : 'text-[#E5E7EB]/80 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <Layers className="size-4" />
                Escrow Ledger
              </span>
              <span className="font-mono text-[11px] text-[#E5E7EB]">{metrics.totalCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setView('originate')}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime ${
                view === 'originate'
                  ? 'bg-white/[0.1] text-white'
                  : 'text-[#E5E7EB]/80 hover:bg-white/[0.04] hover:text-white'
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
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime ${
                view === 'faucet'
                  ? 'bg-white/[0.1] text-white'
                  : 'text-[#E5E7EB]/80 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <Droplets className="size-4" />
                Testnet Faucet
              </span>
            </button>
          </nav>
        </div>

        <div className="space-y-2 border-t border-white/10 p-4 text-[12px] text-[#E5E7EB]">
          <a
            href={getAgentUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-md px-2 py-1.5 text-[#C8FF00] transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
          >
            <span className="inline-flex items-center gap-2">
              <Bot className="size-3.5" />
              AI Agents (Dipto)
            </span>
            <ArrowUpRight className="size-3" />
          </a>
          <a
            href={getSdkUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
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
            className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
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
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-white/10 bg-[#000000]/95 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <a
              href={getApexUrl()}
              className="rwa-display inline-flex items-baseline text-[16px] tracking-[-0.04em] text-white lg:hidden"
            >
              DIPTOS<span className="ml-0.5 inline-block size-1.5 rounded-full bg-[#C8FF00]" />
            </a>
            <div className="hidden items-center gap-2 text-[13px] lg:flex">
              <span className="text-[#9CA3AF]">Condition-Verified USDC Settlement</span>
              <span className="text-white/25">/</span>
              <span className="font-medium text-white">
                {view === 'ledger'
                  ? 'Escrow Ledger'
                  : view === 'originate'
                    ? 'Create Protection Link'
                    : 'Testnet Faucet'}
              </span>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-400/35 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-300">
              <span className="size-1.5 rounded-full bg-amber-300" />
              Testnet · No Real Funds
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {view !== 'originate' && (
              <button
                type="button"
                onClick={() => setView('originate')}
                className="hidden h-8 items-center gap-1.5 rounded-full bg-[#C8FF00] px-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[#07080C] transition-colors hover:bg-[#d8ff4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:inline-flex"
              >
                <Plus className="size-3.5" />
                Start in 1 Click
              </button>
            )}

            <button
              type="button"
              onClick={() => setWalletOpen(true)}
              aria-label="Open multi-chain wallet modal"
              className={`inline-flex h-8 items-center gap-2 rounded-full border px-3.5 font-mono text-[11.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime ${
                isConnected && address
                  ? 'border-white/20 bg-white/[0.05] text-white hover:border-white/40'
                  : 'border-[#C8FF00]/60 bg-[#C8FF00]/15 text-[#C8FF00] hover:bg-[#C8FF00]/25'
              }`}
            >
              <span className={`size-1.5 rounded-full ${isConnected ? 'bg-[#10B981]' : 'bg-[#C8FF00]'}`} />
              {isConnected && address ? (
                <>
                  <span className="hidden text-[#E5E7EB] sm:inline">Arc + Base</span>
                  <span className="hidden text-white/25 sm:inline">|</span>
                  <span>{balanceUsdc ?? '—'} USDC</span>
                  <span className="text-white/25">|</span>
                  <span>{shortHex(address, 5, 4)}</span>
                </>
              ) : (
                <>
                  <Wallet className="size-3.5" />
                  <span>Connect Wallet</span>
                </>
              )}
            </button>
            {isConnected && address && (
              <button
                type="button"
                onClick={() => void disconnect()}
                aria-label="Disconnect wallet and revoke session"
                title="Disconnect wallet"
                className="inline-flex h-8 items-center gap-1 rounded-full border border-white/15 bg-white/[0.03] px-2.5 font-mono text-[10.5px] text-[#E5E7EB] transition-colors hover:border-red-500/50 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
              >
                <LogOut className="size-3" />
                <span className="hidden sm:inline">Disconnect</span>
              </button>
            )}
          </div>
        </header>

        {/* Mobile View Tabs */}
        <div className="flex border-b border-white/10 bg-[#06070A] px-4 lg:hidden">
          {(['ledger', 'originate', 'faucet'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setView(tab)}
              className={`border-b-2 px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] ${
                view === tab ? 'border-[#C8FF00] text-white' : 'border-transparent text-[#E5E7EB]/75'
              }`}
            >
              {tab === 'ledger' ? 'Ledger' : tab === 'originate' ? 'Create Link' : 'Faucet'}
            </button>
          ))}
        </div>

        {/* Workspace Content */}
        <main className="mx-auto w-full max-w-[1220px] flex-1 px-4 pb-24 pt-6 sm:px-8">
          {/* Dismissible First-Time Onboarding Banner */}
          {showOnboarding && view === 'ledger' && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#C8FF00]/30 bg-[#C8FF00]/[0.06] px-4 py-3.5">
              <div className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-[#C8FF00]" />
                <div>
                  <p className="text-[13.5px] font-semibold text-white">
                    Start here: Create your first protection link in 30 seconds
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#E5E7EB]">
                    Lock native USDC against objective proof on Arc Testnet—no platform custody, automatic late-delivery rebate.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setView('originate')}
                  className="rounded-full bg-[#C8FF00] px-3.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[#07080C] hover:bg-[#d8ff4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Create Link →
                </button>
                <button
                  type="button"
                  onClick={() => setShowOnboarding(false)}
                  aria-label="Dismiss onboarding guide"
                  className="grid size-7 place-items-center rounded-full text-[#E5E7EB] hover:bg-white/10"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          )}

          {txStage && (
            <div className="mb-5 flex items-center gap-3 rounded-lg border border-[#C8FF00]/35 bg-[#C8FF00]/[0.08] px-4 py-3 font-mono text-[12px] text-white">
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
            <div
              role="alert"
              className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-[12.5px] text-red-100"
            >
              <span>{formError || walletError}</span>
              <button
                type="button"
                onClick={() => {
                  setFormError(null)
                  clearError()
                }}
                className="font-mono text-[11px] text-white underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* VIEW 1: INSTITUTIONAL ESCROW LEDGER */}
          {view === 'ledger' && (
            <div className="space-y-6">
              {/* Live Operational KPI Strip */}
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 md:grid-cols-4">
                <div className="bg-[#0B0D12] p-4 sm:p-5">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#E5E7EB]/80">
                    ACTIVE NETWORK
                  </p>
                  <p className="mt-1.5 font-mono text-[19px] font-semibold text-white">ARC 5042002</p>
                  <p className="mt-0.5 font-mono text-[10.5px] text-[#10B981]">
                    {pulse.blockNumber !== undefined ? `Block #${pulse.blockNumber.toString()}` : 'RPC Syncing…'}
                  </p>
                </div>
                <div className="bg-[#0B0D12] p-4 sm:p-5">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#E5E7EB]/80">
                    VERIFIED SETTLEMENTS
                  </p>
                  <p className="mt-1.5 font-mono text-[22px] font-semibold tabular-nums text-white">
                    {metrics.settledCount}{' '}
                    <span className="text-[12px] font-normal text-[#E5E7EB]/75">
                      / {metrics.totalCount} total
                    </span>
                  </p>
                </div>
                <div className="bg-[#0B0D12] p-4 sm:p-5">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#E5E7EB]/80">
                    LIVE FINALITY
                  </p>
                  <p className="mt-1.5 font-mono text-[22px] font-semibold tabular-nums text-[#C8FF00]">
                    {avgFinalityLabel}
                  </p>
                </div>
                <div className="bg-[#0B0D12] p-4 sm:p-5">
                  <p className="flex items-center font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#E5E7EB]/80">
                    PROTOCOL FEE
                    <InfoTip term="Atomic DvP" text={GLOSSARY_TIPS.AtomicDvP} />
                  </p>
                  <p className="mt-1.5 font-mono text-[22px] font-semibold tabular-nums text-white">
                    0.50% <span className="text-[12px] text-[#10B981]">FLAT</span>
                  </p>
                </div>
              </div>

              {/* Filter & Search Toolbar */}
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="inline-flex rounded-lg border border-white/12 bg-[#0B0D12] p-1">
                  {(['all', 'funded', 'settled', 'refunded'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={`rounded-md px-3 py-1 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime ${
                        filter === f ? 'bg-white/[0.14] text-white' : 'text-[#E5E7EB]/75 hover:text-white'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-[260px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#E5E7EB]/60" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filter by title, ID, or 0x…"
                      aria-label="Filter escrows"
                      className="h-9 w-full rounded-lg border border-white/15 bg-[#0B0D12] pl-9 pr-3 text-[12.5px] text-white placeholder:text-[#E5E7EB]/50 focus:border-[#C8FF00] focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => refresh()}
                    aria-label="Refresh on-chain escrows"
                    className="grid size-9 place-items-center rounded-lg border border-white/15 bg-[#0B0D12] text-[#E5E7EB] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
                  >
                    <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Empty State */}
              {!loading && filteredEscrows.length === 0 ? (
                <div className="rounded-xl border border-white/12 bg-[#0B0D12] p-10 text-center">
                  <ShieldCheck className="mx-auto size-8 text-[#C8FF00]" />
                  <h3 className="mt-3 text-[16px] font-semibold text-white">No protection links match your filter</h3>
                  <p className="mx-auto mt-1.5 max-w-md text-[13px] text-[#E5E7EB]/80">
                    Originate your first non-custodial USDC protection link on Arc Testnet in 30 seconds.
                  </p>
                  <button
                    type="button"
                    onClick={() => setView('originate')}
                    className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-[#C8FF00] px-5 font-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#07080C] hover:bg-[#d8ff4d]"
                  >
                    <Plus className="size-4" /> Create First Protection Link
                  </button>
                </div>
              ) : (
                <>
                  {/* MOBILE CARD LAYOUT (< md): Zero horizontal overflow at 375px */}
                  <div className="space-y-3 md:hidden">
                    {filteredEscrows.map((esc) => {
                      const sla = formatSlaCountdown(esc.deadline, nowMs)
                      const isExpanded = expandedId === esc.id
                      const isSettled = esc.status.toLowerCase() === 'settled'
                      return (
                        <article
                          key={esc.id}
                          className="rounded-xl border border-white/12 bg-[#0B0D12] p-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="truncate text-[14px] font-semibold text-white">
                                {esc.title || `Escrow ${shortHex(esc.id, 6, 4)}`}
                              </h3>
                              <p className="mt-0.5 font-mono text-[11px] text-[#E5E7EB]/75">
                                {fmtAmount(esc.amountUsdc)} USDC · λ {esc.tecdLambda.toFixed(2)}
                              </p>
                            </div>
                            {isSettled ? <DiptosVerifiedBadge size="xs" /> : <StatusBadge status={esc.status} />}
                          </div>

                          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 font-mono text-[11px]">
                            <span className={isSettled ? 'text-[#E5E7EB]/70' : sla.overdue ? 'text-amber-300' : 'text-[#E5E7EB]'}>
                              {isSettled ? 'Completed' : sla.text}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedId(isExpanded ? null : esc.id)}
                                className="rounded border border-white/15 px-2 py-1 text-[10.5px] text-[#E5E7EB]"
                              >
                                {isExpanded ? 'Hide' : 'Details'}
                              </button>
                              <button
                                type="button"
                                onClick={() => navigate(`/pay/${esc.id}`)}
                                className="rounded bg-[#C8FF00] px-2.5 py-1 text-[10.5px] font-semibold text-[#07080C]"
                              >
                                Open →
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-3 space-y-2 border-t border-white/10 pt-3 font-mono text-[11px] text-[#E5E7EB]">
                              <p className="break-all">ID: {esc.id}</p>
                              <p className="break-all">Payer: {esc.payer ?? 'Open'}</p>
                              <p className="break-all">Payee: {esc.payee}</p>
                              <button
                                type="button"
                                onClick={() => downloadEscrowReceipt(esc)}
                                className="inline-flex items-center gap-1.5 rounded border border-white/15 px-2.5 py-1 text-[10.5px] text-white"
                              >
                                <Download className="size-3" /> Export JSON Receipt
                              </button>
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>

                  {/* DESKTOP SORTABLE & EXPANDABLE TABLE (md+) */}
                  <div className="hidden overflow-x-auto rounded-xl border border-white/12 bg-[#0B0D12] md:block">
                    <table className="w-full text-left">
                      <thead className="border-b border-white/10 bg-white/[0.03] font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#E5E7EB]">
                        <tr>
                          <th className="px-5 py-3 font-medium">Deliverable / ID</th>
                          <th className="px-4 py-3 font-medium">
                            <button
                              type="button"
                              onClick={() => toggleSort('amount')}
                              className="inline-flex items-center gap-1 hover:text-[#C8FF00]"
                            >
                              Principal <ArrowDownUp className="size-3" />
                            </button>
                          </th>
                          <th className="px-4 py-3 font-medium">Lifecycle</th>
                          <th className="px-4 py-3 font-medium">
                            <button
                              type="button"
                              onClick={() => toggleSort('deadline')}
                              className="inline-flex items-center gap-1 hover:text-[#C8FF00]"
                            >
                              SLA Window <ArrowDownUp className="size-3" />
                            </button>
                          </th>
                          <th className="px-4 py-3 font-medium">
                            <button
                              type="button"
                              onClick={() => toggleSort('status')}
                              className="inline-flex items-center gap-1 hover:text-[#C8FF00]"
                            >
                              Status <ArrowDownUp className="size-3" />
                            </button>
                          </th>
                          <th className="px-5 py-3 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.08] text-[13px]">
                        {loading && escrows.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-5 py-12 text-center font-mono text-[12px] text-[#E5E7EB]">
                              Syncing live escrows from Arc Testnet (5042002)…
                            </td>
                          </tr>
                        ) : (
                          filteredEscrows.map((esc) => {
                            const sla = formatSlaCountdown(esc.deadline, nowMs)
                            const isSettled = esc.status.toLowerCase() === 'settled'
                            const isExpanded = expandedId === esc.id
                            return (
                              <Fragment key={esc.id}>
                                <tr className="transition-colors hover:bg-white/[0.025]">
                                  <td className="min-w-[240px] max-w-[340px] px-5 py-3.5">
                                    <div className="flex items-start gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setExpandedId(isExpanded ? null : esc.id)}
                                        aria-label={`Toggle details for ${esc.title || esc.id}`}
                                        className="mt-0.5 grid size-5 shrink-0 place-items-center rounded border border-white/15 text-[#E5E7EB] hover:border-lime hover:text-lime"
                                      >
                                        {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                                      </button>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span
                                            title={esc.title || `Escrow ${shortHex(esc.id, 6, 4)}`}
                                            className="line-clamp-2 font-medium leading-snug text-white"
                                          >
                                            {esc.title || `Escrow ${shortHex(esc.id, 6, 4)}`}
                                          </span>
                                          {isSettled && <DiptosVerifiedBadge size="xs" />}
                                          {esc.mode === 'agent' && (
                                            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9.5px] text-[#E5E7EB]">
                                              <Bot className="size-2.5" /> Agent
                                            </span>
                                          )}
                                        </div>
                                        <p className="mt-0.5 truncate font-mono text-[11px] text-[#E5E7EB]/75">
                                          {esc.payer ? shortHex(esc.payer, 6, 4) : 'Open Payer'} → {shortHex(esc.payee, 6, 4)} •{' '}
                                          {shortHex(esc.id, 6, 4)}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5 font-mono font-semibold tabular-nums text-white">
                                    {fmtAmount(esc.amountUsdc)}{' '}
                                    <span className="text-[11px] font-normal text-[#E5E7EB]/75">USDC</span>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <LifecycleStepper status={esc.status} />
                                  </td>
                                  <td className="px-4 py-3.5 font-mono text-[11.5px] tabular-nums">
                                    {isSettled ? (
                                      <span className="text-[#E5E7EB]/75">Completed</span>
                                    ) : (
                                      <span className={sla.overdue ? 'text-amber-300' : 'text-[#E5E7EB]'}>
                                        <Clock className="mr-1 inline size-3" />
                                        {sla.text}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <StatusBadge status={esc.status} />
                                  </td>
                                  <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                    <div className="inline-flex shrink-0 items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleCopyPayLink(esc.id)}
                                        title="Copy guarantee link"
                                        className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded border border-white/15 bg-white/[0.03] px-2 font-mono text-[10.5px] text-[#E5E7EB] hover:text-white"
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
                                        className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded border border-white/20 bg-white/[0.06] px-2.5 font-mono text-[10.5px] font-medium text-white hover:border-[#C8FF00] hover:text-[#C8FF00]"
                                      >
                                        Open <ArrowRight className="size-3" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {isExpanded && (
                                  <tr className="bg-[#07090D]">
                                    <td colSpan={6} className="px-6 py-4">
                                      <div className="grid gap-4 font-mono text-[11.5px] md:grid-cols-3">
                                        <div>
                                          <p className="text-[10px] uppercase text-[#E5E7EB]/70">Full Counterparties</p>
                                          <p className="mt-1 break-all text-white">Payer: {esc.payer ?? 'Open'}</p>
                                          <p className="mt-0.5 break-all text-[#E5E7EB]">Payee: {esc.payee}</p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] uppercase text-[#E5E7EB]/70">Proof &amp; TECD Parameters</p>
                                          <p className="mt-1 text-white">
                                            SLA λ = {esc.tecdLambda.toFixed(2)} · Proof Gate: Hardware-Pinned
                                          </p>
                                          <p className="mt-0.5 text-[#E5E7EB]">
                                            Deadline: {new Date(esc.deadline).toLocaleString()}
                                          </p>
                                        </div>
                                        <div className="flex items-center justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={() => downloadEscrowReceipt(esc)}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white hover:border-lime hover:text-lime"
                                          >
                                            <Download className="size-3.5" /> Export Receipt (JSON)
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* VIEW 2: STRUCTURED ESCROW ORIGINATION WORKBENCH */}
          {view === 'originate' && (
            <form onSubmit={handleCreateEscrow} className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-7">
                <section className="rounded-xl border border-white/12 bg-[#0B0D12] p-5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                    <h2 className="text-[14px] font-semibold text-white">
                      1. Settlement Rail &amp; Counterparties
                    </h2>
                    <span className="font-mono text-[10.5px] text-[#E5E7EB]/80">Zero Platform Custody</span>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.06em] text-[#E5E7EB]">
                        Settlement Network (Arc + Base)
                      </label>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {APP_CHAINS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            disabled={c.status !== 'live'}
                            onClick={() => setSelectedChainId(c.id)}
                            className={`rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                              selectedChainId === c.id
                                ? 'border-[#C8FF00]/60 bg-[#C8FF00]/[0.08] text-white'
                                : 'cursor-not-allowed border-white/10 bg-white/[0.02] text-[#E5E7EB]/60'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[12.5px] font-semibold">{c.name}</span>
                              <span
                                className={`font-mono text-[10px] uppercase ${
                                  c.status === 'live' ? 'text-[#10B981]' : 'text-[#E5E7EB]/70'
                                }`}
                              >
                                {c.status === 'live' ? 'Live' : 'Builder Ready'}
                              </span>
                            </div>
                            <p className="mt-0.5 font-mono text-[10.5px] text-[#E5E7EB]/75">{c.detail}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.06em] text-[#E5E7EB]">
                        Execution Mode
                      </label>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => handleModeChange('human')}
                          className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left ${
                            mode === 'human'
                              ? 'border-[#C8FF00]/60 bg-[#C8FF00]/[0.08] text-white'
                              : 'border-white/12 bg-white/[0.02] text-[#E5E7EB]/80'
                          }`}
                        >
                          <User className="size-4" />
                          <div>
                            <p className="text-[12.5px] font-medium">Human Checkout</p>
                            <p className="text-[11px] text-[#E5E7EB]/75">Shareable /pay/:id receipt</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleModeChange('agent')}
                          className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left ${
                            mode === 'agent'
                              ? 'border-[#C8FF00]/60 bg-[#C8FF00]/[0.08] text-white'
                              : 'border-white/12 bg-white/[0.02] text-[#E5E7EB]/80'
                          }`}
                        >
                          <Bot className="size-4" />
                          <div>
                            <p className="text-[12.5px] font-medium">Autonomous AI Agent</p>
                            <p className="text-[11px] text-[#E5E7EB]/75">x402 + @diptos/agent-guard</p>
                          </div>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.06em] text-[#E5E7EB]">
                        Payee Recipient Address (0x)
                      </label>
                      <input
                        type="text"
                        value={payeeInput}
                        onChange={(e) => setPayeeInput(e.target.value)}
                        placeholder="0x..."
                        className="h-10 w-full rounded-lg border border-white/15 bg-[#07080B] px-3.5 font-mono text-[12.5px] text-white placeholder:text-[#E5E7EB]/45 focus:border-[#C8FF00] focus:outline-none"
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-white/12 bg-[#0B0D12] p-5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                    <h2 className="text-[14px] font-semibold text-white">
                      2. Objective Scope &amp; SLA Protection
                    </h2>
                    <span className="font-mono text-[10.5px] text-[#E5E7EB]/80">Stored On-Chain</span>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.06em] text-[#E5E7EB]">
                        Deliverable Title
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Smart Contract Audit & Foundry Test Suite"
                        className="h-10 w-full rounded-lg border border-white/15 bg-[#07080B] px-3.5 text-[13px] text-white placeholder:text-[#E5E7EB]/45 focus:border-[#C8FF00] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.06em] text-[#E5E7EB]">
                        Objective Acceptance Criteria (Deterministic Proof)
                      </label>
                      <textarea
                        rows={3}
                        value={scope}
                        onChange={(e) => setScope(e.target.value)}
                        placeholder="Define verifiable proof requirements (merged PR, passing CI tests, or valid AI output)"
                        className="w-full rounded-lg border border-white/15 bg-[#07080B] p-3.5 text-[13px] text-white placeholder:text-[#E5E7EB]/45 focus:border-[#C8FF00] focus:outline-none"
                      />
                      <p className="mt-1.5 font-mono text-[11px] text-amber-300/90">
                        Stored publicly on-chain—do not paste credentials, secrets, or confidential client terms.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1.5 flex items-center font-mono text-[11px] uppercase tracking-[0.06em] text-[#E5E7EB]">
                        SLA Protection Preset (TECD <span className="ml-1 normal-case">λ</span>)
                        <InfoTip term="TECD λ" text={`${GLOSSARY_TIPS.TECD} ${GLOSSARY_TIPS.lambda}`} />
                      </label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {PROTECTION_PRESETS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedLambda(p.lambda)}
                            className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                              selectedLambda === p.lambda
                                ? 'border-[#C8FF00]/60 bg-[#C8FF00]/[0.08] text-white'
                                : 'border-white/12 bg-[#07080B] text-[#E5E7EB]/80 hover:text-white'
                            }`}
                          >
                            <p className="text-[12px] font-medium">{p.label}</p>
                            <p className="font-mono text-[10.5px] text-[#C8FF00]">λ = {p.lambda.toFixed(2)}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.06em] text-[#E5E7EB]">
                          Principal Amount (USDC)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          value={amountInput}
                          onChange={(e) => setAmountInput(e.target.value)}
                          className="h-10 w-full rounded-lg border border-white/15 bg-[#07080B] px-3.5 font-mono text-[13.5px] text-white focus:border-[#C8FF00] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.06em] text-[#E5E7EB]">
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
                                  ? 'border-[#C8FF00]/60 bg-[#C8FF00]/[0.08] text-white'
                                  : 'border-white/12 bg-[#07080B] text-[#E5E7EB]/80 hover:text-white'
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
                <div className="sticky top-20 rounded-xl border border-white/15 bg-[#0B0D12] p-5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                    <div>
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#E5E7EB]/80">
                        Guarantee Terms
                      </p>
                      <p className="mt-0.5 flex items-center text-[14px] font-semibold text-white">
                        Atomic DvP + TECD Rebate
                        <InfoTip term="Atomic DvP" text={GLOSSARY_TIPS.AtomicDvP} />
                      </p>
                    </div>
                    <span className="rounded bg-[#10B981]/20 px-2 py-0.5 font-mono text-[10.5px] text-[#10B981]">
                      λ = {selectedLambda.toFixed(2)}
                    </span>
                  </div>

                  <dl className="mt-3 divide-y divide-white/10 font-mono text-[12px]">
                    <div className="flex justify-between py-2.5">
                      <dt className="text-[#E5E7EB]/80">Principal Locked</dt>
                      <dd className="font-semibold text-white">{fmtAmount(parsedAmount)} USDC</dd>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <dt className="text-[#E5E7EB]/80">On-Time Payee Payout (99.5%)</dt>
                      <dd className="font-semibold text-[#10B981]">{fmtAmount(parsedAmount * 0.995)} USDC</dd>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <dt className="text-[#E5E7EB]/80">Protocol Fee (0.5%)</dt>
                      <dd className="text-white">{fmtAmount(parsedAmount * 0.005)} USDC</dd>
                    </div>
                  </dl>

                  <div className="mt-4 rounded-lg border border-white/10 bg-[#07080B] p-3.5">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#9CA3AF]">
                        Late-Delivery &amp; Worst-Case Schedule
                      </p>
                      <span className="font-mono text-[9.5px] text-[#9CA3AF]">Sum = {fmtAmount(parsedAmount)}</span>
                    </div>
                    <table className="mt-2.5 w-full font-mono text-[10.5px]">
                      <thead>
                        <tr className="border-b border-white/10 text-left text-[9.5px] uppercase text-[#9CA3AF]">
                          <th className="pb-1.5 font-medium">Timing</th>
                          <th className="pb-1.5 text-right font-medium">Payee</th>
                          <th className="pb-1.5 text-right font-medium">Rebate</th>
                          <th className="pb-1.5 text-right font-medium">Fee</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {tecdSchedule.map((row) => (
                          <tr key={row.label}>
                            <td className="py-1.5 text-[#E5E7EB]/85">{row.label}</td>
                            <td className="py-1.5 text-right tabular-nums text-emerald">
                              {fmtAmount(row.payeePayoutUsdc)}
                            </td>
                            <td className="py-1.5 text-right tabular-nums text-amber-300">
                              {fmtAmount(row.buyerRebateUsdc)}
                            </td>
                            <td className="py-1.5 text-right tabular-nums text-[#E5E7EB]">
                              {fmtAmount(row.protocolFeeUsdc)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Plain-English Security & Guarantee Receipt directly above Sign/Lock CTA */}
                  <div className="mt-4 rounded-lg border border-[#C8FF00]/30 bg-[#C8FF00]/[0.06] px-3.5 py-2.5">
                    <p className="flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#C8FF00]">
                      <ShieldCheck className="size-3.5" />
                      Security &amp; Guarantee Receipt
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-white">
                      Zero platform custody • Hardware-pinned verification • Automatic late-delivery rebate.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#C8FF00] font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-[#07080C] transition-colors hover:bg-[#d8ff4d] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
              <div className="rounded-xl border border-white/12 bg-[#0B0D12] p-6">
                <div className="flex items-center gap-2.5">
                  <Droplets className="size-5 text-[#C8FF00]" />
                  <h2 className="text-[16px] font-semibold text-white">On-Chain Arc Testnet USDC Faucet</h2>
                </div>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-[#E5E7EB]/85">
                  Claim testnet native USDC directly from DiptosEscrow.sol (faucetMint) to test protected
                  settlement links on Arc Testnet (5042002).
                </p>

                <div className="mt-4 rounded-lg border border-[#C8FF00]/25 bg-[#C8FF00]/[0.05] px-3.5 py-2.5 text-[12px] text-white">
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
                  <div className="mt-4 flex items-center justify-between rounded-lg border border-[#10B981]/35 bg-[#10B981]/15 px-3.5 py-2.5 font-mono text-[11.5px] text-[#10B981]">
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

              <div className="rounded-xl border border-white/12 bg-[#0B0D12] p-6">
                <h2 className="text-[16px] font-semibold text-white">Verified Arc Testnet Contracts</h2>
                <dl className="mt-4 space-y-3 font-mono text-[12px]">
                  <div className="rounded-lg border border-white/10 bg-[#07080B] p-3">
                    <dt className="text-[10.5px] uppercase text-[#E5E7EB]/75">DiptosEscrow.sol</dt>
                    <dd className="mt-1 flex items-center justify-between gap-2 text-white">
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
                  <div className="rounded-lg border border-white/10 bg-[#07080B] p-3">
                    <dt className="text-[10.5px] uppercase text-[#E5E7EB]/75">DiptosRegistry.sol</dt>
                    <dd className="mt-1 flex items-center justify-between gap-2 text-white">
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
