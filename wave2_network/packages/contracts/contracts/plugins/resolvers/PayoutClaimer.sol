// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IConfidentialEscrow} from "./IConfidentialEscrow.sol";
import {IResultRegistry} from "../../interfaces/IResultRegistry.sol";

/// @title PayoutClaimer
/// @notice Acts as the escrow beneficiary — claims settled funds and distributes
///         payments to the inference quorum (leader + verifiers).
///
///         Flow:
///           1. User creates Reineira escrow with `owner = address(this)` and
///              `resolver = InferenceGate`.
///           2. After the ICL marks the job as verified in ResultRegistry,
///              anyone calls `claim(escrowId)`.
///           3. This contract calls `ConfidentialEscrow.redeem(escrowId)`.
///           4. Reineira internally checks `InferenceGate.isConditionMet()` →
///              reads `ResultRegistry.isConditionMet()` → returns true.
///           5. Escrow releases cUSDC to this contract.
///           6. cUSDC is distributed to the leader and verifiers.
contract PayoutClaimer is Ownable {
    IConfidentialEscrow public immutable escrow;
    IERC20 public immutable cUSDC;
    IResultRegistry public immutable resultRegistry;

    /// @notice Payout split: leader share in basis points (6000 = 60%)
    uint256 public leaderShareBps = 6000;
    /// @notice Payout split: each verifier share in basis points (2000 = 20%)
    uint256 public verifierShareBps = 2000;

    mapping(uint256 => bytes32) public escrowToJob;

    event Claimed(
        uint256 indexed escrowId,
        bytes32 indexed jobId,
        address leader,
        address[] verifiers,
        uint256 amount,
        uint256 leaderAmount,
        uint256 verifierAmount
    );

    constructor(
        address _escrow,
        address _cUSDC,
        address _resultRegistry,
        address _owner
    ) Ownable(_owner) {
        require(_escrow != address(0), "Invalid escrow");
        require(_cUSDC != address(0), "Invalid cUSDC");
        require(_resultRegistry != address(0), "Invalid ResultRegistry");
        escrow = IConfidentialEscrow(_escrow);
        cUSDC = IERC20(_cUSDC);
        resultRegistry = IResultRegistry(_resultRegistry);
    }

    /// @notice Claim the escrow payout and distribute to quorum members.
    /// @param escrowId The Reineira escrow identifier.
    /// @param jobId The corresponding Blindference inference job.
    function claim(uint256 escrowId, bytes32 jobId) external {
        require(escrowId > 0, "Invalid escrowId");
        require(jobId != bytes32(0), "Invalid jobId");
        require(escrowToJob[escrowId] == bytes32(0), "Already claimed");

        escrowToJob[escrowId] = jobId;

        // This will revert if the escrow condition (InferenceGate) is not met
        escrow.redeem(escrowId);

        // Escrow should now have released cUSDC to this contract.
        // Read the quorum result to determine payout recipients.
        IResultRegistry.InferenceResult memory result = resultRegistry.getResult(jobId);

        uint256 balance = cUSDC.balanceOf(address(this));
        require(balance > 0, "No payout received");

        // Compute splits
        uint256 leaderAmount = (balance * leaderShareBps) / 10000;
        uint256 totalVerifier = balance - leaderAmount;
        uint256 verifierCount = result.verifierAddresses.length;
        uint256 perVerifier = verifierCount > 0 ? totalVerifier / verifierCount : 0;

        // Pay leader
        if (leaderAmount > 0 && result.leaderAddress != address(0)) {
            cUSDC.transfer(result.leaderAddress, leaderAmount);
        }

        // Pay verifiers
        for (uint256 i = 0; i < result.verifierAddresses.length; i++) {
            if (perVerifier > 0) {
                cUSDC.transfer(result.verifierAddresses[i], perVerifier);
            }
        }

        emit Claimed(
            escrowId,
            jobId,
            result.leaderAddress,
            result.verifierAddresses,
            balance,
            leaderAmount,
            perVerifier
        );
    }

    /// @notice Update payout split. Total must equal 10000 bps.
    function setSplit(uint256 _leaderBps, uint256 _verifierBps) external onlyOwner {
        require(_leaderBps + (_verifierBps * 2) == 10000, "Splits must total 10000 bps");
        leaderShareBps = _leaderBps;
        verifierShareBps = _verifierBps;
    }

    /// @notice Recover any tokens accidentally sent to this contract.
    function recoverToken(address token, address to) external onlyOwner {
        require(token != address(cUSDC), "Cannot recover cUSDC");
        IERC20(token).transfer(to, IERC20(token).balanceOf(address(this)));
    }
}
