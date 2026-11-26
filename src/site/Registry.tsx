import { AlertCircle, ArrowUpRight, Check } from 'lucide-react'
import { CopyButton } from '@/components/ui'
import { ARC_NETWORK, CONTRACTS, type ContractMeta } from '@/config/protocol'
import { explorerUrl } from '@/lib/chain'
import { useBytecode } from '@/lib/hooks'

function ContractRow({ contract }: { contract: ContractMeta }) {
  const code = useBytecode(contract.address)

  let deployedBadge: React.ReactNode
  if (code.status === 'loading') {
    deployedBadge = <span className="font-mono text-[12.5px] text-[#A3A3A3]">Checking eth_getCode…</span>
  } else if (code.status === 'error') {
    deployedBadge = (
      <span
        className="inline-flex items-center gap-1.5 font-mono text-[12.5px] text-white"
        title={code.error}
      >
        <AlertCircle className="size-3.5 text-[#A3A3A3]" strokeWidth={1.5} /> RPC Unreachable
      </span>
    )
  } else if (code.value.hasCode) {
    deployedBadge = (
      <span className="inline-flex items-center gap-1.5 font-mono text-[12.5px] font-medium text-lime">
        <Check className="size-3.5" strokeWidth={2} />
        Deployed ({code.value.byteLength.toLocaleString('en-US')} bytes)
      </span>
    )
  } else {
    deployedBadge = (
      <span className="font-mono text-[12.5px] text-[#A3A3A3]">Not deployed (0 bytes)</span>
    )
  }

  return (
    <tr className="transition-colors hover:bg-[#141414]">
      <td className="py-5 pr-6 align-top">
        <p className="font-mono text-[14px] font-semibold text-white">{contract.file}</p>
        <p className="mt-1 text-[13.5px] leading-snug text-[#A3A3A3]">{contract.role}</p>
      </td>
      <td className="px-4 py-5 align-top whitespace-nowrap font-mono text-[12.5px] uppercase text-[#A3A3A3]">
        {contract.standard}
      </td>
      <td className="px-4 py-5 align-top whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] text-white">
            {contract.address.slice(0, 10)}…{contract.address.slice(-8)}
          </span>
          <CopyButton value={contract.address} label={`Copy ${contract.file} address`} />
        </div>
      </td>
      <td className="px-4 py-5 align-top whitespace-nowrap">{deployedBadge}</td>
      <td className="py-5 pl-4 text-right align-top whitespace-nowrap">
        <a
          href={`${explorerUrl('address', contract.address)}?tab=contract`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-white/20 px-3.5 font-mono text-[12px] text-white transition-colors hover:border-lime hover:text-lime"
        >
          ArcScan <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
        </a>
      </td>
    </tr>
  )
}

export function Registry() {
  return (
    <section id="registry" className="mx-auto max-w-[1280px] px-5 py-24 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="rwa-hud text-lime">04 // CONTRACT LEDGER</p>
          <h2 className="rwa-display mt-3 text-[28px] text-white sm:text-[38px]">
            DIPTOS DEPLOYED CONTRACTS.
          </h2>
          <p className="mt-3 text-[15.5px] leading-relaxed text-[#A3A3A3]">
            Live smart contracts deployed on{' '}
            <span className="font-mono text-white">{ARC_NETWORK.short}</span>. Bytecode presence (
            <span className="font-mono text-white">eth_getCode</span>) is verified live against Arc RPC.
          </p>
        </div>
        <span className="shrink-0 font-mono text-[12.5px] uppercase tracking-[0.04em] text-[#A3A3A3]">
          {CONTRACTS.length} Live Contracts · Arc 5042002
        </span>
      </div>

      <div className="mt-10 overflow-x-auto rounded-[12px] border border-white/10 bg-[#0E0E0E]">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead className="border-b border-white/10 bg-[#111111]">
            <tr className="font-mono text-[12px] uppercase tracking-[0.04em] text-[#A3A3A3]">
              <th className="py-3.5 pl-5 pr-6 font-medium">Contract</th>
              <th className="px-4 py-3.5 font-medium whitespace-nowrap">Module</th>
              <th className="px-4 py-3.5 font-medium whitespace-nowrap">Arc Address</th>
              <th className="px-4 py-3.5 font-medium whitespace-nowrap">Deployed (eth_getCode)</th>
              <th className="py-3.5 pl-4 pr-5 text-right font-medium whitespace-nowrap">Explorer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 [&_td:first-child]:pl-5 [&_td:last-child]:pr-5">
            {CONTRACTS.map((c) => (
              <ContractRow key={c.key} contract={c} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
