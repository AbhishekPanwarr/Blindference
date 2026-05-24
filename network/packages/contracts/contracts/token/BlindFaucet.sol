// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title BlindFaucet
/// @notice Simple time-gated faucet for BLIND tokens on testnet.
contract BlindFaucet {
    IERC20 public immutable blind;
    uint256 public immutable dripAmount;
    uint256 public immutable cooldown;

    mapping(address => uint256) public lastDrip;

    event Drip(address indexed recipient, uint256 amount);

    constructor(address _blind, uint256 _dripAmount, uint256 _cooldown) {
        require(_blind != address(0), "Invalid BLIND address");
        blind = IERC20(_blind);
        dripAmount = _dripAmount;
        cooldown = _cooldown;
    }

    /// @notice Drip a small amount of BLIND to the caller.
    function drip() external {
        require(block.timestamp >= lastDrip[msg.sender] + cooldown, "Cooldown active");
        lastDrip[msg.sender] = block.timestamp;
        blind.transfer(msg.sender, dripAmount);
        emit Drip(msg.sender, dripAmount);
    }
}
