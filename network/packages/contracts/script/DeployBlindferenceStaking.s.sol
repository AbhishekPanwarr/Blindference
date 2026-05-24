// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {BlindferenceStaking} from "../contracts/staking/BlindferenceStaking.sol";

contract DeployBlindferenceStaking is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address blindToken = vm.envAddress("BLIND_TOKEN_ADDRESS");
        address iclService = vm.envOr("ICL_SERVICE_ADDRESS", deployer);

        vm.startBroadcast(deployerPrivateKey);

        BlindferenceStaking staking = new BlindferenceStaking(blindToken, deployer);

        // Authorize ICL as slasher
        staking.setSlasher(iclService, true);

        vm.stopBroadcast();

        console.log("BlindferenceStaking deployed at:", address(staking));
        console.log("BLIND Token:", blindToken);
        console.log("Owner:", deployer);
        console.log("ICL Slasher:", iclService);
        console.log("MIN_STAKE:", staking.MIN_STAKE());
        console.log("UNBONDING_PERIOD:", staking.UNBONDING_PERIOD());
    }
}
