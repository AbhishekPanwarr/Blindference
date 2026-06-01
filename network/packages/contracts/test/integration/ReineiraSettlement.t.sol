// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {CoFheTest} from "@fhenixprotocol/cofhe-mock-contracts/CoFheTest.sol";
import {PayoutClaimer} from "../../contracts/plugins/resolvers/PayoutClaimer.sol";
import {InferenceGate} from "../../contracts/plugins/resolvers/InferenceGate.sol";
import {ResultRegistry} from "../../contracts/plugins/resolvers/ResultRegistry.sol";
import {IConfidentialEscrow} from "../../contracts/plugins/resolvers/IConfidentialEscrow.sol";

/// @title MockEscrow
/// @notice Lightweight mock of Reineira's ConfidentialEscrow.
contract MockEscrow is IConfidentialEscrow {
    address public resolverAddress;
    bytes public resolverData;
    address public ownerAddr;
    bool public wasRedeemed;

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
    }

    function fund(uint256 /*escrowId*/, uint256 /*amount*/) external {}

    function hasBudget(uint256 /*escrowId*/, address /*claimant*/, uint256 /*amount*/)
        external pure returns (bool)
    {
        return true;
    }
}

/// @title ReineiraSettlementTest
/// @notice Integration test for the simplified PayoutClaimer.
contract ReineiraSettlementTest is Test, CoFheTest {
    PayoutClaimer public claimer;
    InferenceGate public gate;
    ResultRegistry public registry;
    MockEscrow public escrow;

    address public iclService = address(0x7F9B);
    address public leader = address(0xAA01);
    address public verifier1 = address(0xAA02);
    address public verifier2 = address(0xAA03);
    bytes32 public constant JOB_ID = bytes32(uint256(1));

    function setUp() public {
        registry = new ResultRegistry(iclService, address(0));
        gate = new InferenceGate(address(registry));
        escrow = new MockEscrow();

        vm.startPrank(iclService);
        claimer = new PayoutClaimer(
            address(escrow),
            address(registry),
            address(this)
        );
        vm.stopPrank();
    }

    uint256 escrowId;

    function _createAndFundEscrow() internal {
        escrowId = escrow.create(0, 0, address(gate), abi.encode(JOB_ID));
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

    function test_gateReturnsFalseBeforeVerification() public {
        escrowId = escrow.create(0, 0, address(gate), abi.encode(JOB_ID));
        assertFalse(gate.isConditionMet(escrowId));
    }

    function test_gateReturnsTrueAfterVerification() public {
        _createAndFundEscrow();
        _commitResult();
        assertTrue(gate.isConditionMet(escrowId));
    }

    function test_unverifiedJobCannotClaim() public {
        _createAndFundEscrow();
        vm.expectRevert("PayoutClaimer: job not verified");
        claimer.claim(escrowId, JOB_ID);
    }

    function test_claimEmitsEvent() public {
        _createAndFundEscrow();
        _commitResult();

        vm.expectEmit(true, true, false, true);
        emit PayoutClaimer.Claimed(escrowId, JOB_ID, leader);

        claimer.claim(escrowId, JOB_ID);
    }

    function test_claimSetsEscrowToJobMapping() public {
        _createAndFundEscrow();
        _commitResult();

        // Clear the mapping set by onConditionSet to test backward compat
        vm.store(address(claimer), keccak256(abi.encode(escrowId, 0)), bytes32(0));
        
        claimer.claim(escrowId, JOB_ID);
        assertEq(claimer.escrowToJob(escrowId), JOB_ID);
    }

    function test_nonOwnerCannotCallOwnerFunctions() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert();
        claimer.transferOwnership(address(0xBEEF));
    }
}
