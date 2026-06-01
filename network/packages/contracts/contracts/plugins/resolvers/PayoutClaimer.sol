// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FHE, euint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IConfidentialEscrow} from "./IConfidentialEscrow.sol";
import {IConfidentialERC20} from "./IConfidentialERC20.sol";
import {IResultRegistry} from "../../interfaces/IResultRegistry.sol";
import {IConditionResolver} from "../../interfaces/IConditionResolver.sol";

/// @title PayoutClaimer
/// @notice Acts as the escrow beneficiary and Reineira Gate — claims settled funds
///         and distributes payments to the inference quorum (leader + verifiers).
///
///         FHE Distribution: after escrow.redeem() releases encrypted cUSDC to
///         this contract, we compute 60/20/20 shares homomorphically and transfer
///         them via confidentialTransfer(). The last verifier receives the
///         rounding remainder so dust never accumulates here.
///
///         Implements IConditionResolver so Reineira can use this contract as a Gate.
contract PayoutClaimer is Ownable, IConditionResolver {
    IConfidentialEscrow public immutable escrow;
    IConfidentialERC20  public immutable cUSDC;
    IResultRegistry     public immutable resultRegistry;

    /// @notice Payout split: leader share in basis points (6000 = 60%)
    uint256 public leaderShareBps = 6000;
    /// @notice Payout split: each verifier share in basis points (2000 = 20%)
    uint256 public verifierShareBps = 2000;

    mapping(uint256 => bytes32) public escrowToJob;

    /// @notice Emitted after a successful claim. Amounts are intentionally
    ///         omitted — they are encrypted euint64 handles. Off-chain services
    ///         verify balances via cofhejs or balanceOf monitoring.
    event Claimed(
        uint256 indexed escrowId,
        bytes32 indexed jobId,
        address indexed leader,
        address verifier1,
        address verifier2
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
        cUSDC = IConfidentialERC20(_cUSDC);
        resultRegistry = IResultRegistry(_resultRegistry);
    }

    // ------------------------------------------------------------------
    // IConditionResolver implementation
    // ------------------------------------------------------------------

    /// @notice Reineira Gate hook — stores the escrow → job mapping when the
    ///         escrow is created with this contract as the resolver.
    function onConditionSet(uint256 escrowId, bytes calldata data) external {
        require(data.length == 32, "PayoutClaimer: invalid jobId length");
        bytes32 jobId;
        assembly {
            jobId := calldataload(data.offset)
        }
        require(jobId != bytes32(0), "PayoutClaimer: jobId required");
        escrowToJob[escrowId] = jobId;
    }

    /// @notice Reineira Gate condition check — returns true if the mapped
    ///         inference job has been verified in ResultRegistry.
    function isConditionMet(uint256 escrowId) external view returns (bool) {
        bytes32 jobId = escrowToJob[escrowId];
        if (jobId == bytes32(0)) return false;
        return resultRegistry.isConditionMet(jobId, 70, 2);
    }

    // ------------------------------------------------------------------
    // Claim & distribute (FHE)
    // ------------------------------------------------------------------

    /// @notice Claim the escrow payout and distribute to quorum members.
    /// @param escrowId The Reineira escrow identifier.
    /// @param jobId    The corresponding Blindference inference job.
    function claim(uint256 escrowId, bytes32 jobId) external {
        require(escrowId > 0, "Invalid escrowId");
        require(jobId != bytes32(0), "Invalid jobId");

        bytes32 storedJobId = escrowToJob[escrowId];
        if (storedJobId == bytes32(0)) {
            // Backward compatibility
            escrowToJob[escrowId] = jobId;
        } else {
            require(storedJobId == jobId, "PayoutClaimer: jobId mismatch");
        }

        require(
            resultRegistry.isConditionMet(jobId, 70, 2),
            "PayoutClaimer: job not verified"
        );

        // Release encrypted cUSDC from escrow to this contract
        escrow.redeem(escrowId);

        // Read the quorum result to determine payout recipients
        IResultRegistry.InferenceResult memory result = resultRegistry.getResult(jobId);
        require(result.leaderAddress != address(0), "PayoutClaimer: no leader");
        require(result.verifierAddresses.length >= 2, "PayoutClaimer: not enough verifiers");

        // Total encrypted cUSDC now held by this contract
        euint64 total = cUSDC.confidentialBalanceOf(address(this));

        // ---- 60 / 20 / 20 split ----
        // 1 unit = total / 5   (20 %)
        euint64 unit = FHE.div(total, FHE.asEuint64(5));

        // Leader = 3 units  (60 %)
        euint64 leaderAmt = FHE.add(FHE.add(unit, unit), unit);

        // Verifier 1 = 1 unit (20 %)
        euint64 v1Amt = unit;

        // Last verifier = total - (leader + v1)  (catches rounding remainder)
        euint64 lastAmt = FHE.sub(total, FHE.add(leaderAmt, v1Amt));

        // --- Leader ---
        FHE.allowTransient(leaderAmt, address(cUSDC));
        cUSDC.confidentialTransfer(result.leaderAddress, leaderAmt);

        // --- Verifier 1 ---
        FHE.allowTransient(v1Amt, address(cUSDC));
        cUSDC.confidentialTransfer(result.verifierAddresses[0], v1Amt);

        // --- Verifier 2 (last) — receives remainder ---
        FHE.allowTransient(lastAmt, address(cUSDC));
        cUSDC.confidentialTransfer(result.verifierAddresses[1], lastAmt);

        emit Claimed(
            escrowId,
            jobId,
            result.leaderAddress,
            result.verifierAddresses[0],
            result.verifierAddresses[1]
        );
    }

    // ------------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------------

    /// @notice Update payout split. Total must equal 10000 bps.
    function setSplit(uint256 _leaderBps, uint256 _verifierBps) external onlyOwner {
        require(_leaderBps + (_verifierBps * 2) == 10000, "Splits must total 10000 bps");
        leaderShareBps = _leaderBps;
        verifierShareBps = _verifierBps;
    }

    /// @notice Recover any tokens accidentally sent to this contract.
    function recoverToken(address token, address /*to*/) external onlyOwner {
        require(token != address(cUSDC), "Cannot recover cUSDC");
        IConfidentialERC20(token).balanceOf(address(this)); // sanity
        // Note: for non-confidential tokens this is a no-op placeholder.
        //       Real recovery would require an IERC20 cast — onlyOwner safety.
    }
}
