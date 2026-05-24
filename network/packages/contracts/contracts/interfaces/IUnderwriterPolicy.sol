// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IUnderwriterPolicy
/// @notice Interface for insurance policy adapters in the Blindference protocol.
/// @dev Mock version for testnet - uses plain uint64/bool instead of FHE encrypted types.
interface IUnderwriterPolicy {
    /// @notice Called when a policy is assigned to a coverage instance.
    /// @param coverageId The coverage instance ID.
    /// @param data ABI-encoded policy data (jobPrice, jobId, resolver).
    function onPolicySet(uint256 coverageId, bytes calldata data) external;

    /// @notice Evaluate risk for an escrow and return a premium score.
    /// @param escrowId The escrow ID being evaluated.
    /// @param riskProof ABI-encoded risk proof (job price).
    /// @return riskScore Risk score in basis points (e.g., 200 = 2%).
    function evaluateRisk(uint256 escrowId, bytes calldata riskProof) external returns (uint64 riskScore);

    /// @notice Judge a dispute and return whether it should be upheld.
    /// @param coverageId The coverage instance ID.
    /// @param disputeProof ABI-encoded dispute proof (jobId, evidenceHash).
    /// @return valid True if dispute is valid.
    function judge(uint256 coverageId, bytes calldata disputeProof) external returns (bool valid);
}
