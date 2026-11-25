// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DiptosEscrow, IERC1271, IDiptosVerifier} from "../src/DiptosEscrow.sol";
import {DiptosRegistry} from "../src/DiptosRegistry.sol";

interface Vm {
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function deal(address, uint256) external;
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
    function expectEmit(bool, bool, bool, bool) external;
}

/// @notice Malicious payee contract attempting reentrancy on settlement & faucet callbacks.
contract ReentrantAttacker {
    DiptosEscrow public immutable target;
    bytes32 public targetEscrowId;
    bool public attempted;
    bool public reentered;

    constructor(DiptosEscrow _target) {
        target = _target;
    }

    function setTargetEscrow(bytes32 id) external {
        targetEscrowId = id;
    }

    receive() external payable {
        if (!attempted) {
            attempted = true;
            try target.faucetMint() {
                reentered = true;
            } catch {}
            try target.mutualCancel(targetEscrowId) {
                reentered = true;
            } catch {}
        }
    }
}

/// @notice Mock ERC-1271 smart-account oracle verifier.
contract MockERC1271Signer is IERC1271 {
    bytes32 public approvedDigest;

    function approve(bytes32 digest) external {
        approvedDigest = digest;
    }

    function isValidSignature(bytes32 hash, bytes calldata) external view returns (bytes4) {
        return hash == approvedDigest ? bytes4(0x1626ba7e) : bytes4(0xffffffff);
    }
}

/// @notice Mock Phase 2 hardware-pinned TEE verifier implementing IDiptosVerifier.
contract MockTEEVerifier is IDiptosVerifier {
    bytes32 public expectedProofHash;

    function setExpectedProof(bytes32 proofHash) external {
        expectedProofHash = proofHash;
    }

    function verifyRelease(
        bytes32,
        uint256,
        bytes32 deliverableHash,
        uint256,
        bytes calldata proof
    ) external view returns (bool) {
        return deliverableHash == expectedProofHash && keccak256(proof) == keccak256("tee-pcr-attestation");
    }
}

contract DiptosSecurityTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    DiptosRegistry public registry;
    DiptosEscrow public escrow;

    uint256 internal oraclePk = 0xA11CE;
    address internal oracle;
    address internal treasury = address(0xBEEF);
    address internal payer = address(0x1111);
    address internal payee = address(0x2222);
    address internal attacker = address(0x3333);

    function setUp() public {
        oracle = vm.addr(oraclePk);
        registry = new DiptosRegistry(address(this));
        escrow = new DiptosEscrow(oracle, treasury, address(registry));
        registry.setEscrowContract(address(escrow));

        vm.deal(payer, 1000 ether);
        vm.deal(payee, 10 ether);
        vm.deal(attacker, 10 ether);
    }

    function _bound(uint256 x, uint256 minVal, uint256 maxVal) internal pure returns (uint256) {
        if (x >= minVal && x <= maxVal) return x;
        return minVal + (x % (maxVal - minVal + 1));
    }

    function _signExpiry(
        bytes32 escrowId,
        uint256 milestoneIdx,
        bytes32 delHash,
        uint256 nonce,
        uint256 expiry
    ) internal returns (bytes memory) {
        bytes32 digest = escrow.computeReleaseWithExpiryDigest(escrowId, milestoneIdx, delHash, nonce, expiry);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePk, digest);
        return abi.encodePacked(r, s, v);
    }

    function testSelfEscrowReverts() public {
        bytes32 id = keccak256("self-escrow");
        vm.prank(payer);
        vm.expectRevert(DiptosEscrow.SelfEscrowNotAllowed.selector);
        escrow.createEscrowLink{value: 1 ether}(id, payer, block.timestamp + 1 days, 5000, false, "Self", "Invalid");
    }

    function testFaucetCannotDrainLockedEscrowFunds() public {
        bytes32 id = keccak256("locked-escrow-1");
        vm.prank(payer);
        escrow.createEscrowLink{value: 1 ether}(id, payee, block.timestamp + 1 days, 5000, false, "Audit", "Scope");

        require(escrow.totalLockedPrincipal() == 1 ether, "locked principal mismatch");
        require(address(escrow).balance == 1 ether, "balance mismatch");

        // Attacker tries to drain locked user escrow funds via faucetMint()
        vm.prank(attacker);
        vm.expectRevert(DiptosEscrow.FaucetEmpty.selector);
        escrow.faucetMint();

        require(address(escrow).balance >= escrow.totalLockedPrincipal(), "solvency violated");
    }

    function testReentrancyBlockedOnSettlement() public {
        ReentrantAttacker malPayee = new ReentrantAttacker(escrow);
        bytes32 id = keccak256("reentrant-escrow");
        malPayee.setTargetEscrow(id);

        // Fund separate faucet reserve so faucet would succeed if not blocked by ReentrancyGuard
        vm.deal(address(escrow), 1 ether);

        vm.prank(payer);
        escrow.createEscrowLink{value: 2 ether}(
            id,
            address(malPayee),
            block.timestamp + 1 days,
            5000,
            false,
            "Reentrant",
            "Test"
        );

        vm.prank(payer);
        escrow.releaseByPayer(id);

        require(malPayee.attempted(), "callback should have fired");
        require(!malPayee.reentered(), "reentrancy MUST be blocked");
        require(escrow.totalLockedPrincipal() == 0, "locked principal not cleared");
    }

    function testExpiredSignatureReverts() public {
        bytes32 id = keccak256("expired-sig-escrow");
        vm.prank(payer);
        escrow.createEscrowLink{value: 1 ether}(id, payee, block.timestamp + 1 days, 5000, false, "Expiry", "Test");

        bytes32 delHash = keccak256("deliverable-1");
        uint256 expiry = block.timestamp + 10 minutes;
        bytes memory sig = _signExpiry(id, 0, delHash, 0, expiry);

        vm.warp(expiry + 1);
        vm.expectRevert(DiptosEscrow.SignatureExpired.selector);
        escrow.releaseWithExpiry(id, 0, delHash, 0, expiry, sig);
    }

    function testNonceReplayReverts() public {
        bytes32 id = keccak256("replay-escrow");
        vm.prank(payer);
        escrow.createEscrowLink{value: 1 ether}(id, payee, block.timestamp + 1 days, 5000, false, "Replay", "Test");

        bytes32 delHash = keccak256("deliverable-replay");
        uint256 expiry = block.timestamp + 1 hours;
        bytes memory sig = _signExpiry(id, 0, delHash, 0, expiry);

        escrow.releaseWithExpiry(id, 0, delHash, 0, expiry, sig);

        vm.expectRevert(DiptosEscrow.AlreadySettled.selector);
        escrow.releaseWithExpiry(id, 0, delHash, 0, expiry, sig);
    }

    function testERC1271SmartAccountOracleSettlement() public {
        MockERC1271Signer smartOracle = new MockERC1271Signer();
        escrow.setOracleSigner(address(smartOracle));

        bytes32 id = keccak256("erc1271-escrow");
        vm.prank(payer);
        escrow.createEscrowLink{value: 2 ether}(id, payee, block.timestamp + 1 days, 5000, true, "Agent", "ERC1271");

        bytes32 delHash = keccak256("agent-output-1");
        uint256 expiry = block.timestamp + 1 hours;
        bytes32 digest = escrow.computeReleaseWithExpiryDigest(id, 0, delHash, 0, expiry);
        smartOracle.approve(digest);

        escrow.releaseWithExpiry(id, 0, delHash, 0, expiry, hex"1234");
        require(escrow.totalLockedPrincipal() == 0, "locked principal should be 0");
    }

    function testCommitRevealBlocksFrontRunning() public {
        bytes32 id = keccak256("commit-reveal-escrow");
        bytes32 delHash = keccak256("secret-pr-diff");
        bytes32 salt = keccak256("random-salt-99");
        bytes32 commitment = keccak256(abi.encode(id, payee, delHash, salt));

        vm.prank(payee);
        registry.commitDeliverable(id, commitment);

        // Attacker attempts to front-run reveal
        vm.prank(attacker);
        vm.expectRevert(DiptosRegistry.InvalidReveal.selector);
        registry.revealDeliverable(id, delHash, salt);

        // Legitimate payee reveals
        vm.prank(payee);
        registry.revealDeliverable(id, delHash, salt);
        require(registry.revealedDeliverables(delHash), "deliverable not marked revealed");

        // Double-reveal blocked
        vm.prank(payee);
        vm.expectRevert(DiptosRegistry.DeliverableAlreadyRevealed.selector);
        registry.revealDeliverable(id, delHash, salt);
    }

    function testPermissionlessTimeoutRefundAfterGracePeriod() public {
        bytes32 id = keccak256("timeout-escrow");
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(payer);
        escrow.createEscrowLink{value: 3 ether}(id, payee, deadline, 5000, false, "Timeout", "Scope");

        // Unauthorized caller cannot refund
        vm.prank(attacker);
        vm.expectRevert(DiptosEscrow.Unauthorized.selector);
        escrow.claimTimeoutRefund(id);

        // Before grace period reverts
        vm.warp(deadline + 1 hours);
        vm.prank(payer);
        vm.expectRevert(DiptosEscrow.TimeoutNotReached.selector);
        escrow.claimTimeoutRefund(id);

        // After deadline + 24h grace period, payer recovers 100% permissionlessly
        uint256 beforeBal = payer.balance;
        vm.warp(deadline + 24 hours + 1);
        vm.prank(payer);
        escrow.claimTimeoutRefund(id);
        require(payer.balance - beforeBal == 3 ether, "refund mismatch");
        require(escrow.totalLockedPrincipal() == 0, "locked principal not cleared");
    }

    /// @notice Zero-dust invariant across arbitrary principals, 6-dec (Base) & 18-dec (Arc), delays, and λ.
    function testFuzzZeroDustAccounting(
        uint256 rawAmount,
        bool useSixDecimals,
        uint256 delaySeconds,
        uint256 windowSeconds,
        uint256 lambdaBps
    ) public view {
        uint8 decimals = useSixDecimals ? 6 : 18;
        uint256 amount = useSixDecimals
            ? _bound(rawAmount, 1, 1_000_000_000e6)
            : _bound(rawAmount, 1, 1_000_000_000 ether);
        uint256 delay = _bound(delaySeconds, 0, 365 days);
        uint256 window = _bound(windowSeconds, 1 hours, 90 days);
        uint256 lambda = _bound(lambdaBps, 0, 50_000);

        (uint256 payeeAmt, uint256 buyerRebate, uint256 protocolFee, uint256 decayBps) =
            escrow.calculateTECDForDecimals(amount, decimals, delay, window, lambda);

        require(payeeAmt + buyerRebate + protocolFee == amount, "Zero-dust accounting violated");
        require(decayBps <= 10_000, "decayBps must be <= 10000");
        require(protocolFee <= (amount * escrow.MAX_PROTOCOL_FEE_BPS()) / 10_000 + 1, "fee cap exceeded");
        if (delay == 0 || lambda == 0) {
            require(buyerRebate == 0, "on-time settlement must have 0 rebate");
        }
    }

    /// @notice Verifies Phase 2 modular TEE verifier hook + DiptosVerified event emission.
    function testPluggableTEEVerifierEmitsDiptosVerified() public {
        MockTEEVerifier tee = new MockTEEVerifier();
        escrow.setCustomVerifier(address(tee));

        bytes32 id = keccak256("tee-verified-escrow");
        bytes32 proofHash = keccak256("sha256-artifact-proof");
        tee.setExpectedProof(proofHash);

        vm.prank(payer);
        escrow.createEscrowLink{value: 2 ether}(id, payee, block.timestamp + 1 days, 4000, true, "TEE", "PCR-Pinned");

        vm.expectEmit(true, true, true, true);
        emit DiptosEscrow.DiptosVerified(id, proofHash, address(tee), block.timestamp);
        escrow.releaseWithExpiry(id, 0, proofHash, 0, block.timestamp + 1 hours, bytes("tee-pcr-attestation"));

        require(escrow.totalLockedPrincipal() == 0, "locked principal must be 0");
        require(address(escrow).balance >= escrow.totalLockedPrincipal(), "solvency invariant broken");
    }

    /// @notice Verifies unauthorized callers cannot invoke admin, registry, or party-only functions.
    function testUnauthorizedCallsRevert() public {
        bytes32 id = keccak256("unauth-escrow");
        vm.prank(payer);
        escrow.createEscrowLink{value: 1 ether}(id, payee, block.timestamp + 1 days, 3000, false, "Auth", "Guard");

        vm.prank(attacker);
        vm.expectRevert(DiptosEscrow.Unauthorized.selector);
        escrow.setOracleSigner(attacker);

        vm.prank(attacker);
        vm.expectRevert(DiptosEscrow.Unauthorized.selector);
        escrow.setCustomVerifier(attacker);

        vm.prank(attacker);
        vm.expectRevert(DiptosEscrow.Unauthorized.selector);
        escrow.releaseByPayer(id);

        vm.prank(attacker);
        vm.expectRevert(DiptosEscrow.Unauthorized.selector);
        escrow.mutualCancel(id);

        vm.prank(attacker);
        vm.expectRevert(DiptosRegistry.Unauthorized.selector);
        registry.recordCommitment(keccak256("forged"), payer, payee, 1 ether, block.timestamp + 1 days);
    }

    /// @notice Verifies claimTimeout() alias works identically to claimTimeoutRefund() and maintains solvency.
    function testClaimTimeoutAliasPermissionless() public {
        bytes32 id = keccak256("claim-timeout-alias");
        uint256 deadline = block.timestamp + 6 hours;
        vm.prank(payer);
        escrow.createEscrowLink{value: 1.5 ether}(id, payee, deadline, 2500, false, "Alias", "Safety hatch");

        uint256 balBefore = payer.balance;
        vm.warp(deadline + 24 hours + 1);
        vm.prank(payer);
        escrow.claimTimeout(id);

        require(payer.balance - balBefore == 1.5 ether, "full refund mismatch");
        require(escrow.totalLockedPrincipal() == 0, "locked principal must be 0");
        require(address(escrow).balance >= escrow.totalLockedPrincipal(), "solvency invariant broken");
    }

    /// @notice End-to-end on-chain fuzz proving exact native USDC conservation & solvency invariant.
    function testFuzzOnChainSettlementConservationAndSolvency(
        uint256 rawAmount,
        uint256 rawDelay,
        uint256 rawLambda
    ) public {
        uint256 amount = _bound(rawAmount, 1e12, 100 ether);
        uint256 delay = _bound(rawDelay, 0, 14 days);
        uint256 lambda = _bound(rawLambda, 0, 50_000);

        bytes32 id = keccak256(abi.encode("fuzz-settle", amount, delay, lambda));
        uint256 deadline = block.timestamp + 24 hours;

        vm.prank(payer);
        escrow.createEscrowLink{value: amount}(id, payee, deadline, lambda, false, "Fuzz", "Zero-dust");
        require(address(escrow).balance >= escrow.totalLockedPrincipal(), "solvency broken after create");

        vm.warp(deadline + delay);
        uint256 payerBefore = payer.balance;
        uint256 payeeBefore = payee.balance;
        uint256 treasuryBefore = treasury.balance;

        vm.prank(payer);
        escrow.releaseByPayer(id);

        uint256 distributed = (payer.balance - payerBefore) + (payee.balance - payeeBefore) + (treasury.balance - treasuryBefore);
        require(distributed == amount, "on-chain conservation violated (wei dust leaked)");
        require(escrow.totalLockedPrincipal() == 0, "locked principal not zeroed");
        require(address(escrow).balance >= escrow.totalLockedPrincipal(), "solvency broken after settle");
    }
}
