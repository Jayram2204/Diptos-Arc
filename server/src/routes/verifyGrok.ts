import { Hono } from 'hono'
import { formatEther, type Hex, keccak256, parseAbi, stringToHex, zeroAddress } from 'viem'
import {
  arcPublicClient,
  getEscrowContractAddress,
  signMilestoneReleaseEIP712,
} from '../lib/oracleSigner.js'

export const verifyGrokRoute = new Hono()

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions'
const ESCROW_VIEW_ABI = parseAbi([
  'function getEscrowView(bytes32 escrowId) view returns ((bytes32 escrowId, address payer, address payee, uint256 amount, uint256 deadline, uint256 createdAt, uint256 fundedAt, uint256 lambdaBps, uint256 nonce, bool isAgentMode, uint8 status, bytes32 deliverableHash))',
])

interface EvidenceBundle {
  kind: 'github-pr' | 'github-repo' | 'live-url' | 'notes-only'
  summary: string
  rawEvidence: Record<string, unknown>
}

function toEscrowBytes32(rawId: string): Hex {
  const trimmed = rawId.trim()
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed as Hex
  return keccak256(stringToHex(`diptos:arc:5042002:${trimmed}`))
}

async function ingestDeepEvidence(deliverableUrl?: string): Promise<EvidenceBundle> {
  if (!deliverableUrl) {
    return { kind: 'notes-only', summary: 'Auditing submitted deliverable notes.', rawEvidence: {} }
  }

  try {
    const url = new URL(deliverableUrl)
    const ghHeaders = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Diptos-Grok-Oracle/2.0',
    }

    if (url.hostname === 'github.com') {
      const parts = url.pathname.split('/').filter(Boolean)

      if (parts.length >= 4 && parts[2] === 'pull') {
        const base = `https://api.github.com/repos/${parts[0]}/${parts[1]}/pulls/${parts[3]}`
        const [prRes, filesRes, commitsRes] = await Promise.all([
          fetch(base, { headers: ghHeaders, signal: AbortSignal.timeout(7000) }),
          fetch(`${base}/files?per_page=15`, { headers: ghHeaders, signal: AbortSignal.timeout(7000) }),
          fetch(`${base}/commits?per_page=10`, { headers: ghHeaders, signal: AbortSignal.timeout(7000) }),
        ])

        if (prRes.ok) {
          const pr = (await prRes.json()) as Record<string, unknown>
          const files = filesRes.ok
            ? ((await filesRes.json()) as Record<string, unknown>[]).map((f) => ({
                filename: f.filename,
                status: f.status,
                additions: f.additions,
                deletions: f.deletions,
              }))
            : []
          const commits = commitsRes.ok
            ? ((await commitsRes.json()) as Record<string, unknown>[]).map((cm) => ({
                sha: String(cm.sha ?? '').slice(0, 8),
                message: String(((cm.commit as Record<string, unknown>)?.message ?? '')).split('\n')[0],
              }))
            : []

          const summary = `GitHub PR #${pr.number} "${pr.title}" (state=${pr.state}, merged=${pr.merged}, +${pr.additions}/-${pr.deletions}, files=${files.length}, commits=${commits.length})`
          return {
            kind: 'github-pr',
            summary,
            rawEvidence: {
              url: deliverableUrl,
              number: pr.number,
              title: pr.title,
              state: pr.state,
              merged: pr.merged,
              additions: pr.additions,
              deletions: pr.deletions,
              changedFiles: files,
              commits,
              body: String(pr.body ?? '').slice(0, 1200),
            },
          }
        }
      }

      if (parts.length >= 2) {
        const base = `https://api.github.com/repos/${parts[0]}/${parts[1]}`
        const [repoRes, commitsRes] = await Promise.all([
          fetch(base, { headers: ghHeaders, signal: AbortSignal.timeout(7000) }),
          fetch(`${base}/commits?per_page=5`, { headers: ghHeaders, signal: AbortSignal.timeout(7000) }),
        ])
        if (repoRes.ok) {
          const repo = (await repoRes.json()) as Record<string, unknown>
          const commits = commitsRes.ok
            ? ((await commitsRes.json()) as Record<string, unknown>[]).map((cm) => ({
                sha: String(cm.sha ?? '').slice(0, 8),
                message: String(((cm.commit as Record<string, unknown>)?.message ?? '')).split('\n')[0],
              }))
            : []
          const summary = `GitHub Repo ${repo.full_name} (lang=${repo.language}, pushed=${repo.pushed_at}, recentCommits=${commits.length})`
          return {
            kind: 'github-repo',
            summary,
            rawEvidence: {
              url: deliverableUrl,
              fullName: repo.full_name,
              description: repo.description,
              language: repo.language,
              pushedAt: repo.pushed_at,
              commits,
            },
          }
        }
      }
    }

    const pageRes = await fetch(deliverableUrl, {
      headers: { 'User-Agent': 'Diptos-Grok-Oracle/2.0' },
      signal: AbortSignal.timeout(7000),
    })
    const contentType = pageRes.headers.get('content-type') || 'unknown'
    const serverHeader = pageRes.headers.get('server') || 'unknown'
    const text = contentType.includes('text/html') ? await pageRes.text() : ''
    const titleMatch = text.match(/<title[^>]*>([^<]{1,180})<\/title>/i)
    const pageTitle = titleMatch ? titleMatch[1].trim() : ''

    const summary = `Live URL HTTP ${pageRes.status} (${contentType}${pageTitle ? `, title="${pageTitle}"` : ''})`
    return {
      kind: 'live-url',
      summary,
      rawEvidence: {
        url: deliverableUrl,
        httpStatus: pageRes.status,
        contentType,
        serverHeader,
        pageTitle,
      },
    }
  } catch (err) {
    return {
      kind: 'live-url',
      summary: `Submitted URL ${deliverableUrl} (probe warning: ${(err as Error).message.slice(0, 80)})`,
      rawEvidence: { url: deliverableUrl, probeError: (err as Error).message },
    }
  }
}

verifyGrokRoute.post('/', async (c) => {
  const apiKey = process.env.XAI_API_KEY?.trim()
  if (!apiKey) {
    return c.json(
      {
        error: 'XAI_API_KEY is not configured on the server.',
        hint: 'Set XAI_API_KEY in Vercel Environment Variables to enable live Grok deliverable audits.',
      },
      503,
    )
  }

  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid JSON payload' }, 400)
  }

  const escrowIdRaw = typeof body.escrowId === 'string' ? body.escrowId.trim() : ''
  const milestoneIndex = Math.max(0, Math.floor(Number(body.milestoneIndex ?? 0)))
  const deliverableUrl = typeof body.deliverableUrl === 'string' ? body.deliverableUrl.trim() : ''
  const deliverableNotes = typeof body.deliverableNotes === 'string' ? body.deliverableNotes.trim() : ''

  if (!escrowIdRaw) return c.json({ error: 'escrowId is required' }, 400)
  if (!deliverableUrl && !deliverableNotes) {
    return c.json({ error: 'Provide deliverableUrl or deliverableNotes to audit' }, 400)
  }

  const escrowIdBytes32 = toEscrowBytes32(escrowIdRaw)
  let onChainAmountUsdc = Number(body.amountUsdc ?? 0)
  let onChainNonce = Number(body.nonce ?? 0)
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : `Arc Escrow ${escrowIdBytes32.slice(0, 10)}`
  const scope =
    typeof body.scope === 'string' && body.scope.trim()
      ? body.scope.trim()
      : 'Deliverable must match the agreed programmable escrow specification.'

  const escrowContract = getEscrowContractAddress()
  if (escrowContract) {
    try {
      const view = (await arcPublicClient.readContract({
        address: escrowContract,
        abi: ESCROW_VIEW_ABI,
        functionName: 'getEscrowView',
        args: [escrowIdBytes32],
      })) as {
        payer: string
        amount: bigint
        nonce: bigint
      }
      if (view && view.payer !== zeroAddress) {
        onChainAmountUsdc = Number(formatEther(view.amount))
        onChainNonce = Number(view.nonce)
      }
    } catch {
      // Proceed with intent parameters if escrow is pre-funding
    }
  }

  const evidence = await ingestDeepEvidence(deliverableUrl)
  const model = process.env.XAI_MODEL?.trim() || 'grok-3-mini'

  const canonicalEvidencePayload = JSON.stringify({
    escrowIdBytes32,
    milestoneIndex,
    deliverableUrl,
    deliverableNotes,
    evidenceKind: evidence.kind,
    evidenceSummary: evidence.summary,
    rawEvidence: evidence.rawEvidence,
  })
  const deliverableHash = keccak256(stringToHex(canonicalEvidencePayload))

  const systemPrompt = [
    'You are Diptos Grok Oracle, an autonomous cryptographic deliverable auditor for programmable USDC escrows on Arc Testnet.',
    'Evaluate the fetched technical evidence and deliverable notes strictly against the agreed escrow scope.',
    'Respond ONLY with valid JSON matching: {"approved": boolean, "confidence": number (0..1), "summary": string (max 240 chars), "reasoning": string (max 600 chars)}',
  ].join(' ')

  const userPrompt = [
    `Escrow Title: ${title}`,
    `Escrow ID: ${escrowIdBytes32}`,
    `Milestone Index: ${milestoneIndex}`,
    `Agreed Scope: ${scope}`,
    `Amount: ${onChainAmountUsdc} USDC`,
    `Evidence Summary: ${evidence.summary}`,
    `Technical Evidence JSON: ${JSON.stringify(evidence.rawEvidence).slice(0, 2400)}`,
    deliverableNotes ? `Deliverable Notes: ${deliverableNotes}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const res = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    })

    if (!res.ok) {
      const errText = await res.text()
      return c.json(
        { error: `xAI Grok API returned HTTP ${res.status}`, detail: errText.slice(0, 300) },
        502,
      )
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as {
      approved?: boolean
      confidence?: number
      summary?: string
      reasoning?: string
    }

    const approved = Boolean(parsed.approved)
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? (approved ? 0.9 : 0.2))))
    const summary = String(parsed.summary ?? 'Audit completed by Grok Oracle.')
    const auditReasoning = String(parsed.reasoning ?? summary)

    let eip712Signature: Hex | undefined
    let oracleSigner: string | undefined

    if (approved) {
      const signed = await signMilestoneReleaseEIP712({
        escrowId: escrowIdBytes32,
        milestoneIndex: BigInt(milestoneIndex),
        deliverableHash,
        nonce: BigInt(onChainNonce),
      })
      if (signed) {
        eip712Signature = signed.signature
        oracleSigner = signed.oracleSigner
      }
    }

    return c.json({
      approved,
      confidence,
      summary,
      auditReasoning,
      grokModel: model,
      milestoneIndex,
      nonce: onChainNonce,
      deliverableUrl: deliverableUrl || undefined,
      deliverableHash,
      evidenceHash: deliverableHash,
      evidenceSummary: evidence.summary,
      eip712Signature,
      signature: eip712Signature,
      oracleSigner,
      auditedAt: new Date().toISOString(),
    })
  } catch (err) {
    return c.json(
      { error: 'Grok verification request failed', detail: (err as Error).message },
      502,
    )
  }
})
