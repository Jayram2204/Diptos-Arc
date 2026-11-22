import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  Copy,
  Globe,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react'
import { SUPPORTED_CHAINS } from '@diptos/contracts'
import { explorerUrl, shortHex } from '@/lib/chain'
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
    rdns: 'me.rainbow',
    name: 'Rainbow',
    tagline: 'EVM wallet extension',
    installUrl: 'https://rainbow.me/',
    badge: 'RN',
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

  const [copied, setCopied] = useState(false)
  const [switchingChain, setSwitchingChain] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const detectedByRdns = new Map(detectedWallets.map((w) => [w.rdns, w]))
  const hasAnyWindowEth =
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { ethereum?: unknown }).ethereum)

  const extraDetected = detectedWallets.filter(
    (d) => !STANDARD_WALLETS.some((s) => s.rdns === d.rdns),
  )

  const handleConnect = async (rdns?: string) => {
    clearError()
    const connected = await connect(rdns === 'com.coinbase.wallet' ? 'coinbase' : 'metamask', rdns)
    if (connected) onClose()
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
    } finally {
      setSwitchingChain(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Multi-chain wallet connection"
    >
      <div
        className="w-full max-w-[440px] overflow-hidden rounded-xl border border-white/[0.12] bg-[#0B0D12] text-[#F4F2EC] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg border border-white/[0.1] bg-white/[0.03]">
              <Wallet className="size-4 text-[#C8FF00]" />
            </div>
            <div>
              <h2 className="text-[14.5px] font-semibold text-[#F4F2EC]">
                {isConnected ? 'Connected Account' : 'Connect Wallet'}
              </h2>
              <p className="font-mono text-[10.5px] text-[#8E93A4]">
                {isConnected
                  ? `${walletName ?? 'Web3 Wallet'} • Multi-Chain EVM`
                  : 'EIP-6963 Non-Custodial Signer'}
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

        <div className="max-h-[75vh] overflow-y-auto p-5">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-red-200">
              {error}
            </div>
          )}

          {isConnected && address ? (
            <div className="space-y-5">
              {/* Account Card */}
              <div className="rounded-lg border border-white/[0.09] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#10B981]">
                    <span className="size-1.5 rounded-full bg-[#10B981]" />
                    CONNECTED
                  </span>
                  <span className="font-mono text-[11px] text-[#8E93A4]">
                    {walletName ?? 'EVM Wallet'}
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
                  <span className="text-[12px] text-[#8E93A4]">Arc Testnet Balance</span>
                  <span className="font-mono text-[15px] font-semibold tabular-nums text-[#F4F2EC]">
                    {balanceUsdc ?? '—'} <span className="text-[11px] text-[#8E93A4]">USDC</span>
                  </span>
                </div>
              </div>

              {/* Multi-Chain Network Switcher */}
              <div>
                <p className="mb-2.5 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#8E93A4]">
                  <Globe className="size-3" />
                  Settlement Networks
                </p>
                <div className="space-y-1.5">
                  {SUPPORTED_CHAINS.map((chain) => {
                    const active = walletChainId === chain.id
                    const busy = switchingChain === chain.id
                    return (
                      <button
                        key={chain.id}
                        type="button"
                        onClick={() => handleSwitchChain(chain.id)}
                        disabled={busy}
                        className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                          active
                            ? 'border-[#C8FF00]/40 bg-[#C8FF00]/[0.06]'
                            : 'border-white/[0.08] bg-white/[0.015] hover:border-white/[0.16]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-[#F4F2EC]">
                              {chain.name}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] uppercase ${
                                chain.status === 'live'
                                  ? 'bg-[#10B981]/15 text-[#10B981]'
                                  : 'bg-white/[0.06] text-[#8E93A4]'
                              }`}
                            >
                              {chain.status === 'live' ? 'Live' : 'Ready'}
                            </span>
                          </div>
                          <p className="mt-0.5 font-mono text-[10.5px] text-[#7F8596]">
                            Chain ID {chain.id} • {chain.nativeCurrency.symbol}
                          </p>
                        </div>
                        {busy ? (
                          <LoaderCircle className="size-4 animate-spin text-[#C8FF00]" />
                        ) : active ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-[#C8FF00]">
                            <Check className="size-3.5" /> Active
                          </span>
                        ) : (
                          <span className="font-mono text-[10.5px] text-[#8E93A4]">Switch</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  disconnect()
                  onClose()
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.02] py-2.5 font-mono text-[11.5px] text-[#B8BCC9] transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-200"
              >
                <LogOut className="size-3.5" />
                Disconnect Wallet
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Extra EIP-6963 Wallets */}
              {extraDetected.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#8E93A4]">
                    Detected in Browser
                  </p>
                  {extraDetected.map((w) => (
                    <button
                      key={w.rdns}
                      type="button"
                      disabled={Boolean(connecting)}
                      onClick={() => handleConnect(w.rdns)}
                      className="flex w-full items-center justify-between rounded-lg border border-white/[0.1] bg-white/[0.03] px-3.5 py-3 text-left transition-colors hover:border-[#C8FF00]/50"
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
                      <span className="rounded bg-[#10B981]/15 px-2 py-0.5 font-mono text-[10px] text-[#10B981]">
                        Installed
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Standard EVM Wallets */}
              <div className="space-y-1.5">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#8E93A4]">
                  Select EVM Signer
                </p>
                {STANDARD_WALLETS.map((w) => {
                  const detected = detectedByRdns.get(w.rdns)
                  const canConnect = Boolean(detected || hasAnyWindowEth)
                  return (
                    <div
                      key={w.rdns}
                      className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5 transition-colors hover:border-white/[0.18]"
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
                          className="rounded-md bg-[#C8FF00] px-2.5 py-1 font-mono text-[10.5px] font-semibold text-[#07080C] hover:bg-[#d8ff4d]"
                        >
                          {connecting ? '…' : 'Connect'}
                        </button>
                      ) : canConnect ? (
                        <button
                          type="button"
                          disabled={Boolean(connecting)}
                          onClick={() => handleConnect()}
                          className="rounded-md border border-white/[0.14] px-2.5 py-1 font-mono text-[10.5px] text-[#E6E4DD] hover:border-white/[0.28]"
                        >
                          Connect
                        </button>
                      ) : (
                        <a
                          href={w.installUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-white/[0.1] px-2.5 py-1 font-mono text-[10.5px] text-[#8E93A4] hover:text-white"
                        >
                          Install <ArrowUpRight className="size-3" />
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Supported Multi-Chain Footer */}
              <div className="rounded-lg border border-white/[0.07] bg-white/[0.015] px-3.5 py-3">
                <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-[#C8CCD8]">
                  <ShieldCheck className="size-3.5 text-[#10B981]" />
                  Default Settlement Rail: Arc Testnet (5042002)
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[#7F8596]">
                  Connecting prompts your wallet to switch or add Arc Testnet. Funds remain
                  non-custodial in DiptosEscrow.sol.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
