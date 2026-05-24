// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IUnderwriterPolicy.sol";
import "../interfaces/IResultRegistry.sol";

/// @title BlindferencePolicyAdapter
/// @notice Mock insurance policy adapter for Blindference inference jobs.
/// @dev Testnet-only: uses fixed 2% premium and mock dispute resolution.
///      This version does NOT use FHE encryption for simplicity.
contract BlindferencePolicyAdapter is IUnderwriterPolicy {
    // Fixed premium: 2% = 200 basis points
    uint64 public constant PREMIUM_BPS = 200;

    // ResultRegistry for dispute validation
    IResultRegistry public resultRegistry;

    // Dispute authority address (mock: deployer key)
    address public disputeAuthority;

    // Policy data per coverage
    mapping(uint256 => PolicyData) public policies;

    struct PolicyData {
        uint256 jobPrice;
        bytes32 jobId;
        address resolver;
        uint256 createdAt;
    }

    event PolicySet(uint256 indexed coverageId, uint256 jobPrice, bytes32 jobId, address resolver);
    event RiskEvaluated(uint256 indexed escrowId, uint64 riskScore);
    event DisputeJudged(uint256 indexed coverageId, bool upheld);

    modifier onlyDisputeAuthority() {
        require(msg.sender == disputeAuthority, "Not dispute authority");
        _;
    }

    constructor(address _resultRegistry, address _disputeAuthority) {
        require(_resultRegistry != address(0), "Invalid ResultRegistry");
        require(_disputeAuthority != address(0), "Invalid dispute authority");
        resultRegistry = IResultRegistry(_resultRegistry);
        disputeAuthority = _disputeAuthority;
    }

    /// @notice Called when a policy is assigned to a coverage instance.
    function onPolicySet(uint256 coverageId, bytes calldata data) external override {
        (uint256 jobPrice, bytes32 jobId, address resolver) = abi.decode(data, (uint256, bytes32, address));
        policies[coverageId] = PolicyData({
            jobPrice: jobPrice,
            jobId: jobId,
            resolver: resolver,
            createdAt: block.timestamp
        });
        emit PolicySet(coverageId, jobPrice, jobId, resolver);
    }

    /// @notice Evaluate risk for an escrow.
    /// @dev Mock: returns fixed 2% premium (200 basis points) as plain uint64.
    function evaluateRisk(uint256 escrowId, bytes calldata /*riskProof*/) external override returns (uint64 riskScore) {
        // Mock: always return 2% premium (200 basis points)
        riskScore = PREMIUM_BPS;
        emit RiskEvaluated(escrowId, PREMIUM_BPS);
        return riskScore;
    }

    /// @notice Judge a dispute.
    /// @dev Mock: approves dispute if evidence hash is non-empty and within 72h window.
    function judge(uint256 coverageId, bytes calldata disputeProof) external override returns (bool valid) {
        PolicyData memory policy = policies[coverageId];
        require(policy.createdAt != 0, "Policy not found");
        require(block.timestamp <= policy.createdAt + 72 hours, "Dispute window expired");

        // Decode dispute proof: (bytes32 jobId, bytes32 evidenceHash)
        (bytes32 jobId, bytes32 evidenceHash) = abi.decode(disputeProof, (bytes32, bytes32));
        require(jobId == policy.jobId, "Job ID mismatch");
        require(evidenceHash != bytes32(0), "Empty evidence");

        // Mock: always approve if non-empty evidence and within window
        valid = true;
        emit DisputeJudged(coverageId, true);
        return valid;
    }

    /// @notice Update dispute authority.
    function setDisputeAuthority(address newAuthority) external onlyDisputeAuthority {
        require(newAuthority != address(0), "Invalid address");
        disputeAuthority = newAuthority;
    }

    /// @notice Update ResultRegistry.
    function setResultRegistry(address newRegistry) external onlyDisputeAuthority {
        require(newRegistry != address(0), "Invalid address");
        resultRegistry = IResultRegistry(newRegistry);
    }

    /// @notice Check if a job is disputable (within 72h window).
    function isDisputable(uint256 coverageId) external view returns (bool) {
        PolicyData memory policy = policies[coverageId];
        if (policy.createdAt == 0) return false;
        return block.timestamp <= policy.createdAt + 72 hours;
    }
}
