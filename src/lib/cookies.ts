import { useCallback, useEffect, useState } from 'react'

export type DynamicCookieKey =
  | 'diptos_splash_seen'
  | 'diptos_chain'
  | 'diptos_mode'
  | 'diptos_consent'
  | 'diptos_ref'

export type CookieConsentState = 'pending' | 'essential' | 'accepted'

const COOKIE_EVENT = 'diptos:cookies-changed'
const DEFAULT_MAX_AGE = 60 * 60 * 24 * 180 // 180 days

export function readCookie(name: DynamicCookieKey): string | null {
  if (typeof document === 'undefined') return null
  const parts = document.cookie.split(';')
  for (const part of parts) {
    const [rawK, ...rest] = part.trim().split('=')
    if (rawK === name) {
      return decodeURIComponent(rest.join('='))
    }
  }
  return null
}

/**
 * Write a SameSite=Lax (+ Secure on HTTPS) cookie.
 * Pass `maxAgeSec = null` for a browser-session-scoped cookie (e.g. `diptos_splash_seen`).
 */
export function writeCookie(
  name: DynamicCookieKey,
  value: string,
  maxAgeSec: number | null = DEFAULT_MAX_AGE,
): void {
  if (typeof document === 'undefined') return
  const attrs = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax']
  if (maxAgeSec !== null) {
    attrs.push(`Max-Age=${maxAgeSec}`)
  }
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    attrs.push('Secure')
  }
  document.cookie = attrs.join('; ')
  window.dispatchEvent(new Event(COOKIE_EVENT))
}

export function clearCookie(name: DynamicCookieKey): void {
  writeCookie(name, '', 0)
}

export interface DynamicCookiePreferences {
  consent: CookieConsentState
  splashSeen: boolean
  chain: string | null
  mode: 'human' | 'agent' | null
  ref: string | null
}

function snapshotPreferences(): DynamicCookiePreferences {
  const rawConsent = readCookie('diptos_consent')
  const consent: CookieConsentState =
    rawConsent === 'accepted' ? 'accepted' : rawConsent === 'essential' ? 'essential' : 'pending'
  const rawMode = readCookie('diptos_mode')
  const mode = rawMode === 'agent' || rawMode === 'human' ? rawMode : null
  return {
    consent,
    splashSeen: readCookie('diptos_splash_seen') === '1',
    chain: readCookie('diptos_chain'),
    mode,
    ref: readCookie('diptos_ref'),
  }
}

/**
 * Typed client preference cookie helper.
 * Non-essential preference cookies (`diptos_chain`, `diptos_mode`, `diptos_ref`) are gated
 * behind explicit user consent (`diptos_consent=accepted`) and default OFF.
 * `diptos_splash_seen` is an essential session-scoped UI state cookie.
 */
export function useDynamicCookies() {
  const [prefs, setPrefs] = useState<DynamicCookiePreferences>(snapshotPreferences)

  useEffect(() => {
    const sync = () => setPrefs(snapshotPreferences())
    window.addEventListener(COOKIE_EVENT, sync)
    return () => window.removeEventListener(COOKIE_EVENT, sync)
  }, [])

  const setConsent = useCallback((next: 'essential' | 'accepted') => {
    writeCookie('diptos_consent', next)
    if (next === 'essential') {
      clearCookie('diptos_chain')
      clearCookie('diptos_mode')
      clearCookie('diptos_ref')
    } else if (typeof window !== 'undefined') {
      const refParam = new URLSearchParams(window.location.search).get('ref')
      if (refParam && /^[a-zA-Z0-9_-]{2,32}$/.test(refParam)) {
        writeCookie('diptos_ref', refParam)
      }
    }
  }, [])

  const markSplashSeen = useCallback(() => {
    writeCookie('diptos_splash_seen', '1', null)
  }, [])

  const setPreference = useCallback(
    (key: Exclude<DynamicCookieKey, 'diptos_consent' | 'diptos_splash_seen'>, value: string) => {
      if (readCookie('diptos_consent') !== 'accepted') return
      writeCookie(key, value)
    },
    [],
  )

  return {
    ...prefs,
    setConsent,
    markSplashSeen,
    setPreference,
  }
}
