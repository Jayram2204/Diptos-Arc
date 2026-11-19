import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address, Hex } from 'viem'
import { type ContractKey } from '@/config/protocol'
import {
  type EscrowRecord,
  fetchEscrows,
  fetchGeminiRisk,
  type GeminiRiskSnapshot,
  type StreamEvent,
} from './api'
import { publicClient, readProtocol } from './chain'

export type ReadState<T> =
  | { status: 'loading' }
  | { status: 'ok'; value: T }
  | { status: 'error'; error: string }

/** Live chain pulse straight from the Arc Testnet (5042002) RPC. */
export function useArcPulse(interval = 4000) {
  const [state, setState] = useState<{
    blockNumber?: bigint
    timestamp?: bigint
    blockAgeSec?: number
    baseFee?: bigint
    latency?: number
    error?: string
  }>({})

  useEffect(() => {
    let alive = true
    const client = publicClient()
    const tick = async () => {
      const t0 = performance.now()
      try {
        const block = await client.getBlock({ blockTag: 'latest' })
        if (!alive) return
        const nowSec = Math.floor(Date.now() / 1000)
        setState({
          blockNumber: block.number ?? undefined,
          timestamp: block.timestamp,
          blockAgeSec: Math.max(0, nowSec - Number(block.timestamp)),
          baseFee: block.baseFeePerGas ?? undefined,
          latency: Math.round(performance.now() - t0),
        })
      } catch (e) {
        if (alive) setState((s) => ({ ...s, error: (e as Error).message.split('\n')[0] }))
      }
    }
    tick()
    const t = setInterval(tick, interval)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [interval])

  return state
}

/** Poll a protocol view function on Arc Testnet. */
export function useProtocolRead<T>(
  key: ContractKey,
  functionName: string,
  args: readonly unknown[] | null = [],
  interval = 12000,
): ReadState<T> & { refresh: () => void } {
  const [state, setState] = useState<ReadState<T>>({ status: 'loading' })
  const argsKey = JSON.stringify(args, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  const ref = useRef<() => void>(() => {})

  useEffect(() => {
    if (args === null) {
      setState({ status: 'loading' })
      return
    }
    let alive = true
    const run = async () => {
      try {
        const value = await readProtocol<T>(key, functionName, args)
        if (alive) setState({ status: 'ok', value })
      } catch (e) {
        if (alive) setState({ status: 'error', error: (e as Error).message.split('\n')[0] })
      }
    }
    ref.current = run
    run()
    const t = setInterval(run, interval)
    return () => {
      alive = false
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, functionName, argsKey, interval])

  const refresh = useCallback(() => ref.current(), [])
  return Object.assign({}, state, { refresh })
}

/** Bytecode presence check via live eth_getCode against Arc Testnet. */
export function useBytecode(address: Address) {
  const [state, setState] = useState<ReadState<number>>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    publicClient()
      .getCode({ address })
      .then((code: Hex | undefined) => {
        if (!alive) return
        const bytes = code && code !== '0x' ? (code.length - 2) / 2 : 0
        setState({ status: 'ok', value: bytes })
      })
      .catch((e: Error) => alive && setState({ status: 'error', error: e.message.split('\n')[0] }))
    return () => {
      alive = false
    }
  }, [address])
  return state
}

/** Live escrows list from /api/escrows */
export function useEscrows(pollMs = 15_000) {
  const [escrows, setEscrows] = useState<EscrowRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const list = await fetchEscrows()
      setEscrows(list)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, pollMs)
    return () => clearInterval(t)
  }, [refresh, pollMs])

  return { escrows, loading, error, refresh }
}

/** Live Gemini Prediction Markets risk oracle from /api/risk/gemini */
export function useGeminiRisk() {
  const [data, setData] = useState<GeminiRiskSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await fetchGeminiRisk()
      setData(snap)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}

/** Live QuickNode Streams SSE subscription (/api/events/stream) */
export function useQuickNodeStream() {
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let es: EventSource | null = null
    try {
      es = new EventSource('/api/events/stream')
      es.onopen = () => setConnected(true)
      es.onerror = () => setConnected(false)

      es.addEventListener('snapshot', (e) => {
        try {
          const parsed = JSON.parse((e as MessageEvent).data) as { events?: StreamEvent[] }
          if (Array.isArray(parsed.events)) setEvents(parsed.events)
          setConnected(true)
        } catch {
          // ignore malformed event
        }
      })

      es.addEventListener('quicknode', (e) => {
        try {
          const evt = JSON.parse((e as MessageEvent).data) as StreamEvent
          setEvents((prev) => [evt, ...prev].slice(0, 30))
          setConnected(true)
        } catch {
          // ignore malformed event
        }
      })
    } catch {
      setConnected(false)
    }
    return () => {
      es?.close()
    }
  }, [])

  return { events, connected }
}

export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(text)
      setTimeout(() => setCopied((c) => (c === text ? null : c)), 1400)
    } catch {
      /* clipboard unavailable */
    }
  }, [])
  return { copied, copy }
}
