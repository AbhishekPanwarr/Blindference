// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {PromptKeyStore} from "../contracts/core/PromptKeyStore.sol";
import {ResultRegistry} from "../contracts/plugins/resolvers/ResultRegistry.sol";
import {InferenceGate} from "../contracts/plugins/resolvers/InferenceGate.sol";

/// @title DeployPhase1
/// @notice Deploys the updated PromptKeyStore, ResultRegistry, and InferenceGate.
contract DeployPhase1 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // ICL service address — same as deployer by default, override with env
        address iclService = _envAddress("ICL_SERVICE_ADDRESS", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy ResultRegistry
        //    Requires: ICL address + NodeOperatorRegistry address.
        //    NodeOperatorRegistry is not deployed, so we use a dummy address for now.
        address dummyOperatorRegistry = iclService; // placeholder
        ResultRegistry resultRegistry = new ResultRegistry(iclService, dummyOperatorRegistry);
        console2.log("RESULT_REGISTRY_ADDRESS=", address(resultRegistry));

        // 2. Deploy InferenceGate (Reineira condition resolver)
        InferenceGate inferenceGate = new InferenceGate(address(resultRegistry));
        console2.log("INFERENCE_GATE_ADDRESS=", address(inferenceGate));

        // 3. Deploy updated PromptKeyStore (with grantDecryptAccess + storeOutputKey)
        PromptKeyStore promptKeyStore = new PromptKeyStore();
        promptKeyStore.setICL(iclService);
        console2.log("PROMPT_KEY_STORE_ADDRESS=", address(promptKeyStore));
        console2.log("ICL_SERVICE_ADDRESS=", iclService);

        vm.stopBroadcast();

        console2.log("");
        console2.log("=== Deployment Complete ===");
        console2.log("ResultRegistry:     ", address(resultRegistry));
        console2.log("InferenceGate:      ", address(inferenceGate));
        console2.log("PromptKeyStore:     ", address(promptKeyStore));
        console2.log("ICL Service:        ", iclService);
    }

    function _envAddress(string memory key, address _fallback) internal view returns (address) {
        string memory value = vm.envOr(key, string(""));
        if (bytes(value).length == 0) {
            return _fallback;
        }
        return vm.parseAddress(value);
    }
}
