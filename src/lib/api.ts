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
  txHash?: string
  settleTxHash?: string
  tecdLambda: number
  tecdLambdaBps: number
  status: EscrowStatus
  grokAudit?: GrokAuditRecord
  createdAt: string
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
  eventName: 'EscrowCreated' | 'MilestoneSettled' | 'EscrowSettled' | 'TECDPenaltyApplied' | 'TimeoutRefunded' | 'ArcBlock'
  chainId: 5042002
  blockNumber: number
  txHash?: string
  logIndex?: number
  escrowId?: string
  summary: string
  receivedAt: string
}

export interface GrokVerifyResponse {
  approved: boolean
  confidence: number
  summary: string
  deliverableHash: string
  signature: string
  oracleSigner: string
  model: string
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

export async function fetchEscrowById(id: string): Promise<EscrowRecord> {
  const res = await fetch(`/api/escrows/${encodeURIComponent(id)}`)
  const data = await parseJson<{ escrow: EscrowRecord }>(res)
  return data.escrow
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

export async function patchEscrow(
  id: string,
  patch: Partial<Pick<EscrowRecord, 'payer' | 'payee' | 'txHash' | 'settleTxHash' | 'status'>>,
): Promise<EscrowRecord> {
  const res = await fetch(`/api/escrows/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const data = await parseJson<{ escrow: EscrowRecord }>(res)
  return data.escrow
}

export async function fetchGeminiRisk(): Promise<GeminiRiskSnapshot> {
  const res = await fetch('/api/risk/gemini')
  return parseJson<GeminiRiskSnapshot>(res)
}

export async function verifyWithGrok(payload: {
  escrowId: string
  deliverableUrl?: string
  deliverableNotes?: string
}): Promise<GrokVerifyResponse> {
  const res = await fetch('/api/verify/grok', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson<GrokVerifyResponse>(res)
}

export async function fetchVoiceBriefAudio(escrowId?: string): Promise<Blob> {
  const res = await fetch('/api/voice/brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(escrowId ? { escrowId } : {}),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const err = data as { error?: string; hint?: string }
    throw new Error(err.error || `ElevenLabs request failed (${res.status})`)
  }
  return res.blob()
}
