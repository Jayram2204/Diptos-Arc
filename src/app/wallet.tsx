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

export type WalletId = 'metamask' | 'coinbase' | 'judge'
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

const LAST_WALLET_KEY = 'diptos.arc.wallet.v3'
const JUDGE_WALLET_ADDRESS: Address = '0x344d7adf93542C6c27a11bb53A2d7C9d909D9f34'

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
  const [isJudgeMode, setIsJudgeMode] = useState(false)
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

  const resolveInjectedProvider = useCallback((): { provider: EIP1193Provider; name: string } | null => {
    if (eip6963['io.metamask']) return { provider: eip6963['io.metamask'].provider, name: 'MetaMask' }
    if (eip6963['io.rabby']) return { provider: eip6963['io.rabby'].provider, name: 'Rabby Wallet' }
    if (eip6963['app.phantom']) return { provider: eip6963['app.phantom'].provider, name: 'Phantom' }
    if (eip6963['me.rainbow']) return { provider: eip6963['me.rainbow'].provider, name: 'Rainbow' }
    const firstEip6963 = Object.values(eip6963)[0]
    if (firstEip6963) return { provider: firstEip6963.provider, name: firstEip6963.info.name || 'Browser Wallet' }

    const winEth = (
      window as unknown as {
        ethereum?: EIP1193Provider & {
          isMetaMask?: boolean
          isCoinbaseWallet?: boolean
          providers?: (EIP1193Provider & { isMetaMask?: boolean })[]
        }
      }
    ).ethereum

    if (winEth?.providers?.length) {
      const mm = winEth.providers.find((p) => p.isMetaMask) ?? winEth.providers[0]
      return { provider: mm, name: 'MetaMask' }
    }
    if (winEth) {
      return { provider: winEth, name: winEth.isMetaMask ? 'MetaMask' : 'Browser Wallet' }
    }
    return null
  }, [eip6963])

  const coinbaseInjected =
    eip6963['com.coinbase.wallet']?.provider ??
    ((window as unknown as { ethereum?: EIP1193Provider & { isCoinbaseWallet?: boolean } }).ethereum?.isCoinbaseWallet
      ? (window as unknown as { ethereum: EIP1193Provider }).ethereum
      : null)

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
      setIsJudgeMode(false)
      setAddress(getAddress(accounts[0]))
      setWalletName(name)
      setWalletChainId(Number(await p.request({ method: 'eth_chainId' })))
      attach(p)
      return true
    },
    [attach],
  )

  const connectJudgeWallet = useCallback(async () => {
    provider.current = null
    setIsJudgeMode(true)
    setAddress(JUDGE_WALLET_ADDRESS)
    setWalletName('Arc Testnet Judge Wallet')
    setWalletChainId(ARC_CHAIN_ID)
    localStorage.setItem(LAST_WALLET_KEY, 'judge')
  }, [])

  const connect = useCallback(
    async (id: WalletId = 'metamask') => {
      setError(null)
      setConnecting(id)
      try {
        if (id === 'judge') {
          await connectJudgeWallet()
          return
        }

        if (id === 'metamask') {
          const detected = resolveInjectedProvider()
          if (!detected) {
            // In browsers without an injected wallet extension (e.g. IDE preview / Safari),
            // connect seamlessly to the live funded Arc Testnet Judge Wallet so 1-click testing works!
            await connectJudgeWallet()
            return
          }
          const ok = await finishConnect(detected.provider, detected.name, true)
          if (ok) {
            localStorage.setItem(LAST_WALLET_KEY, 'metamask')
            await switchToArc(detected.provider).catch(() => {})
          }
          return
        }

        // Coinbase Wallet
        let p = coinbaseInjected
        if (!p) {
          const { createCoinbaseWalletSDK } = await import('@coinbase/wallet-sdk')
          const sdk = createCoinbaseWalletSDK({
            appName: 'Diptos on Arc',
            appChainIds: [ARC_CHAIN_ID],
          })
          p = sdk.getProvider() as unknown as EIP1193Provider
        }
        const ok = await finishConnect(p, 'Coinbase Wallet', true)
        if (ok) {
          localStorage.setItem(LAST_WALLET_KEY, 'coinbase')
          await switchToArc(p).catch(() => {})
        }
      } catch (e) {
        setError(errMsg(e))
      } finally {
        setConnecting(null)
      }
    },
    [resolveInjectedProvider, coinbaseInjected, finishConnect, switchToArc, connectJudgeWallet],
  )

  useEffect(() => {
    const last = localStorage.getItem(LAST_WALLET_KEY) as WalletId | null
    if (address || !last) return
    if (last === 'judge') {
      void connectJudgeWallet()
      return
    }
    if (last === 'metamask') {
      const detected = resolveInjectedProvider()
      if (detected) finishConnect(detected.provider, detected.name, false).catch(() => {})
    } else if (last === 'coinbase' && coinbaseInjected) {
      finishConnect(coinbaseInjected, 'Coinbase Wallet', false).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveInjectedProvider, coinbaseInjected])

  const disconnect = useCallback(() => {
    provider.current = null
    setIsJudgeMode(false)
    localStorage.removeItem(LAST_WALLET_KEY)
    setAddress(null)
    setWalletName(null)
    setWalletChainId(null)
    setBalanceUsdc(null)
  }, [])

  const execute = useCallback(
    async (req: TxRequest): Promise<Receipt | null> => {
      setError(null)
      try {
        let activeAddress = address
        let activeJudgeMode = isJudgeMode
        if (!activeAddress) {
          const detected = resolveInjectedProvider()
          if (detected) {
            const accounts = (await detected.provider.request({
              method: 'eth_requestAccounts',
            } as never)) as string[]
            if (accounts?.[0]) {
              provider.current = detected.provider
              setIsJudgeMode(false)
              activeJudgeMode = false
              activeAddress = getAddress(accounts[0])
              setAddress(activeAddress)
              setWalletName(detected.name)
              setWalletChainId(Number(await detected.provider.request({ method: 'eth_chainId' })))
              attach(detected.provider)
              localStorage.setItem(LAST_WALLET_KEY, 'metamask')
            }
          }
          if (!activeAddress) {
            await connectJudgeWallet()
            activeAddress = JUDGE_WALLET_ADDRESS
            activeJudgeMode = true
          }
        }

        // Judge Wallet mode: execute real on-chain transaction via funded Arc Testnet server relayer
        if (activeJudgeMode || !provider.current) {
          setTxStage({ kind: req.kind, stage: 'mining' })
          const res = await fetch('/api/wallet/relay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              functionName: req.functionName,
              args: req.args.map((a) => (typeof a === 'bigint' ? a.toString() : a)),
              valueWei: req.value ? req.value.toString() : '0',
            }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            throw new Error(data?.error || `Arc relay failed (${res.status})`)
          }
          refreshBalance()
          return {
            kind: req.kind,
            hash: data.hash as Hex,
            blockNumber: String(data.blockNumber),
            gasUsed: String(data.gasUsed),
            status: data.status === 'reverted' ? 'reverted' : 'success',
            from: (data.from as Address) ?? activeAddress,
            at: Date.now(),
          }
        }

        const p = provider.current
        if (walletChainId !== ARC_CHAIN_ID) {
          setTxStage({ kind: req.kind, stage: 'switch' })
          await switchToArc(p)
        }
        const target = contractAddress(req.contract)
        const wc = createWalletClient({ account: activeAddress, chain: arcTestnet, transport: custom(p) })
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
          from: activeAddress,
          at: Date.now(),
        }
      } catch (e) {
        setError(errMsg(e))
        return null
      } finally {
        setTxStage(null)
      }
    },
    [address, isJudgeMode, walletChainId, switchToArc, refreshBalance, resolveInjectedProvider, attach, connectJudgeWallet],
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
