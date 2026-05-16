// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IResultRegistry {
    struct InferenceResult {
        bytes32 taskId;
        bytes32 resultHash;
        address leaderAddress;
        address[] verifierAddresses;
        uint8 confirmCount;
        uint8 rejectCount;
        uint8 aggregatedConfidence;
        bytes32 modelId;
        uint256 committedAt;
        uint8 status;
        uint256 disputeDeadline;
        bytes32 coverageId;
    }

    function getResult(bytes32 taskId) external view returns (InferenceResult memory);

    function isConditionMet(bytes32 taskId, uint8 minConfidence, uint8 minQuorum) external view returns (bool);
}
