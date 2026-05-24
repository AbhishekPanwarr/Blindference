// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {BLIND} from "../contracts/token/BLIND.sol";
import {BlindFaucet} from "../contracts/token/BlindFaucet.sol";

/// @title DeployTokens
/// @notice Deploys BLIND token and BlindFaucet to Arbitrum Sepolia.
contract DeployTokens is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        uint256 dripAmount = 100 * 10 ** 18; // 100 BLIND
        uint256 cooldown = 1 days;

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy BLIND token — mints 1,000,000 BLIND to deployer
        BLIND blind = new BLIND(deployer);
        console2.log("BLIND_TOKEN_ADDRESS=", address(blind));

        // 2. Deploy BlindFaucet
        BlindFaucet faucet = new BlindFaucet(address(blind), dripAmount, cooldown);
        console2.log("FAUCET_ADDRESS=", address(faucet));

        // 3. Fund faucet with 100,000 BLIND
        uint256 faucetFund = 100_000 * 10 ** 18;
        blind.transfer(address(faucet), faucetFund);
        console2.log("FAUCET_FUNDED=", faucetFund);

        vm.stopBroadcast();

        console2.log("");
        console2.log("=== Token Deployment Complete ===");
        console2.log("BLIND Token:      ", address(blind));
        console2.log("BlindFaucet:      ", address(faucet));
        console2.log("Deployer (owner): ", deployer);
    }
}
