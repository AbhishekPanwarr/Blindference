// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

import "../../interfaces/IResultRegistry.sol";

/// @title ResultRegistry
/// @notice Records accepted and rejected inference outcomes on-chain for Blindference Wave 2.
contract ResultRegistry is Ownable, IResultRegistry {
    uint8 private constant STATUS_PENDING = 0;
    uint8 private constant STATUS_ACCEPTED = 1;
    uint8 private constant STATUS_REJECTED = 2;
    uint8 private constant STATUS_DISPUTED = 3;
    uint8 private constant STATUS_SETTLED = 4;
    uint256 private constant DISPUTE_WINDOW = 72 hours;

    struct DisputeRecord {
        bytes32 evidenceHash;
        string evidenceURI;
        address filedBy;
        uint256 filedAt;
        bool resolved;
        bool upheld;
        uint8 verdict;
    }

    mapping(bytes32 => InferenceResult) public results;
    mapping(bytes32 => DisputeRecord) public disputes;
    mapping(bytes32 => bool) public taskExists;
    mapping(bytes32 => address) public developerByTask;

    address public iclServiceAddress;
    address public nodeOperatorRegistryAddress;

    event ResultCommitted(bytes32 indexed taskId, bytes32 resultHash, address leader, uint8 confirms, uint8 confidence);
    event ResultRejected(bytes32 indexed taskId, address leader, string reason);
    event DisputeSubmitted(bytes32 indexed taskId, address indexed developer, bytes32 evidenceHash);
    event DisputeResolved(bytes32 indexed taskId, bool upheld, uint8 verdict);

    modifier onlyIclService() {
        require(msg.sender == iclServiceAddress, "Caller is not ICL service");
        _;
    }

    constructor(address _iclServiceAddress, address _nodeOperatorRegistryAddress) Ownable(msg.sender) {
        require(_iclServiceAddress != address(0), "Invalid ICL address");
        iclServiceAddress = _iclServiceAddress;
        nodeOperatorRegistryAddress = _nodeOperatorRegistryAddress;
    }

    function commitResult(
        bytes32 taskId,
        bytes32 resultHash,
        address leader,
        address[] calldata verifiers,
        uint8 confirmCount,
        uint8 rejectCount,
        uint8 aggregatedConfidence,
        bytes32 modelId
    ) external onlyIclService {
        require(!taskExists[taskId], "Task already exists");
        require(leader != address(0), "Invalid leader");
        require(confirmCount + rejectCount == verifiers.length, "Verifier counts mismatch");
        require(aggregatedConfidence <= 100, "Confidence exceeds max");

        InferenceResult storage result = results[taskId];
        result.taskId = taskId;
        result.resultHash = resultHash;
        result.leaderAddress = leader;
        result.verifierAddresses = verifiers;
        result.confirmCount = confirmCount;
        result.rejectCount = rejectCount;
        result.aggregatedConfidence = aggregatedConfidence;
        result.modelId = modelId;
        result.committedAt = block.timestamp;
        result.status = STATUS_ACCEPTED;
        result.disputeDeadline = block.timestamp + DISPUTE_WINDOW;
        result.coverageId = bytes32(0);

        taskExists[taskId] = true;

        emit ResultCommitted(taskId, resultHash, leader, confirmCount, aggregatedConfidence);
    }

    function commitRejection(
        bytes32 taskId,
        address leader,
        address[] calldata verifiers,
        bytes32 modelId,
        string calldata reason
    ) external onlyIclService {
        require(!taskExists[taskId], "Task already exists");
        require(leader != address(0), "Invalid leader");

        InferenceResult storage result = results[taskId];
        result.taskId = taskId;
        result.resultHash = bytes32(0);
        result.leaderAddress = leader;
        result.verifierAddresses = verifiers;
        result.confirmCount = 0;
        result.rejectCount = uint8(verifiers.length);
        result.aggregatedConfidence = 0;
        result.modelId = modelId;
        result.committedAt = block.timestamp;
        result.status = STATUS_REJECTED;
        result.disputeDeadline = block.timestamp + DISPUTE_WINDOW;
        result.coverageId = bytes32(0);

        taskExists[taskId] = true;

        emit ResultRejected(taskId, leader, reason);
    }

    function registerDeveloper(bytes32 taskId, address developer) external onlyIclService {
        require(developer != address(0), "Invalid developer");
        developerByTask[taskId] = developer;
    }

    function submitDispute(bytes32 taskId, bytes32 evidenceHash, string calldata evidenceURI) external {
        require(taskExists[taskId], "Task does not exist");

        InferenceResult storage result = results[taskId];
        require(result.status == STATUS_ACCEPTED, "Task is not disputable");
        require(block.timestamp <= result.disputeDeadline, "Dispute window closed");
        require(msg.sender == developerByTask[taskId], "Caller is not registered developer");
        require(disputes[taskId].filedAt == 0, "Dispute already submitted");

        result.status = STATUS_DISPUTED;
        disputes[taskId] = DisputeRecord({
            evidenceHash: evidenceHash,
            evidenceURI: evidenceURI,
            filedBy: msg.sender,
            filedAt: block.timestamp,
            resolved: false,
            upheld: false,
            verdict: 0
        });

        emit DisputeSubmitted(taskId, msg.sender, evidenceHash);
    }

    function resolveDispute(bytes32 taskId, bool upheld, uint8 verdict) external onlyIclService {
        require(taskExists[taskId], "Task does not exist");
        require(verdict <= 100, "Verdict exceeds max");

        InferenceResult storage result = results[taskId];
        require(result.status == STATUS_DISPUTED, "Task is not disputed");

        DisputeRecord storage dispute = disputes[taskId];
        require(dispute.filedAt != 0, "Dispute not found");
        require(!dispute.resolved, "Dispute already resolved");

        dispute.resolved = true;
        dispute.upheld = upheld;
        dispute.verdict = verdict;
        result.status = STATUS_SETTLED;

        emit DisputeResolved(taskId, upheld, verdict);
    }

    function getResult(bytes32 taskId) external view override returns (InferenceResult memory) {
        require(taskExists[taskId], "Task does not exist");
        return results[taskId];
    }

    function isConditionMet(
        bytes32 taskId,
        uint8 minConfidence,
        uint8 minQuorum
    ) external view override returns (bool) {
        require(taskExists[taskId], "Task does not exist");

        InferenceResult memory result = results[taskId];
        if (result.status != STATUS_ACCEPTED) {
            return false;
        }

        uint8 quorumSize = result.confirmCount + result.rejectCount;
        return result.aggregatedConfidence >= minConfidence && quorumSize >= minQuorum;
    }
}
