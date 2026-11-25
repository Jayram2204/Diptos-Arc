#!/usr/bin/env bash
set -euo pipefail

# Verify DiptosRegistry & DiptosEscrow on Arc Testnet (Chain ID: 5042002) via Blockscout / ArcScan.
# Usage:
#   ./scripts/verify-arcscan.sh
# Optional environment overrides:
#   REGISTRY_ADDRESS, ESCROW_ADDRESS, DEPLOYER_ADDRESS, ORACLE_SIGNER, TREASURY_ADDRESS, VERIFIER_URL

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

CHAIN_ID="${CHAIN_ID:-5042002}"
RPC_URL="${ARC_RPC_URL:-https://rpc.testnet.arc.network}"
VERIFIER_URL="${VERIFIER_URL:-https://testnet.arcscan.app/api/}"

REGISTRY_ADDRESS="${REGISTRY_ADDRESS:-0xC831EBFA825d88853625C52d1BD55c456111B004}"
ESCROW_ADDRESS="${ESCROW_ADDRESS:-0x601bD8caDf9ba2274E645412C1Fca2dF13a318F5}"
DEPLOYER_ADDRESS="${DEPLOYER_ADDRESS:-0x344d7adf93542C6c27a11bb53A2d7C9d909D9f34}"
ORACLE_SIGNER="${ORACLE_SIGNER:-$DEPLOYER_ADDRESS}"
TREASURY_ADDRESS="${TREASURY_ADDRESS:-$DEPLOYER_ADDRESS}"

echo "=== Verifying Diptos Contracts on Arc Testnet (Chain ID: ${CHAIN_ID}) ==="
echo "Registry: ${REGISTRY_ADDRESS}"
echo "Escrow:   ${ESCROW_ADDRESS}"
echo "Verifier: ${VERIFIER_URL}"

cd "${REPO_ROOT}/contracts"

REG_ARGS="$(cast abi-encode 'constructor(address)' "${DEPLOYER_ADDRESS}")"
ESC_ARGS="$(cast abi-encode 'constructor(address,address,address)' "${ORACLE_SIGNER}" "${TREASURY_ADDRESS}" "${REGISTRY_ADDRESS}")"

echo ""
echo "[1/2] Verifying DiptosRegistry..."
forge verify-contract \
  --chain-id "${CHAIN_ID}" \
  --rpc-url "${RPC_URL}" \
  --verifier blockscout \
  --verifier-url "${VERIFIER_URL}" \
  --compiler-version "0.8.24" \
  --num-of-optimizations 200 \
  --via-ir \
  --constructor-args "${REG_ARGS}" \
  --watch \
  "${REGISTRY_ADDRESS}" \
  src/DiptosRegistry.sol:DiptosRegistry

echo ""
echo "[2/2] Verifying DiptosEscrow..."
forge verify-contract \
  --chain-id "${CHAIN_ID}" \
  --rpc-url "${RPC_URL}" \
  --verifier blockscout \
  --verifier-url "${VERIFIER_URL}" \
  --compiler-version "0.8.24" \
  --num-of-optimizations 200 \
  --via-ir \
  --constructor-args "${ESC_ARGS}" \
  --watch \
  "${ESCROW_ADDRESS}" \
  src/DiptosEscrow.sol:DiptosEscrow

echo ""
echo "=== Verification complete ==="
echo "ArcScan Registry: https://testnet.arcscan.app/address/${REGISTRY_ADDRESS}"
echo "ArcScan Escrow:   https://testnet.arcscan.app/address/${ESCROW_ADDRESS}"
