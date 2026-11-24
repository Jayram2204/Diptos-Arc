import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  Menu,
  Play,
  Search,
  Terminal,
  X,
} from 'lucide-react'
import { formatEther, parseUnits } from 'viem'
import { ESCROW_CONTRACT_ADDRESS } from '@/config/protocol'
import { getApexUrl, getAppUrl } from '@/lib/route'
import { diptos } from '@/lib/sdk'
import { DOC_GROUPS, DOC_PAGES, type DocCodeBlock, type DocPage } from './docsData'

function CodeBlock({ block }: { block: DocCodeBlock }) {
  const [copied, setCopied] = useState(false)
  const [pm, setPm] = useState<'pnpm' | 'npm' | 'yarn'>('pnpm')
  const [lang, setLang] = useState<'typescript' | 'curl' | 'solidity'>('typescript')

  const showPkgTabs = block.code.startsWith('pnpm add')
  const hasLangTabs = Boolean(block.variants)

  const displayedCode = useMemo(() => {
    if (showPkgTabs) {
      if (pm === 'npm') return block.code.replace('pnpm add', 'npm install')
      if (pm === 'yarn') return block.code.replace('pnpm add', 'yarn add')
      return block.code
    }
    if (hasLangTabs && block.variants) {
      return block.variants[lang] ?? block.code
    }
    return block.code
  }, [block, pm, lang, showPkgTabs, hasLangTabs])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayedCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // ignore clipboard errors
    }
  }

  return (
    <div className="my-5 overflow-hidden rounded-xl border border-white/12 bg-[#0B0D12]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/[0.025] px-3.5 py-2">
        <div className="flex items-center gap-1.5">
          {showPkgTabs ? (
            (['pnpm', 'npm', 'yarn'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setPm(tab)}
                className={`rounded px-2 py-0.5 font-mono text-[11px] transition-colors ${
                  pm === tab ? 'bg-[#C8FF00] font-semibold text-[#07080C]' : 'text-[#E5E7EB]/80 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))
          ) : hasLangTabs ? (
            (['typescript', 'curl', 'solidity'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setLang(tab)}
                className={`rounded px-2.5 py-0.5 font-mono text-[11px] capitalize transition-colors ${
                  lang === tab ? 'bg-[#C8FF00] font-semibold text-[#07080C]' : 'text-[#E5E7EB]/80 hover:text-white'
                }`}
              >
                {tab === 'curl' ? 'cURL' : tab === 'typescript' ? 'TypeScript' : 'Solidity'}
              </button>
            ))
          ) : (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-[#E5E7EB]">
              <Terminal className="size-3 text-[#C8FF00]" />
              {block.filename ?? block.language}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code snippet"
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[11px] text-[#E5E7EB] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
        >
          {copied ? <Check className="size-3 text-[#10B981]" /> : <Copy className="size-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.65] text-white">
        <code>{displayedCode}</code>
      </pre>
    </div>
  )
}

function TecdCurveDiagram() {
  return (
    <figure className="my-5 rounded-xl border border-white/12 bg-[#0B0D12] p-5">
      <svg viewBox="0 0 600 180" className="w-full" role="img" aria-label="TECD Decay Math Curve">
        <rect x="0" y="0" width="600" height="180" fill="transparent" />
        <line x1="56" y1="24" x2="564" y2="24" stroke="rgba(255,255,255,0.1)" strokeDasharray="3 4" />
        <line x1="56" y1="84" x2="564" y2="84" stroke="rgba(255,255,255,0.1)" strokeDasharray="3 4" />
        <line x1="56" y1="144" x2="564" y2="144" stroke="rgba(255,255,255,0.22)" />
        <line x1="56" y1="24" x2="56" y2="144" stroke="rgba(255,255,255,0.22)" />
        {/* On-time flat plateau */}
        <line x1="56" y1="30" x2="190" y2="30" stroke="#10B981" strokeWidth="2.5" />
        {/* TECD exponential decay curve */}
        <path
          d="M 190 30 C 260 36, 330 78, 420 112 C 475 130, 520 138, 560 140"
          fill="none"
          stroke="#C8FF00"
          strokeWidth="2.5"
        />
        <line x1="190" y1="24" x2="190" y2="144" stroke="rgba(200,255,0,0.4)" strokeDasharray="3 3" />
        <circle cx="190" cy="30" r="4.5" fill="#10B981" />
        <circle cx="330" cy="76" r="4.5" fill="#C8FF00" />
        <text x="64" y="18" fill="#10B981" fontSize="11" fontFamily="monospace">
          ON-TIME: 99.5% PAYEE
        </text>
        <text x="200" y="18" fill="#C8FF00" fontSize="11" fontFamily="monospace">
          DEADLINE T (Δt &gt; 0): V(t) = V₀ · e^(−λ·(Δt/T)^1.5)
        </text>
        <text x="342" y="72" fill="#E5E7EB" fontSize="10.5" fontFamily="monospace">
          AUTO BUYER REBATE
        </text>
        <text x="12" y="34" fill="#E5E7EB" fontSize="10" fontFamily="monospace">
          100%
        </text>
        <text x="20" y="148" fill="#E5E7EB" fontSize="10" fontFamily="monospace">
          0%
        </text>
        <text x="182" y="164" fill="#E5E7EB" fontSize="10" fontFamily="monospace">
          T
        </text>
        <text x="530" y="164" fill="#E5E7EB" fontSize="10" fontFamily="monospace">
          +72H
        </text>
      </svg>
      <figcaption className="mt-2 font-mono text-[11px] text-[#E5E7EB]/80">
        Figure 1 — Deterministic WAD decay curve enforced on-chain by DiptosEscrow.sol.
      </figcaption>
    </figure>
  )
}

function TrustBoundariesDiagram() {
  return (
    <figure className="my-5 rounded-xl border border-white/12 bg-[#0B0D12] p-5">
      <svg viewBox="0 0 600 150" className="w-full" role="img" aria-label="Zero-Key Trust Boundaries Diagram">
        <rect x="16" y="32" width="160" height="84" rx="10" fill="#11151E" stroke="rgba(255,255,255,0.2)" />
        <text x="32" y="60" fill="#FFFFFF" fontSize="12" fontWeight="600" fontFamily="monospace">
          BUYER / AGENT
        </text>
        <text x="32" y="80" fill="#E5E7EB" fontSize="10" fontFamily="monospace">
          Holds Own Keys
        </text>
        <text x="32" y="96" fill="#C8FF00" fontSize="10" fontFamily="monospace">
          100% Timeout Refund
        </text>

        <line x1="176" y1="74" x2="218" y2="74" stroke="#C8FF00" strokeWidth="2" />

        <rect x="218" y="24" width="168" height="100" rx="10" fill="#0B1410" stroke="#10B981" strokeWidth="1.5" />
        <text x="234" y="54" fill="#10B981" fontSize="12" fontWeight="600" fontFamily="monospace">
          DiptosEscrow.sol
        </text>
        <text x="234" y="74" fill="#FFFFFF" fontSize="10" fontFamily="monospace">
          Non-Custodial Vault
        </text>
        <text x="234" y="92" fill="#E5E7EB" fontSize="10" fontFamily="monospace">
          Single-Use Nonce Gate
        </text>
        <text x="234" y="108" fill="#C8FF00" fontSize="10" fontFamily="monospace">
          Atomic 99.5% / 0.5%
        </text>

        <line x1="386" y1="74" x2="428" y2="74" stroke="#10B981" strokeWidth="2" />

        <rect x="428" y="32" width="156" height="84" rx="10" fill="#11151E" stroke="rgba(255,255,255,0.2)" />
        <text x="444" y="60" fill="#FFFFFF" fontSize="12" fontWeight="600" fontFamily="monospace">
          PROOF VERIFIER
        </text>
        <text x="444" y="80" fill="#E5E7EB" fontSize="10" fontFamily="monospace">
          Zero Fund Custody
        </text>
        <text x="444" y="96" fill="#10B981" fontSize="10" fontFamily="monospace">
          EIP-712 Attestation
        </text>
      </svg>
      <figcaption className="mt-2 font-mono text-[11px] text-[#E5E7EB]/80">
        Figure 2 — Zero-key custody separation: Diptos never holds user private keys or sweep permissions.
      </figcaption>
    </figure>
  )
}

function LiveTecdPlayground() {
  const [principal, setPrincipal] = useState(1000)
  const [delayHours, setDelayHours] = useState(6)
  const [lambda, setLambda] = useState(0.5)
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState<{
    block: string
    payee: string
    rebate: string
    fee: string
    decayPct: string
  } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const runLiveCall = async () => {
    setRunning(true)
    setErr(null)
    try {
      const nowSec = Math.floor(Date.now() / 1000)
      const deadlineUnix = BigInt(nowSec + 24 * 3600)
      const simulatedTimestamp = deadlineUnix + BigInt(delayHours * 3600)
      const [tel, res] = await Promise.all([
        diptos.getArcTelemetry(),
        diptos.previewTECDPayoutOnChain({
          amountWei: parseUnits(String(principal), 18),
          deadlineUnix,
          simulatedTimestamp,
          lambdaBps: BigInt(Math.round(lambda * 10_000)),
        }),
      ])
      setOutput({
        block: `#${Number(tel.blockNumber).toLocaleString('en-US')}`,
        payee: `${Number(formatEther(res.payeePayout)).toFixed(4)} USDC`,
        rebate: `${Number(formatEther(res.payerRebate)).toFixed(4)} USDC`,
        fee: `${Number(formatEther(res.protocolFee)).toFixed(4)} USDC`,
        decayPct: `${(Number(res.decayBps) / 100).toFixed(2)}%`,
      })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="my-5 rounded-xl border border-[#C8FF00]/30 bg-[#0B0D12] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3.5">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[#C8FF00]">
          LIVE ETH_CALL PLAYGROUND // ARC TESTNET 5042002
        </span>
        <button
          type="button"
          onClick={runLiveCall}
          disabled={running}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#C8FF00] px-3.5 py-1.5 font-mono text-[11px] font-semibold text-[#07080C] hover:bg-[#d8ff4d] disabled:opacity-50"
        >
          <Play className="size-3" />
          {running ? 'Calling Arc RPC…' : 'Run previewTECDPayout()'}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="font-mono text-[10.5px] uppercase text-[#E5E7EB]">Principal (USDC)</span>
          <input
            type="number"
            min={1}
            value={principal}
            onChange={(e) => setPrincipal(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1 h-9 w-full rounded-lg border border-white/15 bg-[#07080B] px-3 font-mono text-[12.5px] text-white"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10.5px] uppercase text-[#E5E7EB]">Delay (Hours Late)</span>
          <input
            type="number"
            min={0}
            max={72}
            value={delayHours}
            onChange={(e) => setDelayHours(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1 h-9 w-full rounded-lg border border-white/15 bg-[#07080B] px-3 font-mono text-[12.5px] text-white"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10.5px] uppercase text-[#E5E7EB]">SLA λ</span>
          <input
            type="number"
            step="0.05"
            min={0.05}
            max={2}
            value={lambda}
            onChange={(e) => setLambda(Math.max(0.05, Number(e.target.value) || 0.35))}
            className="mt-1 h-9 w-full rounded-lg border border-white/15 bg-[#07080B] px-3 font-mono text-[12.5px] text-[#C8FF00]"
          />
        </label>
      </div>

      {err && <p className="mt-3 font-mono text-[11.5px] text-red-300">{err}</p>}
      {output && (
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-[#07080B] p-3.5 font-mono text-[11.5px] sm:grid-cols-4">
          <div>
            <p className="text-[10px] text-[#E5E7EB]/70">ARC BLOCK</p>
            <p className="mt-0.5 text-white">{output.block}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#E5E7EB]/70">PAYEE PAYOUT</p>
            <p className="mt-0.5 text-[#10B981]">{output.payee}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#E5E7EB]/70">AUTO REBATE</p>
            <p className="mt-0.5 text-[#C8FF00]">{output.rebate}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#E5E7EB]/70">DECAY / FEE</p>
            <p className="mt-0.5 text-white">
              {output.decayPct} · {output.fee}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export function DocsPortal() {
  const [activePageId, setActivePageId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'introduction'
    const hash = window.location.hash.replace(/^#/, '')
    return DOC_PAGES.some((p) => p.id === hash) ? hash : 'introduction'
  })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [rpcStatus, setRpcStatus] = useState<{
    loading: boolean
    block?: string
    latency?: string
    error?: string
  }>({ loading: false })

  const activeIndex = useMemo(
    () => Math.max(0, DOC_PAGES.findIndex((p) => p.id === activePageId)),
    [activePageId],
  )
  const activePage: DocPage = DOC_PAGES[activeIndex] ?? DOC_PAGES[0]
  const prevPage = activeIndex > 0 ? DOC_PAGES[activeIndex - 1] : null
  const nextPage = activeIndex < DOC_PAGES.length - 1 ? DOC_PAGES[activeIndex + 1] : null

  const selectPage = (pageId: string) => {
    setActivePageId(pageId)
    setMobileNavOpen(false)
    setSearchOpen(false)
    setSearchQuery('')
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${pageId}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return DOC_PAGES
    return DOC_PAGES.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.group.toLowerCase().includes(q) ||
        p.sections.some(
          (s) =>
            s.heading.toLowerCase().includes(q) ||
            s.paragraphs?.some((par) => par.toLowerCase().includes(q)),
        ),
    )
  }, [searchQuery])

  const checkLiveRpc = async () => {
    setRpcStatus({ loading: true })
    try {
      const tel = await diptos.getArcTelemetry()
      setRpcStatus({
        loading: false,
        block: `#${Number(tel.blockNumber).toLocaleString('en-US')}`,
        latency: `${tel.latencyMs ?? 0}ms`,
      })
    } catch (e) {
      setRpcStatus({ loading: false, error: (e as Error).message })
    }
  }

  return (
    <div className="min-h-screen bg-[#000000] text-white antialiased">
      {/* Top Documentation Bar */}
      <header className="sticky top-0 z-40 h-14 border-b border-white/10 bg-[#000000]/95 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label="Toggle docs navigation"
              className="grid size-8 place-items-center rounded-md border border-white/15 text-[#E5E7EB] hover:text-white lg:hidden"
            >
              {mobileNavOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
            <a
              href={getApexUrl()}
              className="rwa-display inline-flex items-baseline text-[17px] tracking-[-0.04em] text-white"
            >
              DIPTOS<span className="ml-0.5 inline-block size-1.5 rounded-full bg-[#C8FF00]" />
            </a>
            <span className="text-white/25">/</span>
            <span className="font-mono text-[12px] font-medium text-[#E5E7EB]">Docs</span>
            <span className="hidden rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-[#E5E7EB] sm:inline-block">
              @diptos/sdk v1.0.0
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search documentation"
              className="flex h-8 items-center gap-2.5 rounded-md border border-white/15 bg-white/[0.03] px-3 text-[12.5px] text-[#E5E7EB] transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
            >
              <Search className="size-3.5" />
              <span className="hidden sm:inline">Search docs…</span>
              <kbd className="hidden rounded border border-white/15 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-[#E5E7EB] sm:inline">
                ⌘K
              </kbd>
            </button>

            <nav className="hidden items-center gap-4 text-[12.5px] text-[#E5E7EB] md:flex">
              <a
                href={getAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-[#C8FF00]"
              >
                App <ArrowUpRight className="size-3" />
              </a>
              <a
                href="https://github.com/Jayram2204/Diptos-Arc"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-[#C8FF00]"
              >
                GitHub <ArrowUpRight className="size-3" />
              </a>
              <a
                href="https://www.npmjs.com/package/@diptos/sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-[#C8FF00]"
              >
                npm <ArrowUpRight className="size-3" />
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main 3-Column Documentation Layout */}
      <div className="mx-auto flex max-w-[1440px]">
        <aside
          className={`${
            mobileNavOpen ? 'fixed inset-y-14 left-0 z-30 block w-[264px]' : 'hidden'
          } shrink-0 border-r border-white/10 bg-[#06070A] lg:sticky lg:top-14 lg:block lg:h-[calc(100vh-3.5rem)] lg:w-[258px] lg:overflow-y-auto`}
        >
          <nav className="space-y-6 px-4 py-6" aria-label="Documentation sections">
            {DOC_GROUPS.map((group) => {
              const items = DOC_PAGES.filter((p) => p.group === group)
              if (items.length === 0) return null
              return (
                <div key={group}>
                  <p className="px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#E5E7EB]/65">
                    {group}
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {items.map((item) => {
                      const active = item.id === activePage.id
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => selectPage(item.id)}
                            className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime ${
                              active
                                ? 'bg-white/[0.1] font-medium text-white'
                                : 'text-[#E5E7EB]/80 hover:bg-white/[0.04] hover:text-white'
                            }`}
                          >
                            <span>{item.title}</span>
                            {active && <span className="size-1.5 rounded-full bg-[#C8FF00]" />}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </nav>
        </aside>

        {/* Center Editorial Column */}
        <main className="min-w-0 flex-1 px-5 py-10 sm:px-10 lg:px-14">
          <article className="mx-auto max-w-[740px]">
            <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-[#E5E7EB]/75">
              <span>Docs</span>
              <ChevronRight className="size-3" />
              <span>{activePage.group}</span>
            </div>

            <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.025em] text-white sm:text-[36px]">
              {activePage.title}
            </h1>
            <p className="mt-3 text-[16px] leading-[1.65] text-[#E5E7EB]/85">{activePage.description}</p>

            <hr className="my-8 border-white/10" />

            <div className="space-y-10">
              {activePage.sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-20">
                  <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-white">
                    {section.heading}
                  </h2>

                  {section.paragraphs?.map((para, idx) => (
                    <p key={idx} className="mt-3.5 text-[14.5px] leading-[1.75] text-[#E5E7EB]">
                      {para}
                    </p>
                  ))}

                  {section.bullets && (
                    <ul className="mt-4 space-y-2.5 text-[14.5px] leading-[1.7] text-[#E5E7EB]">
                      {section.bullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[#C8FF00]" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {section.diagram === 'tecd-curve' && <TecdCurveDiagram />}
                  {section.diagram === 'trust-boundaries' && <TrustBoundariesDiagram />}
                  {section.playground && <LiveTecdPlayground />}

                  {section.code && <CodeBlock block={section.code} />}

                  {section.table && (
                    <div className="my-5 overflow-x-auto rounded-xl border border-white/12">
                      <table className="w-full text-left text-[13px]">
                        <thead className="border-b border-white/10 bg-white/[0.03] font-mono text-[11px] uppercase tracking-[0.06em] text-[#E5E7EB]">
                          <tr>
                            {section.table.headers.map((h) => (
                              <th key={h} className="px-4 py-2.5 font-medium">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.08]">
                          {section.table.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="align-top">
                              {row.map((cell, cIdx) => (
                                <td
                                  key={cIdx}
                                  className={`px-4 py-3 ${
                                    cIdx === 0
                                      ? 'font-mono text-[12.5px] font-medium text-white'
                                      : 'text-[#E5E7EB]'
                                  }`}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {section.callout && (
                    <div
                      className={`my-5 rounded-lg border-l-2 bg-white/[0.03] px-4 py-3.5 text-[13.5px] leading-[1.65] ${
                        section.callout.tone === 'warning'
                          ? 'border-[#F59E0B] text-white'
                          : 'border-[#C8FF00] text-[#E5E7EB]'
                      }`}
                    >
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white">
                        {section.callout.title}
                      </p>
                      <p className="mt-1">{section.callout.body}</p>
                    </div>
                  )}
                </section>
              ))}
            </div>

            {/* Previous / Next Pagination */}
            <div className="mt-14 grid grid-cols-1 gap-3 border-t border-white/10 pt-8 sm:grid-cols-2">
              {prevPage ? (
                <button
                  type="button"
                  onClick={() => selectPage(prevPage.id)}
                  className="group flex flex-col items-start rounded-xl border border-white/12 bg-white/[0.02] px-4 py-3.5 text-left transition-colors hover:border-[#C8FF00]/50"
                >
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#E5E7EB]/75">
                    <ArrowLeft className="size-3" /> Previous
                  </span>
                  <span className="mt-1 text-[14px] font-medium text-white group-hover:text-[#C8FF00]">
                    {prevPage.title}
                  </span>
                </button>
              ) : (
                <div />
              )}

              {nextPage && (
                <button
                  type="button"
                  onClick={() => selectPage(nextPage.id)}
                  className="group flex flex-col items-end rounded-xl border border-white/12 bg-white/[0.02] px-4 py-3.5 text-right transition-colors hover:border-[#C8FF00]/50"
                >
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#E5E7EB]/75">
                    Next <ArrowRight className="size-3" />
                  </span>
                  <span className="mt-1 text-[14px] font-medium text-white group-hover:text-[#C8FF00]">
                    {nextPage.title}
                  </span>
                </button>
              )}
            </div>
          </article>
        </main>

        {/* Right Sticky Table of Contents */}
        <aside className="hidden w-[240px] shrink-0 xl:block">
          <div className="sticky top-14 px-5 py-10">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[#E5E7EB]/70">
              On this page
            </p>
            <ul className="mt-3 space-y-2 border-l border-white/12 pl-3 text-[12.5px]">
              {activePage.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block text-[#E5E7EB]/80 transition-colors hover:text-white"
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-xl border border-white/12 bg-[#0B0D12] p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#E5E7EB]">
                  Arc Testnet
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#10B981]">
                  <span className="size-1.5 rounded-full bg-[#10B981]" />
                  5042002
                </span>
              </div>
              <p className="mt-2 truncate font-mono text-[11px] text-[#E5E7EB]/80" title={ESCROW_CONTRACT_ADDRESS}>
                {ESCROW_CONTRACT_ADDRESS}
              </p>
              <button
                type="button"
                onClick={checkLiveRpc}
                disabled={rpcStatus.loading}
                className="mt-3 w-full rounded-lg border border-white/20 bg-white/[0.04] px-2.5 py-1.5 font-mono text-[11px] text-white transition-colors hover:border-[#C8FF00] hover:text-[#C8FF00] disabled:opacity-50"
              >
                {rpcStatus.loading ? 'Querying RPC…' : 'Verify Live RPC'}
              </button>
              {rpcStatus.block && (
                <div className="mt-2.5 space-y-1 border-t border-white/10 pt-2 font-mono text-[11px] text-[#E5E7EB]">
                  <div className="flex justify-between">
                    <span>Block</span>
                    <span className="text-white">{rpcStatus.block}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Latency</span>
                    <span className="text-[#C8FF00]">{rpcStatus.latency}</span>
                  </div>
                </div>
              )}
              {rpcStatus.error && (
                <p className="mt-2 font-mono text-[10.5px] text-red-300">{rpcStatus.error}</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ⌘K Search Overlay */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 px-4 pt-24 backdrop-blur-sm"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-[540px] overflow-hidden rounded-xl border border-white/15 bg-[#0B0D12] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
              <Search className="size-4 text-[#E5E7EB]" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Diptos documentation…"
                className="w-full bg-transparent text-[14px] text-white placeholder:text-[#E5E7EB]/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px] text-[#E5E7EB]"
              >
                ESC
              </button>
            </div>
            <ul className="max-h-[340px] divide-y divide-white/[0.08] overflow-y-auto p-2">
              {searchResults.length === 0 ? (
                <li className="px-3 py-6 text-center text-[13px] text-[#E5E7EB]/75">
                  No matching documentation pages.
                </li>
              ) : (
                searchResults.map((page) => (
                  <li key={page.id}>
                    <button
                      type="button"
                      onClick={() => selectPage(page.id)}
                      className="flex w-full flex-col items-start rounded-md px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
                    >
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#C8FF00]">
                        {page.group}
                      </span>
                      <span className="mt-0.5 text-[13.5px] font-medium text-white">{page.title}</span>
                      <span className="mt-0.5 line-clamp-1 text-[12px] text-[#E5E7EB]/75">
                        {page.description}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
