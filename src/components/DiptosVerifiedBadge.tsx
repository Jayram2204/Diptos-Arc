import { useState } from 'react'
import { ArrowUpRight, Check, Download, Share2, ShieldCheck, Zap } from 'lucide-react'
import { ESCROW_CONTRACT_ADDRESS } from '@/config/protocol'
import { explorerUrl, fmtAmount, shortHex } from '@/lib/chain'
import { CopyButton } from './ui'

export function DiptosVerifiedBadge({
  size = 'sm',
  className = '',
}: {
  size?: 'xs' | 'sm' | 'md'
  className?: string
}) {
  const sizeCls =
    size === 'xs'
      ? 'px-2 py-0.5 text-[9.5px] gap-1'
      : size === 'md'
        ? 'px-3.5 py-1.5 text-[11px] gap-1.5'
        : 'px-2.5 py-1 text-[10px] gap-1.5'

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border border-lime/50 bg-[#0B0D12] font-mono font-bold uppercase tracking-[0.12em] text-lime shadow-[0_0_16px_rgba(200,255,0,0.14)] ${sizeCls} ${className}`}
    >
      <ShieldCheck className={size === 'xs' ? 'size-3' : 'size-3.5'} />
      <span>DIPTOS VERIFIED ✓</span>
    </span>
  )
}

export interface VerifiedReceiptProps {
  escrowId: string
  escrowIdBytes32: string
  title: string
  amountUsdc: number
  proofHash?: string
  txHash?: string
  shareUrl: string
  settledAt?: string
}

function downloadVerifiedReceiptPng(props: VerifiedReceiptProps) {
  if (typeof document === 'undefined') return
  const w = 1200
  const h = 630
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Dark background
  ctx.fillStyle = '#07080C'
  ctx.fillRect(0, 0, w, h)

  // Subtle card frame
  ctx.fillStyle = '#0B0D12'
  ctx.strokeStyle = 'rgba(200, 255, 0, 0.35)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(36, 36, w - 72, h - 72, 24)
  ctx.fill()
  ctx.stroke()

  // Top badge pill
  ctx.fillStyle = 'rgba(200, 255, 0, 0.12)'
  ctx.strokeStyle = '#C8FF00'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(76, 76, 260, 42, 21)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#C8FF00'
  ctx.font = '700 16px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText('DIPTOS VERIFIED ✓', 106, 103)

  // Arc finality pill
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)'
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)'
  ctx.beginPath()
  ctx.roundRect(w - 310, 76, 234, 42, 21)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#34D399'
  ctx.font = '700 15px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText('<1S ARC FINALITY', w - 282, 103)

  // Title
  ctx.fillStyle = '#F4F2EC'
  ctx.font = '700 34px -apple-system, BlinkMacSystemFont, Inter, sans-serif'
  const cleanTitle = (props.title || 'Verified Native USDC Settlement').slice(0, 46)
  ctx.fillText(cleanTitle, 76, 182)

  // Amount settled
  ctx.fillStyle = '#C8FF00'
  ctx.font = '700 54px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText(`${fmtAmount(props.amountUsdc)} USDC`, 76, 262)

  ctx.fillStyle = '#9CA3AF'
  ctx.font = '500 16px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText('NON-CUSTODIAL NATIVE USDC SETTLEMENT · ARC TESTNET (5042002)', 76, 300)

  // Metadata rows
  const rows: Array<[string, string]> = [
    ['ESCROW ID', props.escrowIdBytes32],
    ['PROOF HASH', props.proofHash || 'On-Chain Verified Settlement'],
    ['ARC TX / CONTRACT', props.txHash || ESCROW_CONTRACT_ADDRESS],
  ]

  let y = 365
  for (const [label, val] of rows) {
    ctx.fillStyle = '#9CA3AF'
    ctx.font = '600 13px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillText(label, 76, y)
    ctx.fillStyle = '#F4F2EC'
    ctx.font = '500 16px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillText(val.length > 58 ? `${val.slice(0, 32)}…${val.slice(-22)}` : val, 270, y)
    y += 46
  }

  // Footer
  ctx.strokeStyle = 'rgba(244, 242, 236, 0.12)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(76, 520)
  ctx.lineTo(w - 76, 520)
  ctx.stroke()

  ctx.fillStyle = '#9CA3AF'
  ctx.font = '500 15px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText('diptos.xyz  •  app.diptos.xyz  •  Deterministic Proof-Gated Settlement', 76, 558)

  const link = document.createElement('a')
  link.download = `diptos-verified-${props.escrowId.slice(0, 12)}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

export function VerifiedSettlementReceiptCard(props: VerifiedReceiptProps) {
  const [copied, setCopied] = useState(false)

  const handleShareCopy = async () => {
    try {
      await navigator.clipboard.writeText(props.shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore clipboard errors
    }
  }

  const arcLink = props.txHash
    ? explorerUrl('tx', props.txHash)
    : explorerUrl('address', ESCROW_CONTRACT_ADDRESS)

  const displayProof = props.proofHash && !/^0x0+$/.test(props.proofHash) ? props.proofHash : props.escrowIdBytes32

  return (
    <div className="mt-5 rounded-2xl border border-lime/35 bg-[#090B10] p-5 shadow-[0_0_28px_rgba(200,255,0,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper/10 pb-3.5">
        <DiptosVerifiedBadge size="md" />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald/40 bg-emerald/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald">
          <Zap className="size-3" />
          &lt;1s Arc Finality
        </span>
      </div>

      <dl className="mt-4 space-y-2.5 font-mono text-[11.5px]">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-secondary">USDC Settled</dt>
          <dd className="text-[14px] font-bold text-lime">{fmtAmount(props.amountUsdc)} USDC</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-secondary">Escrow ID</dt>
          <dd className="flex items-center gap-1.5 text-paper">
            <span>{shortHex(props.escrowIdBytes32, 10, 8)}</span>
            <CopyButton value={props.escrowIdBytes32} label="Copy escrow ID" />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-secondary">Proof Hash</dt>
          <dd className="flex items-center gap-1.5 text-paper">
            <span>{shortHex(displayProof, 10, 8)}</span>
            <CopyButton value={displayProof} label="Copy proof hash" />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-secondary">On-Chain Proof</dt>
          <dd>
            <a
              href={arcLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald hover:underline"
            >
              {props.txHash ? shortHex(props.txHash, 10, 6) : 'View on ArcScan'}
              <ArrowUpRight className="size-3.5" />
            </a>
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-paper/10 pt-4">
        <button
          type="button"
          onClick={() => void handleShareCopy()}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-lime px-4 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink transition-colors hover:bg-[#d8ff4d]"
        >
          {copied ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
          {copied ? 'Receipt Link Copied' : 'Share Verified Receipt'}
        </button>
        <button
          type="button"
          onClick={() => downloadVerifiedReceiptPng(props)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-paper/20 bg-surface px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-paper transition-colors hover:border-lime hover:text-lime"
        >
          <Download className="size-3.5" />
          PNG Card
        </button>
      </div>
    </div>
  )
}
