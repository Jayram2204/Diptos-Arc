import { ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { CopyButton, Eyebrow, Reveal } from '@/components/ui'
import { ARC_NETWORK, CONTRACTS, type ContractMeta } from '@/config/protocol'
import { explorerUrl, shortHex } from '@/lib/chain'
import { useBytecode } from '@/lib/hooks'

function ContractRow({ contract }: { contract: ContractMeta }) {
  const bytecode = useBytecode(contract.address)

  return (
    <tr className="transition-colors hover:bg-paper/[0.02]">
      <td className="px-6 py-5">
        <p className="font-mono text-[13px] font-semibold text-paper">{contract.key}</p>
        <p className="mt-0.5 font-mono text-[11px] text-secondary">{contract.file}</p>
      </td>
      <td className="px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[12.5px] tabular-nums text-paper/90">
            {shortHex(contract.address, 10, 8)}
          </span>
          <CopyButton value={contract.address} label={`Copy ${contract.key} address`} />
        </div>
      </td>
      <td className="px-6 py-5 font-mono text-[11px] uppercase tracking-[0.1em]">
        {bytecode.status === 'loading' ? (
          <span className="text-secondary">CHECKING ETH_GETCODE…</span>
        ) : bytecode.status === 'error' ? (
          <span className="text-secondary">RPC SYNCING</span>
        ) : bytecode.value.hasCode ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald/35 bg-emerald/10 px-3 py-1 text-emerald">
            <CheckCircle2 className="size-3.5" /> VERIFIED ({bytecode.value.byteLength.toLocaleString()} BYTES)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/35 bg-lime/10 px-3 py-1 text-lime">
            DEPLOYARC.S.SOL READY
          </span>
        )}
      </td>
      <td className="px-6 py-5 text-right">
        <a
          href={explorerUrl('address', contract.address)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-paper/20 px-4 font-mono text-[10.5px] uppercase tracking-[0.12em] text-paper transition-colors hover:border-lime hover:text-lime"
        >
          EXPLORER <ArrowUpRight className="size-3.5" />
        </a>
      </td>
    </tr>
  )
}

export function Registry() {
  return (
    <section id="registry" className="border-t border-paper/10 bg-black py-28 lg:py-36">
      <div className="mx-auto max-w-[1380px] px-6 lg:px-10">
        <div className="flex flex-col justify-between gap-6 border-b border-paper/10 pb-10 sm:flex-row sm:items-end">
          <Reveal>
            <Eyebrow>04 // VERIFIED CONTRACT LEDGER</Eyebrow>
            <h2 className="rwa-display mt-4 text-[clamp(2rem,3.8vw,3.2rem)] uppercase text-paper">
              ARC TESTNET DEPLOYMENTS.
            </h2>
          </Reveal>
          <Reveal delayMs={80}>
            <a
              href={ARC_NETWORK.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-paper/25 px-6 font-mono text-[11px] uppercase tracking-[0.14em] text-paper transition-colors hover:border-lime hover:text-lime"
            >
              OPEN ARC EXPLORER <ArrowUpRight className="size-3.5" />
            </a>
          </Reveal>
        </div>

        <Reveal delayMs={120} className="mt-10 overflow-x-auto rounded-2xl border border-paper/10 bg-surface">
          <table className="w-full min-w-[760px] text-left">
            <thead className="border-b border-paper/10 font-mono text-[10.5px] uppercase tracking-[0.14em] text-secondary">
              <tr>
                <th className="px-6 py-4 font-medium">CONTRACT</th>
                <th className="px-6 py-4 font-medium">ARC TESTNET ADDRESS</th>
                <th className="px-6 py-4 font-medium">BYTECODE STATUS</th>
                <th className="px-6 py-4 text-right font-medium">EXPLORER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper/10">
              {CONTRACTS.map((c) => (
                <ContractRow key={c.key} contract={c} />
              ))}
            </tbody>
          </table>
        </Reveal>
      </div>
    </section>
  )
}
