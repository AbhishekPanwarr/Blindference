// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {BlindferencePolicyAdapter} from "../contracts/insurance/BlindferencePolicyAdapter.sol";

contract DeployPolicyAdapter is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        // Load configuration from environment
        address resultRegistry = vm.envAddress("RESULT_REGISTRY_ADDRESS");
        address disputeAuthority = vm.envAddress("DISPUTE_AUTHORITY_ADDRESS");
        
        vm.startBroadcast(deployerPrivateKey);
        
        BlindferencePolicyAdapter adapter = new BlindferencePolicyAdapter(
            resultRegistry,
            disputeAuthority
        );
        
        vm.stopBroadcast();
        
        console.log("BlindferencePolicyAdapter deployed at:", address(adapter));
        console.log("ResultRegistry:", resultRegistry);
        console.log("DisputeAuthority:", disputeAuthority);
    }
}
