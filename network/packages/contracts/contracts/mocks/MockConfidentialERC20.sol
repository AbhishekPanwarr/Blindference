// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FHE, euint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {IConfidentialERC20} from "../plugins/resolvers/IConfidentialERC20.sol";

/// @notice Mock FHE-confidential ERC20 for testing.
///         Wraps plaintext balances into euint64 handles and unwraps
///         on transfer so Foundry tests can verify amounts.
contract MockConfidentialERC20 is IConfidentialERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => uint64) public confidentialBalance;

    event MockConfidentialTransfer(address indexed from, address indexed to, uint64 amount);

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        confidentialBalance[to] += uint64(amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Mock: insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        confidentialBalance[msg.sender] -= uint64(amount);
        confidentialBalance[to] += uint64(amount);
        return true;
    }

    function confidentialBalanceOf(address account) external returns (euint64) {
        return FHE.asEuint64(confidentialBalance[account]);
    }

    function confidentialTransfer(address to, euint64 amount) external {
        // In the mock environment we can unwrap the handle to get the
        // underlying value (the mock CoFHE stores plaintext next to the hash).
        uint256 handle = euint64.unwrap(amount);
        uint64 amt = _mockValueOf(handle);

        require(confidentialBalance[msg.sender] >= amt, "Mock: insufficient balance");

        confidentialBalance[msg.sender] -= amt;
        confidentialBalance[to] += amt;
        balanceOf[msg.sender] -= amt;
        balanceOf[to] += amt;

        emit MockConfidentialTransfer(msg.sender, to, amt);
    }

    /// @dev  Query the mock CoFHE for the plaintext stored behind a handle.
    ///       This only works in the cofhe-mock-contracts test environment.
    function _mockValueOf(uint256 handle) internal pure returns (uint64) {
        // The mock system packs the plaintext into the high bits of the
        // handle for trivially-encrypted values (which is what FHE.asEuint64
        // produces in the mock).  We shift right 128 bits and mask to 64.
        return uint64(uint256(handle) >> 128);
    }
}
