import { useState } from 'react'
import { ArrowUpRight, Check, Download, Share2, Zap } from 'lucide-react'
import { ESCROW_CONTRACT_ADDRESS } from '@/config/protocol'
import { explorerUrl, fmtAmount, shortHex } from '@/lib/chain'
import { CopyButton } from './ui'

/**
 * Ultra-clean single verification mark (`✓`) — zero bulky text pills.
 */
export function DiptosVerifiedBadge({
  size = 'sm',
  className = '',
}: {
  size?: 'xs' | 'sm' | 'md'
  className?: string
}) {
  const boxCls =
    size === 'xs' ? 'size-4' : size === 'md' ? 'size-5' : 'size-[18px]'
  const iconCls =
    size === 'xs' ? 'size-2.5' : size === 'md' ? 'size-3.5' : 'size-3'

  return (
    <span
      title="Verified on-chain"
      aria-label="Verified on-chain"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-lime text-ink ${boxCls} ${className}`}
    >
      <Check className={iconCls} strokeWidth={2.5} />
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

  // Pure black background
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, w, h)

  // Graphite card frame
  ctx.fillStyle = '#111111'
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(36, 36, w - 72, h - 72, 20)
  ctx.fill()
  ctx.stroke()

  // Top verified mark
  ctx.fillStyle = '#CCFF00'
  ctx.beginPath()
  ctx.roundRect(76, 76, 178, 38, 19)
  ctx.fill()

  ctx.fillStyle = '#000000'
  ctx.font = '700 15px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText('✓ VERIFIED', 112, 100)

  // Arc finality pill (monochrome white border)
  ctx.fillStyle = '#000000'
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
  ctx.beginPath()
  ctx.roundRect(w - 300, 76, 224, 38, 19)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '600 14px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText('<1S ARC FINALITY', w - 270, 100)

  // Title
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '700 34px -apple-system, BlinkMacSystemFont, Inter, sans-serif'
  const cleanTitle = (props.title || 'Verified Native USDC Settlement').slice(0, 46)
  ctx.fillText(cleanTitle, 76, 182)

  // Amount settled
  ctx.fillStyle = '#CCFF00'
  ctx.font = '700 54px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText(`${fmtAmount(props.amountUsdc)} USDC`, 76, 262)

  ctx.fillStyle = '#A3A3A3'
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
    ctx.fillStyle = '#A3A3A3'
    ctx.font = '600 13px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillText(label, 76, y)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '500 16px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillText(val.length > 58 ? `${val.slice(0, 32)}…${val.slice(-22)}` : val, 270, y)
    y += 46
  }

  // Footer
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(76, 520)
  ctx.lineTo(w - 76, 520)
  ctx.stroke()

  ctx.fillStyle = '#A3A3A3'
  ctx.font = '500 15px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText('diptos.xyz  ·  app.diptos.xyz  ·  Condition-Verified USDC Settlement', 76, 558)

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
    <div className="mt-5 rounded-xl border border-white/15 bg-[#111111] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3.5">
        <div className="inline-flex items-center gap-2 font-mono text-[12px] font-semibold text-white">
          <DiptosVerifiedBadge size="md" />
          <span>Settled On-Chain</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black px-2.5 py-1 font-mono text-[11px] font-medium text-[#A3A3A3]">
          <Zap className="size-3 text-lime" strokeWidth={1.5} />
          &lt;1s Arc Finality
        </span>
      </div>

      <dl className="mt-4 space-y-2.5 font-mono text-[12.5px]">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[#A3A3A3]">USDC Settled</dt>
          <dd className="text-[15px] font-bold text-lime">{fmtAmount(props.amountUsdc)} USDC</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[#A3A3A3]">Escrow ID</dt>
          <dd className="flex items-center gap-1.5 text-white">
            <span>{shortHex(props.escrowIdBytes32, 10, 8)}</span>
            <CopyButton value={props.escrowIdBytes32} label="Copy escrow ID" />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[#A3A3A3]">Proof Hash</dt>
          <dd className="flex items-center gap-1.5 text-white">
            <span>{shortHex(displayProof, 10, 8)}</span>
            <CopyButton value={displayProof} label="Copy proof hash" />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[#A3A3A3]">On-Chain Proof</dt>
          <dd>
            <a
              href={arcLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-white hover:text-lime hover:underline"
            >
              {props.txHash ? shortHex(props.txHash, 10, 6) : 'View on ArcScan'}
              <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
            </a>
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={() => void handleShareCopy()}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-lime px-4 font-mono text-[12px] font-bold text-ink transition-colors hover:bg-[#d8ff4d]"
        >
          {copied ? <Check className="size-3.5" strokeWidth={1.5} /> : <Share2 className="size-3.5" strokeWidth={1.5} />}
          {copied ? 'Link Copied' : 'Share Receipt'}
        </button>
        <button
          type="button"
          onClick={() => downloadVerifiedReceiptPng(props)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-white/20 bg-black px-4 font-mono text-[12px] font-medium text-white transition-colors hover:border-lime hover:text-lime"
        >
          <Download className="size-3.5" strokeWidth={1.5} />
          PNG
        </button>
      </div>
    </div>
  )
}
