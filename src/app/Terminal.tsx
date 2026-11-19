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
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  Volume2,
  Wallet,
} from 'lucide-react'
import { parseUnits } from 'viem'
import { Wordmark } from '@/components/Logo'
import { Button, CopyButton, Field, inputCls, PulseDot } from '@/components/ui'
import { ARC_NATIVE_DECIMALS } from '@/config/protocol'
import {
  type EscrowRecord,
  fetchEscrowById,
  fetchVoiceBriefAudio,
  patchEscrow,
  verifyWithGrok,
} from '@/lib/api'
import { computeTECD, explorerUrl, fmtAmount, shortHex } from '@/lib/chain'
import { useQuickNodeStream } from '@/lib/hooks'
import { navigate } from '@/lib/route'
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
    delayHours: overdue ? abs / 3600 : 0,
    label: `${overdue ? '+' : ''}${pad(hrs)}:${pad(mins)}:${pad(secs)}`,
  }
}

function CheckoutRoomInner({ escrowId }: { escrowId: string }) {
  const { address, balanceUsdc, connecting, connect, disconnect, execute, txStage, error: walletError, clearError } =
    useWallet()
  const { events, connected: streamConnected } = useQuickNodeStream()

  const [escrow, setEscrow] = useState<EscrowRecord | null>(null)
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
  const [deliverableUrl, setDeliverableUrl] = useState('')
  const [deliverableNotes, setDeliverableNotes] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  // On-chain action feedback
  const [txSuccess, setTxSuccess] = useState<{ label: string; hash: string } | null>(null)

  const loadEscrow = useCallback(async () => {
    try {
      const rec = await fetchEscrowById(escrowId)
      setEscrow(rec)
      setLoadError(null)
    } catch (e) {
      setLoadError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [escrowId])

  useEffect(() => {
    loadEscrow()
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
    if (!escrow) return { overdue: false, delayHours: 0, label: '00:00:00' }
    return formatCountdown(new Date(escrow.deadline).getTime(), nowMs)
  }, [escrow, nowMs])

  const tecdPreview = useMemo(() => {
    if (!escrow) return null
    return computeTECD({
      amountUsdc: escrow.amountUsdc,
      delayHours: countdown.delayHours,
      slaWindowHours: escrow.deadlineHours,
      lambda: escrow.tecdLambda,
      gamma: 1.5,
    })
  }, [escrow, countdown.delayHours])

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/pay/${escrowId}` : `https://diptos.xyz/pay/${escrowId}`

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
      const blob = await fetchVoiceBriefAudio(escrowId)
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

  const handleFundOnArc = async () => {
    if (!escrow) return
    clearError()
    setTxSuccess(null)
    const valueWei = parseUnits(String(escrow.amountUsdc), ARC_NATIVE_DECIMALS)
    const rc = await execute({
      kind: 'Fund Escrow',
      contract: 'DiptosEscrow',
      functionName: 'createEscrowLink',
      args: [
        escrow.escrowIdBytes32,
        escrow.payee as `0x${string}`,
        BigInt(escrow.deadlineUnix),
        BigInt(escrow.tecdLambdaBps),
        escrow.mode === 'agent',
      ],
      value: valueWei,
    })
    if (rc && rc.status === 'success') {
      const updated = await patchEscrow(escrow.id, {
        payer: rc.from,
        txHash: rc.hash,
        status: 'funded',
      })
      setEscrow(updated)
      setTxSuccess({ label: 'Escrow funded on Arc Testnet', hash: rc.hash })
    }
  }

  const handleSettleOnArc = async () => {
    const sig = escrow?.grokAudit?.eip712Signature ?? escrow?.grokAudit?.signature
    if (!escrow?.grokAudit || !sig) return
    clearError()
    setTxSuccess(null)
    const rc = await execute({
      kind: 'Settle Escrow',
      contract: 'DiptosEscrow',
      functionName: 'releaseWithOracle',
      args: [
        escrow.escrowIdBytes32,
        BigInt(escrow.grokAudit.milestoneIndex ?? 0),
        escrow.grokAudit.deliverableHash,
        BigInt(escrow.grokAudit.nonce ?? 0),
        sig as `0x${string}`,
      ],
    })
    if (rc && rc.status === 'success') {
      const updated = await patchEscrow(escrow.id, {
        settleTxHash: rc.hash,
        status: 'settled',
      })
      setEscrow(updated)
      setTxSuccess({ label: 'Escrow settled atomically on Arc', hash: rc.hash })
    }
  }

  const handleVerifyGrok = async (e: FormEvent) => {
    e.preventDefault()
    if (!escrow) return
    setVerifyError(null)
    if (!deliverableUrl.trim() && !deliverableNotes.trim()) {
      setVerifyError('Paste a GitHub PR URL, live demo link, or deliverable summary to audit.')
      return
    }
    setVerifying(true)
    try {
      await verifyWithGrok({
        escrowId: escrow.id,
        deliverableUrl: deliverableUrl.trim() || undefined,
        deliverableNotes: deliverableNotes.trim() || undefined,
      })
      await loadEscrow()
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

  return (
    <div className="min-h-screen">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 h-16 border-b border-white/[0.08] bg-[#090A0D]/90 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-surface px-2.5 font-mono text-[11px] text-secondary transition-colors hover:border-white/[0.18] hover:text-primary"
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">diptos.xyz</span>
            </button>
            <Wordmark />
            <span className="hidden items-center gap-2 rounded-md border border-white/[0.08] bg-surface px-2.5 py-1 font-mono text-[11px] text-primary md:inline-flex">
              <PulseDot color="bg-emerald" />
              <span>Arc Testnet • 5042002</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {address ? (
              <div className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.1] bg-surface pl-3 pr-1.5 font-mono text-[12px]">
                {balanceUsdc !== null && <span className="hidden text-emerald sm:inline">{balanceUsdc} USDC</span>}
                <span className="rounded bg-elevated px-2 py-0.5 text-primary">{shortHex(address)}</span>
                <button
                  type="button"
                  onClick={disconnect}
                  aria-label="Disconnect wallet"
                  className="grid size-7 place-items-center rounded text-secondary hover:text-primary"
                >
                  <LogOut className="size-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="primary" loading={connecting === 'metamask'} onClick={() => connect('metamask')}>
                  <Wallet className="size-3.5" />
                  Connect Wallet
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6">
        {loading ? (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="h-[520px] animate-pulse rounded-[10px] border border-white/[0.08] bg-surface lg:col-span-7" />
            <div className="h-[520px] animate-pulse rounded-[10px] border border-white/[0.08] bg-surface lg:col-span-5" />
          </div>
        ) : loadError || !escrow ? (
          <div className="mx-auto max-w-xl rounded-[10px] border border-white/[0.08] bg-surface p-8 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-crimson">Escrow Not Found</p>
            <h1 className="mt-2 text-2xl font-semibold text-primary">No escrow found for ID “{escrowId}”</h1>
            <p className="mt-2 text-[13px] text-secondary">
              {loadError || 'This escrow link may have expired or does not exist on this server.'}
            </p>
            <Button variant="primary" onClick={() => navigate('/')} className="mt-6 font-bold">
              Return to diptos.xyz
            </Button>
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-12">
            {/* LEFT COLUMN (7 cols): Deal & On-Chain Settlement */}
            <section className="space-y-5 lg:col-span-7">
              <div className="rounded-[10px] border border-white/[0.08] bg-surface p-6">
                {/* Top badges */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-elevated px-2.5 py-1 font-mono text-[10px] font-medium text-primary">
                      {escrow.mode === 'agent' ? (
                        <>
                          <Bot className="size-3 text-emerald" /> AI AGENT API
                        </>
                      ) : (
                        <>
                          <User className="size-3 text-gold" /> HUMAN ESCROW
                        </>
                      )}
                    </span>
                    <span
                      className={`rounded-md border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase ${
                        escrow.status === 'settled' || escrow.status === 'verified'
                          ? 'border-emerald/35 bg-emerald/10 text-emerald'
                          : escrow.status === 'funded'
                            ? 'border-emerald/30 bg-emerald/10 text-emerald'
                            : 'border-gold/30 bg-gold/10 text-gold'
                      }`}
                    >
                      {escrow.status === 'created'
                        ? 'AWAITING DEPOSIT'
                        : escrow.status === 'funded'
                          ? 'FUNDED ON ARC'
                          : escrow.status === 'verified'
                            ? 'GROK VERIFIED'
                            : 'SETTLED ON ARC'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[11px] text-secondary">
                    <span>{shortHex(escrow.escrowIdBytes32, 10, 6)}</span>
                    <CopyButton value={shareUrl} label="Copy shareable checkout link" />
                  </div>
                </div>

                {/* Title & Scope Checklist */}
                <h1 className="mt-5 text-[24px] font-bold text-primary sm:text-[28px]">{escrow.title}</h1>
                <div className="mt-4 rounded-lg border border-white/[0.08] bg-elevated p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
                    Acceptance Criteria / Scope Checklist
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-primary/90">{escrow.scope}</p>
                </div>

                {/* Financial + TECD Countdown Grid */}
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/[0.08] bg-elevated p-4">
                    <p className="font-mono text-[10px] uppercase text-secondary">Locked Principal</p>
                    <p className="mt-1.5 font-mono text-[20px] font-semibold text-primary">
                      {fmtAmount(escrow.amountUsdc)} <span className="text-[11px] text-secondary">USDC</span>
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-secondary">0.5% flat protocol fee</p>
                  </div>

                  <div className="rounded-lg border border-white/[0.08] bg-elevated p-4">
                    <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-secondary">
                      <Clock className="size-3 text-gold" /> Live TECD Timer
                    </p>
                    <p
                      className={`mt-1.5 font-mono text-[20px] font-semibold ${
                        countdown.overdue ? 'text-crimson' : 'text-emerald'
                      }`}
                    >
                      {countdown.label}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-secondary">
                      λ = {escrow.tecdLambda.toFixed(2)} • SLA {escrow.deadlineHours}h
                    </p>
                  </div>

                  <div className="rounded-lg border border-white/[0.08] bg-elevated p-4">
                    <p className="font-mono text-[10px] uppercase text-secondary">Projected Payout</p>
                    <p className="mt-1.5 font-mono text-[20px] font-semibold text-emerald">
                      {tecdPreview ? fmtAmount(tecdPreview.sellerPayout) : fmtAmount(escrow.amountUsdc * 0.995)}{' '}
                      <span className="text-[11px] text-secondary">USDC</span>
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-secondary">
                      Rebate: {tecdPreview ? fmtAmount(tecdPreview.buyerRebate) : '0.00'} USDC
                    </p>
                  </div>
                </div>

                {/* ElevenLabs Voice Brief Player */}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-elevated px-4 py-3">
                  <div>
                    <p className="text-[13px] font-medium text-primary">Executive Deal Brief (ElevenLabs)</p>
                    <p className="font-mono text-[11px] text-secondary">
                      Synthesizes escrow scope, TECD terms &amp; live Gemini macro risk
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" loading={audioLoading} onClick={handlePlayVoiceBrief}>
                    {!audioLoading && (audioPlaying ? <Pause className="size-3.5 text-gold" /> : <Volume2 className="size-3.5 text-gold" />)}
                    {audioPlaying ? 'Pause Deal Brief' : 'Listen to Deal Brief'}
                  </Button>
                </div>
                {audioError && (
                  <p className="mt-2 rounded-lg border border-crimson/35 bg-crimson/10 px-3 py-2 text-[12px] text-crimson">
                    {audioError}
                  </p>
                )}

                {/* Web3 Action Buttons */}
                <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/[0.08] pt-5">
                  <Button
                    variant="primary"
                    loading={txStage?.kind === 'Fund Escrow'}
                    disabled={escrow.status === 'funded' || escrow.status === 'settled'}
                    onClick={address ? handleFundOnArc : () => connect('metamask')}
                    className="h-11 flex-1 font-bold"
                  >
                    <Wallet className="size-4" />
                    {!address
                      ? 'Connect Wallet to Fund on Arc'
                      : escrow.status === 'funded' || escrow.status === 'settled'
                        ? 'Funded on Arc Testnet'
                        : `Fund ${fmtAmount(escrow.amountUsdc)} USDC on Arc`}
                  </Button>

                  <Button
                    variant="secondary"
                    loading={txStage?.kind === 'Settle Escrow'}
                    disabled={!escrow.grokAudit?.approved || !escrow.grokAudit?.signature || escrow.status === 'settled'}
                    onClick={address ? handleSettleOnArc : () => connect('metamask')}
                    className="h-11 flex-1"
                  >
                    <CheckCircle2 className="size-4 text-emerald" />
                    {escrow.status === 'settled' ? 'Settled On-Chain' : 'Settle On-Chain'}
                  </Button>
                </div>

                {txStage && (
                  <p className="mt-3 font-mono text-[11px] text-gold">
                    {txStage.kind}:{' '}
                    {txStage.stage === 'switch'
                      ? 'Switching wallet to Arc Testnet (5042002)…'
                      : txStage.stage === 'sign'
                        ? 'Awaiting wallet signature…'
                        : 'Confirming atomic finality on Arc…'}
                  </p>
                )}

                {walletError && (
                  <p className="mt-3 rounded-lg border border-crimson/35 bg-crimson/10 px-3 py-2 text-[12px] text-crimson">
                    {walletError}
                  </p>
                )}

                {txSuccess && (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-emerald/35 bg-emerald/10 px-3.5 py-2.5 text-[12px] text-emerald">
                    <span>{txSuccess.label}</span>
                    <a
                      href={explorerUrl('tx', txSuccess.hash)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono underline"
                    >
                      {shortHex(txSuccess.hash, 8, 6)} <ExternalLink className="size-3" />
                    </a>
                  </div>
                )}

                {/* Existing tx hashes */}
                {(escrow.txHash || escrow.settleTxHash) && (
                  <div className="mt-4 space-y-1.5 border-t border-white/[0.08] pt-4 font-mono text-[11px]">
                    {escrow.txHash && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-secondary">Deposit Tx</span>
                        <a
                          href={explorerUrl('tx', escrow.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-gold hover:underline"
                        >
                          {shortHex(escrow.txHash, 10, 8)} <ArrowUpRight className="size-3" />
                        </a>
                      </div>
                    )}
                    {escrow.settleTxHash && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-secondary">Settlement Tx</span>
                        <a
                          href={explorerUrl('tx', escrow.settleTxHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-emerald hover:underline"
                        >
                          {shortHex(escrow.settleTxHash, 10, 8)} <ArrowUpRight className="size-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* RIGHT COLUMN (5 cols): Grok AI Deliverable Verifier & QuickNode Audit Log */}
            <aside className="space-y-5 lg:col-span-5">
              {/* Grok AI Deliverable Verifier */}
              <div className="rounded-[10px] border border-white/[0.08] bg-surface p-6">
                <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-gold" />
                    <h2 className="text-[16px] font-semibold text-primary">Grok AI Deliverable Verifier</h2>
                  </div>
                  <span className="font-mono text-[10px] text-secondary">POST /api/verify/grok</span>
                </div>

                <form onSubmit={handleVerifyGrok} className="mt-4 space-y-3.5">
                  <Field label="GitHub PR or Live Demo URL">
                    <input
                      type="url"
                      value={deliverableUrl}
                      onChange={(e) => setDeliverableUrl(e.target.value)}
                      placeholder="https://github.com/org/repo/pull/42"
                      className={`${inputCls} font-mono text-[12px]`}
                    />
                  </Field>

                  <Field label="Deliverable Notes / Proof">
                    <textarea
                      rows={3}
                      value={deliverableNotes}
                      onChange={(e) => setDeliverableNotes(e.target.value)}
                      placeholder="Summarize completed acceptance criteria, test results, or deployment hash..."
                      className="w-full resize-none rounded-lg border border-white/[0.08] bg-elevated px-3 py-2 text-[13px] text-primary outline-none transition-colors placeholder:text-secondary/45 focus:border-gold/60"
                    />
                  </Field>

                  {verifyError && (
                    <p className="rounded-lg border border-crimson/35 bg-crimson/10 px-3 py-2 text-[12px] text-crimson">
                      {verifyError}
                    </p>
                  )}

                  <Button type="submit" variant="primary" loading={verifying} className="w-full font-bold">
                    <Sparkles className="size-3.5" />
                    Verify Deliverable with Grok
                  </Button>
                </form>

                {/* Structured Grok Audit Verdict */}
                {escrow.grokAudit && (
                  <div className="mt-5 rounded-lg border border-white/[0.08] bg-elevated p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold ${
                          escrow.grokAudit.approved ? 'text-emerald' : 'text-crimson'
                        }`}
                      >
                        {escrow.grokAudit.approved ? (
                          <>
                            <ShieldCheck className="size-4" /> APPROVED BY GROK
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="size-4" /> REJECTED BY GROK
                          </>
                        )}
                      </span>
                      <span className="font-mono text-[11px] text-primary">
                        Confidence {Math.round(escrow.grokAudit.confidence * 100)}%
                      </span>
                    </div>

                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-canvas">
                      <div
                        className={escrow.grokAudit.approved ? 'h-full bg-emerald' : 'h-full bg-crimson'}
                        style={{ width: `${Math.round(escrow.grokAudit.confidence * 100)}%` }}
                      />
                    </div>

                    <p className="mt-3 text-[12px] leading-relaxed text-primary/90">{escrow.grokAudit.summary}</p>

                    <dl className="mt-3 space-y-1.5 border-t border-white/[0.08] pt-3 font-mono text-[10.5px]">
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-secondary">Deliverable Hash</dt>
                        <dd className="flex items-center gap-1.5 text-primary">
                          <span>{shortHex(escrow.grokAudit.deliverableHash, 10, 6)}</span>
                          <CopyButton value={escrow.grokAudit.deliverableHash} label="Copy deliverable hash" />
                        </dd>
                      </div>
                      {escrow.grokAudit.signature && (
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-secondary">ECDSA Signature</dt>
                          <dd className="flex items-center gap-1.5 text-emerald">
                            <span>{shortHex(escrow.grokAudit.signature, 10, 6)}</span>
                            <CopyButton value={escrow.grokAudit.signature} label="Copy ECDSA release signature" />
                          </dd>
                        </div>
                      )}
                      {escrow.grokAudit.oracleSigner && (
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-secondary">Oracle Signer</dt>
                          <dd className="text-primary">{shortHex(escrow.grokAudit.oracleSigner)}</dd>
                        </div>
                      )}
                    </dl>
                    <details className="mt-3 border-t border-white/[0.08] pt-2.5">
                      <summary className="cursor-pointer font-mono text-[10.5px] text-secondary hover:text-primary">
                        Inspect EIP-712 Cryptographic Proof JSON
                      </summary>
                      <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-white/[0.08] bg-canvas p-2.5 font-mono text-[10px] text-secondary">
                        {JSON.stringify(
                          {
                            evidenceHash: escrow.grokAudit.evidenceHash ?? escrow.grokAudit.deliverableHash,
                            grokModel: escrow.grokAudit.grokModel ?? 'grok-3-mini',
                            milestoneIndex: escrow.grokAudit.milestoneIndex ?? 0,
                            nonce: escrow.grokAudit.nonce ?? 0,
                            auditReasoning: escrow.grokAudit.auditReasoning ?? escrow.grokAudit.summary,
                            eip712Signature: escrow.grokAudit.eip712Signature ?? escrow.grokAudit.signature,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </div>
                )}
              </div>

              {/* QuickNode Stream Audit Log */}
              <div className="rounded-[10px] border border-white/[0.08] bg-surface p-6">
                <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3.5">
                  <div className="flex items-center gap-2">
                    <Radio className="size-4 text-gold" />
                    <h2 className="text-[14px] font-semibold text-primary">QuickNode Stream Audit Log</h2>
                  </div>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-secondary">
                    <span className={`size-1.5 rounded-full ${streamConnected ? 'bg-emerald' : 'bg-gold'}`} />
                    {streamConnected ? 'LIVE' : 'SYNCING'}
                  </span>
                </div>

                <div className="mt-3 divide-y divide-white/[0.06]">
                  {relevantEvents.length === 0 ? (
                    <p className="flex items-center gap-2 py-3 font-mono text-[11px] text-secondary">
                      <Activity className="size-3.5 text-emerald" />
                      Awaiting Arc Testnet (5042002) confirmations…
                    </p>
                  ) : (
                    relevantEvents.slice(0, 6).map((evt) => (
                      <div key={evt.id} className="py-2.5 font-mono text-[11px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-gold">{evt.eventName}</span>
                          <span className="text-[10px] text-secondary">
                            {new Date(evt.receivedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="mt-1 text-primary/90">{evt.summary}</p>
                        {evt.txHash && (
                          <a
                            href={explorerUrl('tx', evt.txHash)}
                            target="_blank"
                            rel="noreferrer"
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

export function Terminal({ escrowId }: { escrowId: string }) {
  return (
    <WalletProvider>
      <CheckoutRoomInner escrowId={escrowId} />
    </WalletProvider>
  )
}
