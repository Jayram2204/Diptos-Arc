import crypto from 'node:crypto'
import { parseAbiItem } from 'viem'
import { appendStreamEvent, type StreamEvent, updateEscrow } from '../store.js'
import { arcPublicClient, getEscrowContractAddress } from './oracleSigner.js'

const ESCROW_EVENTS = [
  parseAbiItem(
    'event EscrowCreated(bytes32 indexed escrowId, address indexed payer, address indexed payee, uint256 amount, uint256 deadline, uint256 lambdaBps, uint256 milestoneCount, bool isAgentMode)',
  ),
  parseAbiItem(
    'event MilestoneSettled(bytes32 indexed escrowId, uint256 indexed milestoneIndex, address indexed payee, uint256 payeePayout, uint256 payerRebate, uint256 protocolFee, bytes32 deliverableHash, uint256 nonceUsed)',
  ),
  parseAbiItem(
    'event TECDPenaltyApplied(bytes32 indexed escrowId, uint256 indexed milestoneIndex, uint256 delaySeconds, uint256 decayBps, uint256 payerRebate, uint256 payeePayout)',
  ),
  parseAbiItem(
    'event TimeoutRefunded(bytes32 indexed escrowId, address indexed payer, uint256 refundedAmount, uint256 milestonesRefunded)',
  ),
] as const

type EventBroadcaster = (evt: StreamEvent) => void

let pollerHandle: ReturnType<typeof setInterval> | null = null
let lastIndexedBlock: bigint | null = null

export function startArcRpcIndexer(broadcast: EventBroadcaster, intervalMs = 6000) {
  if (pollerHandle) return

  const poll = async () => {
    const escrowAddress = getEscrowContractAddress()
    if (!escrowAddress) return

    try {
      const head = await arcPublicClient.getBlockNumber()
      const fromBlock =
        lastIndexedBlock !== null
          ? lastIndexedBlock + 1n
          : head > 250n
            ? head - 250n
            : 0n

      if (fromBlock > head) return

      const logs = await arcPublicClient.getLogs({
        address: escrowAddress,
        events: ESCROW_EVENTS,
        fromBlock,
        toBlock: head,
      })

      lastIndexedBlock = head

      for (const log of logs) {
        const eventName = log.eventName as StreamEvent['eventName']
        const args = (log.args ?? {}) as Record<string, unknown>
        const escrowId = typeof args.escrowId === 'string' ? args.escrowId : undefined
        const blockNum = Number(log.blockNumber ?? 0n)

        const summary =
          eventName === 'EscrowCreated'
            ? `EscrowCreated indexed from Arc block #${blockNum}`
            : eventName === 'MilestoneSettled'
              ? `MilestoneSettled finalized on Arc block #${blockNum}`
              : eventName === 'TECDPenaltyApplied'
                ? `TECDPenaltyApplied executed on Arc block #${blockNum}`
                : `TimeoutRefunded reclaimed on Arc block #${blockNum}`

        const evt: StreamEvent = {
          id: `arc_${crypto.randomBytes(6).toString('hex')}`,
          source: 'arc-rpc',
          eventName,
          chainId: 5042002,
          blockNumber: blockNum,
          txHash: log.transactionHash ?? undefined,
          logIndex: typeof log.logIndex === 'number' ? log.logIndex : undefined,
          escrowId,
          summary,
          receivedAt: new Date().toISOString(),
        }

        const { added } = appendStreamEvent(evt)
        if (!added) continue

        if (escrowId) {
          if (eventName === 'EscrowCreated') {
            updateEscrow(escrowId, { status: 'funded', txHash: evt.txHash })
          } else if (eventName === 'MilestoneSettled') {
            updateEscrow(escrowId, { status: 'settled', settleTxHash: evt.txHash })
          } else if (eventName === 'TimeoutRefunded') {
            updateEscrow(escrowId, { status: 'refunded' })
          }
        }

        broadcast(evt)
      }
    } catch {
      // RPC transient failure — retry silently on next interval
    }
  }

  void poll()
  pollerHandle = setInterval(() => void poll(), intervalMs)
}
