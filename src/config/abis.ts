import { DIPTOS_ESCROW_ABI, DIPTOS_REGISTRY_ABI } from '@diptos/sdk'
import type { ContractKey } from './protocol'

export { DIPTOS_ESCROW_ABI, DIPTOS_REGISTRY_ABI }

export const ABIS: Record<ContractKey, typeof DIPTOS_ESCROW_ABI | typeof DIPTOS_REGISTRY_ABI> = {
  DiptosEscrow: DIPTOS_ESCROW_ABI,
  DiptosRegistry: DIPTOS_REGISTRY_ABI,
}
