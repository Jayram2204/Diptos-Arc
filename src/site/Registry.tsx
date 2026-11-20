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
      <span className="font-mono text-[11px] text-lime">
        AWAITING FORGE BROADCAST (0 BYTES)
      </span>
    )
  }

  return (
    <tr className="transition-colors hover:bg-surface/60">
      <td className="py-5 pr-6">
        <p className="font-mono text-[13px] font-semibold text-paper">{contract.file}</p>
        <p className="mt-1 text-[12px] text-secondary">{contract.role}</p>
      </td>
      <td className="px-4 py-5 font-mono text-[11px] uppercase text-secondary">{contract.standard}</td>
      <td className="px-4 py-5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] text-paper">
            {contract.address.slice(0, 10)}…{contract.address.slice(-8)}
          </span>
          <CopyButton value={contract.address} label={`Copy ${contract.file} address`} />
        </div>
      </td>
      <td className="px-4 py-5">{badge}</td>
      <td className="py-5 pl-4 text-right">
        <a
          href={explorerUrl('address', contract.address)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1 rounded-full border border-paper/20 px-3.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-paper transition-colors hover:border-lime hover:text-lime"
        >
          ARCSCAN <ArrowUpRight className="size-3" />
        </a>
      </td>
    </tr>
  )
}

export function Registry() {
  return (
    <section id="registry" className="mx-auto max-w-[1280px] border-t border-paper/12 px-6 py-20 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="rwa-hud text-lime">04 // VERIFIED CONTRACT LEDGER</p>
          <h2 className="rwa-display mt-3 text-[28px] text-paper sm:text-[38px]">
            DIPTOS DEPLOYED CONTRACTS.
          </h2>
          <p className="mt-3 text-[14px] text-secondary">
            Only smart contracts authored and deployed by Diptos on{' '}
            <span className="font-mono text-paper">{ARC_NETWORK.short}</span>, verified via live{' '}
            <span className="font-mono text-paper">eth_getCode</span>.
          </p>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-lime">
          {CONTRACTS.length} DIPTOS CONTRACTS // ARCSCAN
        </span>
      </div>

      <div className="mt-10 overflow-x-auto border-y border-paper/12">
        <table className="w-full min-w-[820px] text-left">
          <thead className="border-b border-paper/12">
            <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-secondary">
              <th className="py-3.5 pr-6 font-medium">Contract</th>
              <th className="px-4 py-3.5 font-medium">Module</th>
              <th className="px-4 py-3.5 font-medium">Arc Address</th>
              <th className="px-4 py-3.5 font-medium">Live eth_getCode</th>
              <th className="py-3.5 pl-4 text-right font-medium">Explorer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-paper/10">
            {CONTRACTS.map((c) => (
              <ContractRow key={c.key} contract={c} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
