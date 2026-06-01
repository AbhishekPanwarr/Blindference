// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {euint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @notice Minimal interface for FHE-confidential ERC20 (e.g., Reineira cUSDC).
/// @dev  Standard ERC20 transfer() is disabled by design. Use confidentialBalanceOf
///       + confidentialTransfer with euint64 handles instead.
interface IConfidentialERC20 {
    /// @return Encrypted balance of `account` as an euint64 handle.
    function confidentialBalanceOf(address account) external returns (euint64);

    /// @notice Transfer an encrypted amount to `to`.
    /// @dev  Caller must FHE.allowTransient() the amount to this token contract
    ///       immediately before the call.
    function confidentialTransfer(address to, euint64 amount) external;

    /// @notice Plaintext balance — kept for test / monitoring verification only.
    ///         On a real FHE token this may return 0 or revert.
    function balanceOf(address account) external view returns (uint256);
}
