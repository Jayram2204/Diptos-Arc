import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  Menu,
  Search,
  Terminal,
  X,
} from 'lucide-react'
import { ESCROW_CONTRACT_ADDRESS } from '@/config/protocol'
import { getApexUrl, getAppUrl } from '@/lib/route'
import { diptos } from '@/lib/sdk'
import { DOC_GROUPS, DOC_PAGES, type DocPage } from './docsData'

function CodeBlock({
  code,
  filename,
  showPkgTabs,
}: {
  code: string
  filename?: string
  showPkgTabs?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [pm, setPm] = useState<'pnpm' | 'npm' | 'yarn'>('pnpm')

  const displayedCode = useMemo(() => {
    if (!showPkgTabs) return code
    if (pm === 'npm') return code.replace('pnpm add', 'npm install')
    if (pm === 'yarn') return code.replace('pnpm add', 'yarn add')
    return code
  }, [code, pm, showPkgTabs])

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
    <div className="my-5 overflow-hidden rounded-lg border border-white/[0.09] bg-[#0B0D12]">
      <div className="flex items-center justify-between border-b border-white/[0.07] bg-white/[0.02] px-3.5 py-2">
        <div className="flex items-center gap-2">
          {showPkgTabs ? (
            <div className="flex items-center gap-1">
              {(['pnpm', 'npm', 'yarn'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPm(tab)}
                  className={`rounded px-2 py-0.5 font-mono text-[11px] transition-colors ${
                    pm === tab
                      ? 'bg-white/[0.1] text-[#F4F2EC]'
                      : 'text-[#8E93A4] hover:text-[#F4F2EC]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-[#8E93A4]">
              <Terminal className="size-3 text-[#6E7485]" />
              {filename ?? 'typescript'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code"
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[11px] text-[#8E93A4] transition-colors hover:bg-white/[0.06] hover:text-[#F4F2EC]"
        >
          {copied ? <Check className="size-3 text-[#10B981]" /> : <Copy className="size-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.65] text-[#E6E4DD]">
        <code>{displayedCode}</code>
      </pre>
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
    lambda?: number
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
      const [tel, risk] = await Promise.all([
        diptos.getArcTelemetry(),
        diptos.getLiveGeminiRisk(),
      ])
      setRpcStatus({
        loading: false,
        block: `#${Number(tel.blockNumber).toLocaleString('en-US')}`,
        lambda: risk.recommendedLambda,
      })
    } catch (e) {
      setRpcStatus({ loading: false, error: (e as Error).message })
    }
  }

  return (
    <div className="min-h-screen bg-[#090A0D] text-[#E6E4DD] antialiased">
      {/* Top Documentation Bar (56px, Antseed-style) */}
      <header className="sticky top-0 z-40 h-14 border-b border-white/[0.08] bg-[#090A0D]/90 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label="Toggle docs navigation"
              className="grid size-8 place-items-center rounded-md border border-white/[0.1] text-[#A1A6B5] hover:text-white lg:hidden"
            >
              {mobileNavOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
            <a
              href={getApexUrl()}
              className="rwa-display inline-flex items-baseline text-[17px] tracking-[-0.04em] text-[#F4F2EC]"
            >
              DIPTOS<span className="ml-0.5 inline-block size-1.5 rounded-full bg-[#C8FF00]" />
            </a>
            <span className="text-white/20">/</span>
            <span className="font-mono text-[12px] font-medium text-[#A1A6B5]">Docs</span>
            <span className="hidden rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-[#8E93A4] sm:inline-block">
              @diptos/sdk v1.0.0
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-8 items-center gap-2.5 rounded-md border border-white/[0.1] bg-white/[0.02] px-3 text-[12.5px] text-[#8E93A4] transition-colors hover:border-white/[0.18] hover:text-[#E6E4DD]"
            >
              <Search className="size-3.5" />
              <span className="hidden sm:inline">Search documentation…</span>
              <kbd className="hidden rounded border border-white/[0.12] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-[#8E93A4] sm:inline">
                ⌘K
              </kbd>
            </button>

            <nav className="hidden items-center gap-4 text-[12.5px] text-[#A1A6B5] md:flex">
              <a
                href={getAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-[#F4F2EC]"
              >
                App <ArrowUpRight className="size-3" />
              </a>
              <a
                href="https://github.com/Jayram2204/Diptos-Arc"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-[#F4F2EC]"
              >
                GitHub <ArrowUpRight className="size-3" />
              </a>
              <a
                href="https://www.npmjs.com/package/@diptos/sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-[#F4F2EC]"
              >
                npm <ArrowUpRight className="size-3" />
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main 3-Column Documentation Layout */}
      <div className="mx-auto flex max-w-[1440px]">
        {/* Left Navigation Sidebar */}
        <aside
          className={`${
            mobileNavOpen ? 'fixed inset-y-14 left-0 z-30 block w-[264px]' : 'hidden'
          } shrink-0 border-r border-white/[0.08] bg-[#07080B] lg:sticky lg:top-14 lg:block lg:h-[calc(100vh-3.5rem)] lg:w-[252px] lg:overflow-y-auto`}
        >
          <nav className="space-y-6 px-4 py-6" aria-label="Documentation sections">
            {DOC_GROUPS.map((group) => {
              const items = DOC_PAGES.filter((p) => p.group === group)
              return (
                <div key={group}>
                  <p className="px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6E7485]">
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
                            className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13.5px] transition-colors ${
                              active
                                ? 'bg-white/[0.07] font-medium text-[#F4F2EC]'
                                : 'text-[#9A9FB0] hover:bg-white/[0.03] hover:text-[#E6E4DD]'
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

        {/* Center Editorial Documentation Column */}
        <main className="min-w-0 flex-1 px-5 py-10 sm:px-10 lg:px-14">
          <article className="mx-auto max-w-[740px]">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-[#7F8596]">
              <span>Docs</span>
              <ChevronRight className="size-3" />
              <span>{activePage.group}</span>
            </div>

            {/* Page Title & Lead */}
            <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.025em] text-[#F4F2EC] sm:text-[36px]">
              {activePage.title}
            </h1>
            <p className="mt-3 text-[16px] leading-[1.65] text-[#9FA4B4]">
              {activePage.description}
            </p>

            <hr className="my-8 border-white/[0.08]" />

            {/* Structured Page Sections */}
            <div className="space-y-10">
              {activePage.sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-20">
                  <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-[#F4F2EC]">
                    {section.heading}
                  </h2>

                  {section.paragraphs?.map((para, idx) => (
                    <p key={idx} className="mt-3.5 text-[14.5px] leading-[1.75] text-[#B8BCC9]">
                      {para}
                    </p>
                  ))}

                  {section.bullets && (
                    <ul className="mt-4 space-y-2.5 text-[14.5px] leading-[1.7] text-[#B8BCC9]">
                      {section.bullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[#6E7485]" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {section.code && (
                    <CodeBlock
                      code={section.code.code}
                      filename={section.code.filename}
                      showPkgTabs={section.code.code.startsWith('pnpm add')}
                    />
                  )}

                  {section.table && (
                    <div className="my-5 overflow-x-auto rounded-lg border border-white/[0.08]">
                      <table className="w-full text-left text-[13px]">
                        <thead className="border-b border-white/[0.08] bg-white/[0.02] font-mono text-[11px] uppercase tracking-[0.06em] text-[#8E93A4]">
                          <tr>
                            {section.table.headers.map((h) => (
                              <th key={h} className="px-4 py-2.5 font-medium">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06]">
                          {section.table.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="align-top">
                              {row.map((cell, cIdx) => (
                                <td
                                  key={cIdx}
                                  className={`px-4 py-3 ${
                                    cIdx === 0
                                      ? 'font-mono text-[12.5px] font-medium text-[#F4F2EC]'
                                      : 'text-[#B8BCC9]'
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
                      className={`my-5 rounded-lg border-l-2 bg-white/[0.025] px-4 py-3.5 text-[13.5px] leading-[1.65] ${
                        section.callout.tone === 'warning'
                          ? 'border-[#F59E0B] text-[#E6DFD0]'
                          : 'border-[#C8FF00] text-[#C8CCD8]'
                      }`}
                    >
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[#F4F2EC]">
                        {section.callout.title}
                      </p>
                      <p className="mt-1">{section.callout.body}</p>
                    </div>
                  )}
                </section>
              ))}
            </div>

            {/* Previous / Next Pagination */}
            <div className="mt-14 grid grid-cols-1 gap-3 border-t border-white/[0.08] pt-8 sm:grid-cols-2">
              {prevPage ? (
                <button
                  type="button"
                  onClick={() => selectPage(prevPage.id)}
                  className="group flex flex-col items-start rounded-lg border border-white/[0.08] bg-white/[0.015] px-4 py-3.5 text-left transition-colors hover:border-white/[0.18]"
                >
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#7F8596]">
                    <ArrowLeft className="size-3" /> Previous
                  </span>
                  <span className="mt-1 text-[14px] font-medium text-[#F4F2EC] group-hover:text-[#C8FF00]">
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
                  className="group flex flex-col items-end rounded-lg border border-white/[0.08] bg-white/[0.015] px-4 py-3.5 text-right transition-colors hover:border-white/[0.18]"
                >
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#7F8596]">
                    Next <ArrowRight className="size-3" />
                  </span>
                  <span className="mt-1 text-[14px] font-medium text-[#F4F2EC] group-hover:text-[#C8FF00]">
                    {nextPage.title}
                  </span>
                </button>
              )}
            </div>
          </article>
        </main>

        {/* Right Sticky Table of Contents */}
        <aside className="hidden w-[236px] shrink-0 xl:block">
          <div className="sticky top-14 px-5 py-10">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6E7485]">
              On this page
            </p>
            <ul className="mt-3 space-y-2 border-l border-white/[0.08] pl-3 text-[12.5px]">
              {activePage.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block text-[#8E93A4] transition-colors hover:text-[#F4F2EC]"
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
            </ul>

            {/* Minimal Live Arc Testnet RPC Check */}
            <div className="mt-8 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#8E93A4]">
                  Arc Testnet
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#10B981]">
                  <span className="size-1.5 rounded-full bg-[#10B981]" />
                  5042002
                </span>
              </div>
              <p className="mt-2 truncate font-mono text-[11px] text-[#9A9FB0]" title={ESCROW_CONTRACT_ADDRESS}>
                {ESCROW_CONTRACT_ADDRESS}
              </p>
              <button
                type="button"
                onClick={checkLiveRpc}
                disabled={rpcStatus.loading}
                className="mt-3 w-full rounded border border-white/[0.12] bg-white/[0.03] px-2.5 py-1.5 font-mono text-[11px] text-[#E6E4DD] transition-colors hover:border-white/[0.24] disabled:opacity-50"
              >
                {rpcStatus.loading ? 'Querying RPC…' : 'Verify Live RPC'}
              </button>
              {rpcStatus.block && (
                <div className="mt-2.5 space-y-1 border-t border-white/[0.07] pt-2 font-mono text-[11px] text-[#A1A6B5]">
                  <div className="flex justify-between">
                    <span>Block</span>
                    <span className="text-[#F4F2EC]">{rpcStatus.block}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gemini λ</span>
                    <span className="text-[#C8FF00]">{rpcStatus.lambda?.toFixed(3)}</span>
                  </div>
                </div>
              )}
              {rpcStatus.error && (
                <p className="mt-2 font-mono text-[10.5px] text-red-400">{rpcStatus.error}</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ⌘K Search Overlay */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 px-4 pt-24 backdrop-blur-sm"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-[540px] overflow-hidden rounded-xl border border-white/[0.12] bg-[#0D0F14] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-white/[0.08] px-4 py-3">
              <Search className="size-4 text-[#7F8596]" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Diptos documentation…"
                className="w-full bg-transparent text-[14px] text-[#F4F2EC] placeholder:text-[#6E7485] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="rounded border border-white/[0.1] px-1.5 py-0.5 font-mono text-[10px] text-[#8E93A4]"
              >
                ESC
              </button>
            </div>
            <ul className="max-h-[340px] divide-y divide-white/[0.05] overflow-y-auto p-2">
              {searchResults.length === 0 ? (
                <li className="px-3 py-6 text-center text-[13px] text-[#7F8596]">
                  No matching documentation pages.
                </li>
              ) : (
                searchResults.map((page) => (
                  <li key={page.id}>
                    <button
                      type="button"
                      onClick={() => selectPage(page.id)}
                      className="flex w-full flex-col items-start rounded-md px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
                    >
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#7F8596]">
                        {page.group}
                      </span>
                      <span className="mt-0.5 text-[13.5px] font-medium text-[#F4F2EC]">
                        {page.title}
                      </span>
                      <span className="mt-0.5 line-clamp-1 text-[12px] text-[#8E93A4]">
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
