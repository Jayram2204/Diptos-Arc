// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DiptosEscrow} from "../src/DiptosEscrow.sol";
import {DiptosRegistry} from "../src/DiptosRegistry.sol";

interface Vm {
    function envUint(string calldata) external returns (uint256);
    function envOr(string calldata, uint256) external returns (uint256);
    function envOr(string calldata, address) external returns (address);
    function addr(uint256) external returns (address);
    function startBroadcast(uint256) external;
    function stopBroadcast() external;
    function writeFile(string calldata path, string calldata data) external;
    function toString(address) external pure returns (string memory);
}

/// @notice Deployment script for Arc Testnet (Chain ID: 5042002, RPC: https://rpc.testnet.arc.network).
///         Run with:
///         forge script script/DeployArc.s.sol:DeployArc --rpc-url https://rpc.testnet.arc.network --broadcast
contract DeployArc {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (DiptosRegistry registry, DiptosEscrow escrow) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        uint256 oracleKey = vm.envOr("GROK_ORACLE_PRIVATE_KEY", deployerKey);
        address oracleSigner = vm.addr(oracleKey);
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);
        address genesisPayee = vm.envOr("GENESIS_PAYEE_ADDRESS", address(0x000000000000000000000000000000000000dEaD));
        if (genesisPayee == deployer || genesisPayee == address(0)) {
            genesisPayee = address(0x000000000000000000000000000000000000dEaD);
        }

        vm.startBroadcast(deployerKey);

        registry = new DiptosRegistry(deployer);
        escrow = new DiptosEscrow(oracleSigner, treasury, address(registry));
        registry.setEscrowContract(address(escrow));

        // Seed 2 real initial on-chain escrows with full on-chain title & acceptanceScope
        if (deployer.balance >= 0.08 ether) {
            bytes32 agentAuditId = keccak256(
                abi.encodePacked("diptos:arc:5042002:genesis-agent-audit", address(escrow))
            );
            escrow.createEscrowLink{value: 0.02 ether}(
                agentAuditId,
                genesisPayee,
                block.timestamp + 24 hours,
                3200,
                true,
                "Arc Native USDC Smart Contract Audit & EIP-712 Verifier",
                "1. Verify DiptosEscrow & DiptosRegistry bytecode on ArcScan (5042002)\n2. Pass 100% of Foundry fuzz & invariant tests for WAD TECD math"
            );

            bytes32 designSprintId = keccak256(
                abi.encodePacked("diptos:arc:5042002:genesis-design-sprint", address(escrow))
            );
            escrow.createEscrowLink{value: 0.05 ether}(
                designSprintId,
                genesisPayee,
                block.timestamp + 72 hours,
                2500,
                false,
                "Institutional Checkout Room & @diptos/sdk Integration",
                "1. Deliver non-custodial USDC checkout on app.diptos.xyz/pay/:id\n2. Integrate live Gemini Prediction Markets risk lambda & ElevenLabs audio brief"
            );
        }

        // Seed the on-chain DiptosEscrow.faucetMint() pool with 2.0 USDC if balance permits
        if (deployer.balance >= 4 ether) {
            (bool ok, ) = payable(address(escrow)).call{value: 2 ether}("");
            require(ok, "Faucet pool funding failed");
        }

        vm.stopBroadcast();

        string memory escrowAddr = vm.toString(address(escrow));
        string memory registryAddr = vm.toString(address(registry));

        string memory deploymentJson = string.concat(
            "{\n",
            '  "chainId": 5042002,\n',
            '  "network": "Arc Testnet",\n',
            '  "rpcUrl": "https://rpc.testnet.arc.network",\n',
            '  "fallbackRpcUrl": "https://rpc.solidrpc.io/public/evm/5042002",\n',
            '  "explorerUrl": "https://testnet.arcscan.app",\n',
            '  "DiptosEscrow": "', escrowAddr, '",\n',
            '  "DiptosRegistry": "', registryAddr, '"\n',
            "}\n"
        );
        vm.writeFile("./deployments/arc-5042002.json", deploymentJson);

        string memory envOverlay = string.concat(
            "VITE_ESCROW_CONTRACT_ADDRESS=", escrowAddr, "\n",
            "VITE_REGISTRY_CONTRACT_ADDRESS=", registryAddr, "\n",
            "ARC_ESCROW_CONTRACT_ADDRESS=", escrowAddr, "\n",
            "ARC_REGISTRY_CONTRACT_ADDRESS=", registryAddr, "\n"
        );
        vm.writeFile("./deployments/.env.deployed", envOverlay);
    }
}
