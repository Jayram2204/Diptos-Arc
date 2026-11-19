// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDiptosRegistry} from "./DiptosRegistry.sol";

/// @title DiptosEscrow
/// @notice Multi-Milestone Programmable Escrow, On-Chain Enumeration, EIP-712 Replay-Protected
///         Grok Oracle Settlement, Fixed-Point WAD Time-Entropic Collateral Decay (TECD),
///         Permissionless Timeout Recovery, and Ergodic Float Accounting on Arc Testnet (5042002).
///         Arc Dual-Decimal Rule: Native USDC (msg.value / balance) = 18 decimals; ERC-20 USDC = 6 decimals.
contract DiptosEscrow {
    enum MilestoneStatus {
        PENDING,
        FUNDED,
        VERIFIED,
        SETTLED,
        REFUNDED
    }

    struct Milestone {
        uint256 amount;
        uint256 deadline;
        bytes32 deliverableHash;
        MilestoneStatus status;
    }

    struct Escrow {
        address payer;
        address payee;
        uint256 totalFunded;
        uint256 createdAt;
        uint256 fundedAt;
        uint256 lambdaBps;
        uint256 gracePeriod;
        uint256 nonce;
        bool isAgentMode;
        bytes32 canonicalHash;
    }

    struct EscrowView {
        bytes32 escrowId;
        address payer;
        address payee;
        uint256 amount;
        uint256 deadline;
        uint256 createdAt;
        uint256 fundedAt;
        uint256 lambdaBps;
        uint256 nonce;
        bool isAgentMode;
        MilestoneStatus status;
        bytes32 deliverableHash;
    }

    uint256 public constant PROTOCOL_FEE_BPS = 50; // 0.50% flat fee
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant WAD = 1e18;
    uint256 public constant NATIVE_TO_ERC20_SCALE = 1e12; // 18-dec native USDC <-> 6-dec ERC-20 USDC
    uint256 public constant DEFAULT_GRACE_PERIOD = 24 hours;
    uint256 public constant ANNUAL_FLOAT_YIELD_BPS = 450; // 4.50% APY reference float rate
    uint256 public constant FAUCET_DRIP = 0.25 ether; // 0.25 native USDC (18 decimals)

    uint256 private constant SECP256K1_HALF_N =
        0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    bytes32 public constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant NAME_HASH = keccak256("DiptosEscrow");
    bytes32 public constant VERSION_HASH = keccak256("2");
    bytes32 public constant RELEASE_TYPEHASH = keccak256(
        "ReleaseMilestone(bytes32 escrowId,uint256 milestoneIndex,bytes32 deliverableHash,uint256 nonce,uint256 chainId)"
    );

    address public owner;
    address public oracleSigner;
    address public treasury;
    IDiptosRegistry public registry;

    mapping(bytes32 => Escrow) public escrows;
    mapping(bytes32 => Milestone[]) private _milestones;
    bytes32[] public allEscrowIds;
    mapping(address => bytes32[]) public userEscrows;
    mapping(address => uint256) public lastFaucetClaim;

    event EscrowCreated(
        bytes32 indexed escrowId,
        address indexed payer,
        address indexed payee,
        uint256 amount,
        uint256 deadline,
        uint256 lambdaBps,
        uint256 milestoneCount,
        bool isAgentMode
    );

    event MilestoneSettled(
        bytes32 indexed escrowId,
        uint256 indexed milestoneIndex,
        address indexed payee,
        uint256 payeePayout,
        uint256 payerRebate,
        uint256 protocolFee,
        bytes32 deliverableHash,
        uint256 nonceUsed
    );

    event TECDPenaltyApplied(
        bytes32 indexed escrowId,
        uint256 indexed milestoneIndex,
        uint256 delaySeconds,
        uint256 decayBps,
        uint256 payerRebate,
        uint256 payeePayout
    );

    event FloatYieldSettled(
        bytes32 indexed escrowId,
        uint256 indexed milestoneIndex,
        uint256 lockDurationSeconds,
        uint256 accruedYieldBps,
        uint256 notionalYieldWei
    );

    event TimeoutRefunded(
        bytes32 indexed escrowId,
        address indexed payer,
        uint256 refundedAmount,
        uint256 milestonesRefunded
    );

    event EscrowCancelled(
        bytes32 indexed escrowId,
        address indexed initiatedBy,
        uint256 refundedAmount
    );

    event FaucetDispensed(address indexed recipient, uint256 amount);
    event OracleSignerUpdated(address indexed previousSigner, address indexed newSigner);

    error Unauthorized();
    error InvalidParameters();
    error InvalidMilestoneIndex();
    error MilestoneNotFunded();
    error InvalidNonce();
    error InvalidOracleSignature();
    error TimeoutNotReached();
    error NothingToRefund();
    error TransferFailed();
    error FaucetCooldown();
    error FaucetEmpty();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(address _oracleSigner, address _treasury, address _registry) {
        if (_oracleSigner == address(0) || _treasury == address(0) || _registry == address(0)) {
            revert InvalidParameters();
        }
        owner = msg.sender;
        oracleSigner = _oracleSigner;
        treasury = _treasury;
        registry = IDiptosRegistry(_registry);
    }

    receive() external payable {}

    function protocolFeeBps() external pure returns (uint256) {
        return PROTOCOL_FEE_BPS;
    }

    /// @notice Converts Arc native 18-decimal USDC wei to 6-decimal ERC-20 USDC units.
    function toUsdc6(uint256 nativeWei) external pure returns (uint256) {
        return nativeWei / NATIVE_TO_ERC20_SCALE;
    }

    /// @notice Converts 6-decimal ERC-20 USDC units to Arc native 18-decimal USDC wei.
    function fromUsdc6(uint256 usdc6) external pure returns (uint256) {
        return usdc6 * NATIVE_TO_ERC20_SCALE;
    }

    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return keccak256(
            abi.encode(EIP712_DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this))
        );
    }

    function setOracleSigner(address _oracleSigner) external onlyOwner {
        if (_oracleSigner == address(0)) revert InvalidParameters();
        emit OracleSignerUpdated(oracleSigner, _oracleSigner);
        oracleSigner = _oracleSigner;
    }

    /// @notice Creates a single-shot programmable native USDC escrow link (1 milestone).
    function createEscrowLink(
        bytes32 escrowId,
        address payee,
        uint256 deadline,
        uint256 lambdaBps,
        bool isAgentMode
    ) public payable {
        uint256[] memory amounts = new uint256[](1);
        uint256[] memory deadlines = new uint256[](1);
        amounts[0] = msg.value;
        deadlines[0] = deadline;
        createMultiMilestoneEscrow(escrowId, payee, amounts, deadlines, lambdaBps, isAgentMode);
    }

    /// @notice Creates a multi-milestone programmable native USDC escrow with canonical registry binding.
    function createMultiMilestoneEscrow(
        bytes32 escrowId,
        address payee,
        uint256[] memory amounts,
        uint256[] memory deadlines,
        uint256 lambdaBps,
        bool isAgentMode
    ) public payable {
        uint256 count = amounts.length;
        if (
            escrowId == bytes32(0) ||
            payee == address(0) ||
            count == 0 ||
            count != deadlines.length ||
            lambdaBps > 50_000
        ) revert InvalidParameters();

        uint256 sum = 0;
        uint256 finalDeadline = 0;
        for (uint256 i = 0; i < count; i++) {
            if (amounts[i] == 0 || deadlines[i] <= block.timestamp) revert InvalidParameters();
            sum += amounts[i];
            if (deadlines[i] > finalDeadline) finalDeadline = deadlines[i];
        }
        if (sum != msg.value) revert InvalidParameters();

        bytes32 canonicalHash = registry.recordCommitment(
            escrowId,
            msg.sender,
            payee,
            msg.value,
            finalDeadline
        );

        escrows[escrowId] = Escrow({
            payer: msg.sender,
            payee: payee,
            totalFunded: msg.value,
            createdAt: block.timestamp,
            fundedAt: block.timestamp,
            lambdaBps: lambdaBps,
            gracePeriod: DEFAULT_GRACE_PERIOD,
            nonce: 0,
            isAgentMode: isAgentMode,
            canonicalHash: canonicalHash
        });

        for (uint256 i = 0; i < count; i++) {
            _milestones[escrowId].push(
                Milestone({
                    amount: amounts[i],
                    deadline: deadlines[i],
                    deliverableHash: bytes32(0),
                    status: MilestoneStatus.FUNDED
                })
            );
        }

        allEscrowIds.push(escrowId);
        userEscrows[msg.sender].push(escrowId);
        if (payee != msg.sender) {
            userEscrows[payee].push(escrowId);
        }

        emit EscrowCreated(
            escrowId,
            msg.sender,
            payee,
            msg.value,
            finalDeadline,
            lambdaBps,
            count,
            isAgentMode
        );
    }

    function fundTestEscrow(
        bytes32 escrowId,
        address payee,
        uint256 deadline,
        uint256 lambdaBps,
        bool isAgentMode
    ) external payable {
        uint256 resolvedDeadline = deadline > block.timestamp ? deadline : block.timestamp + 24 hours;
        uint256 resolvedLambda = lambdaBps > 0 ? lambdaBps : 3500;
        createEscrowLink(escrowId, payee, resolvedDeadline, resolvedLambda, isAgentMode);
    }

    function faucetMint() external {
        if (lastFaucetClaim[msg.sender] != 0 && block.timestamp < lastFaucetClaim[msg.sender] + 1 hours) {
            revert FaucetCooldown();
        }
        if (address(this).balance < FAUCET_DRIP) revert FaucetEmpty();
        lastFaucetClaim[msg.sender] = block.timestamp;
        _transferNative(msg.sender, FAUCET_DRIP);
        emit FaucetDispensed(msg.sender, FAUCET_DRIP);
    }

    /// @notice Total number of escrows created on-chain.
    function getEscrowCount() external view returns (uint256) {
        return allEscrowIds.length;
    }

    /// @notice Returns all escrow IDs associated with a payer or payee address.
    function getUserEscrowIds(address user) external view returns (bytes32[] memory) {
        return userEscrows[user];
    }

    /// @notice Returns a full EscrowView struct for a single escrowId.
    function getEscrowView(bytes32 escrowId) public view returns (EscrowView memory viewData) {
        Escrow storage e = escrows[escrowId];
        Milestone[] storage list = _milestones[escrowId];
        uint256 deadline = 0;
        MilestoneStatus status = MilestoneStatus.PENDING;
        bytes32 delHash = bytes32(0);

        if (list.length > 0) {
            uint256 lastIdx = list.length - 1;
            deadline = list[lastIdx].deadline;
            status = list[lastIdx].status;
            delHash = list[lastIdx].deliverableHash;
            for (uint256 i = 0; i < list.length; i++) {
                if (list[i].status == MilestoneStatus.FUNDED) {
                    status = MilestoneStatus.FUNDED;
                    deadline = list[i].deadline;
                    break;
                }
            }
        }

        return EscrowView({
            escrowId: escrowId,
            payer: e.payer,
            payee: e.payee,
            amount: e.totalFunded,
            deadline: deadline,
            createdAt: e.createdAt,
            fundedAt: e.fundedAt,
            lambdaBps: e.lambdaBps,
            nonce: e.nonce,
            isAgentMode: e.isAgentMode,
            status: status,
            deliverableHash: delHash
        });
    }

    /// @notice Paginated on-chain enumeration of all escrows (newest first when queried from end or sequential offset).
    function getEscrowsPaginated(uint256 offset, uint256 limit) external view returns (EscrowView[] memory items) {
        uint256 total = allEscrowIds.length;
        if (offset >= total || limit == 0) {
            return new EscrowView[](0);
        }
        uint256 remaining = total - offset;
        uint256 count = remaining < limit ? remaining : limit;
        items = new EscrowView[](count);
        for (uint256 i = 0; i < count; i++) {
            // Return newest-first order so recent escrows appear at offset 0
            bytes32 id = allEscrowIds[total - 1 - offset - i];
            items[i] = getEscrowView(id);
        }
    }

    function computeReleaseDigest(
        bytes32 escrowId,
        uint256 milestoneIndex,
        bytes32 deliverableHash,
        uint256 nonce
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                RELEASE_TYPEHASH,
                escrowId,
                milestoneIndex,
                deliverableHash,
                nonce,
                block.chainid
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash));
    }

    function releaseWithOracle(
        bytes32 escrowId,
        uint256 milestoneIndex,
        bytes32 deliverableHash,
        uint256 expectedNonce,
        bytes calldata grokSignature
    ) external {
        Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert InvalidParameters();
        if (expectedNonce != e.nonce) revert InvalidNonce();

        Milestone[] storage list = _milestones[escrowId];
        if (milestoneIndex >= list.length) revert InvalidMilestoneIndex();
        Milestone storage m = list[milestoneIndex];
        if (m.status != MilestoneStatus.FUNDED) revert MilestoneNotFunded();

        bytes32 digest = computeReleaseDigest(escrowId, milestoneIndex, deliverableHash, expectedNonce);
        address recovered = _recoverSigner(digest, grokSignature);
        if (recovered != oracleSigner) revert InvalidOracleSignature();

        e.nonce = expectedNonce + 1;
        m.deliverableHash = deliverableHash;
        m.status = MilestoneStatus.SETTLED;

        (uint256 payeePayout, uint256 payerRebate, uint256 protocolFee, uint256 decayBps) =
            previewMilestoneTECD(escrowId, milestoneIndex, block.timestamp);

        uint256 delaySeconds = block.timestamp > m.deadline ? block.timestamp - m.deadline : 0;
        bool onTime = delaySeconds == 0;

        registry.recordSettlement(escrowId, e.payee, m.amount, delaySeconds, onTime);

        uint256 lockDuration = block.timestamp > e.fundedAt ? block.timestamp - e.fundedAt : 0;
        uint256 accruedYieldBps = (lockDuration * ANNUAL_FLOAT_YIELD_BPS) / 365 days;
        uint256 notionalYieldWei = (m.amount * lockDuration * ANNUAL_FLOAT_YIELD_BPS) / (365 days * BPS_DENOMINATOR);

        if (protocolFee > 0) _transferNative(treasury, protocolFee);
        if (payerRebate > 0) _transferNative(e.payer, payerRebate);
        if (payeePayout > 0) _transferNative(e.payee, payeePayout);

        if (!onTime) {
            emit TECDPenaltyApplied(escrowId, milestoneIndex, delaySeconds, decayBps, payerRebate, payeePayout);
        }

        emit FloatYieldSettled(escrowId, milestoneIndex, lockDuration, accruedYieldBps, notionalYieldWei);
        emit MilestoneSettled(
            escrowId,
            milestoneIndex,
            e.payee,
            payeePayout,
            payerRebate,
            protocolFee,
            deliverableHash,
            expectedNonce
        );
    }

    function claimTimeoutRefund(bytes32 escrowId) external {
        Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert InvalidParameters();
        if (msg.sender != e.payer) revert Unauthorized();

        Milestone[] storage list = _milestones[escrowId];
        uint256 refundAmount = 0;
        uint256 refundedCount = 0;
        bool anyFunded = false;

        for (uint256 i = 0; i < list.length; i++) {
            if (list[i].status == MilestoneStatus.FUNDED) {
                anyFunded = true;
                if (block.timestamp > list[i].deadline + e.gracePeriod) {
                    list[i].status = MilestoneStatus.REFUNDED;
                    refundAmount += list[i].amount;
                    refundedCount += 1;
                }
            }
        }

        if (!anyFunded) revert NothingToRefund();
        if (refundAmount == 0) revert TimeoutNotReached();

        _transferNative(e.payer, refundAmount);
        emit TimeoutRefunded(escrowId, e.payer, refundAmount, refundedCount);
    }

    function mutualCancel(bytes32 escrowId) external {
        Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert InvalidParameters();
        if (msg.sender != e.payee) revert Unauthorized();

        Milestone[] storage list = _milestones[escrowId];
        uint256 refundAmount = 0;

        for (uint256 i = 0; i < list.length; i++) {
            if (list[i].status == MilestoneStatus.FUNDED) {
                list[i].status = MilestoneStatus.REFUNDED;
                refundAmount += list[i].amount;
            }
        }

        if (refundAmount == 0) revert NothingToRefund();

        _transferNative(e.payer, refundAmount);
        emit EscrowCancelled(escrowId, msg.sender, refundAmount);
    }

    function getMilestones(bytes32 escrowId) external view returns (Milestone[] memory) {
        return _milestones[escrowId];
    }

    function getMilestoneCount(bytes32 escrowId) external view returns (uint256) {
        return _milestones[escrowId].length;
    }

    /// @notice Stateless on-chain TECD simulator callable via eth_call so UI matches Solidity WAD math 1:1.
    function previewTECDPayout(
        uint256 amount,
        uint256 deadline,
        uint256 simulatedTimestamp,
        uint256 lambdaBps
    ) external view returns (uint256 payeePayout, uint256 payerRebate, uint256 protocolFee, uint256 decayBps) {
        uint256 delaySeconds = simulatedTimestamp > deadline ? simulatedTimestamp - deadline : 0;
        uint256 window = deadline > block.timestamp ? deadline - block.timestamp : 24 hours;
        return calculateTECD(amount, delaySeconds, window, lambdaBps);
    }

    function calculateTECD(
        uint256 amount,
        uint256 delaySeconds,
        uint256 windowSeconds,
        uint256 lambdaBps
    ) public pure returns (uint256 payeePayout, uint256 payerRebate, uint256 protocolFee, uint256 decayBps) {
        if (amount == 0) return (0, 0, 0, 0);

        if (delaySeconds == 0 || lambdaBps == 0) {
            protocolFee = (amount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
            payeePayout = amount - protocolFee;
            return (payeePayout, 0, protocolFee, 0);
        }

        uint256 window = windowSeconds < 1 hours ? 1 hours : windowSeconds;
        uint256 ratioWad = delaySeconds >= window * 100 ? 100 * WAD : (delaySeconds * WAD) / window;
        uint256 sqrtRatioWad = _sqrt(ratioWad * WAD);
        uint256 ratioGammaWad = (ratioWad * sqrtRatioWad) / WAD;

        uint256 xWad = (lambdaBps * ratioGammaWad) / BPS_DENOMINATOR;
        uint256 retentionWad = _expNegWad(xWad);

        uint256 grossPayee = (amount * retentionWad) / WAD;
        protocolFee = (grossPayee * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        payeePayout = grossPayee - protocolFee;
        payerRebate = amount - grossPayee;
        decayBps = ((WAD - retentionWad) * BPS_DENOMINATOR) / WAD;
    }

    function previewMilestoneTECD(
        bytes32 escrowId,
        uint256 milestoneIndex,
        uint256 atTimestamp
    ) public view returns (uint256 payeePayout, uint256 payerRebate, uint256 protocolFee, uint256 decayBps) {
        Escrow storage e = escrows[escrowId];
        Milestone[] storage list = _milestones[escrowId];
        if (e.payer == address(0) || milestoneIndex >= list.length) return (0, 0, 0, 0);

        Milestone storage m = list[milestoneIndex];
        uint256 delaySeconds = atTimestamp > m.deadline ? atTimestamp - m.deadline : 0;
        uint256 window = m.deadline > e.fundedAt ? m.deadline - e.fundedAt : 1 hours;
        return calculateTECD(m.amount, delaySeconds, window, e.lambdaBps);
    }

    function previewTECD(
        bytes32 escrowId,
        uint256 atTimestamp
    ) external view returns (uint256 payeePayout, uint256 payerRebate, uint256 protocolFee, uint256 decayBps) {
        return previewMilestoneTECD(escrowId, 0, atTimestamp);
    }

    function _expNegWad(uint256 x) internal pure returns (uint256) {
        if (x == 0) return WAD;
        if (x >= 20 * WAD) return 0;

        uint256 k = 0;
        uint256 y = x;
        while (y > WAD / 4) {
            y >>= 1;
            k++;
        }

        uint256 y2 = (y * y) / WAD;
        uint256 y3 = (y2 * y) / WAD;
        uint256 y4 = (y3 * y) / WAD;
        uint256 y5 = (y4 * y) / WAD;
        uint256 y6 = (y5 * y) / WAD;

        uint256 pos = WAD + (y2 / 2) + (y4 / 24) + (y6 / 720);
        uint256 neg = y + (y3 / 6) + (y5 / 120);
        uint256 res = pos > neg ? pos - neg : 0;

        for (uint256 i = 0; i < k; i++) {
            res = (res * res) / WAD;
        }
        return res;
    }

    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function _recoverSigner(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) revert InvalidOracleSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (uint256(s) > SECP256K1_HALF_N) revert InvalidOracleSignature();
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert InvalidOracleSignature();
        address recovered = ecrecover(digest, v, r, s);
        if (recovered == address(0)) revert InvalidOracleSignature();
        return recovered;
    }

    function _transferNative(address to, uint256 amount) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
