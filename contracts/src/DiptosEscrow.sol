// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDiptosRegistry} from "./DiptosRegistry.sol";

/// @notice Minimal ERC-1271 interface for smart-account / ERC-4337 / EIP-7702 verifier compatibility.
interface IERC1271 {
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4 magicValue);
}

/// @notice Modular pluggable verifier interface (TEE attestations, ZK proofs, or future PQ verifiers).
interface IDiptosVerifier {
    function verifyRelease(
        bytes32 escrowId,
        uint256 milestoneIndex,
        bytes32 deliverableHash,
        uint256 nonce,
        bytes calldata proof
    ) external view returns (bool);
}

/// @title DiptosEscrow
/// @notice Multi-Milestone Programmable Escrow, On-Chain Metadata & Enumeration, EIP-712 Replay-Protected
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
        string title;
        string acceptanceScope;
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
        string title;
        string acceptanceScope;
    }

    uint256 public constant PROTOCOL_FEE_BPS = 50; // 0.50% flat fee
    uint256 public constant MAX_PROTOCOL_FEE_BPS = 100; // Hard 1.00% protocol fee ceiling
    uint256 public constant MAX_LAMBDA_BPS = 50_000; // Bounded λ <= 5.0
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant WAD = 1e18;
    uint256 public constant NATIVE_TO_ERC20_SCALE = 1e12; // 18-dec native USDC <-> 6-dec ERC-20 USDC
    uint256 public constant DEFAULT_GRACE_PERIOD = 24 hours;
    uint256 public constant ANNUAL_FLOAT_YIELD_BPS = 450; // 4.50% APY reference float rate
    uint256 public constant FAUCET_DRIP = 0.25 ether; // 0.25 native USDC (18 decimals)
    bytes4 private constant ERC1271_MAGICVALUE = 0x1626ba7e;

    uint256 private constant SECP256K1_HALF_N =
        0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    bytes32 public constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant NAME_HASH = keccak256("DiptosEscrow");
    bytes32 public constant VERSION_HASH = keccak256("1");
    bytes32 public constant RELEASE_TYPEHASH =
        keccak256("ReleaseEscrow(bytes32 escrowId,bytes32 deliverableHash,uint256 nonce)");
    bytes32 public constant RELEASE_WITH_EXPIRY_TYPEHASH =
        keccak256(
            "ReleaseEscrowWithExpiry(bytes32 escrowId,uint256 milestoneIndex,bytes32 deliverableHash,uint256 nonce,uint256 expiry)"
        );
    bytes32 public constant LEGACY_RELEASE_MILESTONE_TYPEHASH =
        keccak256(
            "ReleaseMilestone(bytes32 escrowId,uint256 milestoneIndex,bytes32 deliverableHash,uint256 nonce,uint256 chainId)"
        );

    address public owner;
    address public oracleSigner;
    address public treasury;
    IDiptosRegistry public registry;
    IDiptosVerifier public customVerifier;

    // Strict reentrancy guard (1 = unlocked, 2 = locked) & segregated locked principal accounting
    uint256 private _reentrancyStatus = 1;
    uint256 public totalLockedPrincipal;

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
    event CustomVerifierUpdated(address indexed previousVerifier, address indexed newVerifier);

    error Unauthorized();
    error InvalidParameters();
    error SelfEscrowNotAllowed();
    error ReentrancyDetected();
    error SignatureExpired();
    error InvalidMilestoneIndex();
    error MilestoneNotFunded();
    error EscrowNotFunded();
    error AlreadySettled();
    error InvalidNonce(uint256 expected, uint256 provided);
    error InvalidOracleSignature(address recovered, address expected);
    error ZeroPayout();
    error TimeoutNotReached();
    error NothingToRefund();
    error TransferFailed();
    error FaucetCooldown();
    error FaucetEmpty();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (_reentrancyStatus == 2) revert ReentrancyDetected();
        _reentrancyStatus = 2;
        _;
        _reentrancyStatus = 1;
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

    /// @notice Returns the current replay-protection nonce for an escrowId.
    function nonces(bytes32 escrowId) external view returns (uint256) {
        return escrows[escrowId].nonce;
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

    /// @notice Plug in a modular verifier (TEE / ZK / ERC-4337 / PQ) without redeploying core escrow logic.
    function setCustomVerifier(address _verifier) external onlyOwner {
        emit CustomVerifierUpdated(address(customVerifier), _verifier);
        customVerifier = IDiptosVerifier(_verifier);
    }

    /// @notice Creates a single-shot programmable native USDC escrow link with full on-chain title & acceptance scope.
    function createEscrowLink(
        bytes32 escrowId,
        address payee,
        uint256 deadline,
        uint256 lambdaBps,
        bool isAgentMode,
        string calldata title,
        string calldata acceptanceScope
    ) public payable {
        uint256[] memory amounts = new uint256[](1);
        uint256[] memory deadlines = new uint256[](1);
        amounts[0] = msg.value;
        deadlines[0] = deadline;
        _createEscrowInternal(escrowId, payee, amounts, deadlines, lambdaBps, isAgentMode, title, acceptanceScope);
    }

    /// @notice Backward-compatible 5-arg overload for createEscrowLink.
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
        _createEscrowInternal(escrowId, payee, amounts, deadlines, lambdaBps, isAgentMode, "", "");
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
        _createEscrowInternal(escrowId, payee, amounts, deadlines, lambdaBps, isAgentMode, "", "");
    }

    function _createEscrowInternal(
        bytes32 escrowId,
        address payee,
        uint256[] memory amounts,
        uint256[] memory deadlines,
        uint256 lambdaBps,
        bool isAgentMode,
        string memory title,
        string memory acceptanceScope
    ) internal nonReentrant {
        uint256 count = amounts.length;
        if (payee == msg.sender) revert SelfEscrowNotAllowed();
        if (
            escrowId == bytes32(0) ||
            payee == address(0) ||
            count == 0 ||
            count != deadlines.length ||
            lambdaBps > MAX_LAMBDA_BPS
        ) revert InvalidParameters();

        uint256 sum = 0;
        uint256 finalDeadline = 0;
        for (uint256 i = 0; i < count; i++) {
            if (amounts[i] == 0 || deadlines[i] <= block.timestamp) revert InvalidParameters();
            sum += amounts[i];
            if (deadlines[i] > finalDeadline) finalDeadline = deadlines[i];
        }
        if (sum != msg.value || msg.value == 0) revert InvalidParameters();

        bytes32 canonicalHash = registry.recordCommitment(
            escrowId,
            msg.sender,
            payee,
            msg.value,
            finalDeadline
        );

        totalLockedPrincipal += msg.value;

        Escrow storage e = escrows[escrowId];
        e.payer = msg.sender;
        e.payee = payee;
        e.totalFunded = msg.value;
        e.createdAt = block.timestamp;
        e.fundedAt = block.timestamp;
        e.lambdaBps = lambdaBps;
        e.gracePeriod = DEFAULT_GRACE_PERIOD;
        e.nonce = 0;
        e.isAgentMode = isAgentMode;
        e.canonicalHash = canonicalHash;
        e.title = title;
        e.acceptanceScope = acceptanceScope;

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

    function faucetMint() public nonReentrant {
        if (lastFaucetClaim[msg.sender] != 0 && block.timestamp < lastFaucetClaim[msg.sender] + 1 hours) {
            revert FaucetCooldown();
        }
        // Strictly segregate faucet reserve from locked user escrow principal
        if (address(this).balance < totalLockedPrincipal + FAUCET_DRIP) revert FaucetEmpty();
        lastFaucetClaim[msg.sender] = block.timestamp;
        _transferNative(msg.sender, FAUCET_DRIP);
        emit FaucetDispensed(msg.sender, FAUCET_DRIP);
    }

    function claimTestnetFaucet() external {
        faucetMint();
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
            deliverableHash: delHash,
            title: e.title,
            acceptanceScope: e.acceptanceScope
        });
    }

    /// @notice Alias for getEscrowView(bytes32).
    function getEscrow(bytes32 escrowId) external view returns (EscrowView memory) {
        return getEscrowView(escrowId);
    }

    /// @notice Paginated on-chain enumeration of all escrows (newest-first).
    function getEscrowsPaginated(uint256 offset, uint256 limit) external view returns (EscrowView[] memory items) {
        uint256 total = allEscrowIds.length;
        if (offset >= total || limit == 0) {
            return new EscrowView[](0);
        }
        uint256 remaining = total - offset;
        uint256 count = remaining < limit ? remaining : limit;
        items = new EscrowView[](count);
        for (uint256 i = 0; i < count; i++) {
            bytes32 id = allEscrowIds[total - 1 - offset - i];
            items[i] = getEscrowView(id);
        }
    }

    /// @notice Computes the EIP-712 digest for ReleaseEscrow(bytes32 escrowId,bytes32 deliverableHash,uint256 nonce).
    function computeReleaseDigest(
        bytes32 escrowId,
        bytes32 deliverableHash,
        uint256 nonce
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                RELEASE_TYPEHASH,
                escrowId,
                deliverableHash,
                nonce
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash));
    }

    /// @notice Overload for milestone-indexed callers; delegates to canonical ReleaseEscrow digest when milestoneIndex == 0.
    function computeReleaseDigest(
        bytes32 escrowId,
        uint256 milestoneIndex,
        bytes32 deliverableHash,
        uint256 nonce
    ) public view returns (bytes32) {
        if (milestoneIndex == 0) {
            return computeReleaseDigest(escrowId, deliverableHash, nonce);
        }
        bytes32 structHash = keccak256(
            abi.encode(
                LEGACY_RELEASE_MILESTONE_TYPEHASH,
                escrowId,
                milestoneIndex,
                deliverableHash,
                nonce,
                block.chainid
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash));
    }

    /// @notice Computes the EIP-712 digest with explicit expiry bound to chainId and verifyingContract.
    function computeReleaseWithExpiryDigest(
        bytes32 escrowId,
        uint256 milestoneIndex,
        bytes32 deliverableHash,
        uint256 nonce,
        uint256 expiry
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(RELEASE_WITH_EXPIRY_TYPEHASH, escrowId, milestoneIndex, deliverableHash, nonce, expiry)
        );
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash));
    }

    /// @notice Hardened settlement entrypoint with signature expiry, ERC-1271 smart-account support, and modular verifier hook.
    function releaseWithExpiry(
        bytes32 escrowId,
        uint256 milestoneIndex,
        bytes32 deliverableHash,
        uint256 expectedNonce,
        uint256 expiry,
        bytes calldata signature
    ) external nonReentrant {
        if (block.timestamp > expiry) revert SignatureExpired();
        Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFunded();

        Milestone[] storage list = _milestones[escrowId];
        if (milestoneIndex >= list.length) revert InvalidMilestoneIndex();
        Milestone storage m = list[milestoneIndex];
        if (m.status == MilestoneStatus.SETTLED) revert AlreadySettled();
        if (m.status != MilestoneStatus.FUNDED) revert EscrowNotFunded();
        if (expectedNonce != e.nonce) revert InvalidNonce(e.nonce, expectedNonce);

        bool verified = false;
        if (address(customVerifier) != address(0)) {
            verified = customVerifier.verifyRelease(escrowId, milestoneIndex, deliverableHash, expectedNonce, signature);
        }
        if (!verified) {
            bytes32 digest = computeReleaseWithExpiryDigest(
                escrowId,
                milestoneIndex,
                deliverableHash,
                expectedNonce,
                expiry
            );
            verified = _isValidOracleSignature(digest, signature);
        }
        if (!verified) revert InvalidOracleSignature(address(0), oracleSigner);

        _settleMilestoneInternal(escrowId, milestoneIndex, deliverableHash, expectedNonce);
    }

    /// @notice Settle milestone 0 with EIP-712 signature (4-arg convenience overload).
    function releaseWithOracle(
        bytes32 escrowId,
        bytes32 deliverableHash,
        uint256 expectedNonce,
        bytes calldata grokSignature
    ) external nonReentrant {
        _releaseWithOracleInternal(escrowId, 0, deliverableHash, expectedNonce, grokSignature);
    }

    /// @notice Settle a specific milestone with EIP-712 signature (5-arg canonical entrypoint).
    function releaseWithOracle(
        bytes32 escrowId,
        uint256 milestoneIndex,
        bytes32 deliverableHash,
        uint256 expectedNonce,
        bytes calldata grokSignature
    ) public nonReentrant {
        _releaseWithOracleInternal(escrowId, milestoneIndex, deliverableHash, expectedNonce, grokSignature);
    }

    function _releaseWithOracleInternal(
        bytes32 escrowId,
        uint256 milestoneIndex,
        bytes32 deliverableHash,
        uint256 expectedNonce,
        bytes calldata grokSignature
    ) internal {
        Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFunded();

        Milestone[] storage list = _milestones[escrowId];
        if (milestoneIndex >= list.length) revert InvalidMilestoneIndex();
        Milestone storage m = list[milestoneIndex];
        if (m.status == MilestoneStatus.SETTLED) revert AlreadySettled();
        if (m.status != MilestoneStatus.FUNDED) revert EscrowNotFunded();
        if (expectedNonce != e.nonce) revert InvalidNonce(e.nonce, expectedNonce);

        bytes32 digest = computeReleaseDigest(escrowId, deliverableHash, expectedNonce);
        address recovered = _recoverSigner(digest, grokSignature);
        if (recovered != oracleSigner) {
            // Also check legacy 5-field ReleaseMilestone digest before reverting
            bytes32 legacyStructHash = keccak256(
                abi.encode(
                    LEGACY_RELEASE_MILESTONE_TYPEHASH,
                    escrowId,
                    milestoneIndex,
                    deliverableHash,
                    expectedNonce,
                    block.chainid
                )
            );
            bytes32 legacyDigest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), legacyStructHash));
            address legacyRecovered = _recoverSigner(legacyDigest, grokSignature);
            if (legacyRecovered != oracleSigner) {
                revert InvalidOracleSignature(recovered, oracleSigner);
            }
        }

        _settleMilestoneInternal(escrowId, milestoneIndex, deliverableHash, expectedNonce);
    }

    /// @notice Payer mutual release: allows the escrow payer to directly approve and settle on-chain.
    function releaseByPayer(bytes32 escrowId) external nonReentrant {
        Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFunded();
        if (msg.sender != e.payer) revert Unauthorized();

        Milestone[] storage list = _milestones[escrowId];
        if (list.length == 0) revert EscrowNotFunded();

        uint256 targetIdx = type(uint256).max;
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i].status == MilestoneStatus.FUNDED) {
                targetIdx = i;
                break;
            }
        }
        if (targetIdx == type(uint256).max) revert AlreadySettled();

        bytes32 delHash = keccak256(abi.encodePacked("payer-approved:", escrowId, e.nonce));
        _settleMilestoneInternal(escrowId, targetIdx, delHash, e.nonce);
    }

    function _settleMilestoneInternal(
        bytes32 escrowId,
        uint256 milestoneIndex,
        bytes32 deliverableHash,
        uint256 expectedNonce
    ) internal {
        Escrow storage e = escrows[escrowId];
        Milestone storage m = _milestones[escrowId][milestoneIndex];

        (uint256 payeePayout, uint256 payerRebate, uint256 protocolFee, uint256 decayBps) =
            previewMilestoneTECD(escrowId, milestoneIndex, block.timestamp);

        if (payeePayout == 0 && payerRebate == 0) revert ZeroPayout();

        e.nonce = expectedNonce + 1;
        m.deliverableHash = deliverableHash;
        m.status = MilestoneStatus.SETTLED;
        totalLockedPrincipal -= m.amount;

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

    function claimTimeoutRefund(bytes32 escrowId) external nonReentrant {
        Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFunded();
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

        totalLockedPrincipal -= refundAmount;
        _transferNative(e.payer, refundAmount);
        emit TimeoutRefunded(escrowId, e.payer, refundAmount, refundedCount);
    }

    function mutualCancel(bytes32 escrowId) external nonReentrant {
        Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFunded();
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

        totalLockedPrincipal -= refundAmount;
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

    /// @notice Zero-dust multi-decimal WAD normalization (supports 6-dec Base ERC-20 USDC and 18-dec Arc Native USDC).
    ///         Routes any rounding dust deterministically to payerRebate so payeePayout + payerRebate + protocolFee == amount.
    function calculateTECDForDecimals(
        uint256 amount,
        uint8 decimals,
        uint256 delaySeconds,
        uint256 windowSeconds,
        uint256 lambdaBps
    ) public pure returns (uint256 payeePayout, uint256 payerRebate, uint256 protocolFee, uint256 decayBps) {
        if (amount == 0) return (0, 0, 0, 0);
        if (decimals > 18) revert InvalidParameters();
        uint256 scale = 10 ** (18 - decimals);
        uint256 wadAmount = amount * scale;
        (uint256 wPayee, , uint256 wFee, uint256 dBps) =
            calculateTECD(wadAmount, delaySeconds, windowSeconds, lambdaBps);
        payeePayout = wPayee / scale;
        protocolFee = wFee / scale;
        // Route any sub-unit rounding dust deterministically to buyer rebate (0 wei trapped)
        payerRebate = amount - payeePayout - protocolFee;
        decayBps = dBps;
    }

    function _isValidOracleSignature(bytes32 digest, bytes calldata sig) internal view returns (bool) {
        if (oracleSigner.code.length > 0) {
            try IERC1271(oracleSigner).isValidSignature(digest, sig) returns (bytes4 magic) {
                return magic == ERC1271_MAGICVALUE;
            } catch {
                return false;
            }
        }
        return _recoverSigner(digest, sig) == oracleSigner;
    }

    function _recoverSigner(bytes32 digest, bytes calldata sig) internal view returns (address) {
        if (sig.length != 65) revert InvalidOracleSignature(address(0), oracleSigner);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (uint256(s) > SECP256K1_HALF_N) revert InvalidOracleSignature(address(0), oracleSigner);
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert InvalidOracleSignature(address(0), oracleSigner);
        address recovered = ecrecover(digest, v, r, s);
        if (recovered == address(0)) revert InvalidOracleSignature(address(0), oracleSigner);
        return recovered;
    }

    function _transferNative(address to, uint256 amount) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
