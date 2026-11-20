import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  LogOut,
  Pause,
  Radio,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  Volume2,
  Wallet,
} from 'lucide-react'
import { type Hex } from 'viem'
import { Wordmark } from '@/components/Logo'
import { Button, CopyButton, Field, inputCls, PulseDot } from '@/components/ui'
import { ESCROW_CONTRACT_ADDRESS } from '@/config/protocol'
import { fetchVoiceBriefAudio } from '@/lib/api'
import { explorerUrl, fmtAmount, shortHex } from '@/lib/chain'
import { useProtocolEvents } from '@/lib/hooks'
import { getApexUrl, getAppUrl, getSdkUrl, navigate } from '@/lib/route'
import { diptos, type EscrowRecord, type GrokMilestoneReceipt } from '@/lib/sdk'
import { useWallet, WalletProvider } from './wallet'

function formatCountdown(deadlineMs: number, nowMs: number) {
  const diffSec = Math.floor((deadlineMs - nowMs) / 1000)
  const overdue = diffSec < 0
  const abs = Math.abs(diffSec)
  const hrs = Math.floor(abs / 3600)
  const mins = Math.floor((abs % 3600) / 60)
  const secs = abs % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    overdue,
    delaySeconds: overdue ? abs : 0,
    label: `${overdue ? '+' : ''}${pad(hrs)}:${pad(mins)}:${pad(secs)}`,
  }
}

function CheckoutRoomInner({ escrowId }: { escrowId: string }) {
  const { address, balanceUsdc, connecting, connect, disconnect, execute, txStage, error: walletError, clearError } =
    useWallet()
  const { events, connected: feedConnected } = useProtocolEvents(undefined, 4000)

  const [escrow, setEscrow] = useState<EscrowRecord | null>(null)
  const [grokReceipt, setGrokReceipt] = useState<GrokMilestoneReceipt | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  // ElevenLabs Audio Brief state
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  // Grok Verifier state
  const [deliverableUrl, setDeliverableUrl] = useState('https://github.com/Jayram2204/Diptos-Arc')
  const [deliverableNotes, setDeliverableNotes] = useState(
    'Smart contracts deployed & verified on Arc Testnet (5042002) with passing Foundry test suite.',
  )
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const [txSuccess, setTxSuccess] = useState<{ label: string; hash: string } | null>(null)

  const loadEscrow = useCallback(async () => {
    try {
      const rec = await diptos.getEscrow(escrowId)
      setEscrow(rec)
      setLoadError(null)
    } catch (e) {
      setEscrow(null)
      setLoadError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [escrowId])

  useEffect(() => {
    void loadEscrow()
    const t = setInterval(() => void loadEscrow(), 5000)
    return () => clearInterval(t)
  }, [loadEscrow])

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause()
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [])

  const countdown = useMemo(() => {
    if (!escrow) return { overdue: false, delaySeconds: 0, label: '00:00:00' }
    return formatCountdown(new Date(escrow.deadline).getTime(), nowMs)
  }, [escrow, nowMs])

  const tecdPreview = useMemo(() => {
    if (!escrow) return null
    return diptos.calculateTECD({
      principalUsdc: escrow.amountUsdc,
      lambda: escrow.tecdLambda,
      delaySeconds: countdown.delaySeconds,
      totalDurationSeconds: Math.max(60, escrow.deadlineHours * 3600),
      gamma: 1.5,
    })
  }, [escrow, countdown.delaySeconds])

  const shareUrl = typeof window !== 'undefined' ? window.location.href : `https://app.diptos.xyz/pay/${escrowId}`

  const handlePlayVoiceBrief = async () => {
    setAudioError(null)
    if (audioPlaying && audioRef.current) {
      audioRef.current.pause()
      setAudioPlaying(false)
      return
    }
    if (audioRef.current && audioUrlRef.current) {
      await audioRef.current.play()
      setAudioPlaying(true)
      return
    }

    setAudioLoading(true)
    try {
      const blob = await fetchVoiceBriefAudio({
        escrowId,
        title: escrow?.title,
        amountUsdc: escrow?.amountUsdc,
        tecdLambda: escrow?.tecdLambda,
        mode: escrow?.mode,
      })
      const url = URL.createObjectURL(blob)
      audioUrlRef.current = url
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => setAudioPlaying(false)
      audio.onerror = () => {
        setAudioPlaying(false)
        setAudioError('Audio playback failed in browser.')
      }
      await audio.play()
      setAudioPlaying(true)
    } catch (e) {
      setAudioError((e as Error).message)
    } finally {
      setAudioLoading(false)
    }
  }

  const handleSettleOnArc = async () => {
    const audit = grokReceipt ?? escrow?.grokAudit
    const sig = (audit?.eip712Signature ?? audit?.signature) as Hex | undefined
    if (!escrow || !audit || !sig || escrow.status === 'settled') return
    clearError()
    setTxSuccess(null)

    const built = diptos.buildReleaseWithOracleTx({
      escrowId: escrow.escrowIdBytes32,
      milestoneIndex: audit.milestoneIndex ?? 0,
      deliverableHash: audit.deliverableHash,
      nonce: audit.nonce ?? escrow.nonce ?? 0,
      grokSignature: sig,
    })

    const rc = await execute({
      kind: 'Settle Escrow',
      contract: 'DiptosEscrow',
      functionName: built.functionName,
      args: built.args,
    })

    if (rc && rc.status === 'success') {
      setEscrow((prev) => (prev ? { ...prev, settleTxHash: rc.hash, status: 'settled' } : prev))
      setTxSuccess({ label: 'Escrow settled atomically on Arc Testnet', hash: rc.hash })
      await loadEscrow()
    }
  }

  const handleReleaseByPayer = async () => {
    if (!escrow || escrow.status === 'settled') return
    clearError()
    setTxSuccess(null)

    const rc = await execute({
      kind: 'Release By Payer',
      contract: 'DiptosEscrow',
      functionName: 'releaseByPayer',
      args: [escrow.escrowIdBytes32],
    })

    if (rc && rc.status === 'success') {
      setEscrow((prev) => (prev ? { ...prev, settleTxHash: rc.hash, status: 'settled' } : prev))
      setTxSuccess({ label: 'Escrow released directly by payer on Arc Testnet', hash: rc.hash })
      await loadEscrow()
    }
  }

  const handleClaimTimeoutRefund = async () => {
    if (!escrow) return
    clearError()
    setTxSuccess(null)

    const rc = await execute({
      kind: 'Claim Timeout Refund',
      contract: 'DiptosEscrow',
      functionName: 'claimTimeoutRefund',
      args: [escrow.escrowIdBytes32],
    })

    if (rc && rc.status === 'success') {
      setEscrow((prev) => (prev ? { ...prev, status: 'refunded' } : prev))
      setTxSuccess({ label: 'Timeout refund claimed on Arc', hash: rc.hash })
      await loadEscrow()
    }
  }

  const handleVerifyGrok = async (e: FormEvent) => {
    e.preventDefault()
    if (!escrow || escrow.status === 'settled') return
    setVerifyError(null)
    const effectiveUrl = deliverableUrl.trim() || 'https://github.com/Jayram2204/Diptos-Arc'
    const effectiveNotes =
      deliverableNotes.trim() ||
      `Completed deliverable for "${escrow.title}" satisfying scope: ${escrow.scope}`
    setVerifying(true)
    try {
      const receipt = await diptos.verifyDeliverableWithGrok({
        escrowId: escrow.escrowIdBytes32,
        title: escrow.title,
        scope: escrow.scope,
        amountUsdc: escrow.amountUsdc,
        deliverableUrl: effectiveUrl,
        notes: effectiveNotes,
      })
      setGrokReceipt(receipt)
    } catch (err) {
      setVerifyError((err as Error).message)
    } finally {
      setVerifying(false)
    }
  }

  const relevantEvents = useMemo(() => {
    if (!escrow) return events
    const matched = events.filter(
      (e) =>
        !e.escrowId ||
        e.escrowId.toLowerCase() === escrow.id.toLowerCase() ||
        e.escrowId.toLowerCase() === escrow.escrowIdBytes32.toLowerCase(),
    )
    return matched.length > 0 ? matched : events
  }, [events, escrow])

  const activeAudit = grokReceipt ?? escrow?.grokAudit
  const grokSig = activeAudit?.eip712Signature ?? activeAudit?.signature
  const isSettled = escrow?.status === 'settled'
  const isRefunded = escrow?.status === 'refunded'
  const canRefund = escrow?.status === 'funded' && countdown.delaySeconds > 24 * 3600
  const isPayerConnected = Boolean(
    address && escrow?.payer && address.toLowerCase() === escrow.payer.toLowerCase(),
  )

  return (
    <div className="min-h-screen bg-black text-paper">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 h-[68px] border-b border-paper/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1320px] items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-3">
            <a
              href={getApexUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-paper/15 bg-surface px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-secondary transition-colors hover:border-lime hover:text-lime"
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">diptos.xyz</span>
            </a>
            <button
              type="button"
              onClick={() => navigate(getAppUrl())}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-paper/15 bg-surface px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-secondary transition-colors hover:border-lime hover:text-lime"
            >
              <span>All Escrows</span>
            </button>
            <Wordmark />
            <span className="hidden items-center gap-2 rounded-full border border-paper/12 bg-surface px-3 py-1 font-mono text-[11px] text-paper md:inline-flex">
              <PulseDot color="bg-lime" />
              <span>Arc Testnet • 5042002</span>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href={getSdkUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-9 items-center gap-1 rounded-full border border-paper/20 bg-transparent px-3.5 font-mono text-[11px] uppercase tracking-[0.12em] text-paper transition-colors hover:border-lime hover:text-lime sm:inline-flex"
            >
              SDK <ArrowUpRight className="size-3" />
            </a>
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

      <main className="mx-auto max-w-[1320px] px-6 py-10">
        {loading ? (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="h-[520px] animate-pulse rounded-2xl border border-paper/10 bg-surface lg:col-span-7" />
            <div className="h-[520px] animate-pulse rounded-2xl border border-paper/10 bg-surface lg:col-span-5" />
          </div>
        ) : loadError || !escrow ? (
          <div className="rwa-depth-card mx-auto max-w-xl rounded-2xl p-8 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-crimson">Escrow Not Found On-Chain</p>
            <h1 className="mt-2 text-2xl font-semibold text-paper">
              Escrow not found on Arc Testnet ({shortHex(escrowId, 10, 8)})
            </h1>
            <p className="mt-2 text-[13.5px] text-secondary">
              {loadError || 'This escrow ID does not exist in DiptosEscrow.sol on Arc Testnet (5042002).'}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="primary" onClick={() => navigate(getAppUrl())}>
                Back to app.diptos.xyz
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid items-stretch gap-6 lg:grid-cols-12">
            <section className="flex flex-col justify-between lg:col-span-7">
              <div className="rwa-depth-card flex h-full flex-col justify-between rounded-2xl p-7">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper/10 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-paper/15 bg-black/50 px-3 py-1 font-mono text-[10px] font-medium text-lime">
                        {escrow.mode === 'agent' ? (
                          <>
                            <Bot className="size-3" /> AI AGENT API
                          </>
                        ) : (
                          <>
                            <User className="size-3" /> HUMAN ESCROW
                          </>
                        )}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase ${
                          isRefunded
                            ? 'border-crimson/35 bg-crimson/10 text-crimson'
                            : isSettled
                              ? 'border-emerald/40 bg-emerald/15 text-emerald'
                              : 'border-lime/35 bg-lime/10 text-lime'
                        }`}
                      >
                        {isRefunded ? 'REFUNDED ON ARC' : isSettled ? 'SETTLED ON ARC' : 'FUNDED ON ARC'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[11px] text-secondary">
                      <span>{shortHex(escrow.escrowIdBytes32, 10, 6)}</span>
                      <CopyButton value={shareUrl} label="Copy shareable checkout link" />
                    </div>
                  </div>

                  <h1 className="mt-5 text-[24px] font-bold text-paper sm:text-[28px]">{escrow.title}</h1>
                  <div className="mt-4 rounded-xl border border-paper/10 bg-black/45 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-lime">
                      On-Chain Acceptance Criteria / Scope Checklist
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-paper/90">
                      {escrow.scope}
                    </p>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-paper/10 bg-black/45 p-4">
                      <p className="font-mono text-[10px] uppercase text-secondary">Locked Principal</p>
                      <p className="mt-1.5 font-mono text-[20px] font-semibold text-paper">
                        {fmtAmount(escrow.amountUsdc)} <span className="text-[11px] text-secondary">USDC</span>
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-secondary">0.5% flat fee • 18-dec native</p>
                    </div>

                    <div className="rounded-xl border border-paper/10 bg-black/45 p-4">
                      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-secondary">
                        <Clock className="size-3 text-lime" /> Live TECD Timer
                      </p>
                      <p
                        className={`mt-1.5 font-mono text-[20px] font-semibold ${
                          isSettled ? 'text-emerald' : countdown.overdue ? 'text-crimson' : 'text-emerald'
                        }`}
                      >
                        {isSettled ? 'FINALIZED' : countdown.label}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-secondary">
                        λ = {escrow.tecdLambda.toFixed(2)} • Nonce #{escrow.nonce ?? 0}
                      </p>
                    </div>

                    <div className="rounded-xl border border-paper/10 bg-black/45 p-4">
                      <p className="font-mono text-[10px] uppercase text-secondary">Projected Payout</p>
                      <p className="mt-1.5 font-mono text-[20px] font-semibold text-emerald">
                        {tecdPreview ? fmtAmount(tecdPreview.payeePayoutUsdc) : fmtAmount(escrow.amountUsdc * 0.995)}{' '}
                        <span className="text-[11px] text-secondary">USDC</span>
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-secondary">
                        Rebate: {tecdPreview ? fmtAmount(tecdPreview.buyerRebateUsdc) : '0.00'} USDC
                      </p>
                    </div>
                  </div>

                  {/* Counterparty Addresses */}
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-paper/10 bg-black/45 px-4 py-3 font-mono text-[11px]">
                    <div>
                      <span className="text-secondary">Payer: </span>
                      <span className="text-paper">{escrow.payer ? shortHex(escrow.payer, 8, 6) : '—'}</span>
                    </div>
                    <div>
                      <span className="text-secondary">Payee: </span>
                      <span className="text-paper">{shortHex(escrow.payee, 8, 6)}</span>
                    </div>
                  </div>

                  {/* ElevenLabs Voice Brief Player */}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-paper/10 bg-black/45 px-4 py-3">
                    <div>
                      <p className="text-[13px] font-medium text-paper">Executive Deal Brief (ElevenLabs)</p>
                      <p className="font-mono text-[11px] text-secondary">
                        Streams audio/mpeg brief with live Gemini λ odds &amp; TECD schedule
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" loading={audioLoading} onClick={handlePlayVoiceBrief}>
                      {!audioLoading &&
                        (audioPlaying ? (
                          <Pause className="size-3.5 text-lime" />
                        ) : (
                          <Volume2 className="size-3.5 text-lime" />
                        ))}
                      {audioPlaying ? 'Pause Deal Brief' : 'Listen to Deal Brief'}
                    </Button>
                  </div>
                  {audioError && (
                    <p className="mt-2 rounded-xl border border-crimson/35 bg-crimson/10 px-3.5 py-2 font-mono text-[11.5px] text-crimson">
                      {audioError}
                    </p>
                  )}
                </div>

                {/* Web3 Action Buttons — strictly bound to live on-chain escrow.status */}
                <div className="mt-6 border-t border-paper/10 pt-5">
                  <div className="flex flex-wrap items-center gap-3">
                    {isSettled ? (
                      <a
                        href={
                          escrow.settleTxHash
                            ? explorerUrl('tx', escrow.settleTxHash)
                            : explorerUrl('address', ESCROW_CONTRACT_ADDRESS)
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-emerald/40 bg-emerald/15 px-5 font-mono text-[11.5px] font-semibold uppercase tracking-[0.12em] text-emerald transition-colors hover:bg-emerald/25"
                      >
                        <CheckCircle2 className="size-4" />
                        Settled On-Chain • View on ArcScan <ArrowUpRight className="size-3.5" />
                      </a>
                    ) : isRefunded ? (
                      <span className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-crimson/40 bg-crimson/15 px-5 font-mono text-[11.5px] font-semibold uppercase tracking-[0.12em] text-crimson">
                        Escrow Refunded On-Chain
                      </span>
                    ) : (
                      <>
                        {activeAudit?.approved && grokSig ? (
                          <Button
                            variant="primary"
                            loading={txStage?.kind === 'Settle Escrow'}
                            onClick={() => void handleSettleOnArc()}
                            className="h-11 flex-1 font-bold"
                          >
                            <CheckCircle2 className="size-4" />
                            Settle On-Chain with Grok Signature
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            loading={verifying}
                            onClick={(e) => void handleVerifyGrok(e as unknown as FormEvent)}
                            className="h-11 flex-1 font-bold"
                          >
                            <Sparkles className="size-4" />
                            1. Verify with Grok AI to Unlock Settlement
                          </Button>
                        )}

                        <Button
                          variant="secondary"
                          loading={txStage?.kind === 'Release By Payer'}
                          onClick={() => void handleReleaseByPayer()}
                          title={
                            isPayerConnected
                              ? 'Direct payer release (releaseByPayer)'
                              : 'Connect the payer wallet to release directly without oracle signature'
                          }
                          className="h-11"
                        >
                          <CheckCircle2 className="size-4 text-emerald" />
                          Payer Direct Release
                        </Button>
                      </>
                    )}

                    {canRefund && !isSettled && !isRefunded && (
                      <Button
                        variant="danger"
                        loading={txStage?.kind === 'Claim Timeout Refund'}
                        onClick={() => void handleClaimTimeoutRefund()}
                        className="h-11"
                      >
                        <RotateCcw className="size-4" />
                        Claim Timeout Refund
                      </Button>
                    )}
                  </div>

                  {txStage && (
                    <p className="mt-3 font-mono text-[11px] text-lime">
                      {txStage.kind}:{' '}
                      {txStage.stage === 'switch'
                        ? 'Switching wallet to Arc Testnet (5042002)…'
                        : txStage.stage === 'simulate'
                          ? 'Simulating transaction on Arc Testnet (pre-flight check)…'
                          : txStage.stage === 'sign'
                            ? 'Awaiting wallet signature…'
                            : 'Confirming atomic finality on Arc…'}
                    </p>
                  )}

                  {walletError && (
                    <p className="mt-3 rounded-xl border border-crimson/35 bg-crimson/10 px-3.5 py-2.5 font-mono text-[11.5px] text-crimson">
                      {walletError}
                    </p>
                  )}

                  {txSuccess && (
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-emerald/35 bg-emerald/10 px-3.5 py-2.5 font-mono text-[12px] text-emerald">
                      <span>{txSuccess.label}</span>
                      <a
                        href={explorerUrl('tx', txSuccess.hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 underline"
                      >
                        {shortHex(txSuccess.hash, 8, 6)} <ExternalLink className="size-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <aside className="flex flex-col justify-between gap-5 lg:col-span-5">
              <div className="rwa-depth-card rounded-2xl p-6">
                <div className="flex items-center justify-between gap-2 border-b border-paper/10 pb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-lime" />
                    <h2 className="text-[16px] font-semibold text-paper">Grok AI Deliverable Verifier</h2>
                  </div>
                  <span className="font-mono text-[10px] text-secondary">POST /api/verify/grok</span>
                </div>

                <form onSubmit={handleVerifyGrok} className="mt-4 space-y-3.5">
                  <Field label="GitHub PR or Live Demo URL">
                    <input
                      type="url"
                      value={deliverableUrl}
                      onChange={(e) => setDeliverableUrl(e.target.value)}
                      disabled={isSettled}
                      placeholder="https://github.com/org/repo/pull/42"
                      className={`${inputCls} font-mono text-[12px]`}
                    />
                  </Field>

                  <Field label="Deliverable Notes / Proof">
                    <textarea
                      rows={2}
                      value={deliverableNotes}
                      onChange={(e) => setDeliverableNotes(e.target.value)}
                      disabled={isSettled}
                      placeholder="Summarize completed acceptance criteria, test results, or deployment hash..."
                      className="w-full resize-none rounded-xl border border-paper/12 bg-elevated px-3.5 py-2 text-[13px] text-paper outline-none transition-colors placeholder:text-secondary/45 focus:border-lime disabled:opacity-50"
                    />
                  </Field>

                  {verifyError && (
                    <p className="rounded-xl border border-crimson/35 bg-crimson/10 px-3 py-2 font-mono text-[11.5px] text-crimson">
                      {verifyError}
                    </p>
                  )}

                  <Button
                    type="submit"
                    variant={isSettled ? 'secondary' : 'primary'}
                    loading={verifying}
                    disabled={isSettled}
                    className="w-full font-bold"
                  >
                    <Sparkles className="size-3.5" />
                    {isSettled ? 'Escrow Already Settled On-Chain' : 'Verify Deliverable with Grok'}
                  </Button>
                </form>

                {activeAudit && (
                  <div className="mt-5 rounded-xl border border-paper/10 bg-black/50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold ${
                          activeAudit.approved ? 'text-emerald' : 'text-crimson'
                        }`}
                      >
                        {activeAudit.approved ? (
                          <>
                            <ShieldCheck className="size-4" /> APPROVED BY GROK
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="size-4" /> REJECTED BY GROK
                          </>
                        )}
                      </span>
                      <span className="font-mono text-[11px] text-paper">
                        Confidence {Math.round(activeAudit.confidence * 100)}%
                      </span>
                    </div>

                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                      <div
                        className={activeAudit.approved ? 'h-full bg-emerald' : 'h-full bg-crimson'}
                        style={{ width: `${Math.round(activeAudit.confidence * 100)}%` }}
                      />
                    </div>

                    <p className="mt-3 text-[12px] leading-relaxed text-paper/90">
                      {activeAudit.auditReasoning || activeAudit.summary}
                    </p>

                    <dl className="mt-3 space-y-1.5 border-t border-paper/10 pt-3 font-mono text-[10.5px]">
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-secondary">Evidence Hash</dt>
                        <dd className="flex items-center gap-1.5 text-paper">
                          <span>{shortHex(activeAudit.evidenceHash ?? activeAudit.deliverableHash, 10, 6)}</span>
                          <CopyButton
                            value={activeAudit.evidenceHash ?? activeAudit.deliverableHash}
                            label="Copy evidence hash"
                          />
                        </dd>
                      </div>
                      {grokSig && (
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-secondary">EIP-712 Signature (Nonce #{activeAudit.nonce ?? 0})</dt>
                          <dd className="flex items-center gap-1.5 text-emerald">
                            <span>{shortHex(grokSig, 10, 6)}</span>
                            <CopyButton value={grokSig} label="Copy EIP-712 release signature" />
                          </dd>
                        </div>
                      )}
                      {activeAudit.oracleSigner && (
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-secondary">Oracle Signer</dt>
                          <dd className="text-paper">{shortHex(activeAudit.oracleSigner)}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}
              </div>

              <div className="rwa-depth-card rounded-2xl p-6">
                <div className="flex items-center justify-between gap-2 border-b border-paper/10 pb-3.5">
                  <div className="flex items-center gap-2">
                    <Radio className="size-4 text-lime" />
                    <h2 className="text-[14px] font-semibold text-paper">QuickNode &amp; Arc Audit Log</h2>
                  </div>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-secondary">
                    <span className={`size-1.5 rounded-full ${feedConnected ? 'bg-emerald' : 'bg-lime'}`} />
                    {feedConnected ? 'LIVE' : 'POLLING'}
                  </span>
                </div>

                <div className="mt-3 divide-y divide-paper/10">
                  {relevantEvents.length === 0 ? (
                    <p className="flex items-center gap-2 py-3 font-mono text-[11px] text-secondary">
                      <Activity className="size-3.5 text-emerald" />
                      Awaiting Arc Testnet (5042002) confirmations…
                    </p>
                  ) : (
                    relevantEvents.slice(0, 5).map((evt) => (
                      <div key={evt.id} className="py-2.5 font-mono text-[11px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-lime">{evt.eventName}</span>
                          <span className="text-[10px] text-secondary">
                            blk #{evt.blockNumber} · idx {evt.logIndex ?? 0}
                          </span>
                        </div>
                        <p className="mt-1 text-paper/90">{evt.summary}</p>
                        {evt.txHash && (
                          <a
                            href={explorerUrl('tx', evt.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald hover:underline"
                          >
                            {shortHex(evt.txHash, 10, 6)} <ArrowUpRight className="size-3" />
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}

export function PayCheckout({ escrowId }: { escrowId: string }) {
  return (
    <WalletProvider>
      <CheckoutRoomInner escrowId={escrowId} />
    </WalletProvider>
  )
}
