// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BlindferenceStaking
/// @notice BLIND token staking contract for Blindference compute nodes.
///         Nodes stake BLIND to participate in inference quorums.
///         Unbonding period prevents flash-loan attacks.
/// @dev    Separate from NodeRegistry (which stakes ETH). Nodes may stake
///         both ETH and BLIND; this contract governs BLIND economic security.
contract BlindferenceStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------
    // Constants
    // ------------------------------------------------------------------
    uint256 public constant MIN_STAKE = 1000 * 10 ** 18; // 1000 BLIND
    uint256 public constant UNBONDING_PERIOD = 96 hours;
    uint256 public constant MAX_CONSECUTIVE_FAILURES = 3;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------
    event Staked(address indexed node, uint256 amount, uint256 totalStaked);
    event UnstakeInitiated(address indexed node, uint256 amount, uint256 availableAt);
    event UnstakeCompleted(address indexed node, uint256 amount);
    event Slashed(address indexed node, uint256 amount, string reason);
    event SlasherSet(address indexed slasher, bool authorized);
    event ConsecutiveFailuresUpdated(address indexed node, uint256 count);

    // ------------------------------------------------------------------
    // Structs
    // ------------------------------------------------------------------
    struct StakeInfo {
        uint256 staked;
        uint256 unbonding;
        uint256 unbondingAvailableAt;
        uint256 consecutiveFailures;
        bool active;
    }

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------
    IERC20 public immutable blindToken;

    mapping(address => StakeInfo) public stakes;
    mapping(address => bool) public authorizedSlasher;

    uint256 public totalStaked;

    // ------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------
    modifier onlySlasher() {
        require(
            authorizedSlasher[msg.sender] || msg.sender == owner(),
            "BlindferenceStaking: caller is not slasher"
        );
        _;
    }

    modifier hasStake() {
        require(stakes[msg.sender].staked > 0, "BlindferenceStaking: no stake");
        _;
    }

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------
    constructor(address _blindToken, address _owner) Ownable(_owner) {
        require(_blindToken != address(0), "BlindferenceStaking: zero token");
        blindToken = IERC20(_blindToken);
    }

    // ------------------------------------------------------------------
    // Staking
    // ------------------------------------------------------------------
    /// @notice Stake BLIND tokens. Must approve this contract first.
    function stake(uint256 amount) external nonReentrant {
        require(amount >= MIN_STAKE, "BlindferenceStaking: below min stake");

        StakeInfo storage s = stakes[msg.sender];
        s.staked += amount;
        s.active = true;
        totalStaked += amount;

        blindToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, amount, s.staked);
    }

    /// @notice Initiate unstake — starts 96h unbonding period.
    function initiateUnstake() external hasStake nonReentrant {
        StakeInfo storage s = stakes[msg.sender];
        require(s.unbonding == 0, "BlindferenceStaking: unbonding in progress");

        uint256 amount = s.staked;
        s.staked = 0;
        s.unbonding = amount;
        s.unbondingAvailableAt = block.timestamp + UNBONDING_PERIOD;
        s.active = false;
        totalStaked -= amount;

        emit UnstakeInitiated(msg.sender, amount, s.unbondingAvailableAt);
    }

    /// @notice Complete unstake after unbonding period.
    function completeUnstake() external nonReentrant {
        StakeInfo storage s = stakes[msg.sender];
        require(s.unbonding > 0, "BlindferenceStaking: no unbonding");
        require(block.timestamp >= s.unbondingAvailableAt, "BlindferenceStaking: unbonding not ready");

        uint256 amount = s.unbonding;
        s.unbonding = 0;
        s.unbondingAvailableAt = 0;

        blindToken.safeTransfer(msg.sender, amount);

        emit UnstakeCompleted(msg.sender, amount);
    }

    // ------------------------------------------------------------------
    // Slashing
    // ------------------------------------------------------------------
    /// @notice Slash a node's stake. Callable by authorized slashers.
    ///         Resets consecutive failures after slash.
    function slash(
        address node,
        uint256 amount,
        string calldata reason
    ) external onlySlasher nonReentrant {
        StakeInfo storage s = stakes[node];
        require(s.staked > 0, "BlindferenceStaking: node has no stake");

        uint256 slashAmount = amount > s.staked ? s.staked : amount;
        s.staked -= slashAmount;
        s.consecutiveFailures = 0;

        if (s.staked == 0) {
            s.active = false;
        }
        totalStaked -= slashAmount;

        // Transfer slashed tokens to owner (treasury) for now.
        // In future, may burn or redistribute.
        blindToken.safeTransfer(owner(), slashAmount);

        emit Slashed(node, slashAmount, reason);
    }

    /// @notice Record a failure for a node. Increments consecutive failures.
    ///         Callable by ICL (authorized slasher).
    function recordFailure(address node) external onlySlasher {
        StakeInfo storage s = stakes[node];
        if (s.staked == 0) return;

        s.consecutiveFailures += 1;
        if (s.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            // Auto-slash entire stake on max failures
            uint256 amount = s.staked;
            s.staked = 0;
            s.active = false;
            s.consecutiveFailures = 0;
            totalStaked -= amount;

            blindToken.safeTransfer(owner(), amount);
            emit Slashed(node, amount, "max_consecutive_failures");
        }

        emit ConsecutiveFailuresUpdated(node, s.consecutiveFailures);
    }

    /// @notice Reset consecutive failures (e.g., after successful job).
    function resetFailures(address node) external onlySlasher {
        StakeInfo storage s = stakes[node];
        s.consecutiveFailures = 0;
        emit ConsecutiveFailuresUpdated(node, 0);
    }

    // ------------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------------
    function setSlasher(address slasher, bool authorized) external onlyOwner {
        authorizedSlasher[slasher] = authorized;
        emit SlasherSet(slasher, authorized);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------
    function getStakeInfo(address node) external view returns (StakeInfo memory) {
        return stakes[node];
    }

    function isActive(address node) external view returns (bool) {
        return stakes[node].active && stakes[node].staked >= MIN_STAKE;
    }

    function canCompleteUnstake(address node) external view returns (bool) {
        StakeInfo storage s = stakes[node];
        return s.unbonding > 0 && block.timestamp >= s.unbondingAvailableAt;
    }
}
