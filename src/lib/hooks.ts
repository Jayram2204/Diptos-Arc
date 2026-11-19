import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import type { ContractKey } from '@/config/protocol'
import { readProtocol } from './chain'
import {
  type ArcTelemetryResult,
  type BytecodeVerificationResult,
  diptos,
  type EscrowRecord,
  type GeminiRiskResult,
  type OracleStatusResult,
  type ProtocolEvent,
} from './sdk'

export type ReadState<T> =
  | { status: 'loading' }
  | { status: 'ok'; value: T }
  | { status: 'error'; error: string }

/** Live Arc Testnet (5042002) telemetry via @diptos/sdk */
export function useArcPulse(interval = 4000) {
  const [state, setState] = useState<{
    telemetry?: ArcTelemetryResult
    error?: string
  }>({})

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const telemetry = await diptos.getArcTelemetry()
        if (!alive) return
        setState({ telemetry })
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

  return {
    blockNumber: state.telemetry?.blockNumber,
    timestamp: state.telemetry?.blockTimestamp,
    baseFee: state.telemetry?.baseFeePerGas ?? state.telemetry?.gasPrice,
    gasPrice: state.telemetry?.gasPrice,
    latency: state.telemetry?.latencyMs,
    error: state.error,
  }
}

/** Live contract bytecode verification via @diptos/sdk verifyContractBytecode(address) */
export function useBytecode(address: Address) {
  const [state, setState] = useState<ReadState<BytecodeVerificationResult>>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    diptos
      .verifyContractBytecode(address)
      .then((res) => alive && setState({ status: 'ok', value: res }))
      .catch((e: Error) => alive && setState({ status: 'error', error: e.message.split('\n')[0] }))
    return () => {
      alive = false
    }
  }, [address])

  return state
}

/** Live on-chain escrows list via @diptos/sdk listEscrows() (polls every 4s by default) */
export function useEscrows(pollMs = 4000) {
  const [escrows, setEscrows] = useState<EscrowRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const list = await diptos.listEscrows()
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

/** Live Gemini Prediction Markets risk oracle via @diptos/sdk getLiveGeminiRisk() */
export function useGeminiRisk() {
  const [data, setData] = useState<GeminiRiskResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await diptos.getLiveGeminiRisk()
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

/** Live Grok EIP-712 Oracle status via @diptos/sdk getOracleStatus() */
export function useOracleStatus(pollMs = 15_000) {
  const [data, setData] = useState<OracleStatusResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await diptos.getOracleStatus()
        if (alive) {
          setData(res)
          setError(null)
        }
      } catch (e) {
        if (alive) setError((e as Error).message)
      }
    }
    load()
    const t = setInterval(load, pollMs)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [pollMs])

  return { data, error }
}

/**
 * Stateless QuickNode + Arc Testnet event feed (GET /api/events), ordered strictly by
 * blockNumber desc + logIndex desc for Vercel serverless compatibility.
 */
export function useProtocolEvents(
  onEventOrPollMs?: number | ((evt: ProtocolEvent) => void),
  pollMsArg = 4000,
) {
  const pollMs = typeof onEventOrPollMs === 'number' ? onEventOrPollMs : pollMsArg
  const onEvent = typeof onEventOrPollMs === 'function' ? onEventOrPollMs : undefined
  const [events, setEvents] = useState<ProtocolEvent[]>([])
  const [connected, setConnected] = useState(false)
  const seenRef = useRef<Set<string>>(new Set())
  const cbRef = useRef(onEvent)
  cbRef.current = onEvent

  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const res = await diptos.getEvents(25)
        if (!alive) return
        const next = res.events ?? []
        for (const evt of next) {
          if (!seenRef.current.has(evt.id)) {
            seenRef.current.add(evt.id)
            if (seenRef.current.size > next.length) cbRef.current?.(evt)
          }
        }
        setEvents(next)
        setConnected(true)
      } catch {
        if (alive) setConnected(false)
      }
    }
    void poll()
    const t = setInterval(() => void poll(), pollMs)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [pollMs])

  return { events, connected }
}

export const useQuickNodeStream = useProtocolEvents

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
    void run()
    const t = setInterval(() => void run(), interval)
    return () => {
      alive = false
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, functionName, argsKey, interval])

  const refresh = useCallback(() => ref.current(), [])
  return Object.assign({}, state, { refresh })
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
