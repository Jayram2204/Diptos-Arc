export interface AgentPolicyConfig {
  maxPerTaskUsdc: number
  dailyBudgetUsdc: number
  approvalThresholdUsdc: number
  allowedProviders: string[]
  maxLatencySeconds: number
}

export interface QuoteEvaluationRequest {
  agentId: string
  provider: string
  amountUsdc: number
  estimatedLatencySeconds: number
  parentAgentId?: string
}

export type PolicyDecision = 'approve' | 'require_human_approval' | 'deny'

export interface QuoteEvaluationResult {
  allowed: boolean
  decision: PolicyDecision
  reason: string
  remainingDailyBudgetUsdc: number
  remainingAgentCapUsdc?: number
}

interface SubAgentAllocation {
  parentAgentId: string
  capUsdc: number
  spentUsdc: number
}

interface SpendEntry {
  timestampMs: number
  agentId: string
  amountUsdc: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Runtime Policy Harness inspired by the Circle Agent Stack & Arc Agentic Payments Blueprint.
 * The AI agent never sees private keys; every payment quote passes through deterministic spend caps,
 * provider allowlists, latency bounds, approval thresholds, and parent-to-sub-agent DAG budgets.
 */
export class PolicyGuard {
  public readonly config: AgentPolicyConfig
  private readonly spendLog: SpendEntry[] = []
  private readonly dagAllocations = new Map<string, SubAgentAllocation>()
  private readonly parentAllocatedTotal = new Map<string, number>()

  constructor(config: AgentPolicyConfig) {
    if (config.maxPerTaskUsdc <= 0 || config.dailyBudgetUsdc <= 0) {
      throw new Error('PolicyGuard requires positive maxPerTaskUsdc and dailyBudgetUsdc')
    }
    if (config.maxLatencySeconds <= 0) {
      throw new Error('PolicyGuard requires positive maxLatencySeconds')
    }
    this.config = {
      ...config,
      allowedProviders: config.allowedProviders.map((p) => p.trim().toLowerCase()).filter(Boolean),
    }
  }

  private normalizeProvider(provider: string): string {
    const trimmed = provider.trim().toLowerCase()
    try {
      if (trimmed.includes('://')) return new URL(trimmed).hostname.toLowerCase()
    } catch {
      // fall through
    }
    return trimmed
  }

  public getDailySpentUsdc(nowMs = Date.now()): number {
    const cutoff = nowMs - DAY_MS
    return this.spendLog
      .filter((e) => e.timestampMs >= cutoff)
      .reduce((sum, e) => sum + e.amountUsdc, 0)
  }

  public getRemainingDailyBudgetUsdc(nowMs = Date.now()): number {
    return Math.max(0, Number((this.config.dailyBudgetUsdc - this.getDailySpentUsdc(nowMs)).toFixed(6)))
  }

  /**
   * Parent-to-Sub-Agent DAG Budget Allocation:
   * Agent A locks a parent budget and allocates bounded sub-caps to Sub-Agent B / Compute Node C.
   */
  public allocateSubBudget(parentAgentId: string, childAgentId: string, capUsdc: number): void {
    if (!parentAgentId.trim() || !childAgentId.trim() || parentAgentId === childAgentId) {
      throw new Error('Invalid parent/child agent IDs for DAG budget allocation')
    }
    if (!Number.isFinite(capUsdc) || capUsdc <= 0) {
      throw new Error('Sub-agent capUsdc must be positive')
    }

    const existingAllocated = this.parentAllocatedTotal.get(parentAgentId) ?? 0
    const parentBudgetLimit = this.dagAllocations.get(parentAgentId)?.capUsdc ?? this.config.dailyBudgetUsdc

    if (existingAllocated + capUsdc > parentBudgetLimit + 1e-9) {
      throw new Error(
        `DAG budget overflow: allocating ${capUsdc} USDC to ${childAgentId} exceeds parent ${parentAgentId} limit (${parentBudgetLimit} USDC)`,
      )
    }

    this.dagAllocations.set(childAgentId, {
      parentAgentId,
      capUsdc,
      spentUsdc: 0,
    })
    this.parentAllocatedTotal.set(parentAgentId, existingAllocated + capUsdc)
  }

  public getSubAgentRemainingUsdc(agentId: string): number | undefined {
    const alloc = this.dagAllocations.get(agentId)
    if (!alloc) return undefined
    return Math.max(0, Number((alloc.capUsdc - alloc.spentUsdc).toFixed(6)))
  }

  public evaluateQuote(req: QuoteEvaluationRequest, nowMs = Date.now()): QuoteEvaluationResult {
    const remainingDaily = this.getRemainingDailyBudgetUsdc(nowMs)
    const remainingSub = this.getSubAgentRemainingUsdc(req.agentId)

    if (!Number.isFinite(req.amountUsdc) || req.amountUsdc <= 0) {
      return {
        allowed: false,
        decision: 'deny',
        reason: 'Quote amountUsdc must be greater than 0.',
        remainingDailyBudgetUsdc: remainingDaily,
        remainingAgentCapUsdc: remainingSub,
      }
    }

    if (this.config.allowedProviders.length > 0) {
      const normalized = this.normalizeProvider(req.provider)
      const matched = this.config.allowedProviders.some(
        (allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`),
      )
      if (!matched) {
        return {
          allowed: false,
          decision: 'deny',
          reason: `Provider "${req.provider}" is not in allowedProviders allowlist.`,
          remainingDailyBudgetUsdc: remainingDaily,
          remainingAgentCapUsdc: remainingSub,
        }
      }
    }

    if (req.amountUsdc > this.config.maxPerTaskUsdc) {
      return {
        allowed: false,
        decision: 'deny',
        reason: `Quote ${req.amountUsdc} USDC exceeds maxPerTaskUsdc (${this.config.maxPerTaskUsdc} USDC).`,
        remainingDailyBudgetUsdc: remainingDaily,
        remainingAgentCapUsdc: remainingSub,
      }
    }

    if (req.amountUsdc > remainingDaily + 1e-9) {
      return {
        allowed: false,
        decision: 'deny',
        reason: `Quote ${req.amountUsdc} USDC exceeds remaining daily budget (${remainingDaily} USDC).`,
        remainingDailyBudgetUsdc: remainingDaily,
        remainingAgentCapUsdc: remainingSub,
      }
    }

    if (req.estimatedLatencySeconds > this.config.maxLatencySeconds) {
      return {
        allowed: false,
        decision: 'deny',
        reason: `Estimated latency ${req.estimatedLatencySeconds}s exceeds maxLatencySeconds (${this.config.maxLatencySeconds}s).`,
        remainingDailyBudgetUsdc: remainingDaily,
        remainingAgentCapUsdc: remainingSub,
      }
    }

    // Check DAG sub-agent cap (and walk up parent chain if nested)
    let cursor: string | undefined = req.agentId
    while (cursor) {
      const alloc = this.dagAllocations.get(cursor)
      if (!alloc) break
      const rem = alloc.capUsdc - alloc.spentUsdc
      if (req.amountUsdc > rem + 1e-9) {
        return {
          allowed: false,
          decision: 'deny',
          reason: `Sub-agent "${cursor}" DAG cap exceeded (requested ${req.amountUsdc} USDC, remaining ${rem.toFixed(2)} USDC).`,
          remainingDailyBudgetUsdc: remainingDaily,
          remainingAgentCapUsdc: Math.max(0, rem),
        }
      }
      cursor = alloc.parentAgentId
    }

    if (req.amountUsdc > this.config.approvalThresholdUsdc) {
      return {
        allowed: false,
        decision: 'require_human_approval',
        reason: `Quote ${req.amountUsdc} USDC exceeds approvalThresholdUsdc (${this.config.approvalThresholdUsdc} USDC) — human sign-off required.`,
        remainingDailyBudgetUsdc: remainingDaily,
        remainingAgentCapUsdc: remainingSub,
      }
    }

    return {
      allowed: true,
      decision: 'approve',
      reason: 'Quote passed all PolicyGuard spend, latency, provider, and DAG budget checks.',
      remainingDailyBudgetUsdc: remainingDaily,
      remainingAgentCapUsdc: remainingSub,
    }
  }

  public recordSpend(agentId: string, amountUsdc: number, nowMs = Date.now()): void {
    this.spendLog.push({ timestampMs: nowMs, agentId, amountUsdc })
    let cursor: string | undefined = agentId
    while (cursor) {
      const alloc = this.dagAllocations.get(cursor)
      if (!alloc) break
      alloc.spentUsdc = Number((alloc.spentUsdc + amountUsdc).toFixed(6))
      cursor = alloc.parentAgentId
    }
  }

  public refundSpend(agentId: string, amountUsdc: number): void {
    const idx = this.spendLog.findIndex((e) => e.agentId === agentId && Math.abs(e.amountUsdc - amountUsdc) < 1e-9)
    if (idx !== -1) this.spendLog.splice(idx, 1)
    let cursor: string | undefined = agentId
    while (cursor) {
      const alloc = this.dagAllocations.get(cursor)
      if (!alloc) break
      alloc.spentUsdc = Math.max(0, Number((alloc.spentUsdc - amountUsdc).toFixed(6)))
      cursor = alloc.parentAgentId
    }
  }
}
