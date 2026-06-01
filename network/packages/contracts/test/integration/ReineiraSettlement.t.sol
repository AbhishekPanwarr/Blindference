// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {CoFheTest} from "@fhenixprotocol/cofhe-mock-contracts/CoFheTest.sol";
import {PayoutClaimer} from "../../contracts/plugins/resolvers/PayoutClaimer.sol";
import {InferenceGate} from "../../contracts/plugins/resolvers/InferenceGate.sol";
import {ResultRegistry} from "../../contracts/plugins/resolvers/ResultRegistry.sol";
import {IConfidentialEscrow} from "../../contracts/plugins/resolvers/IConfidentialEscrow.sol";
import {MockConfidentialERC20} from "../../contracts/mocks/MockConfidentialERC20.sol";

/// @title MockEscrow
/// @notice Lightweight mock of Reineira's ConfidentialEscrow.
contract MockEscrow is IConfidentialEscrow {
    address public resolverAddress;
    bytes public resolverData;
    address public ownerAddr;
    bool public wasRedeemed;
    MockConfidentialERC20 public token;

    function setToken(address _token) external { token = MockConfidentialERC20(_token); }
    uint256 public nextEscrowId = 1;

    function create(
        uint256 /*encOwner*/,
        uint256 /*encAmount*/,
        address resolver,
        bytes calldata data
    ) external returns (uint256) {
        resolverAddress = resolver;
        resolverData = data;
        ownerAddr = msg.sender;
        uint256 id = nextEscrowId++;
        InferenceGate(resolver).onConditionSet(id, data);
        return id;
    }

    function redeem(uint256 /*escrowId*/) external {
        require(!wasRedeemed, "Already redeemed");
        wasRedeemed = true;
        if (address(token) != address(0)) {
            uint256 bal = token.balanceOf(address(this));
            if (bal > 0) token.transfer(msg.sender, bal);
        }
    }

    function fund(uint256 /*escrowId*/, uint256 amount) external {
        token.mint(address(this), amount);
    }

    function hasBudget(uint256 /*escrowId*/, address /*claimant*/, uint256 /*amount*/)
        external pure returns (bool)
    {
        return true;
    }
}

/// @title ReineiraSettlementTest
/// @notice Integration test for the Reineira settlement flow.
///
/// @dev   NOTE: The cofhe-mock-contracts test environment has a known limitation
///        where trivially-encrypted FHE handles do not bypass ACL correctly
///        across contract boundaries (see TODO in MockTaskManager). This means
///        the full FHE distribution math (FHE.div / FHE.add / confidentialTransfer)
///        cannot be verified in Foundry unit tests.
///
///        Tests here cover:
///          1. Contract compiles and all non-FHE paths work
///          2. Condition checking, Gate logic, ResultRegistry wiring
///          3. Access-control reverts (unverified job, owner checks)
///          4. Split configuration validation
///        The actual 60/20/20 FHE distribution is verified on testnet.
contract ReineiraSettlementTest is Test, CoFheTest {
    PayoutClaimer public claimer;
    InferenceGate public gate;
    ResultRegistry public registry;
    MockEscrow public escrow;
    MockConfidentialERC20 public cUSDC;

    address public iclService = address(0x7F9B);
    address public leader = address(0xAA01);
    address public verifier1 = address(0xAA02);
    address public verifier2 = address(0xAA03);
    bytes32 public constant JOB_ID = bytes32(uint256(1));

    function setUp() public {
        cUSDC = new MockConfidentialERC20();
        registry = new ResultRegistry(iclService, address(0));
        gate = new InferenceGate(address(registry));
        escrow = new MockEscrow();
        escrow.setToken(address(cUSDC));

        vm.startPrank(iclService);
        claimer = new PayoutClaimer(
            address(escrow),
            address(cUSDC),
            address(registry),
            address(this)
        );
        vm.stopPrank();
    }

    uint256 escrowId;

    function _createAndFundEscrow(uint256 payout) internal {
        escrowId = escrow.create(0, 0, address(gate), abi.encode(JOB_ID));
        cUSDC.mint(address(escrow), payout);
        // Manually wire the escrow → job mapping in PayoutClaimer
        // (In production Reineira calls this via the resolver hook during escrow creation)
        claimer.onConditionSet(escrowId, abi.encode(JOB_ID));
    }

    function _commitResult() internal {
        address[] memory verifiers = new address[](2);
        verifiers[0] = verifier1;
        verifiers[1] = verifier2;

        vm.prank(iclService);
        registry.commitResult(
            JOB_ID,
            bytes32(uint256(0xDEF)),
            leader,
            verifiers,
            2, 0, 95, bytes32(0)
        );
    }

    // ------------------------------------------------------------------
    // Gate / condition tests
    // ------------------------------------------------------------------

    function test_gateReturnsFalseBeforeVerification() public {
        escrowId = escrow.create(0, 0, address(gate), abi.encode(JOB_ID));
        assertFalse(gate.isConditionMet(escrowId));
    }

    function test_gateReturnsTrueAfterVerification() public {
        _createAndFundEscrow(1000e6);
        _commitResult();
        assertTrue(gate.isConditionMet(escrowId));
    }

    // ------------------------------------------------------------------
    // PayoutClaimer access-control (reverts before FHE ops)
    // ------------------------------------------------------------------

    function test_unverifiedJobCannotClaim() public {
        _createAndFundEscrow(1000e6);
        vm.expectRevert("PayoutClaimer: job not verified");
        claimer.claim(escrowId, JOB_ID);
    }

    function test_claimMappingStoredFromOnConditionSet() public {
        _createAndFundEscrow(1000e6);
        assertEq(claimer.escrowToJob(escrowId), JOB_ID);
    }

    // ------------------------------------------------------------------
    // Admin / configuration
    // ------------------------------------------------------------------

    function test_setSplitUpdatesBps() public {
        claimer.setSplit(7000, 1500);
        assertEq(claimer.leaderShareBps(), 7000);
        assertEq(claimer.verifierShareBps(), 1500);
    }

    function test_setSplitEnforcesTotal10000() public {
        vm.expectRevert("Splits must total 10000 bps");
        claimer.setSplit(5000, 2000);
    }

    function test_nonOwnerCannotSetSplit() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert();
        claimer.setSplit(7000, 1500);
    }

    function test_recoverTokenRevertsForCUSDC() public {
        vm.expectRevert("Cannot recover cUSDC");
        claimer.recoverToken(address(cUSDC), address(this));
    }

    // ------------------------------------------------------------------
    // Full FHE distribution — verified on testnet, not in Foundry mock
    // ------------------------------------------------------------------

    /// @dev  Foundry mock ACL limitation prevents cross-contract FHE math.
    ///       Deploy to Arbitrum Sepolia and run testnet integration script
    ///       to verify 60/20/20 confidentialTransfer distribution.
}
