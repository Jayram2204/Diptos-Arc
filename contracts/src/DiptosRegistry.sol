// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDiptosRegistry {
    struct CounterpartyStats {
        uint256 completedOnTime;
        uint256 completedLate;
        uint256 totalVolumeSettled;
        uint256 totalLatencySeconds;
        uint256 averageLatencySeconds;
    }

    function recordCommitment(
        bytes32 escrowId,
        address payer,
        address payee,
        uint256 amount,
        uint256 deadline
    ) external returns (bytes32 canonicalHash);

    function recordSettlement(
        bytes32 escrowId,
        address payee,
        uint256 volumeSettled,
        uint256 latencySeconds,
        bool onTime
    ) external;

    function getCounterpartyStats(address payee) external view returns (CounterpartyStats memory);
}

/// @title DiptosRegistry
/// @notice Canonical anti-double-spend commitment ledger & on-chain counterparty reliability registry
///         for Diptos programmable escrows on Arc Testnet (Chain ID 5042002).
contract DiptosRegistry is IDiptosRegistry {
    address public owner;
    address public escrowContract;

    uint256 public totalEscrows;
    uint256 public totalSettledMilestones;
    uint256 public totalVolumeWei;

    mapping(bytes32 => bool) public canonicalHashes;
    mapping(bytes32 => bool) public escrowIds;
    mapping(address => CounterpartyStats) private _stats;

    event CanonicalCommitmentRecorded(
        bytes32 indexed escrowId,
        bytes32 indexed canonicalHash,
        address indexed payer,
        address payee,
        uint256 amount,
        uint256 deadline
    );

    event CounterpartySettlementRecorded(
        bytes32 indexed escrowId,
        address indexed payee,
        uint256 volumeSettled,
        uint256 latencySeconds,
        bool onTime,
        uint256 averageLatencySeconds
    );

    event EscrowContractUpdated(address indexed previousEscrow, address indexed newEscrow);

    error Unauthorized();
    error CommitmentAlreadyExists();
    error InvalidAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyEscrow() {
        if (msg.sender != escrowContract) revert Unauthorized();
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert InvalidAddress();
        owner = initialOwner;
    }

    function setEscrowContract(address _escrow) external onlyOwner {
        if (_escrow == address(0)) revert InvalidAddress();
        emit EscrowContractUpdated(escrowContract, _escrow);
        escrowContract = _escrow;
    }

    function computeCanonicalHash(
        bytes32 escrowId,
        address payer,
        address payee,
        uint256 amount,
        uint256 deadline
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(escrowId, payer, payee, amount, deadline));
    }

    function recordCommitment(
        bytes32 escrowId,
        address payer,
        address payee,
        uint256 amount,
        uint256 deadline
    ) external onlyEscrow returns (bytes32 canonicalHash) {
        canonicalHash = computeCanonicalHash(escrowId, payer, payee, amount, deadline);
        if (escrowIds[escrowId] || canonicalHashes[canonicalHash]) {
            revert CommitmentAlreadyExists();
        }
        escrowIds[escrowId] = true;
        canonicalHashes[canonicalHash] = true;
        totalEscrows += 1;
        totalVolumeWei += amount;

        emit CanonicalCommitmentRecorded(escrowId, canonicalHash, payer, payee, amount, deadline);
    }

    function recordSettlement(
        bytes32 escrowId,
        address payee,
        uint256 volumeSettled,
        uint256 latencySeconds,
        bool onTime
    ) external onlyEscrow {
        CounterpartyStats storage s = _stats[payee];
        if (onTime) {
            s.completedOnTime += 1;
        } else {
            s.completedLate += 1;
        }
        s.totalVolumeSettled += volumeSettled;
        s.totalLatencySeconds += latencySeconds;

        uint256 totalCount = s.completedOnTime + s.completedLate;
        s.averageLatencySeconds = totalCount > 0 ? s.totalLatencySeconds / totalCount : 0;
        totalSettledMilestones += 1;

        emit CounterpartySettlementRecorded(
            escrowId,
            payee,
            volumeSettled,
            latencySeconds,
            onTime,
            s.averageLatencySeconds
        );
    }

    function getCounterpartyStats(address payee) external view returns (CounterpartyStats memory) {
        return _stats[payee];
    }
}
