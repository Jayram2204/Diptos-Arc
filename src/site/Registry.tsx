import { AlertCircle, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { CopyButton } from '@/components/ui'
import { ARC_NETWORK, CONTRACTS, type ContractMeta } from '@/config/protocol'
import { explorerUrl } from '@/lib/chain'
import { useBytecode } from '@/lib/hooks'

function ContractRow({ contract }: { contract: ContractMeta }) {
  const code = useBytecode(contract.address)

  let badge: React.ReactNode
  if (code.status === 'loading') {
    badge = <span className="font-mono text-[11px] text-secondary">CHECKING ETH_GETCODE…</span>
  } else if (code.status === 'error') {
    badge = (
      <span
        className="inline-flex items-center gap-1.5 font-mono text-[11px] text-crimson"
        title={code.error}
      >
        <AlertCircle className="size-3.5" /> RPC UNREACHABLE
      </span>
    )
  } else if (code.value.hasCode) {
    badge = (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-emerald">
        <CheckCircle2 className="size-3.5" />
        VERIFIED ({code.value.byteLength.toLocaleString('en-US')} BYTES)
      </span>
    )
  } else {
    badge = (
      <span className="font-mono text-[11px] text-secondary">
        AWAITING FORGE BROADCAST (0 BYTES)
      </span>
    )
  }

  return (
    <tr className="transition-colors hover:bg-[#161922]">
      <td className="py-5 pl-6 pr-6">
        <p className="font-mono text-[13px] font-semibold text-[#F4F2EC]">{contract.file}</p>
        <p className="mt-1 text-[12px] text-secondary">{contract.role}</p>
      </td>
      <td className="px-4 py-5 font-mono text-[11px] uppercase text-secondary">{contract.standard}</td>
      <td className="px-4 py-5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] text-[#F4F2EC]">
            {contract.address.slice(0, 10)}…{contract.address.slice(-8)}
          </span>
          <CopyButton value={contract.address} label={`Copy ${contract.file} address`} />
        </div>
      </td>
      <td className="px-4 py-5">{badge}</td>
      <td className="py-5 pl-4 pr-6 text-right">
        <a
          href={explorerUrl('address', contract.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center gap-1 rounded-full border border-white/15 px-3.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#F4F2EC] transition-all duration-200 hover:-translate-y-[1px] hover:border-white/30 hover:bg-white/[0.06]"
        >
          ARCSCAN <ArrowUpRight className="size-3" />
        </a>
      </td>
    </tr>
  )
}

export function Registry() {
  return (
    <section id="registry" className="mx-auto max-w-[1320px] border-t border-white/[0.08] px-6 py-20 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="rwa-hud text-secondary">04 // VERIFIED CONTRACT LEDGER</p>
          <h2 className="rwa-display mt-3 text-[28px] text-[#F4F2EC] sm:text-[38px]">
            DIPTOS DEPLOYED CONTRACTS.
          </h2>
          <p className="mt-3 text-[14px] text-secondary">
            Only smart contracts authored and deployed by Diptos on{' '}
            <span className="font-mono text-[#F4F2EC]">{ARC_NETWORK.short}</span>, verified via live{' '}
            <span className="font-mono text-[#F4F2EC]">eth_getCode</span>.
          </p>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-secondary">
          {CONTRACTS.length} DIPTOS CONTRACTS // ARCSCAN
        </span>
      </div>

      <div className="mt-10 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#111318]">
        <table className="w-full min-w-[820px] text-left">
          <thead className="border-b border-white/[0.08]">
            <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-secondary">
              <th className="py-3.5 pl-6 pr-6 font-medium">Contract</th>
              <th className="px-4 py-3.5 font-medium">Module</th>
              <th className="px-4 py-3.5 font-medium">Arc Address</th>
              <th className="px-4 py-3.5 font-medium">Live eth_getCode</th>
              <th className="py-3.5 pl-4 pr-6 text-right font-medium">Explorer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {CONTRACTS.map((c) => (
              <ContractRow key={c.key} contract={c} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
