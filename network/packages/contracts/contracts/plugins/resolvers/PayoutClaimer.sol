// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IConfidentialEscrow} from "./IConfidentialEscrow.sol";
import {IResultRegistry} from "../../interfaces/IResultRegistry.sol";
import {IConditionResolver} from "../../interfaces/IConditionResolver.sol";

/// @title PayoutClaimer
/// @notice Acts as the escrow beneficiary and Reineira Gate — claims settled funds
///         to this contract. Emits a Claimed event so the off-chain Payment Service
///         can forward the cUSDC to the actual quorum leader.
///
///         Simplified: no on-chain FHE math. After escrow.redeem(), cUSDC is held
///         here. The Payment Service decrypts the balance and forwards it.
///
///         Implements IConditionResolver so Reineira can use this contract as a Gate.
contract PayoutClaimer is Ownable, IConditionResolver {
    IConfidentialEscrow public immutable escrow;
    IResultRegistry     public immutable resultRegistry;

    mapping(uint256 => bytes32) public escrowToJob;

    /// @notice Emitted after a successful claim. Off-chain service forwards cUSDC
    ///         to the actual leader address from the result registry.
    event Claimed(
        uint256 indexed escrowId,
        bytes32 indexed jobId,
        address leaderAddress
    );

    constructor(
        address _escrow,
        address _resultRegistry,
        address _owner
    ) Ownable(_owner) {
        require(_escrow != address(0), "Invalid escrow");
        require(_resultRegistry != address(0), "Invalid ResultRegistry");
        escrow = IConfidentialEscrow(_escrow);
        resultRegistry = IResultRegistry(_resultRegistry);
    }

    // ------------------------------------------------------------------
    // IConditionResolver implementation
    // ------------------------------------------------------------------

    function onConditionSet(uint256 escrowId, bytes calldata data) external {
        require(data.length == 32, "PayoutClaimer: invalid jobId length");
        bytes32 jobId;
        assembly {
            jobId := calldataload(data.offset)
        }
        require(jobId != bytes32(0), "PayoutClaimer: jobId required");
        escrowToJob[escrowId] = jobId;
    }

    function isConditionMet(uint256 escrowId) external view returns (bool) {
        bytes32 jobId = escrowToJob[escrowId];
        if (jobId == bytes32(0)) return false;
        return resultRegistry.isConditionMet(jobId, 70, 2);
    }

    // ------------------------------------------------------------------
    // Claim — simplified: just redeem, emit event
    // ------------------------------------------------------------------

    function claim(uint256 escrowId, bytes32 jobId) external {
        require(escrowId > 0, "Invalid escrowId");
        require(jobId != bytes32(0), "Invalid jobId");

        bytes32 storedJobId = escrowToJob[escrowId];
        if (storedJobId == bytes32(0)) {
            escrowToJob[escrowId] = jobId;
        } else {
            require(storedJobId == jobId, "PayoutClaimer: jobId mismatch");
        }

        require(
            resultRegistry.isConditionMet(jobId, 70, 2),
            "PayoutClaimer: job not verified"
        );

        // Release cUSDC from escrow to this contract
        escrow.redeem(escrowId);

        // Read the quorum result to get the leader address
        IResultRegistry.InferenceResult memory result = resultRegistry.getResult(jobId);
        require(result.leaderAddress != address(0), "PayoutClaimer: no leader");

        emit Claimed(escrowId, jobId, result.leaderAddress);
    }
}
