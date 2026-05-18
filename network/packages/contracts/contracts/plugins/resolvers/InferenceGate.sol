// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IConditionResolver} from "../../interfaces/IConditionResolver.sol";
import {IResultRegistry} from "../../interfaces/IResultRegistry.sol";

/// @title InferenceGate
/// @notice Reineira condition resolver — bridges an escrow to a verified inference result.
contract InferenceGate is IConditionResolver {
    IResultRegistry public resultRegistry;

    mapping(uint256 escrowId => bytes32 jobId) public escrowToJob;

    event ConditionSet(uint256 indexed escrowId, bytes32 indexed jobId);

    constructor(address _resultRegistry) {
        require(_resultRegistry != address(0), "Invalid ResultRegistry");
        resultRegistry = IResultRegistry(_resultRegistry);
    }

    /// @inheritdoc IConditionResolver
    function onConditionSet(uint256 escrowId, bytes calldata data) external override {
        bytes32 resolvedJobId = abi.decode(data, (bytes32));
        require(resolvedJobId != bytes32(0), "Invalid job ID");
        escrowToJob[escrowId] = resolvedJobId;
        emit ConditionSet(escrowId, resolvedJobId);
    }

    /// @inheritdoc IConditionResolver
    function isConditionMet(uint256 escrowId) external view override returns (bool) {
        bytes32 internalJobId = escrowToJob[escrowId];
        if (internalJobId == bytes32(0)) {
            return false;
        }
        return resultRegistry.isConditionMet(internalJobId, 70, 2);
    }
}
