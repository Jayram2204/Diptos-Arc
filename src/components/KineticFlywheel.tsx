import { useCallback, useEffect, useState } from 'react'
import { readCookie, writeCookie } from '@/lib/cookies'

/**
 * Custom Precision SVG Settlement Wheel — Crisp White (#FFFFFF) for dark institutional surfaces:
 * - Outer concentric precision rings
 * - 24 radial CNC-style degree ticks
 * - 6 geometric spokes in #FFFFFF
 * - High-contrast #FFFFFF calibration notch at 12 o'clock
 */
export function SettlementWheelSvg({
  size = 120,
  className = '',
}: {
  size?: number
  className?: string
}) {
  const ticks = Array.from({ length: 24 }, (_, i) => i * 15)
  const spokes = Array.from({ length: 6 }, (_, i) => i * 60)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer concentric precision rings */}
      <circle cx="60" cy="60" r="56" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.92" />
      <circle cx="60" cy="60" r="46" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.3" />

      {/* 24 radial CNC-style degree ticks */}
      {ticks.map((deg) => {
        const isMajor = deg % 90 === 0
        return (
          <line
            key={deg}
            x1="60"
            y1={isMajor ? '5.5' : '7.5'}
            x2="60"
            y2="12.5"
            stroke="#FFFFFF"
            strokeWidth={isMajor ? '1.6' : '1'}
            strokeOpacity={isMajor ? '0.95' : '0.45'}
            transform={`rotate(${deg} 60 60)`}
          />
        )
      })}

      {/* 6 geometric spokes */}
      {spokes.map((deg) => (
        <line
          key={deg}
          x1="60"
          y1="20"
          x2="60"
          y2="46"
          stroke="#FFFFFF"
          strokeWidth="2.4"
          strokeLinecap="round"
          transform={`rotate(${deg} 60 60)`}
        />
      ))}

      {/* Inner hub ring + core */}
      <circle cx="60" cy="60" r="16" stroke="#FFFFFF" strokeWidth="2" fill="#000000" />
      <circle cx="60" cy="60" r="4.5" fill="#FFFFFF" />

      {/* Crisp white calibration notch at 12 o'clock */}
      <rect x="57" y="1.5" width="6" height="14" rx="1.5" fill="#FFFFFF" />
    </svg>
  )
}

function RadialBurstLines({ size }: { size: number }) {
  const rays = Array.from({ length: 8 }, (_, i) => i * 45)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 180 180"
      fill="none"
      className="pointer-events-none absolute inset-0 m-auto"
      aria-hidden="true"
    >
      {rays.map((deg) => (
        <line
          key={deg}
          x1="90"
          y1="8"
          x2="90"
          y2="24"
          stroke="#FFFFFF"
          strokeWidth={deg === 0 ? '2.4' : '1.5'}
          strokeLinecap="round"
          strokeOpacity={deg === 0 ? '1' : '0.55'}
          transform={`rotate(${deg} 90 90)`}
        />
      ))}
    </svg>
  )
}

/**
 * Compact 28px–36px interactive Settlement Wheel emblem in crisp white (#FFFFFF).
 * Spins 720deg with white radial burst + shockwave whenever clicked, double-tapped, or externally triggered.
 */
export function InteractiveFlywheelEmblem({
  size = 28,
  externalTrigger = 0,
  onSpin,
  ariaLabel = 'Spin Diptos settlement wheel',
}: {
  size?: number
  externalTrigger?: number
  onSpin?: () => void
  ariaLabel?: string
}) {
  const [burstKey, setBurstKey] = useState(0)

  useEffect(() => {
    if (externalTrigger > 0) {
      setBurstKey((k) => k + 1)
    }
  }, [externalTrigger])

  const trigger = useCallback(() => {
    setBurstKey((k) => k + 1)
    onSpin?.()
  }, [onSpin])

  const outerSize = Math.round(size * 1.55)

  return (
    <button
      type="button"
      onClick={trigger}
      onDoubleClick={trigger}
      aria-label={ariaLabel}
      title="Click or double-tap to spin settlement wheel"
      className="relative inline-grid shrink-0 cursor-pointer place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFFFF]"
      style={{ width: size, height: size }}
    >
      {burstKey > 0 && (
        <>
          <span
            key={`burst-${burstKey}`}
            className="animate-flywheel-burst pointer-events-none absolute"
            style={{ width: outerSize, height: outerSize }}
          >
            <RadialBurstLines size={outerSize} />
          </span>
          <span
            key={`wave-${burstKey}`}
            className="animate-flywheel-inline-shockwave pointer-events-none absolute rounded-full border border-[#FFFFFF]/70"
            style={{ width: size, height: size }}
          />
        </>
      )}
      <span
        key={`wheel-${burstKey}`}
        className={burstKey > 0 ? 'animate-flywheel-inline block will-change-transform' : 'block'}
      >
        <SettlementWheelSvg size={size} />
      </span>
    </button>
  )
}

/**
 * Full-screen 3-stage Kinetic Cryptographic Flywheel Preloader (apex diptos.xyz only):
 * - Pitch-black #000000 backdrop with pure white (#FFFFFF) 120px precision settlement wheel
 * - Stage 1 (0–650ms): Inertial spin-up (scale 0.72 -> 1.0, 540deg) + 8 white radial burst lines
 * - Stage 2 (650–1050ms): Detent lock at 720deg + white 1px shockwave + ARC 5042002 telemetry in #F4F2EC
 * - Stage 3 (1050–1400ms): Smooth upward curtain reveal translateY(-100%) + unmount
 * - Hard 1550ms unconditional failsafe + sessionStorage once-per-session guard
 */
export function KineticFlywheel() {
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
      return readCookie('diptos_splash_seen') !== '1'
    } catch {
      return false
    }
  })
  const [locked, setLocked] = useState(false)
  const [exiting, setExiting] = useState(false)

  const dismissNow = useCallback(() => {
    writeCookie('diptos_splash_seen', '1', null)
    setExiting(true)
    setVisible(false)
  }, [])

  useEffect(() => {
    if (!visible) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    writeCookie('diptos_splash_seen', '1', null)

    const tLock = window.setTimeout(() => setLocked(true), 1350)
    const tExit = window.setTimeout(() => setExiting(true), 2100)
    const tDone = window.setTimeout(() => setVisible(false), 2500)
    // Hard 2.65s unconditional failsafe so overlay can never freeze
    const tFailsafe = window.setTimeout(() => setVisible(false), 2650)

    return () => {
      document.body.style.overflow = prevOverflow
      window.clearTimeout(tLock)
      window.clearTimeout(tExit)
      window.clearTimeout(tDone)
      window.clearTimeout(tFailsafe)
    }
  }, [visible])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-label="Initializing Diptos Settlement Engine"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#000000] text-[#F4F2EC] transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
        exiting ? 'pointer-events-none -translate-y-full' : 'translate-y-0'
      }`}
    >
      <div className="relative flex size-[180px] items-center justify-center">
        {/* 8 crisp white radial burst lines flaring outward in Stage 1 */}
        <div className="animate-flywheel-burst pointer-events-none absolute inset-0">
          <RadialBurstLines size={180} />
        </div>

        {/* White 1px expanding shockwave ring in Stage 2 */}
        <span
          aria-hidden="true"
          className="animate-flywheel-shockwave pointer-events-none absolute size-[120px] rounded-full border border-[#FFFFFF]/75 opacity-0"
        />

        {/* 120px Pure White Precision Settlement Wheel */}
        <div className="animate-flywheel-spin will-change-transform">
          <SettlementWheelSvg size={120} />
        </div>
      </div>

      {/* Stage 2 Detent Telemetry */}
      <div
        className={`mt-6 flex items-center gap-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[#F4F2EC] transition-opacity duration-200 ${
          locked ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span className="inline-block size-2 rounded-full bg-[#FFFFFF]" />
        <span>ARC 5042002 // SETTLEMENT ENGINE READY</span>
      </div>

      {/* High-Contrast Skip Pill */}
      <button
        type="button"
        onClick={dismissNow}
        className="fixed bottom-6 right-6 whitespace-nowrap rounded-full border border-[#E5E7EB]/40 bg-[#000000] px-4 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#E5E7EB] transition-colors hover:border-[#FFFFFF] hover:text-[#FFFFFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFFFF]"
      >
        SKIP →
      </button>
    </div>
  )
}
