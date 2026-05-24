// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title BLIND Token
/// @notice Blindference utility token for staking, payments, and testnet rewards.
contract BLIND is ERC20, Ownable {
    constructor(address initialOwner) ERC20("Blindference Token", "BLIND") Ownable(initialOwner) {
        // Mint 1,000,000 BLIND to deployer
        _mint(initialOwner, 1_000_000 * 10 ** decimals());
    }

    /// @notice Mint additional tokens — restricted to owner (for testnet rewards).
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
