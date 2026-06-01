// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {PayoutClaimer} from "../contracts/plugins/resolvers/PayoutClaimer.sol";

/// @title DeployPayoutClaimer
/// @notice Deploys the simplified PayoutClaimer contract.
contract DeployPayoutClaimer is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(deployerPrivateKey);

        address escrow = vm.envAddress("REINEIRA_ESCROW_ADDRESS");
        address resultRegistry = vm.envAddress("RESULT_REGISTRY_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        PayoutClaimer claimer = new PayoutClaimer(escrow, resultRegistry, owner);
        console2.log("PAYOUT_CLAIMER_ADDRESS=", address(claimer));

        vm.stopBroadcast();
    }
}
