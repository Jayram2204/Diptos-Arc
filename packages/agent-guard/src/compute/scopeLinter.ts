export interface ScopeLinterInput {
  acceptanceScope: string
  deliverableSummary: string
  endpoint?: string
  model?: string
  timeoutMs?: number
}

export interface ScopeLinterResult {
  advisoryOnly: true
  skipped: boolean
  completeLikely: boolean
  warnings: string[]
  summary: string
  endpointUsed?: string
}

/**
 * Optional, ZERO-CUSTODY Local AI Pre-Submission Linter.
 * - Points to any OpenAI-compatible local/P2P endpoint (Ollama, llama.cpp, AntSeed) via `LOCAL_AI_ENDPOINT`.
 * - Strictly advisory: warns builders BEFORE submission if a deliverable looks incomplete.
 * - NEVER holds private keys, NEVER signs EIP-712 attestations, and NEVER unlocks funds.
 * - Gracefully skips if no local endpoint is configured or if unreachable.
 */
export async function lintDeliverableScope(input: ScopeLinterInput): Promise<ScopeLinterResult> {
  const endpoint =
    input.endpoint?.trim() ||
    (typeof process !== 'undefined' ? process.env.LOCAL_AI_ENDPOINT?.trim() : undefined)

  if (!endpoint) {
    return {
      advisoryOnly: true,
      skipped: true,
      completeLikely: true,
      warnings: [],
      summary: 'Local AI pre-submission linter skipped (LOCAL_AI_ENDPOINT not configured).',
    }
  }

  const base = endpoint.replace(/\/+$/, '')
  const url = base.endsWith('/chat/completions') ? base : `${base}/v1/chat/completions`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: input.model || 'llama3.2',
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content:
              'You are an advisory pre-submission deliverable linter. Respond ONLY with JSON: {"completeLikely": boolean, "warnings": string[], "summary": string}. Never approve or authorize payments.',
          },
          {
            role: 'user',
            content: `Acceptance Scope:\n${input.acceptanceScope}\n\nSubmitted Deliverable:\n${input.deliverableSummary}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 6000),
    })

    if (!res.ok) {
      return {
        advisoryOnly: true,
        skipped: true,
        completeLikely: true,
        warnings: [`Local AI endpoint returned HTTP ${res.status}; skipped advisory lint.`],
        summary: 'Local AI linter unavailable; proceed with deterministic on-chain verification.',
        endpointUsed: url,
      }
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data.choices?.[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as {
      completeLikely?: boolean
      warnings?: string[]
      summary?: string
    }

    return {
      advisoryOnly: true,
      skipped: false,
      completeLikely: Boolean(parsed.completeLikely ?? true),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
      summary: String(parsed.summary || 'Advisory local lint completed.'),
      endpointUsed: url,
    }
  } catch {
    return {
      advisoryOnly: true,
      skipped: true,
      completeLikely: true,
      warnings: [],
      summary: 'Local AI endpoint unreachable; advisory lint gracefully skipped.',
      endpointUsed: url,
    }
  }
}
