export type EscrowMode = 'human' | 'agent'
export type EscrowStatus = 'created' | 'funded' | 'verified' | 'settled' | 'refunded'

export interface GrokAuditRecord {
  approved: boolean
  confidence: number
  summary: string
  auditReasoning?: string
  grokModel?: string
  milestoneIndex?: number
  nonce?: number
  deliverableUrl?: string
  deliverableHash: `0x${string}`
  evidenceHash?: `0x${string}`
  evidenceSummary?: string
  eip712Signature?: `0x${string}`
  signature?: string
  oracleSigner?: string
  auditedAt: string
}

export interface CounterpartyStatsDto {
  completedOnTime: number
  completedLate: number
  totalVolumeSettledUsdc: number
  averageLatencySeconds: number
}

export interface EscrowRecord {
  id: string
  escrowIdBytes32: `0x${string}`
  title: string
  scope: string
  amountUsdc: number
  deadline: string
  deadlineUnix: number
  deadlineHours: number
  mode: EscrowMode
  payer?: string
  payee: string
  nonce?: number
  txHash?: string
  settleTxHash?: string
  tecdLambda: number
  tecdLambdaBps: number
  status: EscrowStatus
  grokAudit?: GrokAuditRecord
  createdAt: string
  onChain?: boolean
}

export interface GeminiContractSnapshot {
  instrumentSymbol: string
  title: string
  yesProbability: number
  noProbability: number
  status: string
}

export interface GeminiRiskSnapshot {
  source: 'gemini-prediction-markets'
  fetchedAt: string
  volatilityIndex: number
  recommendedLambda: number
  recommendedLambdaBps: number
  contracts: GeminiContractSnapshot[]
}

export interface StreamEvent {
  id: string
  source: 'quicknode' | 'arc-rpc'
  eventName:
    | 'EscrowCreated'
    | 'MilestoneSettled'
    | 'EscrowSettled'
    | 'TECDPenaltyApplied'
    | 'TimeoutRefunded'
    | 'ArcBlock'
  chainId: 5042002
  blockNumber: number
  logIndex?: number
  txHash?: string
  escrowId?: string
  summary: string
  receivedAt: string
}

export interface GrokVerifyResponse {
  approved: boolean
  confidence: number
  summary: string
  auditReasoning?: string
  grokModel?: string
  milestoneIndex?: number
  nonce?: number
  deliverableHash: `0x${string}`
  evidenceHash?: `0x${string}`
  evidenceSummary?: string
  eip712Signature?: `0x${string}`
  signature?: string
  oracleSigner?: string
  auditedAt: string
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = data as { error?: string; detail?: string; hint?: string }
    throw new Error(err.error || err.detail || `Request failed (${res.status})`)
  }
  return data as T
}

export async function fetchEscrows(): Promise<EscrowRecord[]> {
  const res = await fetch('/api/escrows')
  const data = await parseJson<{ escrows: EscrowRecord[] }>(res)
  return data.escrows ?? []
}

export async function fetchEscrowById(
  id: string,
): Promise<{ escrow: EscrowRecord; counterpartyStats: CounterpartyStatsDto | null }> {
  const res = await fetch(`/api/escrows/${encodeURIComponent(id)}`)
  return parseJson<{ escrow: EscrowRecord; counterpartyStats: CounterpartyStatsDto | null }>(res)
}

export async function createEscrow(payload: {
  title: string
  scope: string
  amountUsdc: number
  deadlineHours: number
  mode: EscrowMode
  payee?: string
  tecdLambda?: number
}): Promise<{ escrow: EscrowRecord; checkoutPath: string; shareUrl: string }> {
  const res = await fetch('/api/escrows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson(res)
}

export async function fetchOnChainEvents(limit = 25): Promise<{ events: StreamEvent[]; latestBlock: number }> {
  const res = await fetch(`/api/events?limit=${limit}`)
  return parseJson<{ events: StreamEvent[]; latestBlock: number }>(res)
}

export async function fetchGeminiRisk(): Promise<GeminiRiskSnapshot> {
  const res = await fetch('/api/risk/gemini')
  return parseJson<GeminiRiskSnapshot>(res)
}

export interface DeterministicCheckItem {
  label: string
  passed: boolean
  detail: string
}

export type DeliverableProofType = 'github_pr' | 'artifact_hash' | 'url_digest'

export interface DeterministicVerifyResponse {
  approved: boolean
  proofType: DeliverableProofType
  escrowId: string
  escrowIdBytes32: `0x${string}`
  milestoneIndex: number
  amountUsdc: number
  proofHash: `0x${string}`
  deliverableHash: `0x${string}`
  sha256?: string
  nonce: number
  eip712Signature?: `0x${string}`
  verifier?: string
  nonCustodial: boolean
  summary: string
  errorRecovery?: string
  checks: DeterministicCheckItem[]
  verifiedAt: string
}

export async function verifyDeliverableDeterministically(payload: {
  escrowId: string
  proofType: DeliverableProofType
  payload: Record<string, unknown>
  milestoneIndex?: number
}): Promise<DeterministicVerifyResponse> {
  const res = await fetch('/api/verify/deliverable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as DeterministicVerifyResponse & { error?: string }
  if (!res.ok && typeof data.approved !== 'boolean') {
    throw new Error(data.error || `Verification failed (${res.status})`)
  }
  return data
}

export async function verifyWithGrok(payload: {
  escrowId: string
  deliverableUrl?: string
  deliverableNotes?: string
  title?: string
  scope?: string
  amountUsdc?: number
}): Promise<GrokVerifyResponse> {
  const res = await fetch('/api/verify/grok', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson<GrokVerifyResponse>(res)
}

export async function fetchVoiceBriefAudio(
  payload?:
    | string
    | {
        escrowId?: string
        title?: string
        amountUsdc?: number
        tecdLambda?: number
        mode?: EscrowMode
      },
): Promise<Blob> {
  const body = typeof payload === 'string' ? { escrowId: payload } : (payload ?? {})
  const res = await fetch('/api/voice/brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const err = data as { error?: string; hint?: string }
    throw new Error(err.error || `ElevenLabs request failed (${res.status})`)
  }
  return res.blob()
}
