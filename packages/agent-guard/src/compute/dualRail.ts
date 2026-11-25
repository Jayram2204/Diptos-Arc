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
