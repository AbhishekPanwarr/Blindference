// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title NodeRegistry
/// @notice Unified registry for Blindference compute nodes.
///         Stores node metadata, tracks attestations, and manages heartbeats.
/// @dev    This is a lightweight registry meant to be called by the ICL
///         and by nodes themselves.
contract NodeRegistry is OwnableUpgradeable, ReentrancyGuard {

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------
    event NodeRegistered(
        address indexed node,
        uint8 tier,
        string[] models,
        uint256 stake
    );
    event NodeUpdated(
        address indexed node,
        uint8 tier,
        bytes32 attestationHash,
        uint256 expiresAt
    );
    event Heartbeat(address indexed node, uint64 timestamp);
    event NodeRemoved(address indexed node);
    event StakeWithdrawn(address indexed node, uint256 amount);

    // ------------------------------------------------------------------
    // Structs
    // ------------------------------------------------------------------
    struct Node {
        address operator;
        uint8 tier;
        bytes32 attestationHash;
        uint64 registeredAt;
        uint64 lastHeartbeat;
        uint64 attestationExpires;
        bool active;
        string[] models;
        uint256 stake;
    }

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------
    mapping(address => Node) public nodes;
    mapping(address => bool) public authorizedICL;

    uint64 public heartbeatGraceSeconds = 950400; // 11 days
    uint256 public minStake = 0; // Start at 0 for development

    // ------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------
    modifier onlyICL() {
        require(
            authorizedICL[msg.sender] || msg.sender == owner(),
            "NodeRegistry: caller is not ICL"
        );
        _;
    }

    // ------------------------------------------------------------------
    // Constructor & Initializer
    // ------------------------------------------------------------------
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_, address iclService) external initializer {
        __Ownable_init(owner_);
        authorizedICL[iclService] = true;
    }

    // ------------------------------------------------------------------
    // Registration
    // ------------------------------------------------------------------
    function register(
        uint8 tier,
        bytes32 attestationHash,
        uint64 attestationExpires,
        string[] calldata models
    ) external payable nonReentrant returns (bool) {
        require(tier <= 2, "NodeRegistry: invalid tier");
        require(
            nodes[msg.sender].operator == address(0),
            "NodeRegistry: already registered"
        );
        require(msg.value >= minStake, "NodeRegistry: insufficient stake");

        nodes[msg.sender] = Node({
            operator: msg.sender,
            tier: tier,
            attestationHash: attestationHash,
            registeredAt: uint64(block.timestamp),
            lastHeartbeat: uint64(block.timestamp),
            attestationExpires: attestationExpires,
            active: true,
            models: models,
            stake: msg.value
        });

        emit NodeRegistered(msg.sender, tier, models, msg.value);
        return true;
    }

    // ------------------------------------------------------------------
    // Attestation Update
    // ------------------------------------------------------------------
    function updateAttestation(
        address node,
        bytes32 attestationHash,
        uint8 tier,
        uint64 expiresAt
    ) external onlyICL {
        Node storage n = nodes[node];
        require(n.operator != address(0), "NodeRegistry: node not found");

        n.attestationHash = attestationHash;
        n.tier = tier;
        n.attestationExpires = expiresAt;
        n.active = _isValid(n);

        emit NodeUpdated(node, tier, attestationHash, expiresAt);
    }

    // ------------------------------------------------------------------
    // Heartbeat
    // ------------------------------------------------------------------
    function heartbeat() external {
        Node storage n = nodes[msg.sender];
        require(n.operator != address(0), "NodeRegistry: node not found");

        n.lastHeartbeat = uint64(block.timestamp);
        n.active = _isValid(n);

        emit Heartbeat(msg.sender, n.lastHeartbeat);
    }

    // ------------------------------------------------------------------
    // Status
    // ------------------------------------------------------------------
    function isActive(address node) external view returns (bool) {
        Node storage n = nodes[node];
        if (n.operator == address(0)) return false;
        return _isValid(n);
    }

    function getNode(address node) external view returns (Node memory) {
        return nodes[node];
    }

    function isAuthorizedICL(address addr) external view returns (bool) {
        return authorizedICL[addr];
    }

    // ------------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------------
    function setAuthorizedICL(address addr, bool authorized) external onlyOwner {
        authorizedICL[addr] = authorized;
    }

    function setMinStake(uint256 amount) external onlyOwner {
        minStake = amount;
    }

    function setHeartbeatGrace(uint64 seconds_) external onlyOwner {
        heartbeatGraceSeconds = seconds_;
    }

    // ------------------------------------------------------------------
    // Withdrawal
    // ------------------------------------------------------------------
    function withdrawStake() external nonReentrant {
        Node storage n = nodes[msg.sender];
        require(n.operator != address(0), "NodeRegistry: node not found");
        require(!n.active, "NodeRegistry: node still active");

        uint256 amount = n.stake;
        n.stake = 0;
        n.active = false;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "NodeRegistry: transfer failed");

        emit StakeWithdrawn(msg.sender, amount);
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------
    function _isValid(Node storage n) internal view returns (bool) {
        // Node is valid if:
        // 1. Has a non-zero operator address
        // 2. Attestation hasn't expired
        // 3. Heartbeat is within grace period
        if (n.operator == address(0)) return false;
        if (block.timestamp > n.attestationExpires) return false;
        if (block.timestamp > n.lastHeartbeat + heartbeatGraceSeconds) return false;
        return true;
    }

    receive() external payable {}
    fallback() external payable {}
}
