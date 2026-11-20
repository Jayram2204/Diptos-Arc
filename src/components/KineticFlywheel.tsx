import { useEffect, useState } from 'react'

const SESSION_KEY = 'diptos:preloader:seen'

/**
 * Pure white (#FFFFFF) KineticFlywheel preloader/emblem with a strict 1.55s failsafe
 * and sessionStorage guard so it never blocks returning views or crawlers.
 */
export function KineticFlywheel() {
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.sessionStorage.getItem(SESSION_KEY) !== '1'
    } catch {
      return false
    }
  })
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (!visible) return
    const fadeTimer = setTimeout(() => setFading(true), 1150)
    const doneTimer = setTimeout(() => {
      try {
        window.sessionStorage.setItem(SESSION_KEY, '1')
      } catch {
        // ignore storage restrictions
      }
      setVisible(false)
    }, 1550)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [visible])

  if (!visible) return null

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black transition-opacity duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <svg
        viewBox="0 0 64 64"
        className="size-12 animate-spin text-white"
        style={{ animationDuration: '1.4s' }}
        fill="none"
      >
        <circle cx="32" cy="32" r="26" stroke="#FFFFFF" strokeOpacity="0.18" strokeWidth="2" />
        <path
          d="M32 6 A26 26 0 0 1 58 32"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <rect x="23" y="21" width="6.5" height="22" rx="1.2" fill="#FFFFFF" />
        <path d="M33 21H35.5C40 21 43 25.5 43 32S40 43 35.5 43H33V21Z" fill="#FFFFFF" />
      </svg>
      <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/75">
        DIPTOS // ARC 5042002
      </p>
    </div>
  )
}

export function InteractiveFlywheelEmblem({
  size = 32,
  className = '',
  ariaLabel = 'Diptos Emblem',
}: {
  size?: number
  externalTrigger?: number
  ariaLabel?: string
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`text-white ${className}`}
      fill="none"
      aria-label={ariaLabel}
    >
      <circle cx="32" cy="32" r="26" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="2" />
      <path d="M32 6 A26 26 0 0 1 58 32" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="23" y="21" width="6.5" height="22" rx="1.2" fill="#FFFFFF" />
      <path d="M33 21H35.5C40 21 43 25.5 43 32S40 43 35.5 43H33V21Z" fill="#FFFFFF" />
    </svg>
  )
}
