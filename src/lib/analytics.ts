import { readCookie } from './cookies'

export type FunnelEventName =
  | 'landing_cta_click'
  | 'wallet_connected'
  | 'link_created'
  | 'escrow_funded'
  | 'escrow_settled'

export interface FunnelEventRecord {
  event: FunnelEventName
  timestamp: string
  path: string
  meta?: Record<string, string | number | boolean>
}

const EVENT_BUFFER_KEY = '__diptos_funnel_events'

/**
 * Lightweight, privacy-respecting funnel instrumentation.
 * Strictly gated behind `diptos_consent=accepted`; emits zero network/storage calls otherwise.
 */
export function trackFunnelEvent(
  event: FunnelEventName,
  meta?: Record<string, string | number | boolean>,
): void {
  if (typeof window === 'undefined') return
  if (readCookie('diptos_consent') !== 'accepted') return

  const record: FunnelEventRecord = {
    event,
    timestamp: new Date().toISOString(),
    path: window.location.pathname,
    meta,
  }

  const w = window as unknown as Record<string, FunnelEventRecord[]>
  const buf = Array.isArray(w[EVENT_BUFFER_KEY]) ? w[EVENT_BUFFER_KEY] : []
  buf.push(record)
  if (buf.length > 50) buf.shift()
  w[EVENT_BUFFER_KEY] = buf

  window.dispatchEvent(new CustomEvent('diptos:funnel', { detail: record }))
}
