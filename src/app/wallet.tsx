import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  type Address,
  type BaseError,
  createWalletClient,
  custom,
  type EIP1193Provider,
  formatUnits,
  getAddress,
  type Hex,
  numberToHex,
} from 'viem'
import { ABIS } from '@/config/abis'
import { ARC_CHAIN_ID, ARC_NATIVE_DECIMALS, type ContractKey, contractAddress } from '@/config/protocol'
import { arcTestnet, publicClient } from '@/lib/chain'

export type WalletId = 'metamask' | 'coinbase'
export type TxKind = 'Fund Escrow' | 'Settle Escrow' | 'Claim Timeout Refund' | 'Claim Faucet'

export interface TxRequest {
  kind: TxKind
  contract: ContractKey
  functionName: string
  args: readonly unknown[]
  value?: bigint
}

export interface Receipt {
  kind: TxKind
  hash: Hex
  blockNumber: string
  gasUsed: string
  status: 'success' | 'reverted'
  from: Address
  at: number
}

interface Eip6963Detail {
  info: { rdns: string; name: string; uuid: string }
  provider: EIP1193Provider
}

interface WalletContextValue {
  address: Address | null
  isConnected: boolean
  walletName: string | null
  walletChainId: number | null
  connecting: WalletId | null
  connect: (id?: WalletId) => Promise<void>
  disconnect: () => void
  balanceUsdc: string | null
  refreshBalance: () => void
  execute: (req: TxRequest) => Promise<Receipt | null>
  txStage: { kind: TxKind; stage: 'switch' | 'sign' | 'mining' } | null
  error: string | null
  clearError: () => void
}

const WalletCtx = createContext<WalletContextValue | null>(null)

export function useWallet() {
  const ctx = useContext(WalletCtx)
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider')
  return ctx
}

const NO_WALLET_MSG =
  'No EVM wallet extension detected — open in Chrome/Brave with MetaMask or Rabby to sign Arc Testnet transactions.'

const errMsg = (e: unknown) => {
  const be = e as BaseError & { code?: number }
  if (be?.code === 4001 || /rejected|denied/i.test(be?.message ?? '')) return 'Transaction rejected in wallet.'
  return (be?.shortMessage || be?.message || 'Unknown wallet error').split('\n')[0]
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [eip6963, setEip6963] = useState<Record<string, Eip6963Detail>>({})
  const [address, setAddress] = useState<Address | null>(null)
  const [walletName, setWalletName] = useState<string | null>(null)
  const [walletChainId, setWalletChainId] = useState<number | null>(null)
  const [connecting, setConnecting] = useState<WalletId | null>(null)
  const [balanceUsdc, setBalanceUsdc] = useState<string | null>(null)
  const [txStage, setTxStage] = useState<{ kind: TxKind; stage: 'switch' | 'sign' | 'mining' } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const provider = useRef<EIP1193Provider | null>(null)

  // Purge any legacy auto-connect / burner wallet keys from localStorage on mount
  useEffect(() => {
    try {
      localStorage.removeItem('diptos.wallet.v1')
      localStorage.removeItem('diptos.arc.wallet.v2')
      localStorage.removeItem('diptos.arc.wallet.v3')
    } catch {
      // ignore storage errors
    }
  }, [])

  // EIP-6963 provider discovery (passive discovery only — never auto-connects)
  useEffect(() => {
    const onAnnounce = (e: Event) => {
      const d = (e as CustomEvent<Eip6963Detail>).detail
      if (d?.info?.rdns) setEip6963((m) => ({ ...m, [d.info.rdns]: d }))
    }
    window.addEventListener('eip6963:announceProvider', onAnnounce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    return () => window.removeEventListener('eip6963:announceProvider', onAnnounce)
  }, [])

  const resolveInjectedProvider = useCallback((): { provider: EIP1193Provider; name: string } | null => {
    if (eip6963['io.metamask']) return { provider: eip6963['io.metamask'].provider, name: 'MetaMask' }
    if (eip6963['io.rabby']) return { provider: eip6963['io.rabby'].provider, name: 'Rabby Wallet' }
    if (eip6963['com.coinbase.wallet']) {
      return { provider: eip6963['com.coinbase.wallet'].provider, name: 'Coinbase Wallet' }
    }
    if (eip6963['app.phantom']) return { provider: eip6963['app.phantom'].provider, name: 'Phantom' }
    if (eip6963['me.rainbow']) return { provider: eip6963['me.rainbow'].provider, name: 'Rainbow' }
    const firstEip6963 = Object.values(eip6963)[0]
    if (firstEip6963) return { provider: firstEip6963.provider, name: firstEip6963.info.name || 'Browser Wallet' }

    const winEth = (
      window as unknown as {
        ethereum?: EIP1193Provider & {
          isMetaMask?: boolean
          isRabby?: boolean
          isCoinbaseWallet?: boolean
          providers?: (EIP1193Provider & { isMetaMask?: boolean; isRabby?: boolean })[]
        }
      }
    ).ethereum

    if (winEth?.providers?.length) {
      const preferred = winEth.providers.find((p) => p.isRabby || p.isMetaMask) ?? winEth.providers[0]
      return { provider: preferred, name: preferred.isRabby ? 'Rabby Wallet' : 'MetaMask' }
    }
    if (winEth && typeof winEth.request === 'function') {
      const name = winEth.isRabby ? 'Rabby Wallet' : winEth.isMetaMask ? 'MetaMask' : 'Browser Wallet'
      return { provider: winEth, name }
    }
    return null
  }, [eip6963])

  const refreshBalance = useCallback(() => {
    if (!address) {
      setBalanceUsdc(null)
      return
    }
    publicClient()
      .getBalance({ address })
      .then((wei) => {
        const val = Number(formatUnits(wei, ARC_NATIVE_DECIMALS))
        setBalanceUsdc(val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }))
      })
      .catch(() => {
        setBalanceUsdc(null)
      })
  }, [address])

  useEffect(() => {
    refreshBalance()
  }, [refreshBalance])

  const switchToArc = useCallback(async (p: EIP1193Provider) => {
    const hexId = numberToHex(ARC_CHAIN_ID) // 0x4cef52 (5042002)
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] })
    } catch (e) {
      const code = (e as { code?: number })?.code
      if (code === 4902 || code === -32603) {
        await p.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: hexId,
              chainName: arcTestnet.name,
              nativeCurrency: arcTestnet.nativeCurrency,
              rpcUrls: [...arcTestnet.rpcUrls.default.http],
              blockExplorerUrls: [arcTestnet.blockExplorers.default.url],
            },
          ],
        })
      } else {
        throw e
      }
    }
    setWalletChainId(ARC_CHAIN_ID)
  }, [])

  const attach = useCallback((p: EIP1193Provider) => {
    const onAccounts = (accs: string[]) => {
      if (!accs?.[0]) {
        provider.current = null
        setAddress(null)
        setWalletName(null)
        setBalanceUsdc(null)
      } else {
        setAddress(getAddress(accs[0]))
      }
    }
    const onChain = (id: string) => setWalletChainId(Number(id))
    p.on?.('accountsChanged', onAccounts as never)
    p.on?.('chainChanged', onChain as never)
  }, [])

  const connect = useCallback(
    async (id: WalletId = 'metamask') => {
      setError(null)
      setConnecting(id)
      try {
        const detected = resolveInjectedProvider()
        if (!detected) {
          setError(NO_WALLET_MSG)
          return
        }

        const accounts = (await detected.provider.request({
          method: 'eth_requestAccounts',
        } as never)) as string[]

        if (!accounts?.[0]) {
          setError('No wallet account authorized.')
          return
        }

        provider.current = detected.provider
        setAddress(getAddress(accounts[0]))
        setWalletName(detected.name)
        const currentChainHex = (await detected.provider.request({ method: 'eth_chainId' })) as string
        setWalletChainId(Number(currentChainHex))
        attach(detected.provider)

        await switchToArc(detected.provider).catch(() => {})
      } catch (e) {
        setError(errMsg(e))
      } finally {
        setConnecting(null)
      }
    },
    [resolveInjectedProvider, attach, switchToArc],
  )

  const disconnect = useCallback(() => {
    provider.current = null
    setAddress(null)
    setWalletName(null)
    setWalletChainId(null)
    setBalanceUsdc(null)
    setError(null)
  }, [])

  const execute = useCallback(
    async (req: TxRequest): Promise<Receipt | null> => {
      setError(null)
      try {
        const p = provider.current
        if (!p || !address) {
          throw new Error('Connect your EVM wallet on Arc Testnet first.')
        }
        if (walletChainId !== ARC_CHAIN_ID) {
          setTxStage({ kind: req.kind, stage: 'switch' })
          await switchToArc(p)
        }
        const target = contractAddress(req.contract)
        const wc = createWalletClient({ account: address, chain: arcTestnet, transport: custom(p) })
        const pc = publicClient()

        setTxStage({ kind: req.kind, stage: 'sign' })
        const hash = await wc.writeContract({
          address: target,
          abi: ABIS[req.contract],
          functionName: req.functionName,
          args: req.args,
          value: req.value,
        } as never)

        setTxStage({ kind: req.kind, stage: 'mining' })
        const rc = await pc.waitForTransactionReceipt({ hash })
        refreshBalance()
        return {
          kind: req.kind,
          hash,
          blockNumber: rc.blockNumber.toString(),
          gasUsed: rc.gasUsed.toString(),
          status: rc.status,
          from: address,
          at: Date.now(),
        }
      } catch (e) {
        setError(errMsg(e))
        return null
      } finally {
        setTxStage(null)
      }
    },
    [address, walletChainId, switchToArc, refreshBalance],
  )

  return (
    <WalletCtx.Provider
      value={{
        address,
        isConnected: Boolean(address && provider.current),
        walletName,
        walletChainId,
        connecting,
        connect,
        disconnect,
        balanceUsdc,
        refreshBalance,
        execute,
        txStage,
        error,
        clearError: () => setError(null),
      }}
    >
      {children}
    </WalletCtx.Provider>
  )
}
