/** Geometric Diptych emblem — institutional Swiss mark in #F9FAFB & Sovereign Gold #E5A93B. */
export function LogoMark({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden>
      <rect x="3" y="3" width="8.5" height="22" rx="1.5" fill="#F9FAFB" />
      <path d="M14.5 3H17C22 3 25.5 7.8 25.5 14S22 25 17 25h-2.5V3Z" fill="#E5A93B" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className="size-6" />
      <span className="font-display text-[16px] font-bold tracking-[-0.03em] text-primary">Diptos</span>
    </span>
  )
}
