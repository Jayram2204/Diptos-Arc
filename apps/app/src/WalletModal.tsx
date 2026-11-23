import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  Copy,
  Fuel,
  Globe,
  KeyRound,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react'
import { formatUnits } from 'viem'
import { explorerUrl, shortHex } from '@/lib/chain'
import { useDynamicCookies } from '@/lib/cookies'
import { useArcPulse } from '@/lib/hooks'
import { useWallet } from '@/app/wallet'

interface WalletOption {
  rdns: string
  name: string
  tagline: string
  installUrl: string
  badge: string
}

const STANDARD_WALLETS: WalletOption[] = [
  {
    rdns: 'io.metamask',
    name: 'MetaMask',
    tagline: 'Browser extension & mobile',
    installUrl: 'https://metamask.io/download/',
    badge: 'MM',
  },
  {
    rdns: 'io.rabby',
    name: 'Rabby Wallet',
    tagline: 'Multi-chain EVM security wallet',
    installUrl: 'https://rabby.io/',
    badge: 'RB',
  },
  {
    rdns: 'com.coinbase.wallet',
    name: 'Coinbase Wallet',
    tagline: 'Extension & smart wallet',
    installUrl: 'https://www.coinbase.com/wallet',
    badge: 'CB',
  },
  {
    rdns: 'app.phantom',
    name: 'Phantom',
    tagline: 'Multi-chain EVM support',
    installUrl: 'https://phantom.app/',
    badge: 'PH',
  },
  {
    rdns: 'walletconnect',
    name: 'WalletConnect',
    tagline: 'QR & mobile wallet bridge (EIP-1193)',
    installUrl: 'https://walletconnect.network/',
    badge: 'WC',
  },
]

const MODAL_CHAINS = [
  {
    id: 5042002,
    name: 'Arc Testnet',
    status: 'live' as const,
    asset: 'Native USDC',
    subtitle: 'Chain ID 5042002 · Sub-second finality',
  },
  {
    id: 8453,
    name: 'Base',
    status: 'coming_next' as const,
    asset: 'USDC',
    subtitle: 'Chain ID 8453 · Multi-chain expansion',
  },
]

export function WalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    address,
    isConnected,
    walletName,
    walletChainId,
    detectedWallets,
    connecting,
    connect,
    switchNetwork,
    disconnect,
    balanceUsdc,
    error,
    clearError,
  } = useWallet()

  const pulse = useArcPulse(6000)
  const { setPreference } = useDynamicCookies()

  const [copied, setCopied] = useState(false)
  const [switchingChain, setSwitchingChain] = useState<number | null>(null)
  const [siweState, setSiweState] = useState<'idle' | 'signing' | 'verified'>('idle')
  const [siweError, setSiweError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open || !isConnected) return
    fetch('/api/auth/session', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.authenticated && data.address?.toLowerCase() === address?.toLowerCase()) {
          setSiweState('verified')
        }
      })
      .catch(() => {})
  }, [open, isConnected, address])

  if (!open) return null

  const detectedByRdns = new Map(detectedWallets.map((w) => [w.rdns, w]))
  const hasAnyWindowEth =
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { ethereum?: unknown }).ethereum)

  const extraDetected = detectedWallets.filter(
    (d) => !STANDARD_WALLETS.some((s) => s.rdns === d.rdns),
  )

  const liveGasLabel =
    pulse.baseFee !== undefined
      ? `${Number(formatUnits(pulse.baseFee, 18)).toFixed(7)} USDC`
      : 'Syncing…'

  const handleConnect = async (rdns?: string) => {
    clearError()
    setSiweError(null)
    const connected = await connect(rdns === 'com.coinbase.wallet' ? 'coinbase' : 'metamask', rdns)
    if (connected) {
      setPreference('diptos_chain', '5042002')
      onClose()
    }
  }

  const handleSiweSignIn = async () => {
    if (!address) return
    setSiweError(null)
    setSiweState('signing')
    try {
      const nonceRes = await fetch('/api/auth/nonce', { credentials: 'include' })
      if (!nonceRes.ok) throw new Error('Unable to request session nonce.')
      const { nonce, domain, chainId, issuedAt } = (await nonceRes.json()) as {
        nonce: string
        domain: string
        chainId: number
        issuedAt: string
      }

      const message = [
        `${domain} wants you to sign in with your Ethereum account:`,
        address,
        '',
        'Sign in to Diptos Guaranteed Outcome Protection. Zero platform custody; this signature does not authorize any fund transfer.',
        '',
        `URI: https://${domain}`,
        'Version: 1',
        `Chain ID: ${chainId}`,
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt}`,
      ].join('\n')

      const eth = (window as unknown as { ethereum?: { request: (arg: unknown) => Promise<string> } }).ethereum
      if (!eth) throw new Error('Injected EVM wallet required for SIWE verification.')
      const signature = await eth.request({ method: 'personal_sign', params: [message, address] })

      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, signature, message, nonce, chainId }),
      })
      if (!verifyRes.ok) {
        const err = (await verifyRes.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'SIWE verification failed.')
      }
      setSiweState('verified')
    } catch (e) {
      setSiweState('idle')
      setSiweError((e as Error).message)
    }
  }

  const handleDisconnect = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    setSiweState('idle')
    disconnect()
    onClose()
  }

  const handleCopy = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore clipboard errors
    }
  }

  const handleSwitchChain = async (chainId: number) => {
    setSwitchingChain(chainId)
    try {
      await switchNetwork(chainId)
      setPreference('diptos_chain', String(chainId))
    } finally {
      setSwitchingChain(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="1-Click Multi-Chain Settlement Modal"
    >
      <div
        className="w-full max-w-[448px] overflow-hidden rounded-2xl border border-paper/15 bg-[#08090D] text-[#F4F2EC] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-paper/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg border border-lime/30 bg-lime/10">
              <Wallet className="size-4 text-[#C8FF00]" />
            </div>
            <div>
              <h2 className="text-[14.5px] font-semibold text-[#F4F2EC]">
                {isConnected ? 'Multi-Chain Settlement Account' : '1-Click Settlement Wallet'}
              </h2>
              <p className="font-mono text-[10.5px] text-[#8E93A4]">
                {isConnected
                  ? `${walletName ?? 'Web3 Wallet'} · Non-Custodial Signer`
                  : 'EIP-6963 Multi-Provider + WalletConnect'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close wallet dialog"
            className="grid size-8 place-items-center rounded-lg text-[#8E93A4] transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto p-5">
          {(error || siweError) && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-red-200">
              {error || siweError}
            </div>
          )}

          {isConnected && address ? (
            <div className="space-y-4">
              {/* Account Card */}
              <div className="rounded-xl border border-paper/12 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-[#10B981]">
                    <span className="size-1.5 rounded-full bg-[#10B981]" />
                    CONNECTED
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-[#8E93A4]">
                    <Fuel className="size-3 text-[#C8FF00]" />
                    Gas: {liveGasLabel}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-3">
                  <p className="font-mono text-[15px] font-semibold text-[#F4F2EC]">
                    {shortHex(address, 8, 6)}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1 rounded border border-white/[0.1] bg-white/[0.03] px-2 py-1 font-mono text-[10.5px] text-[#B8BCC9] hover:text-white"
                    >
                      {copied ? <Check className="size-3 text-[#10B981]" /> : <Copy className="size-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <a
                      href={explorerUrl('address', address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded border border-white/[0.1] bg-white/[0.03] px-2 py-1 font-mono text-[10.5px] text-[#B8BCC9] hover:text-white"
                    >
                      ArcScan <ArrowUpRight className="size-3" />
                    </a>
                  </div>
                </div>

                <div className="mt-3.5 flex items-baseline justify-between border-t border-white/[0.07] pt-3">
                  <span className="text-[12px] text-[#8E93A4]">Live USDC Balance (Arc 5042002)</span>
                  <span className="font-mono text-[15px] font-semibold tabular-nums text-[#F4F2EC]">
                    {balanceUsdc ?? '—'} <span className="text-[11px] text-[#8E93A4]">USDC</span>
                  </span>
                </div>
              </div>

              {/* 1-Click SIWE HttpOnly Session */}
              <div className="flex items-center justify-between rounded-xl border border-paper/10 bg-white/[0.015] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <KeyRound className="size-4 text-[#C8FF00]" />
                  <div>
                    <p className="text-[12.5px] font-medium text-[#F4F2EC]">SIWE Session Cookie</p>
                    <p className="font-mono text-[10px] text-[#8E93A4]">
                      HttpOnly · SameSite=Lax · Zero key storage
                    </p>
                  </div>
                </div>
                {siweState === 'verified' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#10B981]/15 px-2.5 py-1 font-mono text-[10px] font-semibold text-[#10B981]">
                    <Check className="size-3" /> ACTIVE
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={siweState === 'signing'}
                    onClick={handleSiweSignIn}
                    className="rounded-full bg-[#C8FF00] px-3 py-1 font-mono text-[10.5px] font-semibold text-[#07080C] hover:bg-[#d8ff4d] disabled:opacity-50"
                  >
                    {siweState === 'signing' ? 'Signing…' : 'Sign In'}
                  </button>
                )}
              </div>

              {/* Clean Multi-Chain Network Switcher */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#8E93A4]">
                  <Globe className="size-3" />
                  Settlement Networks
                </p>
                <div className="space-y-1.5">
                  {MODAL_CHAINS.map((chain) => {
                    const active = walletChainId === chain.id
                    const busy = switchingChain === chain.id
                    const isLive = chain.status === 'live'
                    return (
                      <button
                        key={chain.id}
                        type="button"
                        disabled={!isLive || busy}
                        onClick={() => isLive && handleSwitchChain(chain.id)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                          active
                            ? 'border-[#C8FF00]/50 bg-[#C8FF00]/[0.07]'
                            : isLive
                              ? 'border-white/[0.08] bg-white/[0.015] hover:border-white/[0.18]'
                              : 'cursor-not-allowed border-white/[0.06] bg-white/[0.01] opacity-65'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-[#F4F2EC]">{chain.name}</span>
                            <span
                              className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] uppercase ${
                                isLive
                                  ? 'bg-[#10B981]/15 text-[#10B981]'
                                  : 'bg-white/[0.06] text-[#8E93A4]'
                              }`}
                            >
                              {isLive ? 'Live' : 'Coming Next'}
                            </span>
                          </div>
                          <p className="mt-0.5 font-mono text-[10.5px] text-[#7F8596]">{chain.subtitle}</p>
                        </div>
                        {busy ? (
                          <LoaderCircle className="size-4 animate-spin text-[#C8FF00]" />
                        ) : active ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-[#C8FF00]">
                            <Check className="size-3.5" /> Active
                          </span>
                        ) : isLive ? (
                          <span className="font-mono text-[10.5px] text-[#C8FF00]">1-Click Switch</span>
                        ) : (
                          <span className="font-mono text-[10px] text-[#7F8596]">Soon</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={handleDisconnect}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.02] py-2.5 font-mono text-[11.5px] text-[#B8BCC9] transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-200"
              >
                <LogOut className="size-3.5" />
                Disconnect &amp; Clear Session
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Plain-English Security & Guarantee Receipt */}
              <div className="rounded-xl border border-[#C8FF00]/25 bg-[#C8FF00]/[0.05] px-3.5 py-3">
                <div className="flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#C8FF00]">
                  <ShieldCheck className="size-3.5" />
                  Security &amp; Guarantee Receipt
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-[#E6E4DD]">
                  Zero platform custody • Hardware-pinned verification • Automatic late-delivery rebate.
                </p>
              </div>

              {extraDetected.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#8E93A4]">
                    Detected in Browser (EIP-6963)
                  </p>
                  {extraDetected.map((w) => (
                    <button
                      key={w.rdns}
                      type="button"
                      disabled={Boolean(connecting)}
                      onClick={() => handleConnect(w.rdns)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/[0.1] bg-white/[0.03] px-3.5 py-3 text-left transition-colors hover:border-[#C8FF00]/50"
                    >
                      <div className="flex items-center gap-3">
                        {w.icon ? (
                          <img src={w.icon} alt="" className="size-7 rounded-md" />
                        ) : (
                          <div className="grid size-7 place-items-center rounded-md bg-white/[0.08] font-mono text-[11px]">
                            W3
                          </div>
                        )}
                        <span className="text-[13.5px] font-medium text-[#F4F2EC]">{w.name}</span>
                      </div>
                      <span className="rounded bg-[#C8FF00] px-2.5 py-1 font-mono text-[10px] font-semibold text-[#07080C]">
                        1-Click Connect
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#8E93A4]">
                  Select Signer
                </p>
                {STANDARD_WALLETS.map((w) => {
                  const detected = detectedByRdns.get(w.rdns)
                  const isWc = w.rdns === 'walletconnect'
                  const canConnect = !isWc && Boolean(detected || hasAnyWindowEth)
                  return (
                    <div
                      key={w.rdns}
                      className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5 transition-colors hover:border-white/[0.18]"
                    >
                      <button
                        type="button"
                        disabled={Boolean(connecting)}
                        onClick={() =>
                          canConnect
                            ? handleConnect(detected?.rdns)
                            : window.open(w.installUrl, '_blank', 'noopener,noreferrer')
                        }
                        className="flex flex-1 items-center gap-3 text-left"
                      >
                        {detected?.icon ? (
                          <img src={detected.icon} alt="" className="size-8 rounded-lg" />
                        ) : (
                          <div className="grid size-8 place-items-center rounded-lg border border-white/[0.1] bg-white/[0.04] font-mono text-[11px] font-semibold text-[#F4F2EC]">
                            {w.badge}
                          </div>
                        )}
                        <div>
                          <p className="text-[13.5px] font-medium text-[#F4F2EC]">{w.name}</p>
                          <p className="text-[11.5px] text-[#7F8596]">{w.tagline}</p>
                        </div>
                      </button>

                      {detected ? (
                        <button
                          type="button"
                          disabled={Boolean(connecting)}
                          onClick={() => handleConnect(detected.rdns)}
                          className="rounded-full bg-[#C8FF00] px-3 py-1 font-mono text-[10.5px] font-semibold text-[#07080C] hover:bg-[#d8ff4d]"
                        >
                          {connecting ? '…' : 'Connect'}
                        </button>
                      ) : canConnect ? (
                        <button
                          type="button"
                          disabled={Boolean(connecting)}
                          onClick={() => handleConnect()}
                          className="rounded-full border border-white/[0.14] px-3 py-1 font-mono text-[10.5px] text-[#E6E4DD] hover:border-white/[0.28]"
                        >
                          Connect
                        </button>
                      ) : (
                        <a
                          href={w.installUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-white/[0.1] px-2.5 py-1 font-mono text-[10.5px] text-[#8E93A4] hover:text-white"
                        >
                          {isWc ? 'Mobile' : 'Install'} <ArrowUpRight className="size-3" />
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Clean Live Rail Footer */}
              <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.015] px-3.5 py-2.5 font-mono text-[10.5px]">
                <span className="text-[#8E93A4]">Arc Testnet 5042002 (Live)</span>
                <span className="text-[#C8FF00]">Base (Coming Next)</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
