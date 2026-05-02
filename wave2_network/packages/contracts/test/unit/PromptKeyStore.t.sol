// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {CoFheTest} from "@fhenixprotocol/cofhe-mock-contracts/CoFheTest.sol";
import {PromptKeyStore} from "../../contracts/core/PromptKeyStore.sol";
import {InEuint128, euint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract PromptKeyStoreTest is Test, CoFheTest {
    PromptKeyStore public store;

    function setUp() public {
        store = new PromptKeyStore();
    }

    function test_storeKey_persistsEncryptedHandles() public {
        bytes32 jobId = keccak256("job-1");
        InEuint128 memory highInput = createInEuint128(111, address(this));
        InEuint128 memory lowInput = createInEuint128(222, address(this));
        address[] memory allowedNodes = new address[](2);
        allowedNodes[0] = makeAddr("leader");
        allowedNodes[1] = makeAddr("verifier");

        store.storeKey(jobId, highInput, lowInput, allowedNodes);

        (euint128 storedHigh, euint128 storedLow) = store.getEncryptedKey(jobId);
        assertTrue(euint128.unwrap(storedHigh) != 0, "high handle should be set");
        assertTrue(euint128.unwrap(storedLow) != 0, "low handle should be set");
    }

    function test_storeKey_overwritesExistingJobKey() public {
        bytes32 jobId = keccak256("job-2");
        address[] memory allowedNodes = new address[](1);
        allowedNodes[0] = makeAddr("leader");

        store.storeKey(jobId, createInEuint128(111, address(this)), createInEuint128(222, address(this)), allowedNodes);
        (euint128 firstHigh, euint128 firstLow) = store.getEncryptedKey(jobId);

        store.storeKey(jobId, createInEuint128(333, address(this)), createInEuint128(444, address(this)), allowedNodes);
        (euint128 secondHigh, euint128 secondLow) = store.getEncryptedKey(jobId);

        assertTrue(euint128.unwrap(firstHigh) != euint128.unwrap(secondHigh), "high handle should update");
        assertTrue(euint128.unwrap(firstLow) != euint128.unwrap(secondLow), "low handle should update");
    }
}
