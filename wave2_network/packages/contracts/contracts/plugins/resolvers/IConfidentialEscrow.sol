// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// Minimal interface for Reineira ConfidentialEscrow at 0xbe1eEB78504B71beEE1b33D3E3D367A2F9a549A6
interface IConfidentialEscrow {
    function redeem(uint256 escrowId) external;
    function create(uint256 encOwner, uint256 encAmount, address resolver, bytes calldata resolverData) external returns (uint256);
    function fund(uint256 escrowId, uint256 amount) external;
    function hasBudget(uint256 escrowId, address claimant, uint256 amount) external view returns (bool);
    event EscrowCreated(uint256 indexed escrowId);
    event EscrowFunded(uint256 indexed escrowId, address indexed payer);
    event EscrowRedeemed(uint256 indexed escrowId);
}
