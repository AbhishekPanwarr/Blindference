// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {NodeRegistry} from "../contracts/core/NodeRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployNodeRegistry
/// @notice Deploys the NodeRegistry as an upgradeable proxy.
///         Env vars:
///           - PRIVATE_KEY: deployer private key
///           - ICL_SERVICE_ADDRESS: ICL service wallet (defaults to deployer)
contract DeployNodeRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address iclService = _envAddress("ICL_SERVICE_ADDRESS", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy implementation
        NodeRegistry impl = new NodeRegistry();
        console2.log("NODEREGISTRY_IMPL=", address(impl));

        // Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeWithSelector(
                NodeRegistry.initialize.selector,
                deployer,  // owner
                iclService // ICL service address
            )
        );

        vm.stopBroadcast();

        console2.log("NODEREGISTRY_PROXY=", address(proxy));
        console2.log("NODEREGISTRY_OWNER=", deployer);
        console2.log("NODEREGISTRY_ICL=", iclService);
        console2.log("NODEREGISTRY_MIN_STAKE=", uint256(0));
    }

    function _envAddress(string memory key, address _fallback) internal view returns (address) {
        string memory value = vm.envOr(key, string(""));
        if (bytes(value).length == 0) {
            return _fallback;
        }
        return vm.parseAddress(value);
    }
}
