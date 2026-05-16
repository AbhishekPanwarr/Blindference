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

    struct OutputKey {
        uint256 KoH;
        uint256 KoL;
    }

    mapping(bytes32 jobId => StoredKey) private _jobKeys;
    mapping(bytes32 jobId => OutputKey) public outputKeys;

    address public icl;

    event KeyStored(
        bytes32 indexed jobId,
        address indexed submitter,
        uint256 highHandle,
        uint256 lowHandle,
        address[] allowedNodes
    );

    event DecryptAccessGranted(
        bytes32 indexed jobId,
        address indexed node
    );

    event OutputKeyStored(
        bytes32 indexed jobId,
        uint256 koHighHandle,
        uint256 koLowHandle,
        address indexed userAddress
    );

    modifier onlyICL() {
        require(msg.sender == icl, "Only ICL");
        _;
    }

    function setICL(address _icl) external {
        require(icl == address(0) || msg.sender == icl, "ICL already set by non-owner");
        require(_icl != address(0), "Invalid ICL address");
        icl = _icl;
    }

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

    /// @notice Grant CoFHE decryption access to a node after it claims a job.
    function grantDecryptAccess(bytes32 jobId, address node) external onlyICL {
        StoredKey storage key = _jobKeys[jobId];
        require(euint128.unwrap(key.high) != 0 || euint128.unwrap(key.low) != 0, "Job keys not set");
        FHE.allow(key.high, node);
        FHE.allow(key.low, node);
        emit DecryptAccessGranted(jobId, node);
    }

    /// @notice Store output key halves for a user after leader inference completes.
    function storeOutputKey(
        bytes32 jobId,
        uint256 koHighHandle,
        uint256 koLowHandle,
        address userAddress
    ) external onlyICL {
        outputKeys[jobId] = OutputKey({KoH: koHighHandle, KoL: koLowHandle});
        FHE.allow(euint128.wrap(koHighHandle), userAddress);
        FHE.allow(euint128.wrap(koLowHandle), userAddress);
        emit OutputKeyStored(jobId, koHighHandle, koLowHandle, userAddress);
    }

    function _grantAccess(euint128 handle, address[] calldata allowedNodes) internal {
        FHE.allowThis(handle);
        for (uint256 index = 0; index < allowedNodes.length; index++) {
            FHE.allow(handle, allowedNodes[index]);
        }
    }
}
