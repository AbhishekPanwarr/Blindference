// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {PayoutClaimer} from "../../contracts/plugins/resolvers/PayoutClaimer.sol";
import {InferenceGate} from "../../contracts/plugins/resolvers/InferenceGate.sol";
import {ResultRegistry} from "../../contracts/plugins/resolvers/ResultRegistry.sol";
import {IConfidentialEscrow} from "../../contracts/plugins/resolvers/IConfidentialEscrow.sol";

/// @title MockEscrow
/// @notice Lightweight mock of Reineira's ConfidentialEscrow for integration tests.
contract MockEscrow {
    address public resolverAddress;
    bytes public resolverData;
    address public ownerAddr;
    bool public wasRedeemed;
    MockERC20 public token;

    function setToken(address _token) external { token = MockERC20(_token); }
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

        // Register the escrow → job mapping in the resolver
        InferenceGate(resolver).onConditionSet(id, data);

        return id;
    }

    function redeem(uint256 escrowId) external {
        require(!wasRedeemed, "Already redeemed");
        bool ok = InferenceGate(resolverAddress).isConditionMet(escrowId);
        require(ok, "Condition not met");
        wasRedeemed = true;
        if (address(token) != address(0)) {
            uint256 bal = token.balanceOf(address(this));
            if (bal > 0) token.transfer(msg.sender, bal);
        }
    }
}

contract MockERC20 {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @title ReineiraSettlementTest
/// @notice Integration test for the full Reineira settlement flow.
contract ReineiraSettlementTest is Test {
    PayoutClaimer public claimer;
    InferenceGate public gate;
    ResultRegistry public registry;
    MockEscrow public escrow;
    MockERC20 public cUSDC;

    address public iclService = address(0x7F9B);
    address public leader = address(0xAA01);
    address public verifier1 = address(0xAA02);
    address public verifier2 = address(0xAA03);
    bytes32 public constant JOB_ID = bytes32(uint256(1));
    function setUp() public {
        cUSDC = new MockERC20();
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
    }

    /// @notice Tests the full flow: escrow → gate → registry → claim
    function test_fullSettlementFlow() public {
        uint256 payout = 1000e6; // 1000 USDC
        _createAndFundEscrow(payout);

        // ICL marks job as verified in ResultRegistry
        address[] memory verifiers = new address[](2);
        verifiers[0] = verifier1;
        verifiers[1] = verifier2;

        vm.prank(iclService);
        registry.commitResult(
            JOB_ID,
            bytes32(uint256(0xDEF)),
            leader,
            verifiers,
            2,  // confirmCount
            0,  // rejectCount
            95, // confidence
            bytes32(0)
        );

        // 4. Verify InferenceGate returns true
        assertTrue(gate.isConditionMet(escrowId), "Gate should report condition met");

        // 5. Claim payout
        claimer.claim(escrowId, JOB_ID);

        // 6. Verify leader received payout
        uint256 leaderBalance = cUSDC.balanceOf(leader);
        assertTrue(leaderBalance > 0, "Leader should receive payout");
        // Leader gets 60% of 1000 USDC
        assertEq(leaderBalance, (payout * 6000) / 10000);
    }

    /// @notice Test claiming twice reverts
    function test_doubleClaimReverts() public {
        _createAndFundEscrow(1000e6);

        address[] memory verifiers = new address[](2);
        verifiers[0] = verifier1;
        verifiers[1] = verifier2;

        vm.prank(iclService);
        registry.commitResult(JOB_ID, bytes32(0), leader, verifiers, 2, 0, 95, bytes32(0));

        claimer.claim(escrowId, JOB_ID);

        vm.expectRevert("Already claimed");
        claimer.claim(escrowId, JOB_ID);
    }

    /// @notice Test that isConditionMet returns false before verification
    function test_gateReturnsFalseBeforeVerification() public {
        escrowId = escrow.create(0, 0, address(gate), abi.encode(JOB_ID));
        assertFalse(gate.isConditionMet(escrowId), "Gate should block before verification");
    }

    /// @notice Test setSplit updates payout correctly
    function test_splitUpdate() public {
        _createAndFundEscrow(1000e6);

        address[] memory verifiers = new address[](2);
        verifiers[0] = verifier1;
        verifiers[1] = verifier2;

        vm.prank(iclService);
        registry.commitResult(JOB_ID, bytes32(0), leader, verifiers, 2, 0, 95, bytes32(0));

        // Change split to 70% leader, 15% per verifier
        claimer.setSplit(7000, 1500);

        claimer.claim(escrowId, JOB_ID);
        assertEq(cUSDC.balanceOf(leader), (1000e6 * 7000) / 10000);
    }
}
