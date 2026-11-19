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
  walletName: string | null
  walletChainId: number | null
  connecting: WalletId | null
  connect: (id: WalletId) => Promise<void>
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

const LAST_WALLET_KEY = 'diptos.arc.wallet.v2'

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

  useEffect(() => {
    const onAnnounce = (e: Event) => {
      const d = (e as CustomEvent<Eip6963Detail>).detail
      if (d?.info?.rdns) setEip6963((m) => ({ ...m, [d.info.rdns]: d }))
    }
    window.addEventListener('eip6963:announceProvider', onAnnounce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    return () => window.removeEventListener('eip6963:announceProvider', onAnnounce)
  }, [])

  const injected = (window as unknown as {
    ethereum?: EIP1193Provider & { isMetaMask?: boolean; isCoinbaseWallet?: boolean }
  }).ethereum

  const metamaskProvider =
    eip6963['io.metamask']?.provider ?? (injected?.isMetaMask && !injected.isCoinbaseWallet ? injected : injected ?? null)
  const coinbaseInjected = eip6963['com.coinbase.wallet']?.provider ?? (injected?.isCoinbaseWallet ? injected : null)

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
    const hexId = numberToHex(ARC_CHAIN_ID)
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] })
    } catch (e) {
      if ((e as { code?: number }).code === 4902) {
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
    const onAccounts = (accs: string[]) => setAddress(accs[0] ? getAddress(accs[0]) : null)
    const onChain = (id: string) => setWalletChainId(Number(id))
    p.on?.('accountsChanged', onAccounts as never)
    p.on?.('chainChanged', onChain as never)
  }, [])

  const finishConnect = useCallback(
    async (p: EIP1193Provider, name: string, interactive: boolean) => {
      const accounts = (await p.request({
        method: interactive ? 'eth_requestAccounts' : 'eth_accounts',
      } as never)) as string[]
      if (!accounts?.[0]) return false
      provider.current = p
      setAddress(getAddress(accounts[0]))
      setWalletName(name)
      setWalletChainId(Number(await p.request({ method: 'eth_chainId' })))
      attach(p)
      return true
    },
    [attach],
  )

  const connect = useCallback(
    async (id: WalletId) => {
      setError(null)
      setConnecting(id)
      try {
        let p: EIP1193Provider | null = null
        let name = ''
        if (id === 'metamask') {
          p = metamaskProvider
          name = 'MetaMask'
          if (!p) throw new Error('No EVM browser wallet detected. Install MetaMask or Coinbase Wallet.')
        } else {
          name = 'Coinbase Wallet'
          p = coinbaseInjected
          if (!p) {
            const { createCoinbaseWalletSDK } = await import('@coinbase/wallet-sdk')
            const sdk = createCoinbaseWalletSDK({
              appName: 'Diptos on Arc',
              appChainIds: [ARC_CHAIN_ID],
            })
            p = sdk.getProvider() as unknown as EIP1193Provider
          }
        }
        const ok = await finishConnect(p, name, true)
        if (ok) {
          localStorage.setItem(LAST_WALLET_KEY, id)
          await switchToArc(p).catch(() => {})
        }
      } catch (e) {
        setError(errMsg(e))
      } finally {
        setConnecting(null)
      }
    },
    [metamaskProvider, coinbaseInjected, finishConnect, switchToArc],
  )

  useEffect(() => {
    const last = localStorage.getItem(LAST_WALLET_KEY) as WalletId | null
    if (address || !last) return
    const p = last === 'metamask' ? metamaskProvider : coinbaseInjected
    if (p) finishConnect(p, last === 'metamask' ? 'MetaMask' : 'Coinbase Wallet', false).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metamaskProvider, coinbaseInjected])

  const disconnect = useCallback(() => {
    provider.current = null
    localStorage.removeItem(LAST_WALLET_KEY)
    setAddress(null)
    setWalletName(null)
    setWalletChainId(null)
    setBalanceUsdc(null)
  }, [])

  const execute = useCallback(
    async (req: TxRequest): Promise<Receipt | null> => {
      setError(null)
      const p = provider.current
      try {
        if (!p || !address) throw new Error('Connect a wallet on Arc Testnet first.')
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
