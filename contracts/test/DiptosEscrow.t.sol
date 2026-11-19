// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DiptosEscrow} from "../src/DiptosEscrow.sol";
import {DiptosRegistry, IDiptosRegistry} from "../src/DiptosRegistry.sol";

interface Vm {
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function deal(address, uint256) external;
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract DiptosEscrowTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    DiptosRegistry internal registry;
    DiptosEscrow internal escrow;

    uint256 internal oracleKey = 0xA11CE;
    uint256 internal rogueKey = 0xBAD01;
    address internal oracleSigner;
    address internal treasury = address(0xBEEF);
    address internal payer = address(0x1111);
    address internal payee = address(0x2222);

    function setUp() public {
        oracleSigner = vm.addr(oracleKey);
        registry = new DiptosRegistry(address(this));
        escrow = new DiptosEscrow(oracleSigner, treasury, address(registry));
        registry.setEscrowContract(address(escrow));
        vm.deal(payer, 10_000 ether);
    }

    function _signEIP712(
        uint256 signingKey,
        bytes32 escrowId,
        uint256 milestoneIndex,
        bytes32 deliverableHash,
        uint256 nonce
    ) internal returns (bytes memory) {
        bytes32 digest = escrow.computeReleaseDigest(escrowId, milestoneIndex, deliverableHash, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signingKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_SingleShotOnTimeRelease() public {
        bytes32 id = keccak256("escrow-ontime");
        uint256 deadline = block.timestamp + 24 hours;

        vm.prank(payer);
        escrow.createEscrowLink{value: 10 ether}(id, payee, deadline, 3500, false);

        bytes32 delHash = keccak256("github:pr#42");
        bytes memory sig = _signEIP712(oracleKey, id, 0, delHash, 0);
        escrow.releaseWithOracle(id, 0, delHash, 0, sig);

        assert(payee.balance == 9.95 ether);
        assert(treasury.balance == 0.05 ether);
        assert(registry.totalSettledMilestones() == 1);
    }

    function test_MultiMilestonePartialAndFullSettlement() public {
        bytes32 id = keccak256("escrow-multi");
        uint256[] memory amounts = new uint256[](2);
        uint256[] memory deadlines = new uint256[](2);
        amounts[0] = 4 ether;
        amounts[1] = 6 ether;
        deadlines[0] = block.timestamp + 24 hours;
        deadlines[1] = block.timestamp + 72 hours;

        vm.prank(payer);
        escrow.createMultiMilestoneEscrow{value: 10 ether}(id, payee, amounts, deadlines, 3000, true);
        assert(escrow.getMilestoneCount(id) == 2);

        // Settle milestone 0 on-time (nonce 0)
        bytes32 h0 = keccak256("milestone-0");
        bytes memory sig0 = _signEIP712(oracleKey, id, 0, h0, 0);
        escrow.releaseWithOracle(id, 0, h0, 0, sig0);

        // Settle milestone 1 on-time (nonce 1)
        bytes32 h1 = keccak256("milestone-1");
        bytes memory sig1 = _signEIP712(oracleKey, id, 1, h1, 1);
        escrow.releaseWithOracle(id, 1, h1, 1, sig1);

        assert(payee.balance == 9.95 ether);
        assert(treasury.balance == 0.05 ether);
        assert(registry.totalSettledMilestones() == 2);
    }

    function test_LateReleaseTECDDecayAndConservation() public {
        bytes32 id = keccak256("escrow-late");
        uint256 deadline = block.timestamp + 24 hours;

        vm.prank(payer);
        escrow.createEscrowLink{value: 10 ether}(id, payee, deadline, 3500, true);

        vm.warp(deadline + 24 hours);
        uint256 payerBefore = payer.balance;

        bytes32 delHash = keccak256("ipfs://late-agent-output");
        bytes memory sig = _signEIP712(oracleKey, id, 0, delHash, 0);
        escrow.releaseWithOracle(id, 0, delHash, 0, sig);

        uint256 rebate = payer.balance - payerBefore;
        assert(rebate > 2.5 ether && rebate < 3.5 ether);
        assert(payee.balance > 6.5 ether && payee.balance < 7.5 ether);
        assert(payee.balance + rebate + treasury.balance == 10 ether);
    }

    function testFuzz_TECDDecayMonotonicity(uint256 delaySeconds, uint256 lambdaBps) public view {
        uint256 amount = 100 ether;
        uint256 window = 24 hours;

        // Bound to realistic protocol ranges
        uint256 d1 = delaySeconds % (14 days);
        uint256 d2 = d1 + 600; // +10 minutes later
        uint256 lam = 100 + (lambdaBps % 19_900); // 1% to 200% lambda

        (uint256 p1, uint256 r1, uint256 f1, ) = escrow.calculateTECD(amount, d1, window, lam);
        (uint256 p2, uint256 r2, uint256 f2, ) = escrow.calculateTECD(amount, d2, window, lam);

        // Conservation: zero wei dust lost or created
        assert(p1 + r1 + f1 == amount);
        assert(p2 + r2 + f2 == amount);

        // Monotonicity: larger delay => payeePayout <= previous, buyerRebate >= previous
        assert(p2 <= p1);
        assert(r2 >= r1);
    }

    function testFuzz_TECDConservationZeroDust(uint256 amount, uint256 delaySeconds, uint256 lambdaBps) public view {
        uint256 amt = 1 + (amount % (1_000_000 ether));
        uint256 delay = delaySeconds % (30 days);
        uint256 lam = lambdaBps % 50_001;

        (uint256 p, uint256 r, uint256 f, ) = escrow.calculateTECD(amt, delay, 48 hours, lam);
        assert(p + r + f == amt);
    }

    function test_RevertOnSignatureReplay() public {
        bytes32 id = keccak256("escrow-replay");
        uint256[] memory amounts = new uint256[](2);
        uint256[] memory deadlines = new uint256[](2);
        amounts[0] = 2 ether;
        amounts[1] = 2 ether;
        deadlines[0] = block.timestamp + 24 hours;
        deadlines[1] = block.timestamp + 48 hours;

        vm.prank(payer);
        escrow.createMultiMilestoneEscrow{value: 4 ether}(id, payee, amounts, deadlines, 2500, false);

        bytes32 delHash = keccak256("deliverable-0");
        bytes memory sig = _signEIP712(oracleKey, id, 0, delHash, 0);
        escrow.releaseWithOracle(id, 0, delHash, 0, sig);

        // Replaying the exact same signature / nonce 0 must revert with InvalidNonce()
        vm.expectRevert(DiptosEscrow.InvalidNonce.selector);
        escrow.releaseWithOracle(id, 0, delHash, 0, sig);
    }

    function test_RevertOnWrongOracleSigner() public {
        bytes32 id = keccak256("escrow-wrong-signer");
        vm.prank(payer);
        escrow.createEscrowLink{value: 1 ether}(id, payee, block.timestamp + 24 hours, 2500, false);

        bytes32 delHash = keccak256("forged");
        bytes memory rogueSig = _signEIP712(rogueKey, id, 0, delHash, 0);

        vm.expectRevert(DiptosEscrow.InvalidOracleSignature.selector);
        escrow.releaseWithOracle(id, 0, delHash, 0, rogueSig);
    }

    function test_RevertOnDoubleSpendEscrowId() public {
        bytes32 id = keccak256("escrow-double-spend");
        uint256 deadline = block.timestamp + 12 hours;

        vm.prank(payer);
        escrow.createEscrowLink{value: 1 ether}(id, payee, deadline, 2500, false);

        vm.prank(payer);
        vm.expectRevert(DiptosRegistry.CommitmentAlreadyExists.selector);
        escrow.createEscrowLink{value: 1 ether}(id, payee, deadline, 2500, false);
    }

    function test_PermissionlessTimeoutRefund() public {
        bytes32 id = keccak256("escrow-timeout");
        uint256 deadline = block.timestamp + 24 hours;

        vm.prank(payer);
        escrow.createEscrowLink{value: 5 ether}(id, payee, deadline, 3000, false);

        // Advance past deadline + 24h grace period
        vm.warp(deadline + 24 hours + 1);
        uint256 beforeBal = payer.balance;

        vm.prank(payer);
        escrow.claimTimeoutRefund(id);

        assert(payer.balance == beforeBal + 5 ether);
    }

    function test_RevertTimeoutRefundBeforeGracePeriod() public {
        bytes32 id = keccak256("escrow-early-timeout");
        uint256 deadline = block.timestamp + 24 hours;

        vm.prank(payer);
        escrow.createEscrowLink{value: 5 ether}(id, payee, deadline, 3000, false);

        // Only 1 hour past deadline (still inside 24h grace period)
        vm.warp(deadline + 1 hours);

        vm.prank(payer);
        vm.expectRevert(DiptosEscrow.TimeoutNotReached.selector);
        escrow.claimTimeoutRefund(id);
    }

    function test_MutualCancellationByPayee() public {
        bytes32 id = keccak256("escrow-cancel");
        vm.prank(payer);
        escrow.createEscrowLink{value: 3 ether}(id, payee, block.timestamp + 24 hours, 2500, false);

        uint256 payerBefore = payer.balance;
        vm.prank(payee);
        escrow.mutualCancel(id);

        assert(payer.balance == payerBefore + 3 ether);
    }

    function test_CounterpartyReputationTelemetryOnRegistry() public {
        bytes32 id1 = keccak256("rep-1");
        bytes32 id2 = keccak256("rep-2");
        uint256 d1 = block.timestamp + 24 hours;
        uint256 d2 = block.timestamp + 24 hours;

        vm.prank(payer);
        escrow.createEscrowLink{value: 2 ether}(id1, payee, d1, 3000, false);
        bytes memory sig1 = _signEIP712(oracleKey, id1, 0, keccak256("ok"), 0);
        escrow.releaseWithOracle(id1, 0, keccak256("ok"), 0, sig1);

        vm.prank(payer);
        escrow.createEscrowLink{value: 3 ether}(id2, payee, d2, 3000, false);
        vm.warp(d2 + 3600); // 1 hour late
        bytes memory sig2 = _signEIP712(oracleKey, id2, 0, keccak256("late"), 0);
        escrow.releaseWithOracle(id2, 0, keccak256("late"), 0, sig2);

        IDiptosRegistry.CounterpartyStats memory stats = registry.getCounterpartyStats(payee);
        assert(stats.completedOnTime == 1);
        assert(stats.completedLate == 1);
        assert(stats.totalVolumeSettled == 5 ether);
        assert(stats.averageLatencySeconds == 1800);
    }

    function test_FaucetMintAndCooldown() public {
        vm.deal(address(escrow), 1 ether);
        address judge = address(0x9999);

        vm.prank(judge);
        escrow.faucetMint();
        assert(judge.balance == 0.25 ether);

        vm.prank(judge);
        vm.expectRevert(DiptosEscrow.FaucetCooldown.selector);
        escrow.faucetMint();
    }
}
