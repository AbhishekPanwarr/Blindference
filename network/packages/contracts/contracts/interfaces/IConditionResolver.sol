// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IConditionResolver
/// @notice Pluggable verification for Reineira escrow conditions.
interface IConditionResolver {
    /// @notice Check if the release condition is met for an escrow.
    function isConditionMet(uint256 escrowId) external view returns (bool);

    /// @notice Hook called when a resolver is attached to an escrow.
    function onConditionSet(uint256 escrowId, bytes calldata data) external;
}
