export type SettlementRailId = 'arc-testnet' | 'arc-mainnet' | 'base-mainnet' | 'base-sepolia'

export interface DualRailConfig {
  id: SettlementRailId
  chainId: number
  name: string
  usdcDecimals: 6 | 18
  isNativeUsdc: boolean
  usdcAddress: `0x${string}`
  supportsBuilderCodes: boolean
}

export const DUAL_SETTLEMENT_RAILS: Record<SettlementRailId, DualRailConfig> = {
  'arc-testnet': {
    id: 'arc-testnet',
    chainId: 5042002,
    name: 'Arc Testnet',
    usdcDecimals: 18,
    isNativeUsdc: true,
    usdcAddress: '0x3600000000000000000000000000000000000000',
    supportsBuilderCodes: false,
  },
  'arc-mainnet': {
    id: 'arc-mainnet',
    chainId: 5042001,
    name: 'Arc Mainnet',
    usdcDecimals: 18,
    isNativeUsdc: true,
    usdcAddress: '0x3600000000000000000000000000000000000000',
    supportsBuilderCodes: false,
  },
  'base-mainnet': {
    id: 'base-mainnet',
    chainId: 8453,
    name: 'Base Mainnet',
    usdcDecimals: 6,
    isNativeUsdc: false,
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    supportsBuilderCodes: true,
  },
  'base-sepolia': {
    id: 'base-sepolia',
    chainId: 84532,
    name: 'Base Sepolia',
    usdcDecimals: 6,
    isNativeUsdc: false,
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    supportsBuilderCodes: true,
  },
}

/**
 * Converts human USDC amount into the exact smallest integer units for Arc (18-dec) or Base (6-dec).
 */
export function toRailUsdcUnits(amountUsdc: number, rail: SettlementRailId): bigint {
  const cfg = DUAL_SETTLEMENT_RAILS[rail]
  const micro = BigInt(Math.round(Math.max(0, amountUsdc) * 1_000_000))
  return cfg.usdcDecimals === 18 ? micro * 10n ** 12n : micro
}

/**
 * Appends a Base Builder Code attribution suffix to EVM transaction calldata for Base Builder Grants eligibility.
 * Preserves ABI-encoded arguments untouched; only appends suffix on Base rails when a non-empty code is provided.
 */
export function appendBaseBuilderCode(
  calldata: `0x${string}`,
  rail: SettlementRailId,
  builderCode?: string,
): `0x${string}` {
  const cfg = DUAL_SETTLEMENT_RAILS[rail]
  const cleanCode = builderCode?.trim()
  if (!cfg.supportsBuilderCodes || !cleanCode) return calldata

  const hexCode = Array.from(new TextEncoder().encode(cleanCode))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const lenHex = Math.min(255, cleanCode.length).toString(16).padStart(2, '0')
  // ERC-8021-style data suffix marker ("bc" builder code marker + length + UTF-8 bytes)
  const suffix = `6263${lenHex}${hexCode}`
  return `${calldata}${suffix}` as `0x${string}`
}

const MAX_EXACT_APPROVAL_USDC = 1_000_000_000 // Hard ceiling preventing uint256.max infinite approvals

/**
 * Socket Protocol Defense: Builds an EXACT-AMOUNT ERC-20 USDC `approve(address,uint256)` calldata for Base.
 * - Rejects zero, negative, or infinite approvals (`uint256.max` is strictly forbidden).
 * - Returns `null` on Arc rails because native 18-dec USDC (`msg.value`) requires ZERO token approvals.
 */
export function buildExactUsdcApproveCalldata(
  spender: `0x${string}`,
  amountUsdc: number,
  rail: SettlementRailId,
): `0x${string}` | null {
  const cfg = DUAL_SETTLEMENT_RAILS[rail]
  if (cfg.isNativeUsdc) return null
  if (!/^0x[0-9a-fA-F]{40}$/.test(spender) || /^0x0{40}$/.test(spender)) {
    throw new Error('Invalid non-zero spender address required for exact USDC approval')
  }
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0 || amountUsdc > MAX_EXACT_APPROVAL_USDC) {
    throw new Error('Exact USDC approval amount out of safe bounds (infinite approvals forbidden)')
  }
  const units = toRailUsdcUnits(amountUsdc, rail)
  const spenderPadded = spender.slice(2).toLowerCase().padStart(64, '0')
  const amountPadded = units.toString(16).padStart(64, '0')
  // Selector 0x095ea7b3 = approve(address,uint256)
  return `0x095ea7b3${spenderPadded}${amountPadded}` as `0x${string}`
}
