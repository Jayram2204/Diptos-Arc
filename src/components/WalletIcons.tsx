/** Monochrome / duotone wallet marks rendered on #16213E tiles. */

export function CoinbaseIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" fill="none" stroke="#60A5FA" strokeWidth="2.4" />
      <rect x="9" y="9" width="6" height="6" rx="1" fill="#F8F8FF" />
    </svg>
  )
}

export function MetaMaskIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" strokeLinejoin="round">
      {/* Geometric fox head */}
      <path d="M3 3.5 10 8.6h4L21 3.5l-1.6 6.3L21 15l-2 5.5-4.6-1.3L12 20.5l-2.4-1.3L5 20.5 3 15l1.6-5.2z" fill="#EFC07B" fillOpacity=".18" stroke="#EFC07B" strokeWidth="1.3" />
      <path d="M10 8.6 7.8 13l2.4 1.2L12 13l1.8 1.2 2.4-1.2L14 8.6" stroke="#EFC07B" strokeWidth="1.3" />
      <path d="m10.2 14.2-.6 5M13.8 14.2l.6 5" stroke="#BEA98E" strokeWidth="1.1" />
    </svg>
  )
}

export function WalletConnectIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="#B0C4DE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.2 9.2c3.8-3.6 9.8-3.6 13.6 0" />
      <path d="m3 11.6 3.2 3.1 3-2.9 2.8 2.7 2.8-2.7 3 2.9 3.2-3.1" />
    </svg>
  )
}
