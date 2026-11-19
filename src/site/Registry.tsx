import { AlertCircle, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { CopyButton, Eyebrow } from '@/components/ui'
import { ARC_NETWORK, CONTRACTS, type ContractMeta } from '@/config/protocol'
import { explorerUrl } from '@/lib/chain'
import { useBytecode } from '@/lib/hooks'

function ContractRow({ contract }: { contract: ContractMeta }) {
  const code = useBytecode(contract.address)

  let badge: React.ReactNode
  if (code.status === 'loading') {
    badge = <span className="font-mono text-[11px] text-secondary">Checking eth_getCode…</span>
  } else if (code.status === 'error') {
    badge = (
      <span
        className="inline-flex items-center gap-1.5 rounded-md border border-crimson/35 bg-crimson/10 px-2.5 py-1 font-mono text-[10px] font-medium text-crimson"
        title={code.error}
      >
        <AlertCircle className="size-3" /> RPC unreachable
      </span>
    )
  } else if (code.value.hasCode) {
    badge = (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald/30 bg-emerald/10 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.04em] text-emerald">
        <CheckCircle2 className="size-3" />
        <span>{code.value.byteLength.toLocaleString('en-US')} bytes verified on Arc</span>
      </span>
    )
  } else if (contract.isNativeAsset) {
    badge = (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald/30 bg-emerald/10 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.04em] text-emerald">
        <CheckCircle2 className="size-3" />
        <span>NATIVE PRECOMPILE VERIFIED</span>
      </span>
    )
  } else {
    badge = (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/10 px-2.5 py-1 font-mono text-[10px] font-medium text-gold">
        <span>0 bytes at address (deploy via Forge)</span>
      </span>
    )
  }

  return (
    <tr className="transition-colors hover:bg-elevated/60">
      <td className="px-5 py-4">
        <p className="font-mono text-[13px] font-medium text-primary">{contract.file}</p>
        <p className="mt-0.5 text-[12px] text-secondary">{contract.role}</p>
      </td>
      <td className="px-5 py-4">
        <span className="rounded-md border border-white/[0.08] bg-elevated px-2 py-1 font-mono text-[10px] text-primary">
          {contract.standard}
        </span>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] text-primary">
            {contract.address.slice(0, 10)}…{contract.address.slice(-8)}
          </span>
          <CopyButton value={contract.address} label={`Copy ${contract.file} address`} />
        </div>
      </td>
      <td className="px-5 py-4">{badge}</td>
      <td className="px-5 py-4 text-right">
        <a
          href={explorerUrl('address', contract.address)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/[0.1] bg-elevated px-3 text-[12px] font-medium text-primary transition-colors hover:border-gold/50 hover:text-gold"
        >
          Arc Explorer <ArrowUpRight className="size-3.5" />
        </a>
      </td>
    </tr>
  )
}

export function Registry() {
  return (
    <section id="registry" className="mx-auto max-w-[1280px] border-t border-white/[0.08] px-4 py-20 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <Eyebrow>Verified Arc Contracts</Eyebrow>
          <h2 className="mt-3 text-[28px] font-semibold text-primary sm:text-[34px]">
            Deployed Arc Testnet contract inspector.
          </h2>
          <p className="mt-3 text-[14px] text-secondary">
            Live <span className="font-mono text-primary">diptos.verifyContractBytecode(address)</span> (
            <span className="font-mono text-primary">eth_getCode</span>) against{' '}
            <span className="font-mono text-primary">{ARC_NETWORK.short}</span>.
          </p>
        </div>
        <span className="inline-flex h-8 items-center rounded-md border border-emerald/25 bg-emerald/10 px-3 font-mono text-[11px] font-medium text-emerald">
          Live eth_getCode • Chain 5042002
        </span>
      </div>

      <div className="mt-8 overflow-hidden rounded-[10px] border border-white/[0.08] bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead className="border-b border-white/[0.08] bg-elevated/60">
              <tr className="font-mono text-[10px] uppercase tracking-[0.12em] text-secondary">
                <th className="px-5 py-3 font-medium">Contract</th>
                <th className="px-5 py-3 font-medium">Standard</th>
                <th className="px-5 py-3 font-medium">Arc Address</th>
                <th className="px-5 py-3 font-medium">On-Chain Bytecode</th>
                <th className="px-5 py-3 text-right font-medium">Explorer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.08]">
              {CONTRACTS.map((c) => (
                <ContractRow key={c.key} contract={c} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
