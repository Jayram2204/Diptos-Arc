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
import { createPublicClient, formatUnits, http, parseAbi } from 'viem'
import { base } from 'viem/chains'
import { trackFunnelEvent } from '@/lib/analytics'
import { explorerUrl, shortHex } from '@/lib/chain'
import { useDynamicCookies } from '@/lib/cookies'
import { useArcPulse } from '@/lib/hooks'
import { useWallet } from '@/app/wallet'

const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const
const ERC20_BALANCE_ABI = parseAbi(['function balanceOf(address owner) view returns (uint256)'])
const basePublicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org', { timeout: 5000 }),
})

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

export function WalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    address,
    isConnected,
    walletName,
    walletChainId,
    detectedWallets,
    siweSession,
    connecting,
    connect,
    signInWithSiwe,
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
  const [baseBalanceUsdc, setBaseBalanceUsdc] = useState<string | null>(null)
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

  // Fetch live Base 6-dec ERC-20 USDC balance when connected
  useEffect(() => {
    if (!open || !address) {
      setBaseBalanceUsdc(null)
      return
    }
    let alive = true
    basePublicClient
      .readContract({
        address: BASE_USDC,
        abi: ERC20_BALANCE_ABI,
        functionName: 'balanceOf',
        args: [address],
      })
      .then((raw) => {
        if (!alive) return
        const val = Number(formatUnits(raw, 6))
        setBaseBalanceUsdc(val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
      })
      .catch(() => {
        if (alive) setBaseBalanceUsdc('0.00')
      })
    return () => {
      alive = false
    }
  }, [open, address])

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
    const connected = await connect(
      rdns === 'com.coinbase.wallet' ? 'coinbase' : 'metamask',
      rdns,
      { autoSiwe: true },
    )
    if (connected) {
      setPreference('diptos_chain', '5042002')
      trackFunnelEvent('wallet_connected', { chainId: 5042002 })
      onClose()
    }
  }

  const handleSiweSignIn = async () => {
    if (!address) return
    setSiweError(null)
    setSiweState('signing')
    const ok = await signInWithSiwe()
    if (ok) {
      setSiweState('verified')
    } else {
      setSiweState('idle')
      setSiweError('SIWE verification cancelled or failed.')
    }
  }

  const handleDisconnect = async () => {
    await disconnect()
    setSiweState('idle')
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
      if (chainId === 8453) {
        const eth = (window as unknown as { ethereum?: { request: (a: unknown) => Promise<unknown> } }).ethereum
        if (eth) {
          try {
            await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] })
          } catch {
            await eth.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: '0x2105',
                  chainName: 'Base',
                  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['https://mainnet.base.org'],
                  blockExplorerUrls: ['https://basescan.org'],
                },
              ],
            })
          }
        }
      } else {
        await switchNetwork(chainId)
      }
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
        className="w-full max-w-[468px] overflow-hidden rounded-2xl border border-paper/15 bg-[#08090D] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-paper/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg border border-lime/40 bg-lime/10">
              <Wallet className="size-4 text-[#C8FF00]" />
            </div>
            <div>
              <h2 className="text-[14.5px] font-semibold text-white">
                {isConnected ? 'Multi-Chain Settlement Account' : '1-Click Settlement Wallet'}
              </h2>
              <p className="font-mono text-[11px] text-[#E5E7EB]/80">
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
            className="grid size-8 place-items-center rounded-lg text-[#E5E7EB] transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto p-5">
          {(error || siweError) && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-red-100"
            >
              {error || siweError}
            </div>
          )}

          {isConnected && address ? (
            <div className="space-y-4">
              {/* Account Header */}
              <div className="rounded-xl border border-paper/15 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#10B981]">
                    <span className="size-1.5 rounded-full bg-[#10B981]" />
                    CONNECTED
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#E5E7EB]">
                    <Fuel className="size-3 text-[#C8FF00]" />
                    Arc Gas: {liveGasLabel}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-3">
                  <p className="font-mono text-[15px] font-semibold text-white">{shortHex(address, 8, 6)}</p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-[#E5E7EB] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
                    >
                      {copied ? <Check className="size-3 text-[#10B981]" /> : <Copy className="size-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <a
                      href={explorerUrl('address', address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-[#E5E7EB] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
                    >
                      ArcScan <ArrowUpRight className="size-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Side-by-Side Arc + Base Multi-Chain Settlement Rails */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[#E5E7EB]">
                  <Globe className="size-3.5 text-[#C8FF00]" />
                  Active Settlement Rails (Arc + Base)
                </p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {/* Arc Testnet (5042002) */}
                  <button
                    type="button"
                    disabled={switchingChain === 5042002}
                    onClick={() => handleSwitchChain(5042002)}
                    className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime ${
                      walletChainId === 5042002
                        ? 'border-[#C8FF00]/60 bg-[#C8FF00]/[0.07]'
                        : 'border-white/15 bg-white/[0.02] hover:border-white/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[13px] font-semibold text-white">Arc Testnet</span>
                        <span className="rounded bg-[#10B981]/20 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-[#10B981]">
                          Live
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[10.5px] text-[#E5E7EB]/75">
                        5042002 · 18-dec Native USDC
                      </p>
                    </div>
                    <div className="mt-3 border-t border-white/10 pt-2.5">
                      <p className="font-mono text-[14px] font-semibold tabular-nums text-white">
                        {balanceUsdc ?? '—'} <span className="text-[10.5px] text-[#E5E7EB]">USDC</span>
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-[#C8FF00]">
                        {switchingChain === 5042002
                          ? 'Switching…'
                          : walletChainId === 5042002
                            ? '✓ Active Rail'
                            : '1-Click Switch →'}
                      </p>
                    </div>
                  </button>

                  {/* Base (8453) — 6-dec ERC-20 USDC + Base Builder Codes */}
                  <button
                    type="button"
                    disabled={switchingChain === 8453}
                    onClick={() => handleSwitchChain(8453)}
                    className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime ${
                      walletChainId === 8453
                        ? 'border-[#C8FF00]/60 bg-[#C8FF00]/[0.07]'
                        : 'border-white/15 bg-white/[0.02] hover:border-white/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[13px] font-semibold text-white">Base</span>
                        <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-[#E5E7EB]">
                          x402 + ERC-20
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[10.5px] text-[#E5E7EB]/75">
                        8453 · 6-dec USDC · Builder Code
                      </p>
                    </div>
                    <div className="mt-3 border-t border-white/10 pt-2.5">
                      <p className="font-mono text-[14px] font-semibold tabular-nums text-white">
                        {baseBalanceUsdc ?? '…'} <span className="text-[10.5px] text-[#E5E7EB]">USDC</span>
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-[#E5E7EB]">
                        {switchingChain === 8453
                          ? 'Switching…'
                          : walletChainId === 8453
                            ? '✓ Active Rail'
                            : '1-Click Switch →'}
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* 1-Click SIWE HttpOnly Session */}
              <div className="flex items-center justify-between rounded-xl border border-paper/15 bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <KeyRound className="size-4 text-[#C8FF00]" />
                  <div>
                    <p className="text-[12.5px] font-medium text-white">SIWE Session Cookie</p>
                    <p className="font-mono text-[10.5px] text-[#E5E7EB]/75">
                      HttpOnly · SameSite=Lax · Zero key storage
                    </p>
                  </div>
                </div>
                {siweState === 'verified' || siweSession?.authenticated ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#10B981]/20 px-2.5 py-1 font-mono text-[10px] font-semibold text-[#10B981]">
                    <Check className="size-3" /> ACTIVE
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={siweState === 'signing'}
                    onClick={handleSiweSignIn}
                    className="rounded-full bg-[#C8FF00] px-3 py-1 font-mono text-[10.5px] font-semibold text-[#07080C] hover:bg-[#d8ff4d] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    {siweState === 'signing' ? 'Signing…' : 'Sign In'}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleDisconnect}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.02] py-2.5 font-mono text-[11.5px] text-[#E5E7EB] transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
              >
                <LogOut className="size-3.5" />
                Disconnect &amp; Clear Session
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Plain-English Security & Guarantee Receipt */}
              <div className="rounded-xl border border-[#C8FF00]/30 bg-[#C8FF00]/[0.06] px-3.5 py-3">
                <div className="flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#C8FF00]">
                  <ShieldCheck className="size-3.5" />
                  Security &amp; Guarantee Receipt
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-white">
                  Zero platform custody • Hardware-pinned verification • Automatic late-delivery rebate.
                </p>
              </div>

              {extraDetected.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#E5E7EB]">
                    Detected in Browser (EIP-6963)
                  </p>
                  {extraDetected.map((w) => (
                    <button
                      key={w.rdns}
                      type="button"
                      disabled={Boolean(connecting)}
                      onClick={() => handleConnect(w.rdns)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/[0.03] px-3.5 py-3 text-left transition-colors hover:border-[#C8FF00]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
                    >
                      <div className="flex items-center gap-3">
                        {w.icon ? (
                          <img src={w.icon} alt="" className="size-7 rounded-md" />
                        ) : (
                          <div className="grid size-7 place-items-center rounded-md bg-white/[0.08] font-mono text-[11px]">
                            W3
                          </div>
                        )}
                        <span className="text-[13.5px] font-medium text-white">{w.name}</span>
                      </div>
                      <span className="rounded-full bg-[#C8FF00] px-2.5 py-1 font-mono text-[10px] font-semibold text-[#07080C]">
                        1-Click Connect
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#E5E7EB]">
                  Select Signer
                </p>
                {STANDARD_WALLETS.map((w) => {
                  const detected = detectedByRdns.get(w.rdns)
                  const isWc = w.rdns === 'walletconnect'
                  // STRICT EIP-6963 isolation: NEVER route a non-detected wallet (e.g. Rabby) to window.ethereum
                  const isInstalled = !isWc && Boolean(detected)
                  return (
                    <div
                      key={w.rdns}
                      className="flex items-center justify-between rounded-xl border border-white/12 bg-white/[0.02] px-3.5 py-2.5 transition-colors hover:border-white/25"
                    >
                      <button
                        type="button"
                        disabled={Boolean(connecting)}
                        onClick={() =>
                          isInstalled && detected
                            ? handleConnect(detected.rdns)
                            : window.open(w.installUrl, '_blank', 'noopener,noreferrer')
                        }
                        className="flex flex-1 items-center gap-3 text-left focus-visible:outline-none"
                      >
                        {detected?.icon ? (
                          <img src={detected.icon} alt="" className="size-8 rounded-lg" />
                        ) : (
                          <div className="grid size-8 place-items-center rounded-lg border border-white/15 bg-white/[0.05] font-mono text-[11px] font-semibold text-white">
                            {w.badge}
                          </div>
                        )}
                        <div>
                          <p className="text-[13.5px] font-medium text-white">{w.name}</p>
                          <p className="text-[11.5px] text-[#E5E7EB]/75">
                            {isInstalled ? 'Detected via EIP-6963' : isWc ? w.tagline : 'Not installed'}
                          </p>
                        </div>
                      </button>

                      {isInstalled && detected ? (
                        <button
                          type="button"
                          disabled={Boolean(connecting)}
                          onClick={() => handleConnect(detected.rdns)}
                          className="rounded-full bg-[#C8FF00] px-3 py-1 font-mono text-[10.5px] font-semibold text-[#07080C] hover:bg-[#d8ff4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                          {connecting ? <LoaderCircle className="size-3.5 animate-spin" /> : '1-Click Sign In'}
                        </button>
                      ) : (
                        <a
                          href={w.installUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 font-mono text-[10.5px] text-[#E5E7EB] hover:text-white"
                        >
                          {isWc ? 'Mobile' : 'Not installed'} <ArrowUpRight className="size-3" />
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5 font-mono text-[11px]">
                <span className="text-white">Arc 5042002 (Live)</span>
                <span className="text-[#E5E7EB]">Base 8453 (x402 + ERC-20)</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
