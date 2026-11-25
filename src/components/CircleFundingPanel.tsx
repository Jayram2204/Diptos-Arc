import { createOnrampKit, type OnrampSession, type OnrampWidget } from '@circle-fin/onramp-kit'
import { CreditCard, Fuel, Globe, LoaderCircle, RefreshCw, ShieldCheck, Wallet } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { type Address } from 'viem'
import { ESCROW_CONTRACT_ADDRESS } from '@/config/protocol'
import { fmtAmount, shortHex } from '@/lib/chain'
import { type GasSponsorshipState, resolveArcGasSponsorship } from '@/lib/circle/sponsorship'
import {
  fetchUnifiedUsdcBalance,
  planUnifiedArcFunding,
  UNIFIED_SOURCE_CHAINS,
  type UnifiedBalanceSnapshot,
} from '@/lib/circle/unifiedBalance'

type FundingTab = 'card' | 'wallet' | 'unified'

interface OnrampApiResponse {
  configured: boolean
  reason?: string
  message?: string
  error?: string
  widgetBaseUrl?: string
  session?: OnrampSession
}

export function CircleFundingPanel({
  escrowId,
  amountUsdc,
  connectedAddress,
  balanceUsdc,
  onConnectWallet,
}: {
  escrowId: string
  amountUsdc: number
  connectedAddress: Address | null
  balanceUsdc: string | null
  onConnectWallet: () => void
}) {
  const [tab, setTab] = useState<FundingTab>('wallet')
  const [gasState, setGasState] = useState<GasSponsorshipState | null>(null)

  // Tab 1: Circle Onramp Kit state
  const iframeContainerRef = useRef<HTMLDivElement | null>(null)
  const [onrampLoading, setOnrampLoading] = useState(false)
  const [onrampStatus, setOnrampStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'unconfigured'; reason: string; message: string }
    | { kind: 'ready' }
    | { kind: 'settled'; detail: string }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' })

  // Tab 3: Unified Balance state
  const [sourceChainId, setSourceChainId] = useState<number>(UNIFIED_SOURCE_CHAINS[0].chainId)
  const [unifiedLoading, setUnifiedLoading] = useState(false)
  const [unifiedSnapshot, setUnifiedSnapshot] = useState<UnifiedBalanceSnapshot | null>(null)

  useEffect(() => {
    let alive = true
    resolveArcGasSponsorship()
      .then((s) => {
        if (alive) setGasState(s)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // Mount Circle Onramp Kit when Tab 1 is selected
  useEffect(() => {
    if (tab !== 'card') return
    let active = true
    let widgetHandle: OnrampWidget | null = null

    async function bootOnramp() {
      setOnrampLoading(true)
      try {
        const destinationAddress = connectedAddress ?? ESCROW_CONTRACT_ADDRESS
        const res = await fetch('/api/onramp/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: connectedAddress ?? `diptos-buyer-${escrowId.slice(0, 12)}`,
            destinationAddress,
            amountUsdc: Math.max(0.01, amountUsdc),
            escrowId,
          }),
        })
        const data = (await res.json().catch(() => ({}))) as OnrampApiResponse
        if (!active) return

        if (data.configured === false) {
          setOnrampStatus({
            kind: 'unconfigured',
            reason: data.reason || 'NOT_CONFIGURED',
            message:
              data.message ||
              'Server-side Circle Onramp credentials are not configured in this environment. Existing Arc wallet checkout remains active.',
          })
          return
        }

        if (!res.ok || !data.session) {
          setOnrampStatus({
            kind: 'error',
            message: data.error || `Onramp session error (HTTP ${res.status})`,
          })
          return
        }

        if (iframeContainerRef.current) {
          iframeContainerRef.current.innerHTML = ''
          const kit = createOnrampKit({
            widgetBaseUrl:
              data.widgetBaseUrl ||
              (import.meta.env.VITE_CIRCLE_ONRAMP_WIDGET_BASE_URL as string | undefined) ||
              'https://onramp-sandbox.arc.io',
          })
          widgetHandle = kit.mountIframe({
            session: data.session,
            container: iframeContainerRef.current,
            onInitializationSuccess: () => {
              if (active) setOnrampStatus({ kind: 'ready' })
            },
            onDepositSettled: ({ payload }) => {
              if (active) {
                setOnrampStatus({
                  kind: 'settled',
                  detail: `Settled ${payload.amount ?? amountUsdc} ${payload.tokenSymbol ?? 'USDC'} on Arc`,
                })
              }
            },
            onDepositNotCompleted: ({ code }) => {
              if (active) {
                setOnrampStatus({
                  kind: 'error',
                  message: `Checkout did not complete (${code}). You can retry or switch to Wallet.`,
                })
              }
            },
          })
          setOnrampStatus({ kind: 'ready' })
        }
      } catch (err) {
        if (active) {
          setOnrampStatus({ kind: 'error', message: (err as Error).message })
        }
      } finally {
        if (active) setOnrampLoading(false)
      }
    }

    void bootOnramp()
    return () => {
      active = false
      widgetHandle?.close()
    }
  }, [tab, connectedAddress, escrowId, amountUsdc])

  // Load live multi-chain USDC balances when Tab 3 is active and wallet is connected
  const refreshUnifiedBalances = async () => {
    if (!connectedAddress) return
    setUnifiedLoading(true)
    try {
      const snap = await fetchUnifiedUsdcBalance(connectedAddress)
      setUnifiedSnapshot(snap)
    } finally {
      setUnifiedLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'unified' && connectedAddress) {
      void refreshUnifiedBalances()
    }
  }, [tab, connectedAddress])

  const fundingPlan = useMemo(
    () =>
      planUnifiedArcFunding({
        snapshot: unifiedSnapshot,
        sourceChainId,
        amountUsdc,
        destinationAddress: connectedAddress ?? ESCROW_CONTRACT_ADDRESS,
      }),
    [unifiedSnapshot, sourceChainId, amountUsdc, connectedAddress],
  )

  return (
    <div className="mt-5 rounded-2xl border border-paper/12 bg-black/55 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-lime">
          Circle Funding Rails · Arc (5042002)
        </span>
        {gasState && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold ${
              gasState.sponsored
                ? 'border-lime/45 bg-lime/10 text-lime'
                : 'border-emerald/35 bg-emerald/10 text-emerald'
            }`}
          >
            <Fuel className="size-3" />
            {gasState.badgeLabel}
          </span>
        )}
      </div>

      {/* 3-Tab Switcher */}
      <div className="grid grid-cols-1 gap-1.5 rounded-xl border border-paper/10 bg-surface/80 p-1 font-mono text-[10.5px] sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setTab('card')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 font-semibold transition-colors ${
            tab === 'card' ? 'bg-lime text-ink' : 'text-secondary hover:text-paper'
          }`}
        >
          <CreditCard className="size-3.5" />
          Card / Bank
        </button>
        <button
          type="button"
          onClick={() => setTab('wallet')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 font-semibold transition-colors ${
            tab === 'wallet' ? 'bg-lime text-ink' : 'text-secondary hover:text-paper'
          }`}
        >
          <Wallet className="size-3.5" />
          Wallet (1-Click)
        </button>
        <button
          type="button"
          onClick={() => setTab('unified')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 font-semibold transition-colors ${
            tab === 'unified' ? 'bg-lime text-ink' : 'text-secondary hover:text-paper'
          }`}
        >
          <Globe className="size-3.5" />
          Unified Balance
        </button>
      </div>

      {/* TAB 1: CIRCLE ONRAMP KIT */}
      {tab === 'card' && (
        <div className="mt-3.5 space-y-3">
          <div className="rounded-xl border border-lime/25 bg-lime/[0.04] px-3.5 py-2.5">
            <p className="font-mono text-[11px] font-semibold text-paper">
              Pay with your card. Protected on-chain. Sponsored USDC gas covers network fees.
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-secondary">
              Powered by @circle-fin/onramp-kit · Destination: {shortHex(connectedAddress ?? ESCROW_CONTRACT_ADDRESS, 8, 6)}
            </p>
          </div>

          {onrampLoading && (
            <div className="flex items-center gap-2 rounded-xl border border-paper/10 bg-black/50 px-4 py-4 font-mono text-[11.5px] text-secondary">
              <LoaderCircle className="size-4 animate-spin text-lime" />
              <span>Minting Circle Onramp session via POST /api/onramp/sessions…</span>
            </div>
          )}

          {onrampStatus.kind === 'unconfigured' && (
            <div className="rounded-xl border border-paper/15 bg-surface px-4 py-3.5 font-mono text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-lime">CIRCLE ONRAMP KIT · SETUP REQUIRED</span>
                <span className="rounded border border-paper/15 px-2 py-0.5 text-[9.5px] text-secondary">
                  {onrampStatus.reason}
                </span>
              </div>
              <p className="mt-2 leading-relaxed text-paper/85">{onrampStatus.message}</p>
              <button
                type="button"
                onClick={() => setTab('wallet')}
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-lime px-3.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink"
              >
                <Wallet className="size-3.5" />
                Continue with 1-Click Arc Wallet
              </button>
            </div>
          )}

          {onrampStatus.kind === 'error' && (
            <div className="rounded-xl border border-crimson/35 bg-crimson/10 px-3.5 py-2.5 font-mono text-[11px] text-crimson">
              {onrampStatus.message}
            </div>
          )}

          {onrampStatus.kind === 'settled' && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald/40 bg-emerald/10 px-3.5 py-2.5 font-mono text-[11.5px] text-emerald">
              <ShieldCheck className="size-4" />
              <span>{onrampStatus.detail}</span>
            </div>
          )}

          <div
            ref={iframeContainerRef}
            className={onrampStatus.kind === 'ready' ? 'min-h-[520px] w-full overflow-hidden rounded-xl border border-paper/15' : 'hidden'}
          />
        </div>
      )}

      {/* TAB 2: DIRECT 1-CLICK WALLET */}
      {tab === 'wallet' && (
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-paper/10 bg-black/45 px-4 py-3 font-mono text-[11.5px]">
          <div>
            <p className="font-semibold text-paper">Direct Arc Native USDC Settlement (1-Click EIP-6963)</p>
            <p className="mt-0.5 text-[10.5px] text-secondary">
              {connectedAddress
                ? `Connected ${shortHex(connectedAddress, 8, 6)} · Balance: ${balanceUsdc ?? '—'} USDC`
                : 'Connect MetaMask, Rabby, or Coinbase Wallet on Arc Testnet (5042002).'}
            </p>
          </div>
          {!connectedAddress && (
            <button
              type="button"
              onClick={onConnectWallet}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-lime px-3.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink"
            >
              <Wallet className="size-3.5" />
              Connect Wallet
            </button>
          )}
        </div>
      )}

      {/* TAB 3: UNIFIED BALANCE (CIRCLE GATEWAY / CCTP) */}
      {tab === 'unified' && (
        <div className="mt-3.5 space-y-3 font-mono text-[11px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {UNIFIED_SOURCE_CHAINS.map((ch) => (
                <button
                  key={ch.chainId}
                  type="button"
                  onClick={() => setSourceChainId(ch.chainId)}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                    sourceChainId === ch.chainId
                      ? 'border-lime bg-lime/15 text-lime'
                      : 'border-paper/15 text-secondary hover:text-paper'
                  }`}
                >
                  {ch.shortName} → Arc
                </button>
              ))}
            </div>
            {connectedAddress && (
              <button
                type="button"
                onClick={() => void refreshUnifiedBalances()}
                className="inline-flex items-center gap-1 text-[10px] text-secondary hover:text-lime"
              >
                <RefreshCw className={`size-3 ${unifiedLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
          </div>

          {!connectedAddress ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-paper/10 bg-black/45 px-4 py-3">
              <span className="text-secondary">Connect wallet to read live Base / Arbitrum / OP / Arc USDC balances.</span>
              <button
                type="button"
                onClick={onConnectWallet}
                className="shrink-0 rounded-full bg-lime px-3 py-1.5 text-[10px] font-bold uppercase text-ink"
              >
                Connect
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-lime/30 bg-black/50 p-2.5">
                <p className="text-[9.5px] text-lime">Arc Native</p>
                <p className="mt-0.5 text-[13px] font-bold text-paper">
                  {unifiedSnapshot ? fmtAmount(unifiedSnapshot.arcNativeUsdc) : '…'} USDC
                </p>
              </div>
              {(unifiedSnapshot?.chains ?? UNIFIED_SOURCE_CHAINS.map((c) => ({ ...c, formatted: '…' }))).map((c) => (
                <div key={c.chainId} className="rounded-lg border border-paper/10 bg-black/50 p-2.5">
                  <p className="text-[9.5px] text-secondary">{c.shortName}</p>
                  <p className="mt-0.5 text-[13px] font-semibold text-paper">{c.formatted} USDC</p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-paper/10 bg-black/45 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold uppercase text-lime">
                Route: {fundingPlan.route.replace(/-/g, ' ')}
              </span>
              <span className="text-[10px] text-emerald">{fundingPlan.estimatedFinality}</span>
            </div>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[10.5px] text-paper/85">
              {fundingPlan.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
