import { AlertCircle, ArrowUpRight, CheckCircle2, ShieldCheck } from 'lucide-react'
import { CopyButton } from '@/components/ui'
import { ARC_NETWORK, CONTRACTS, type ContractMeta } from '@/config/protocol'
import { explorerUrl } from '@/lib/chain'
import { useBytecode } from '@/lib/hooks'

function ContractRow({ contract }: { contract: ContractMeta }) {
  const code = useBytecode(contract.address)

  let deployedBadge: React.ReactNode
  if (code.status === 'loading') {
    deployedBadge = <span className="font-mono text-[11px] text-[#9CA3AF]">CHECKING ETH_GETCODE…</span>
  } else if (code.status === 'error') {
    deployedBadge = (
      <span
        className="inline-flex items-center gap-1.5 font-mono text-[11px] text-crimson"
        title={code.error}
      >
        <AlertCircle className="size-3.5" /> RPC UNREACHABLE
      </span>
    )
  } else if (code.value.hasCode) {
    deployedBadge = (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-emerald">
        <CheckCircle2 className="size-3.5" />
        DEPLOYED ({code.value.byteLength.toLocaleString('en-US')} BYTES)
      </span>
    )
  } else {
    deployedBadge = (
      <span className="font-mono text-[11px] text-amber-300">
        NOT DEPLOYED (0 BYTES)
      </span>
    )
  }

  return (
    <tr className="transition-colors hover:bg-surface/60">
      <td className="py-5 pr-6">
        <p className="font-mono text-[13px] font-semibold text-paper">{contract.file}</p>
        <p className="mt-1 text-[12px] text-[#9CA3AF]">{contract.role}</p>
      </td>
      <td className="px-4 py-5 whitespace-nowrap font-mono text-[11px] uppercase text-[#9CA3AF]">{contract.standard}</td>
      <td className="px-4 py-5 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] text-paper">
            {contract.address.slice(0, 10)}…{contract.address.slice(-8)}
          </span>
          <CopyButton value={contract.address} label={`Copy ${contract.file} address`} />
        </div>
      </td>
      <td className="px-4 py-5 whitespace-nowrap">{deployedBadge}</td>
      <td className="py-5 pl-4 text-right whitespace-nowrap">
        <a
          href={`${explorerUrl('address', contract.address)}?tab=contract`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-paper/20 px-3.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-paper transition-colors hover:border-lime hover:text-lime"
        >
          Source on ArcScan <ArrowUpRight className="size-3" />
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
          <p className="rwa-hud text-lime">04 // CONTRACT LEDGER &amp; SECURITY DISCLOSURE</p>
          <h2 className="rwa-display mt-3 text-[28px] text-paper sm:text-[38px]">
            DIPTOS DEPLOYED CONTRACTS.
          </h2>
          <p className="mt-3 text-[14px] text-[#9CA3AF]">
            Live smart contracts deployed by Diptos on{' '}
            <span className="font-mono text-paper">{ARC_NETWORK.short}</span>. Bytecode presence (
            <span className="font-mono text-paper">eth_getCode</span>) is displayed separately from ArcScan source
            verification.
          </p>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#E5E7EB]">
          {CONTRACTS.length} LIVE CONTRACTS · ARC 5042002
        </span>
      </div>

      <div className="mt-10 overflow-x-auto border-y border-paper/12">
        <table className="w-full min-w-[820px] text-left">
          <thead className="border-b border-paper/12">
            <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#9CA3AF]">
              <th className="py-3.5 pr-6 font-medium">Contract</th>
              <th className="px-4 py-3.5 font-medium whitespace-nowrap">Module</th>
              <th className="px-4 py-3.5 font-medium whitespace-nowrap">Arc Address</th>
              <th className="px-4 py-3.5 font-medium whitespace-nowrap">Deployed (eth_getCode)</th>
              <th className="py-3.5 pl-4 text-right font-medium whitespace-nowrap">Source Verification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-paper/10">
            {CONTRACTS.map((c) => (
              <ContractRow key={c.key} contract={c} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Admin & Security Disclosure Row */}
      <div className="mt-6 rounded-2xl border border-paper/12 bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper/10 pb-3">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-white">
            <ShieldCheck className="size-4 text-emerald" />
            Admin &amp; Security Disclosure
          </span>
          <span className="rounded-full border border-amber-400/35 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
            Unaudited · 34/34 Foundry tests
          </span>
        </div>
        <dl className="mt-4 grid gap-4 font-mono text-[11.5px] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[10px] uppercase text-[#9CA3AF]">Custody Model</dt>
            <dd className="mt-1 text-paper">Non-upgradeable custody · zero admin sweep over user funds</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-[#9CA3AF]">Oracle Kill-Switch</dt>
            <dd className="mt-1 text-paper">
              <code className="text-emerald">revokeOracleSigner()</code> halts compromised signer instantly
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-[#9CA3AF]">Outflow Circuit Breaker</dt>
            <dd className="mt-1 text-paper">Configurable rolling 1-hour oracle velocity cap</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-[#9CA3AF]">Permissionless Recovery</dt>
            <dd className="mt-1 text-paper">
              <code className="text-emerald">claimTimeoutRefund()</code> requires zero oracle cooperation
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
