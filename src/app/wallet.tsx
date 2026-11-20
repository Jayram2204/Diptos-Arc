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
export type TxKind =
  | 'Create Escrow'
  | 'Fund Escrow'
  | 'Settle Escrow'
  | 'Release By Payer'
  | 'Claim Timeout Refund'
  | 'Claim Faucet'

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
  connect: (id?: WalletId) => Promise<Address | null>
  disconnect: () => void
  balanceUsdc: string | null
  refreshBalance: () => void
  execute: (req: TxRequest) => Promise<Receipt | null>
  txStage: { kind: TxKind; stage: 'switch' | 'simulate' | 'sign' | 'mining' } | null
  error: string | null
  clearError: () => void
}

const WalletCtx = createContext<WalletContextValue | null>(null)

export function useWallet() {
  const ctx = useContext(WalletCtx)
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider')
  return ctx
}

export const NO_WEB3_WALLET_MSG =
  'No Web3 wallet detected in this browser. Open in MetaMask / Rabby mobile browser or desktop Chrome to sign Arc Testnet transactions.'

export function decodeRevertError(e: unknown): string {
  const be = e as BaseError & {
    code?: number
    shortMessage?: string
    details?: string
    cause?: { data?: { errorName?: string; args?: unknown[] }; shortMessage?: string; message?: string }
  }
  if (be?.code === 4001 || /rejected|denied/i.test(be?.message ?? '')) {
    return 'Transaction rejected in wallet.'
  }
  const errorName = be?.cause?.data?.errorName
  const errorArgs = be?.cause?.data?.args
  if (errorName) {
    if (errorName === 'EscrowNotFunded') return 'Revert: EscrowNotFunded() — this escrow is not funded on Arc Testnet.'
    if (errorName === 'AlreadySettled') return 'Revert: AlreadySettled() — this escrow has already been settled on-chain.'
    if (errorName === 'InvalidNonce') {
      return `Revert: InvalidNonce(expected=${String(errorArgs?.[0] ?? '?')}, provided=${String(errorArgs?.[1] ?? '?')}) — click "Verify Deliverable with Grok" to sign with the latest on-chain nonce.`
    }
    if (errorName === 'InvalidOracleSignature') {
      return `Revert: InvalidOracleSignature(recovered=${String(errorArgs?.[0] ?? '?')}, expected=${String(errorArgs?.[1] ?? '?')}) — oracle signature mismatch.`
    }
    if (errorName === 'ZeroPayout') return 'Revert: ZeroPayout() — computed payout is zero.'
    if (errorName === 'Unauthorized') return 'Revert: Unauthorized() — caller is not authorized for this action.'
    if (errorName === 'FaucetCooldown') return 'Revert: FaucetCooldown() — please wait 1 hour between faucet claims.'
    if (errorName === 'FaucetEmpty') return 'Revert: FaucetEmpty() — on-chain faucet reserve is empty.'
    return `Contract reverted with ${errorName}(${(errorArgs ?? []).map(String).join(', ')})`
  }
  const msg = be?.shortMessage || be?.cause?.shortMessage || be?.message || 'Transaction failed on Arc Testnet.'
  return msg.split('\n')[0]
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [eip6963, setEip6963] = useState<Record<string, Eip6963Detail>>({})
  const [address, setAddress] = useState<Address | null>(null)
  const [walletName, setWalletName] = useState<string | null>(null)
  const [walletChainId, setWalletChainId] = useState<number | null>(null)
  const [connecting, setConnecting] = useState<WalletId | null>(null)
  const [balanceUsdc, setBalanceUsdc] = useState<string | null>(null)
  const [txStage, setTxStage] = useState<{ kind: TxKind; stage: 'switch' | 'simulate' | 'sign' | 'mining' } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const provider = useRef<EIP1193Provider | null>(null)

  // Clear any legacy cached keys on mount; never auto-connect
  useEffect(() => {
    try {
      window.localStorage?.removeItem('diptos.wallet.v1')
      window.localStorage?.removeItem('diptos.arc.wallet.v2')
      window.localStorage?.removeItem('diptos.arc.wallet.v3')
    } catch {
      // ignore storage errors
    }
  }, [])

  // Passive EIP-6963 provider discovery (does not auto-connect)
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
    if (firstEip6963) return { provider: firstEip6963.provider, name: firstEip6963.info.name || 'Web3 Wallet' }

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
      const name = winEth.isRabby ? 'Rabby Wallet' : winEth.isMetaMask ? 'MetaMask' : 'Web3 Wallet'
      return { provider: winEth, name }
    }
    return null
  }, [eip6963])

  const refreshBalance = useCallback((targetAddress?: Address | null) => {
    const addr = targetAddress ?? address
    if (!addr) {
      setBalanceUsdc(null)
      return
    }
    publicClient()
      .getBalance({ address: addr })
      .then((wei) => {
        const val = Number(formatUnits(wei, ARC_NATIVE_DECIMALS))
        setBalanceUsdc(val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }))
      })
      .catch(() => {
        setBalanceUsdc(null)
      })
  }, [address])

  useEffect(() => {
    refreshBalance(address)
  }, [address, refreshBalance])

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
        const nextAddr = getAddress(accs[0])
        setAddress(nextAddr)
      }
    }
    const onChain = (id: string) => setWalletChainId(Number(id))
    p.on?.('accountsChanged', onAccounts as never)
    p.on?.('chainChanged', onChain as never)
  }, [])

  const connect = useCallback(
    async (id: WalletId = 'metamask'): Promise<Address | null> => {
      setError(null)
      setConnecting(id)
      try {
        const detected = resolveInjectedProvider()
        if (!detected) {
          setError(NO_WEB3_WALLET_MSG)
          return null
        }

        const accounts = (await detected.provider.request({
          method: 'eth_requestAccounts',
        } as never)) as string[]

        if (!accounts?.[0]) {
          setError('No wallet account authorized.')
          return null
        }

        const connectedAddress = getAddress(accounts[0])
        provider.current = detected.provider
        setAddress(connectedAddress)
        setWalletName(detected.name)
        const currentChainHex = (await detected.provider.request({ method: 'eth_chainId' })) as string
        setWalletChainId(Number(currentChainHex))
        attach(detected.provider)

        await switchToArc(detected.provider).catch(() => {})
        refreshBalance(connectedAddress)
        return connectedAddress
      } catch (e) {
        setError(decodeRevertError(e))
        return null
      } finally {
        setConnecting(null)
      }
    },
    [resolveInjectedProvider, attach, switchToArc, refreshBalance],
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
        let activeAddress = address
        let p = provider.current
        if (!p || !activeAddress) {
          activeAddress = await connect('metamask')
          p = provider.current
          if (!p || !activeAddress) {
            return null
          }
        }

        if (walletChainId !== ARC_CHAIN_ID) {
          setTxStage({ kind: req.kind, stage: 'switch' })
          await switchToArc(p)
        }

        const target = contractAddress(req.contract)
        const pc = publicClient()

        // Pre-flight simulateContract to catch & decode any custom revert error before opening wallet popup
        setTxStage({ kind: req.kind, stage: 'simulate' })
        await pc.simulateContract({
          address: target,
          abi: ABIS[req.contract],
          functionName: req.functionName,
          args: req.args,
          value: req.value,
          account: activeAddress,
        } as never)

        const wc = createWalletClient({ account: activeAddress, chain: arcTestnet, transport: custom(p) })

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
        refreshBalance(activeAddress)
        return {
          kind: req.kind,
          hash,
          blockNumber: rc.blockNumber.toString(),
          gasUsed: rc.gasUsed.toString(),
          status: rc.status,
          from: activeAddress,
          at: Date.now(),
        }
      } catch (e) {
        setError(decodeRevertError(e))
        return null
      } finally {
        setTxStage(null)
      }
    },
    [address, walletChainId, connect, switchToArc, refreshBalance],
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
        refreshBalance: () => refreshBalance(address),
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
