// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DiptosEscrow} from "../src/DiptosEscrow.sol";
import {DiptosRegistry} from "../src/DiptosRegistry.sol";

interface Vm {
    function envUint(string calldata) external returns (uint256);
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
        address oracleSigner = vm.envOr("GROK_ORACLE_SIGNER_ADDRESS", deployer);
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);
        address genesisPayee = vm.envOr("GENESIS_PAYEE_ADDRESS", oracleSigner);

        vm.startBroadcast(deployerKey);

        registry = new DiptosRegistry(deployer);
        escrow = new DiptosEscrow(oracleSigner, treasury, address(registry));
        registry.setEscrowContract(address(escrow));

        // Seed 1 live Genesis Escrow (0.05 native USDC) on Arc Testnet so diptos.xyz renders live on-chain data immediately
        if (deployer.balance >= 0.06 ether) {
            bytes32 genesisId = keccak256(abi.encodePacked("diptos:arc:5042002:genesis-v1", address(escrow)));
            escrow.createEscrowLink{value: 0.05 ether}(
                genesisId,
                genesisPayee,
                block.timestamp + 24 hours,
                3500,
                true
            );
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
        vm.writeFile("../.env.deployed", envOverlay);
    }
}
