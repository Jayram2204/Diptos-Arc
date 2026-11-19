import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type EscrowMode = 'human' | 'agent'
export type EscrowStatus = 'created' | 'funded' | 'verified' | 'settled' | 'refunded'

export interface GrokAuditRecord {
  approved: boolean
  confidence: number
  summary: string
  auditReasoning: string
  grokModel: string
  milestoneIndex: number
  nonce: number
  deliverableUrl?: string
  deliverableHash: `0x${string}`
  evidenceHash: `0x${string}`
  evidenceSummary: string
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
  nonce?: number
  txHash?: string
  settleTxHash?: string
  tecdLambda: number
  tecdLambdaBps: number
  status: EscrowStatus
  grokAudit?: GrokAuditRecord
  createdAt: string
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

export interface RiskHistoryPoint {
  fetchedAt: string
  volatilityIndex: number
  recommendedLambda: number
  recommendedLambdaBps: number
  contractCount: number
}

interface EscrowStoreShape {
  escrows: EscrowRecord[]
  totalAttestationsSigned: number
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.VERCEL ? '/tmp/diptos-data' : path.resolve(__dirname, '../data')
const ESCROWS_FILE = path.join(DATA_DIR, 'escrows.json')
const EVENTS_FILE = path.join(DATA_DIR, 'events.json')
const RISK_HISTORY_FILE = path.join(DATA_DIR, 'risk-history.json')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function readJson<T>(filePath: string, fallback: T): T {
  ensureDir()
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf8')
    return fallback
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
  } catch {
    return fallback
  }
}

function writeJson<T>(filePath: string, data: T): void {
  ensureDir()
  const tmp = `${filePath}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  fs.renameSync(tmp, filePath)
}

function readEscrowStore(): EscrowStoreShape {
  const raw = readJson<Partial<EscrowStoreShape>>(ESCROWS_FILE, { escrows: [], totalAttestationsSigned: 0 })
  return {
    escrows: Array.isArray(raw.escrows) ? raw.escrows : [],
    totalAttestationsSigned: typeof raw.totalAttestationsSigned === 'number' ? raw.totalAttestationsSigned : 0,
  }
}

export function listEscrows(): EscrowRecord[] {
  return readEscrowStore().escrows
}

export function getEscrowById(id: string): EscrowRecord | undefined {
  const normalized = id.trim()
  return readEscrowStore().escrows.find(
    (e) => e.id === normalized || e.escrowIdBytes32.toLowerCase() === normalized.toLowerCase(),
  )
}

export function saveEscrow(record: EscrowRecord): EscrowRecord {
  const store = readEscrowStore()
  const idx = store.escrows.findIndex((e) => e.id === record.id)
  if (idx >= 0) {
    store.escrows[idx] = record
  } else {
    store.escrows.unshift(record)
  }
  writeJson(ESCROWS_FILE, store)
  return record
}

export function updateEscrow(id: string, patch: Partial<EscrowRecord>): EscrowRecord | undefined {
  const store = readEscrowStore()
  const idx = store.escrows.findIndex(
    (e) => e.id === id || e.escrowIdBytes32.toLowerCase() === id.toLowerCase(),
  )
  if (idx < 0) return undefined
  store.escrows[idx] = { ...store.escrows[idx], ...patch }
  writeJson(ESCROWS_FILE, store)
  return store.escrows[idx]
}

export function incrementAttestationCount(): number {
  const store = readEscrowStore()
  store.totalAttestationsSigned += 1
  writeJson(ESCROWS_FILE, store)
  return store.totalAttestationsSigned
}

export function getTotalAttestationsSigned(): number {
  return readEscrowStore().totalAttestationsSigned
}

export function listStreamEvents(limit = 40): StreamEvent[] {
  const list = readJson<StreamEvent[]>(EVENTS_FILE, [])
  return Array.isArray(list) ? list.slice(0, limit) : []
}

export function appendStreamEvent(evt: StreamEvent): { added: boolean; event: StreamEvent } {
  const list = readJson<StreamEvent[]>(EVENTS_FILE, [])
  const safeList = Array.isArray(list) ? list : []

  if (evt.txHash && evt.logIndex !== undefined) {
    const dup = safeList.some((e) => e.txHash === evt.txHash && e.logIndex === evt.logIndex)
    if (dup) return { added: false, event: evt }
  }

  safeList.unshift(evt)
  writeJson(EVENTS_FILE, safeList.slice(0, 150))
  return { added: true, event: evt }
}

export function listRiskHistory(limit = 50): RiskHistoryPoint[] {
  const list = readJson<RiskHistoryPoint[]>(RISK_HISTORY_FILE, [])
  return Array.isArray(list) ? list.slice(0, limit) : []
}

export function appendRiskHistory(point: RiskHistoryPoint): void {
  const list = readJson<RiskHistoryPoint[]>(RISK_HISTORY_FILE, [])
  const safeList = Array.isArray(list) ? list : []
  safeList.unshift(point)
  writeJson(RISK_HISTORY_FILE, safeList.slice(0, 120))
}

// Initialize clean empty files on boot (zero fake seed data)
readEscrowStore()
readJson<StreamEvent[]>(EVENTS_FILE, [])
readJson<RiskHistoryPoint[]>(RISK_HISTORY_FILE, [])
