// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.28;

import {FHE, InEuint128, euint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title PromptKeyStore
/// @notice Stores CoFHE-encrypted AES prompt-key halves and grants assigned nodes ACL access.
contract PromptKeyStore {
    struct StoredKey {
        euint128 high;
        euint128 low;
    }

    mapping(bytes32 jobId => StoredKey) private _jobKeys;

    event KeyStored(
        bytes32 indexed jobId,
        address indexed submitter,
        uint256 highHandle,
        uint256 lowHandle,
        address[] allowedNodes
    );

    function storeKey(
        bytes32 jobId,
        InEuint128 calldata encHigh,
        InEuint128 calldata encLow,
        address[] calldata allowedNodes
    ) external {
        euint128 high = FHE.asEuint128(encHigh);
        euint128 low = FHE.asEuint128(encLow);

        _grantAccess(high, allowedNodes);
        _grantAccess(low, allowedNodes);

        _jobKeys[jobId] = StoredKey({high: high, low: low});

        emit KeyStored(jobId, msg.sender, euint128.unwrap(high), euint128.unwrap(low), allowedNodes);
    }

    function getEncryptedKey(bytes32 jobId) external view returns (euint128, euint128) {
        StoredKey storage key = _jobKeys[jobId];
        return (key.high, key.low);
    }

    function _grantAccess(euint128 handle, address[] calldata allowedNodes) internal {
        FHE.allowThis(handle);
        for (uint256 index = 0; index < allowedNodes.length; index++) {
            FHE.allow(handle, allowedNodes[index]);
        }
    }
}
