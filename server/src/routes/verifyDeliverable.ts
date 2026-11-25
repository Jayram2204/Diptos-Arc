import crypto from 'node:crypto'
import { Hono } from 'hono'
import { formatEther, type Hex, keccak256, parseAbi, stringToHex, zeroAddress } from 'viem'
import {
  arcPublicClient,
  getEscrowContractAddress,
  getRegistryContractAddress,
  signMilestoneReleaseEIP712,
} from '../lib/oracleSigner.js'

export const verifyDeliverableRoute = new Hono()

export type DeliverableProofType = 'github_pr' | 'artifact_hash' | 'url_digest'

const ESCROW_READ_ABI = parseAbi([
  'function nonces(bytes32 escrowId) view returns (uint256)',
  'function getEscrowView(bytes32 escrowId) view returns ((bytes32 escrowId, address payer, address payee, uint256 amount, uint256 deadline, uint256 createdAt, uint256 fundedAt, uint256 lambdaBps, uint256 nonce, bool isAgentMode, uint8 status, bytes32 deliverableHash, string title, string acceptanceScope))',
])

const REGISTRY_READ_ABI = parseAbi([
  'function revealedDeliverables(bytes32 deliverableHash) view returns (bool)',
  'function canonicalHashes(bytes32 hash) view returns (bool)',
])

interface CheckItem {
  label: string
  passed: boolean
  detail: string
}

function toEscrowBytes32(rawId: string): Hex {
  const trimmed = rawId.trim()
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed as Hex
  return keccak256(stringToHex(`diptos:arc:5042002:${trimmed}`))
}

function normalizeSha256(raw: string): string | null {
  const cleaned = raw.trim().replace(/^0x/i, '').toLowerCase()
  return /^[0-9a-f]{64}$/.test(cleaned) ? cleaned : null
}

function parseGitHubPrUrl(prUrl: string): { owner: string; repo: string; prNumber: string } | null {
  try {
    const u = new URL(prUrl.trim())
    if (u.hostname !== 'github.com' && u.hostname !== 'www.github.com') return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length < 4 || parts[2] !== 'pull' || !/^\d+$/.test(parts[3])) return null
    return { owner: parts[0], repo: parts[1], prNumber: parts[3] }
  } catch {
    return null
  }
}

async function verifyGithubPr(payload: Record<string, unknown>): Promise<{
  approved: boolean
  sha256: string
  summary: string
  errorRecovery?: string
  checks: CheckItem[]
  evidence: Record<string, unknown>
}> {
  const prUrl = typeof payload.prUrl === 'string' ? payload.prUrl.trim() : ''
  const parsed = prUrl
    ? parseGitHubPrUrl(prUrl)
    : typeof payload.owner === 'string' && typeof payload.repo === 'string' && payload.prNumber
      ? {
          owner: payload.owner.trim(),
          repo: payload.repo.trim(),
          prNumber: String(payload.prNumber).trim(),
        }
      : null

  if (!parsed) {
    return {
      approved: false,
      sha256: '',
      summary: 'Invalid GitHub PR URL.',
      errorRecovery: 'Provide a valid GitHub pull request URL (e.g. https://github.com/owner/repo/pull/12).',
      checks: [{ label: 'GitHub PR URL format', passed: false, detail: 'Expected https://github.com/<owner>/<repo>/pull/<number>' }],
      evidence: { prUrl },
    }
  }

  const ghHeaders: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Diptos-Deterministic-Verifier/1.0',
  }
  const ghToken = process.env.GITHUB_TOKEN?.trim()
  if (ghToken) ghHeaders.Authorization = `Bearer ${ghToken}`

  const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.prNumber}`
  const prRes = await fetch(apiUrl, { headers: ghHeaders, signal: AbortSignal.timeout(8000) })

  if (!prRes.ok) {
    return {
      approved: false,
      sha256: '',
      summary: `GitHub API returned HTTP ${prRes.status} for ${parsed.owner}/${parsed.repo}#${parsed.prNumber}.`,
      errorRecovery: 'Confirm the repository is public and the pull request number exists, then retry.',
      checks: [{ label: 'GitHub API lookup', passed: false, detail: `HTTP ${prRes.status}` }],
      evidence: { apiUrl, status: prRes.status },
    }
  }

  const pr = (await prRes.json()) as Record<string, unknown>
  const merged = Boolean(pr.merged)
  const headSha = String(((pr.head as Record<string, unknown>)?.sha ?? '')).trim()
  const mergeSha = String(pr.merge_commit_sha ?? '').trim()
  const commitSha = mergeSha || headSha
  const expectedSha = typeof payload.expectedCommitSha === 'string' ? payload.expectedCommitSha.trim().toLowerCase() : ''
  const requireCi = Boolean(payload.requireCi)

  const checks: CheckItem[] = [
    {
      label: 'PR Merged',
      passed: merged,
      detail: merged
        ? `Merged (#${pr.number} "${String(pr.title ?? '')}")`
        : `PR #${pr.number} is ${String(pr.state ?? 'open')} and not merged yet`,
    },
    {
      label: 'Commit SHA',
      passed: Boolean(commitSha) && (!expectedSha || commitSha.toLowerCase().startsWith(expectedSha) || headSha.toLowerCase().startsWith(expectedSha)),
      detail: expectedSha
        ? `commit=${commitSha.slice(0, 12)} vs expected=${expectedSha.slice(0, 12)}`
        : `commit=${commitSha.slice(0, 12)}`,
    },
  ]

  let ciPassed = true
  if (requireCi && headSha) {
    try {
      const ciRes = await fetch(
        `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits/${headSha}/check-runs`,
        { headers: ghHeaders, signal: AbortSignal.timeout(8000) },
      )
      if (ciRes.ok) {
        const ciData = (await ciRes.json()) as { check_runs?: Array<{ name?: string; status?: string; conclusion?: string }> }
        const runs = ciData.check_runs ?? []
        const failed = runs.filter((r) => r.status !== 'completed' || (r.conclusion !== 'success' && r.conclusion !== 'neutral' && r.conclusion !== 'skipped'))
        ciPassed = runs.length > 0 && failed.length === 0
        checks.push({
          label: 'CI Check Runs',
          passed: ciPassed,
          detail: runs.length === 0 ? 'No CI check runs found on commit' : `${runs.length - failed.length}/${runs.length} checks green`,
        })
      } else {
        ciPassed = false
        checks.push({ label: 'CI Check Runs', passed: false, detail: `GitHub Checks API HTTP ${ciRes.status}` })
      }
    } catch (e) {
      ciPassed = false
      checks.push({ label: 'CI Check Runs', passed: false, detail: (e as Error).message.slice(0, 80) })
    }
  }

  const allPassed = checks.every((ch) => ch.passed)
  const evidence = {
    owner: parsed.owner,
    repo: parsed.repo,
    prNumber: Number(parsed.prNumber),
    title: pr.title,
    merged,
    mergeCommitSha: mergeSha,
    headSha,
    mergedAt: pr.merged_at ?? null,
    additions: pr.additions ?? 0,
    deletions: pr.deletions ?? 0,
  }
  const sha256 = crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex')

  return {
    approved: allPassed,
    sha256,
    summary: allPassed
      ? `GitHub PR #${parsed.prNumber} verified merged (${commitSha.slice(0, 10)}) with deterministic SHA-256 digest.`
      : `Verification blocked: ${checks.filter((ch) => !ch.passed).map((ch) => ch.detail).join('; ')}.`,
    errorRecovery: allPassed
      ? undefined
      : !merged
        ? 'Merge this pull request on GitHub first, then re-run deterministic verification.'
        : 'Confirm the commit SHA and CI check status on GitHub, then retry verification.',
    checks,
    evidence,
  }
}

async function verifyArtifactHash(payload: Record<string, unknown>): Promise<{
  approved: boolean
  sha256: string
  summary: string
  errorRecovery?: string
  checks: CheckItem[]
  evidence: Record<string, unknown>
}> {
  const rawSha = typeof payload.sha256 === 'string' ? payload.sha256 : ''
  const rawContent = typeof payload.artifactContent === 'string' ? payload.artifactContent : ''
  const computedSha = rawSha
    ? normalizeSha256(rawSha)
    : rawContent
      ? crypto.createHash('sha256').update(rawContent, 'utf8').digest('hex')
      : null

  if (!computedSha) {
    return {
      approved: false,
      sha256: '',
      summary: 'Invalid or missing SHA-256 artifact hash.',
      errorRecovery: 'Supply a 64-character hex SHA-256 hash (with or without 0x prefix) or raw artifactContent.',
      checks: [{ label: 'SHA-256 Format', passed: false, detail: 'Expected 64 hex chars' }],
      evidence: {},
    }
  }

  const expectedRaw = typeof payload.expectedSha256 === 'string' ? payload.expectedSha256.trim() : ''
  const expectedSha = expectedRaw ? normalizeSha256(expectedRaw) : null
  const hashMatchesExpected = !expectedRaw || (expectedSha !== null && expectedSha === computedSha)

  const checks: CheckItem[] = [
    { label: 'SHA-256 Digest Valid', passed: true, detail: `0x${computedSha.slice(0, 16)}…` },
  ]
  if (expectedRaw) {
    checks.push({
      label: 'Expected Hash Match',
      passed: hashMatchesExpected,
      detail: hashMatchesExpected
        ? 'Exact 256-bit digest match'
        : `Mismatch: received 0x${computedSha.slice(0, 12)}… != expected 0x${(expectedSha ?? expectedRaw).slice(0, 12)}…`,
    })
  }

  const requireRegistryReveal = Boolean(payload.requireOnChainCommit)
  const proofBytes32 = `0x${computedSha}` as Hex
  let onChainRevealed = false
  try {
    onChainRevealed = await arcPublicClient.readContract({
      address: getRegistryContractAddress(),
      abi: REGISTRY_READ_ABI,
      functionName: 'revealedDeliverables',
      args: [proofBytes32],
    })
  } catch {
    onChainRevealed = false
  }

  if (requireRegistryReveal) {
    checks.push({
      label: 'DiptosRegistry On-Chain Reveal',
      passed: onChainRevealed,
      detail: onChainRevealed
        ? 'Matched revealedDeliverables in DiptosRegistry.sol'
        : 'Hash not yet revealed in DiptosRegistry.sol (call revealDeliverable first)',
    })
  } else {
    checks.push({
      label: 'DiptosRegistry Status',
      passed: true,
      detail: onChainRevealed
        ? 'Confirmed in DiptosRegistry.revealedDeliverables'
        : 'Ready for atomic on-chain settlement commitment',
    })
  }

  const allPassed = checks.every((ch) => ch.passed)
  return {
    approved: allPassed,
    sha256: computedSha,
    summary: allPassed
      ? `Artifact SHA-256 (0x${computedSha.slice(0, 14)}…) deterministically verified.`
      : `Artifact verification failed: ${checks.filter((ch) => !ch.passed).map((ch) => ch.detail).join('; ')}.`,
    errorRecovery: allPassed
      ? undefined
      : !hashMatchesExpected
        ? 'Re-compute the deliverable SHA-256 checksum and ensure it matches the agreed expected hash.'
        : 'Call DiptosRegistry.revealDeliverable() on Arc Testnet first, then retry.',
    checks,
    evidence: { sha256: computedSha, expectedSha256: expectedSha, onChainRevealed },
  }
}

async function verifyUrlDigest(payload: Record<string, unknown>): Promise<{
  approved: boolean
  sha256: string
  summary: string
  errorRecovery?: string
  checks: CheckItem[]
  evidence: Record<string, unknown>
}> {
  const urlStr = typeof payload.url === 'string' ? payload.url.trim() : ''
  let parsed: URL
  try {
    parsed = new URL(urlStr)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Invalid protocol')
  } catch {
    return {
      approved: false,
      sha256: '',
      summary: 'Invalid deliverable URL.',
      errorRecovery: 'Provide a valid http:// or https:// deliverable URL.',
      checks: [{ label: 'URL Format', passed: false, detail: 'Expected https://…' }],
      evidence: { url: urlStr },
    }
  }

  try {
    const res = await fetch(parsed.toString(), {
      headers: { 'User-Agent': 'Diptos-Deterministic-Verifier/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    const buf = Buffer.from(await res.arrayBuffer())
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex')
    const reachable = res.status >= 200 && res.status < 400
    const expectedRaw = typeof payload.expectedSha256 === 'string' ? payload.expectedSha256.trim() : ''
    const expectedSha = expectedRaw ? normalizeSha256(expectedRaw) : null
    const hashOk = !expectedRaw || (expectedSha !== null && expectedSha === sha256)

    const checks: CheckItem[] = [
      { label: 'HTTP Reachability', passed: reachable, detail: `HTTP ${res.status} (${buf.byteLength} bytes)` },
      { label: 'Content SHA-256 Digest', passed: true, detail: `0x${sha256.slice(0, 16)}…` },
    ]
    if (expectedRaw) {
      checks.push({
        label: 'Expected Content Hash',
        passed: hashOk,
        detail: hashOk ? 'Exact content hash match' : `Mismatch: live 0x${sha256.slice(0, 12)}… != expected`,
      })
    }

    const allPassed = checks.every((ch) => ch.passed)
    return {
      approved: allPassed,
      sha256,
      summary: allPassed
        ? `Live URL verified (HTTP ${res.status}, ${buf.byteLength} bytes, SHA-256 0x${sha256.slice(0, 12)}…).`
        : `URL verification failed: ${checks.filter((ch) => !ch.passed).map((ch) => ch.detail).join('; ')}.`,
      errorRecovery: allPassed
        ? undefined
        : !reachable
          ? 'Ensure the deployed deliverable URL returns HTTP 200–399 publicly, then retry.'
          : 'The live response SHA-256 does not match the expected digest. Redeploy or verify the hash.',
      checks,
      evidence: {
        url: parsed.toString(),
        httpStatus: res.status,
        contentType: res.headers.get('content-type') || 'unknown',
        byteLength: buf.byteLength,
        sha256,
      },
    }
  } catch (err) {
    return {
      approved: false,
      sha256: '',
      summary: `Deliverable URL unreachable: ${(err as Error).message.slice(0, 90)}`,
      errorRecovery: 'Verify DNS/SSL and confirm the URL responds within 8 seconds, then retry.',
      checks: [{ label: 'HTTP Reachability', passed: false, detail: (err as Error).message.slice(0, 90) }],
      evidence: { url: parsed.toString() },
    }
  }
}

verifyDeliverableRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid JSON payload' }, 400)
  }

  const escrowIdRaw = typeof body.escrowId === 'string' ? body.escrowId.trim() : ''
  const proofType = typeof body.proofType === 'string' ? (body.proofType.trim() as DeliverableProofType) : ''
  const payload = body.payload && typeof body.payload === 'object' ? (body.payload as Record<string, unknown>) : {}
  const milestoneIndex = Math.max(0, Math.floor(Number(body.milestoneIndex ?? 0)))

  if (!escrowIdRaw) {
    return c.json({ error: 'escrowId is required' }, 400)
  }
  if (proofType !== 'github_pr' && proofType !== 'artifact_hash' && proofType !== 'url_digest') {
    return c.json(
      { error: 'proofType must be one of: github_pr | artifact_hash | url_digest' },
      400,
    )
  }

  const escrowIdBytes32 = toEscrowBytes32(escrowIdRaw)
  const escrowContract = getEscrowContractAddress()

  let onChainNonce = 0n
  let onChainAmountUsdc = 0
  try {
    const [nonce, view] = await Promise.all([
      arcPublicClient.readContract({
        address: escrowContract,
        abi: ESCROW_READ_ABI,
        functionName: 'nonces',
        args: [escrowIdBytes32],
      }),
      arcPublicClient.readContract({
        address: escrowContract,
        abi: ESCROW_READ_ABI,
        functionName: 'getEscrowView',
        args: [escrowIdBytes32],
      }),
    ])
    onChainNonce = nonce
    if (view && view.payer !== zeroAddress) {
      onChainAmountUsdc = Number(formatEther(view.amount))
    }
  } catch {
    // Allow deterministic check even if escrow has not been seeded yet; nonce stays 0n
  }

  const outcome =
    proofType === 'github_pr'
      ? await verifyGithubPr(payload)
      : proofType === 'artifact_hash'
        ? await verifyArtifactHash(payload)
        : await verifyUrlDigest(payload)

  const proofHash: Hex =
    proofType === 'artifact_hash' && outcome.sha256
      ? (`0x${outcome.sha256}` as Hex)
      : keccak256(
          stringToHex(
            JSON.stringify({
              escrowIdBytes32,
              milestoneIndex,
              proofType,
              sha256: outcome.sha256,
              evidence: outcome.evidence,
            }),
          ),
        )

  let eip712Signature: Hex | undefined
  let verifier: string | undefined

  if (outcome.approved) {
    const signed = await signMilestoneReleaseEIP712({
      escrowId: escrowIdBytes32,
      milestoneIndex: BigInt(milestoneIndex),
      deliverableHash: proofHash,
      nonce: onChainNonce,
    })
    if (signed) {
      eip712Signature = signed.signature
      verifier = signed.oracleSigner
    }
  }

  return c.json(
    {
      approved: outcome.approved,
      proofType,
      escrowId: escrowIdRaw,
      escrowIdBytes32,
      milestoneIndex,
      amountUsdc: onChainAmountUsdc,
      proofHash,
      deliverableHash: proofHash,
      sha256: outcome.sha256 || undefined,
      nonce: Number(onChainNonce),
      eip712Signature,
      verifier,
      nonCustodial: true,
      summary: outcome.summary,
      errorRecovery: outcome.errorRecovery,
      checks: outcome.checks,
      evidence: outcome.evidence,
      verifiedAt: new Date().toISOString(),
    },
    outcome.approved ? 200 : 422,
  )
})
