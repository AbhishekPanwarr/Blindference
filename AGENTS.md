# Blindference — Complete Context Transfer Document

> **Purpose**: This document is a self-contained handoff for any future LLM or engineer picking up the repository. It explains what the project is, how the repo is structured, what has already been changed, what is currently working, and what exact blockers or critical decisions exist.

---

## 1. Project Summary

Blindference is a **confidential AI inference protocol** for Web3. It coordinates encrypted requests across a `1 leader + 2 verifier` quorum, uses CoFHE (Confidential FHE) for key access control, runs off-chain inference through hosted frontier models (Groq, Gemini), and commits results on-chain on Arbitrum Sepolia.

**Core guarantee**: A quorum of 3 nodes runs identical inference on encrypted inputs. Results are cross-validated. Only the user can decrypt the final output.

**Tech stack**:
- **Frontend**: React/Vite + wagmi/viem + CoFHE browser SDK (`@cofhe/sdk`)
- **ICL (Inference Coordination Layer)**: FastAPI + Motor (MongoDB async driver)
- **Node Runtime**: Python asyncio + TypeScript CoFHE bridge (`@cofhe/sdk/node`)
- **Contracts**: Solidity on Arbitrum Sepolia (chain ID 421614)
- **Encryption**: AES-256 for prompt blobs, CoFHE (FHE) for key access control
- **Inference**: Groq Llama 3.3 70B, Google Gemini 2.5 Flash, or local vLLM

---

## 2. Monorepo Layout

```
blindference/
├── README.md                    # Human-facing README (keep concise)
├── ARCHITECTURE.md              # Component-level architecture (may be stale)
├── DEPLOYMENT.md                # Contract deployment history
├── CONTEXT.md                   # Legacy LLM handoff (may be stale)
├── updates.md                   # Changelog
├── AGENTS.md                    # THIS FILE — comprehensive context transfer
├── network/
│   ├── packages/
│   │   ├── frontend/            # React/Vite browser client
│   │   │   ├── src/pages/InferenceNewPage.tsx      # Main inference submission UI
│   │   │   ├── src/pages/InferenceStatusPage.tsx   # Status polling UI
│   │   │   ├── src/hooks/useInferenceStatus.ts      # Status hook with FAILED stage
│   │   │   ├── src/components/StatusTimeline.tsx    # Visual timeline
│   │   │   ├── src/components/StatusBadge.tsx       # Status badges
│   │   │   ├── src/api/inferenceApi.ts             # ICL REST client
│   │   │   └── src/utils/encryption.ts             # CoFHE encryption utils
│   │   ├── icl/                 # FastAPI coordinator
│   │   │   ├── main.py                           # FastAPI app entry
│   │   │   ├── routers/
│   │   │   │   ├── inference.py                # Public REST API (frontend → ICL)
│   │   │   │   └── internal.py                 # Node-facing REST API
│   │   │   ├── services/
│   │   │   │   ├── quorum_service.py           # Core quorum logic (CRITICAL)
│   │   │   │   ├── chain_service.py            # On-chain tx submission
│   │   │   │   ├── node_selector.py            # Quorum node selection
│   │   │   │   └── verdict_aggregator.py       # Consensus logic
│   │   │   ├── models/
│   │   │   │   ├── db_models.py                # MongoDB document schemas
│   │   │   │   ├── request_models.py           # Pydantic request validators
│   │   │   │   ├── response_models.py          # Pydantic response serializers
│   │   │   │   └── text_inference.py           # Text inference types
│   │   │   ├── chain/
│   │   │   │   ├── prompt_key_store.py         # PromptKeyStore contract wrapper
│   │   │   │   └── node_registry.py            # NodeRegistry contract wrapper
│   │   │   └── db/
│   │   │       └── collections.py              # MongoDB collection names
│   │   ├── node-reineira/       # LEGACY node runtime — DO NOT USE
│   │   │   └── (kept for reference only)
│   │   ├── contracts/           # Solidity contracts + Hardhat artifacts
│   │   │   ├── contracts/
│   │   │   │   ├── InferenceGate.sol
│   │   │   │   ├── InferenceInsurancePolicy.sol
│   │   │   │   ├── ModelRegistry.sol
│   │   │   │   ├── NodeOperatorRegistry.sol
│   │   │   │   ├── ResultRegistry.sol
│   │   │   │   └── CoverageManager.sol
│   │   │   ├── artifacts/        # Compiled ABI + bytecode
│   │   │   └── broadcast/        # Deployment transaction records
│   │   ├── blindference-demo/     # Demo vertical contracts
│   │   │   ├── contracts/core/BlindferenceInputVault.sol  # On-chain ACL vault
│   │   │   ├── contracts/core/BlindferenceAttestor.sol
│   │   │   ├── contracts/core/BlindferenceUnderwriter.sol
│   │   │   ├── contracts/core/BlindferenceAgent.sol
│   │   │   └── script/DeployBlindferenceAgent.s.sol
│   │   ├── shared/               # Shared TypeScript utilities
│   │   └── shared-py/            # Shared Python utilities (AES, IPFS, commitment)
│   └── scripts/demo/            # Orchestration scripts
│       ├── run-icl.sh
│       ├── run-node.sh
│       ├── run-frontend.sh
│       ├── run-stack.sh
│       ├── bootstrap.sh
│       ├── status.sh
│       └── stop.sh
└── Blindference-node/           # SEPARATE REPO — standalone node runtime package
    └── (see Blindference-node/AGENTS.md)
```

---

## 3. System Architecture

### 3.1 High-Level Flow (Text Inference)

```
Browser (MetaMask) → Frontend (React) → ICL (FastAPI) → Nodes (3x Python)
                                      ↓
                                Arbitrum Sepolia (Contracts)
```

### 3.2 Detailed Text Inference Flow

1. **User enters prompt** in browser
2. **Browser AES-256 encrypts prompt** locally — generates `prompt_key` (32 bytes)
3. **Browser uploads encrypted blob to IPFS** (Pinata) → gets `prompt_cid`
4. **Browser splits `prompt_key` into two uint128 halves**: `key_high`, `key_low`
5. **Browser CoFHE-encrypts each half** via `@cofhe/sdk` → gets `enc_high_handle`, `enc_low_handle`
6. **Browser calls `PromptKeyStore.storeKey(taskId, encHigh, encLow, allowedNodes)`** via wagmi
   - **CRITICAL**: Must be called by user's wallet, NOT ICL wallet. Fhenix CoFHE enforces `InvalidSigner`.
7. **Browser submits request to ICL** with `prompt_cid`, `task_id`, `prompt_key_store_tx`
8. **ICL selects quorum**: 1 leader + 2 verifiers from active node pool
9. **ICL dispatches tasks** to nodes via `POST /internal/assignments/{addr}` (push, not polling)
10. **Each node**:
    - Claims assignment via `POST /internal/task/claim`
    - Gets CoFHE key handles (`kpHighHandle`, `kpLowHandle`) + sharing permit
    - Calls `decryptForView(kpHighHandle).withPermit(permit)` via CoFHE bridge
    - Reconstructs AES key from two decrypted uint128 halves
    - Downloads encrypted blob from IPFS
    - Decrypts blob with AES key → plaintext prompt
    - Runs inference via Groq/Gemini API
    - Hashes result for commitment
11. **Leader** additionally:
    - Encrypts output with new AES key
    - Splits output key into CoFHE halves
    - Stores output key in PromptKeyStore
    - Uploads encrypted output blob to IPFS
    - Submits result hash + output CID + output key handles to ICL
12. **Verifiers** submit verdict: match/no-match against leader's commitment hash
13. **ICL aggregates**: 2/3 match → `accepted`, <2/3 → `rejected`
14. **ICL commits accepted result on-chain** via `ResultRegistry`
15. **Frontend polls status**, decrypts output key, reveals answer

### 3.3 Two-Phase Key Storage (CRITICAL)

Because of Fhenix CoFHE `InvalidSigner` enforcement, the ICL wallet CANNOT store prompt keys:

```
Phase 1: Frontend stores key
  User Wallet ──▶ PromptKeyStore.storeKey(taskId, encHigh, encLow, allowedNodes)
                         │
                         ▼
                  Transaction mined → tx_hash

Phase 2: Frontend confirms to ICL
  Frontend ──▶ POST /v1/inference/{request_id}/confirm-store-key
               { "prompt_key_store_tx": "0x..." }
                         │
                         ▼
                  ICL verifies key exists on-chain via getEncryptedKey(taskId)
                  ICL dispatches to quorum nodes
```

---

## 4. Deployed Contracts (Arbitrum Sepolia — Chain ID 421614)

| Contract | Address | ABI Location | Purpose |
|----------|---------|--------------|---------|
| **PromptKeyStore** | `0x1E22dD12f448B15f1Ca8560fB6B4463834FaAf73` | `network/packages/contracts/artifacts/contracts/PromptKeyStore.json` | Stores CoFHE-encrypted AES key halves. Functions: `storeKey(taskId, encHigh, encLow, allowedNodes[])`, `storeOutputKey(taskId, KoH, KoL, user)`, `getEncryptedKey(taskId)` → `(uint256, uint256, address[])` |
| **NodeRegistry** (new) | `0x72C0Ead949Fd2C346598a30AF1A69c3c5Cb86082` | `network/packages/contracts/artifacts/contracts/NodeOperatorRegistry.json` | New preferred registry. Functions: `register(tier, attestationHash, expiry, models[])`, `isActive(address)`, `getNode(address)`, `heartbeat()` |
| **NodeAttestationRegistry** (legacy) | `0xB54e019e9717a8Ed4746bA9d7F1A3F83cf0a35E0` | Same ABI | Legacy fallback. Functions: `commit(...)`, `hasValid(...)` |
| **ExecutionCommitmentRegistry** | `0xcd45aefE9a16772528fa30B7d47958a95e83440C` | `network/packages/contracts/artifacts/contracts/ExecutionCommitmentRegistry.json` | Task dispatch and commitment tracking |
| **ResultRegistry** | `0xCebd831eCd00915E299b8Ef2666cAbf942dc7150` | `network/packages/contracts/artifacts/contracts/ResultRegistry.json` | On-chain result storage for settlement |
| **BlindferenceInputVault** | `0x8dD7B2A9B69C76A69d33B2DF46426Cbe657a902b` | `network/packages/blindference-demo/out/BlindferenceInputVault.json` | NEW: On-chain ACL vault for CoFHE-encrypted features. Accepts encrypted inputs, verifies via `FHE.asEuint32/64/8`, grants ACL to caller |
| **BlindferenceAgent** | `0x43132afC4F163C244f7b66Adafee32F6B904994c` | `network/packages/blindference-demo/out/BlindferenceAgent.json` | Agent configuration |
| **BlindferenceAttestor** | `0x957CEb3F3E77bF91A001ef9FB2cEeB40A860FD79` | `network/packages/blindference-demo/out/BlindferenceAttestor.json` | Custom attestation validation |
| **BlindferenceUnderwriter** | `0xC7D3706Ca2a42d739429Aec1b452051dA5Eb68f0` | `network/packages/blindference-demo/out/BlindferenceUnderwriter.json` | Insurance underwriter |
| **BlindferenceInference** (proxy) | `0x98b08590D1CB28E6687eFea59A32BE8B16571C86` | — | Contract-mode inference with self-submit commitments |
| **BlindferenceInferenceGate** | `0x6a3fA63542d0b69937949372c11348A9EE3f6459` | — | On-chain quorum gate for contract-mode |
| **BLIND Token** | `0x232D5470DaaC7AD552a42d876aDEF1f778033cE0` | `network/packages/contracts/artifacts/contracts/BLIND.json` | ERC-20 utility token for staking, payments, and rewards |
| **BlindferenceStaking** | `0x222Ac74201Ed58915e42Ee5be626d939fd234D0b` | `network/packages/contracts/out/BlindferenceStaking.sol/BlindferenceStaking.json` | BLIND token staking: stake/unbond/slash. Min 1000 BLIND, 96h unbonding, auto-slash at 3 failures |
| **BlindferencePolicyAdapter** | `0xc8Ae5892bf5b91726FCb9B2a7EceDee596B795cF` | `network/packages/contracts/out/BlindferencePolicyAdapter.sol/BlindferencePolicyAdapter.json` | Mock insurance policy adapter (Tier 1 testnet) |

### 4.1 PromptKeyStore ABI (Critical Functions)

```solidity
function storeKey(
    bytes32 taskId,
    uint256 encryptedHigh,
    uint256 encryptedLow,
    address[] calldata allowedNodes
) external;

function storeOutputKey(
    bytes32 taskId,
    uint256 KoH,
    uint256 KoL,
    address user
) external;

function getEncryptedKey(bytes32 taskId)
    external view
    returns (uint256 encryptedHigh, uint256 encryptedLow, address[] memory allowedNodes);
```

**CRITICAL**: `storeKey()` already grants all `allowedNodes` ACL access atomically. There is NO `grantDecryptAccess` function in the deployed contract. Do NOT try to call `grantDecryptAccess` — it will revert with "function not found".

### 4.2 NodeRegistry ABI (New Preferred)

```solidity
function register(
    uint8 tier,
    bytes32 attestationHash,
    uint256 attestationExpires,
    string[] calldata modelIds
) external payable;

function isActive(address node) external view returns (bool);
function getNode(address node) external view returns (address operator, uint8 tier, bool active, uint256 lastHeartbeat, uint256 attestationExpires, bytes32 attestationHash);
function heartbeat() external;
```

### 4.3 BlindferenceStaking ABI (Phase 4)

```solidity
function stake(uint256 amount) external;                              // Must approve BLIND first
function initiateUnstake() external;                                // Starts 96h unbonding
function completeUnstake() external;                                // Withdraw after unbonding
function slash(address node, uint256 amount, string calldata reason) external;  // Slasher role only
function recordFailure(address node) external;                      // +1 consecutive failure
function resetFailures(address node) external;                      // Reset failure counter
function getStakeInfo(address node) external view returns (StakeInfo memory);
function isActive(address node) external view returns (bool);         // staked >= MIN_STAKE

struct StakeInfo {
    uint256 staked;
    uint256 unbonding;
    uint256 unbondingAvailableAt;
    uint256 consecutiveFailures;
    bool active;
}

// Constants
uint256 public constant MIN_STAKE = 1000 * 10**18;   // 1000 BLIND
uint256 public constant UNBONDING_PERIOD = 96 hours;
uint256 public constant MAX_CONSECUTIVE_FAILURES = 3;  // Auto-slash threshold
```

**CRITICAL**: The ICL wallet (`0x7F9B...`) is configured as the authorized slasher at deployment. Only the slasher can call `slash()`, `recordFailure()`, and `resetFailures()`.

---

## 5. ICL (Inference Coordination Layer)

### 5.1 Tech Stack
- **Framework**: FastAPI
- **Database**: MongoDB (async via `motor`)
- **Python**: 3.11+
- **Key dependencies**: `fastapi`, `uvicorn[standard]`, `motor`, `pymongo`, `web3`, `eth-account`, `pydantic`, `httpx`, `pycryptodome`

### 5.2 Database Collections

| Collection | Document Model | Purpose |
|------------|---------------|---------|
| `inference_requests` | `InferenceRequestRecord` | All inference requests |
| `quorum_assignments` | `QuorumAssignmentRecord` | Quorum member mapping |
| `verifier_verdicts` | `VerifierVerdictRecord` | Individual verifier votes |
| `quorum_certificates` | `QuorumCertificateRecord` | Final consensus certificates |
| `permits` | `PermitRecord` | CoFHE sharing permits per task |
| `node_runtimes` | `NodeRuntimeRecord` | Active node callback URLs |
| `disputes` | `DisputeRecord` | Dispute records |

### 5.3 InferenceRequestRecord Schema (MongoDB)

```python
class InferenceRequestRecord(BaseModel):
    request_id: str           # UUIDv4 hex (auto-generated)
    task_id: str              # keccak256 hash (deterministic from payload)
    invocation_id: str        # Numeric string derived from task_id
    developer_address: str    # User wallet address (checksum)
    model_id: str             # e.g. "groq:llama-3.3-70b-versatile"
    mode: Literal["risk", "text"] = "risk"
    text_mode: bool = False
    encrypted_features: list[dict]  # CoFHE encrypted feature handles
    feature_types: list[str]
    loan_id: str | None = None
    coverage_type: str | None = None
    max_fee_gnk: int = 0
    min_tier: int
    zdr_required: bool
    verifier_count: int
    leader_address: str
    verifier_addresses: list[str]
    status: Literal["queued", "accepted", "rejected", "disputed"] = "queued"
    created_at: datetime
    updated_at: datetime
    metadata: dict[str, Any]          # EXTENSIVE — see below
    prompt_cid: str | None = None   # IPFS CID for encrypted prompt blob
    encrypted_prompt_key_high: str | None = None   # CoFHE handle (as string)
    encrypted_prompt_key_low: str | None = None
    encrypted_output_key_high: str | None = None
    encrypted_output_key_low: str | None = None
    output_cid: str | None = None
    commitment_hash: str | None = None
    result_hash: str | None = None
    result_preview: str | None = None
    risk_score: int | None = None
    chain_tx_hash: str | None = None
    aggregated_confidence: int | None = None
    confirm_count: int = 0
    reject_count: int = 0
    dispute_deadline: datetime | None = None
    claimed_nodes: list[str] = []     # Nodes that have claimed
    # PER-NODE TRACKING (added 2026-05-24):
    node_assignments: dict[str, dict] = {}  # address -> {"status": "pending|claimed|completed|failed", "claimed_at": ..., "completed_at": ..., "failure_reason": ...}
    leader_output_ready: bool = False       # Set when leader submits result
    failure_reason: str | None = None       # Set if all nodes fail
```

### 5.4 Metadata Field Structure

```python
{
    "coverage_requested": bool,
    "text_request": {
        "prompt_cid": str,
        "encrypted_prompt_key": {"high": str, "low": str},
        "model_id": str,
        "coverage_enabled": bool,
    },
    "prompt_key_store_tx": str,          # Frontend's storeKey tx hash
    "prompt_key_store_status": "stored_by_user" | "pending" | "stored",
    "prompt_key_store_address": "0x1E22...",
    "prompt_key_store_handles": {"high": str, "low": str},
    "task_registered_tx": str,
    "escrow_creation_tx": str,
    "coverage_id": str,
    "coverage_purchase_tx": str,
    "permits": list[dict],               # Serialized permit entries
    "leader_submission": {              # Leader result metadata
        "leader_address": str,
        "risk_score": int,
        "leader_confidence": int,
        "leader_summary": str,
        "provider": str,
        "model": str,
        "result_hash": str,
        "submitted_at": str,  # ISO datetime
    },
    "text_leader_result": {             # Text mode leader result
        "leader_address": str,
        "output_cid": str,
        "commitment_hash": str,
        "encrypted_output_key_high": str,
        "encrypted_output_key_low": str,
        "verdict": "CONFIRM" | "REJECT" | None,
        "confidence": int,
        "submitted_at": str,
    },
    "output_key_store_job_id": str,
    "output_key_store_tx": str,
    "output_key_store_handles": {"high": str, "low": str},
    "result_commit_tx": str,
    "escrow_release_tx": str,
    "escrow_release_mode": str,
}
```

### 5.5 ICL REST API Endpoints

#### Public API (Frontend)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/inference/quorum-preview` | Preview quorum for given constraints |
| `POST` | `/v1/inference/requests` | Create new inference request |
| `GET`  | `/v1/inference/requests` | List all requests |
| `GET`  | `/v1/inference/requests/{request_id}` | Get request details |
| `GET`  | `/v1/inference/requests/{request_id}/status` | Get request status (returns TextInferenceResult for text mode) |
| `POST` | `/v1/inference/{request_id}/confirm-store-key` | Confirm frontend prompt key storage |
| `POST` | `/v1/inference/{request_id}/attach-permit` | Attach sharing permit |

#### Node API (Internal)

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/internal/challenge/{address}` | Get attestation challenge |
| `POST` | `/internal/attestation/verify` | Submit attestation |
| `POST` | `/internal/heartbeat` | Node heartbeat |
| `GET`  | `/internal/assignments/{address}` | Get pending assignments for node |
| `POST` | `/internal/task/claim` | Claim an assignment |
| `POST` | `/internal/task/result` | Submit leader result |
| `POST` | `/internal/task/verify` | Submit verifier verdict |
| `POST` | `/internal/task` | New unified task submission endpoint |
| `GET`  | `/internal/nodes` | List registered node runtimes |

### 5.6 QuorumService — Core Logic (Critical Code Paths)

**File**: `network/packages/icl/services/quorum_service.py`

#### Assignment Dispatch (`_dispatch_request_to_quorum`)

```python
async def _dispatch_request_to_quorum(self, request_id: str, target_nodes: list[str] | None = None) -> None:
    """Push request to node runtimes via HTTP POST to their callback URLs."""
    request_document = await self.database[INFERENCE_REQUESTS].find_one({"request_id": request_id})
    assignment_document = await self.database[QUORUM_ASSIGNMENTS].find_one({"request_id": request_id})
    # ... builds payload and POSTs to each node's callback_url
```

**IMPORTANT**: The ICL pushes to node callback URLs (not polling). Nodes register their callback URL at startup.

#### Node Assignment Polling (`_get_pending_assignments`)

```python
# This is the CRITICAL method that nodes call via GET /internal/assignments/{addr}
# It was recently fixed (2026-05-24) to NOT gate verifiers on leader_output_ready

async def _get_pending_assignments(self, checksum: str) -> list[str]:
    """Return task_ids that this node should claim."""
    assigned_ids: list[str] = []
    now = datetime.now(timezone.utc)
    
    async for document in self.database[INFERENCE_REQUESTS].find({
        "status": "queued",
        "$or": [
            {"leader_address": checksum},
            {"verifier_addresses": checksum},
        ],
    }):
        task_id = document["task_id"]
        
        # Per-node assignment tracking
        node_assignments = document.get("node_assignments", {})
        node_status = node_assignments.get(checksum, {}).get("status", "pending")
        
        if node_status == "completed":
            continue
        if node_status == "failed":
            continue
        if node_status == "claimed":
            claimed_at_str = node_assignments.get(checksum, {}).get("claimed_at")
            if claimed_at_str:
                claimed_at = datetime.fromisoformat(claimed_at_str)
                if now - claimed_at < timedelta(minutes=5):
                    continue  # Still within 5-minute timeout
                else:
                    # Timeout — mark as failed
                    await self._mark_node_failed(document["request_id"], checksum, "timeout")
                    continue
        
        # OLD BUG (fixed 2026-05-24): This line blocked verifiers until leader finished
        # is_leader = document.get("leader_address") == checksum
        # if not is_leader and not document.get("leader_output_ready", False):
        #     continue  # ← BUG REMOVED
        
        assigned_ids.append(task_id)
    
    return assigned_ids
```

**5-minute timeout**: All nodes (leader + verifiers) have 5 minutes to claim and complete. If a node claims but doesn't complete within 5 minutes, it's marked `failed`. If ALL nodes fail, the job status becomes `failed` with a `failure_reason`.

#### Leader Result Submission (`submit_text_leader_result`)

```python
async def submit_text_leader_result(self, payload: LeaderTextResultSubmission) -> dict:
    # 1. Validate leader address matches assignment
    # 2. Store output key on-chain via PromptKeyStore.storeOutputKey
    # 3. Update document:
    #    - output_cid = payload.output_cid
    #    - commitment_hash = payload.commitment_hash
    #    - encrypted_output_key_high/low
    #    - leader_output_ready = True
    #    - node_assignments[leader_address].status = "completed"
    # 4. Call _attempt_finalize_text_request()
```

#### Verifier Verdict Submission (`submit_text_verifier_verdict`)

```python
async def submit_text_verifier_verdict(self, payload: VerifierTextVerdict) -> dict:
    # 1. Validate verifier is in quorum
    # 2. Store verdict in verifier_verdicts collection
    # 3. Update node_assignments[verifier].status = "completed"
    # 4. Call _attempt_finalize_text_request()
```

#### Finalization (`_attempt_finalize_text_request`)

```python
async def _attempt_finalize_text_request(self, job_id: str) -> InferenceCommitResponse | None:
    # 1. Check if leader has submitted (leader_output_ready)
    # 2. Count verifier verdicts
    # 3. If 2+ CONFIRM → accepted
    # 4. If 2+ REJECT → rejected
    # 5. If split or insufficient → stays queued
    # 6. On accepted: write to ResultRegistry, release escrow
    # 7. Phase 4: On accepted, call _distribute_reward() → Payment Service /v1/rewards/distribute
```

#### Phase 4 — Soft & Hard Slashing

**File**: `network/packages/icl/services/quorum_service.py`

**Soft slashing** (immediate, 0 gas):
- `_mark_node_assignment_failed()` → calls `BlindferenceStaking.recordFailure(node_address)` on-chain
- `get_active_nodes()` in `chain_service.py` → queries `BlindferenceStaking.getStakeInfo()` and **excludes nodes with `consecutiveFailures >= 3`** from quorum selection

**Hard slashing** (automatic on-chain):
- Contract auto-slashes **entire stake** when `consecutiveFailures` hits `MAX_CONSECUTIVE_FAILURES (3)`
- Triggered inside `recordFailure()` when the counter reaches 3

**Failure reset** (on successful completion):
- `submit_text_leader_result()` → calls `resetFailures(leader_address)`
- `submit_text_verifier_verdict()` → calls `resetFailures(verifier_address)`
- `submit_verifier_verdict()` (risk mode) → calls `resetFailures(verifier_address)`

### 5.7 ChainService — On-Chain Interactions

**File**: `network/packages/icl/services/chain_service.py`

Key methods:
- `register_task(task_id, developer_address, leader_address, cross_verifier_address, model_id)` → calls `ExecutionCommitmentRegistry`
- `store_text_prompt_key(task_id, encrypted_high_input, encrypted_low_input, allowed_nodes)` → calls `PromptKeyStore.storeKey`
- `store_output_key(task_id, high_handle, low_handle, user_address)` → calls `PromptKeyStore.storeOutputKey`
- `get_text_prompt_key_handles(task_id)` → calls `PromptKeyStore.getEncryptedKey`
- `finalize_execution(task_id, result_hash, leader, cross_verifier, accepted)` → commits result
- `write_result_to_registry(...)` → writes to `ResultRegistry`
- **Phase 4**: `blindference_staking.record_failure(node_address)` → calls `BlindferenceStaking.recordFailure()`
- **Phase 4**: `blindference_staking.reset_failures(node_address)` → calls `BlindferenceStaking.resetFailures()`

**CRITICAL**: `store_text_prompt_key()` often fails with `InvalidSigner` because the ICL wallet is NOT the user wallet. This is expected. The fallback is to set status to `pending_store_key` and have the frontend call `storeKey()` directly, then confirm via `POST /v1/inference/{id}/confirm-store-key`.

#### Phase 4 — BlindferenceStakingClient

**File**: `network/packages/icl/chain/blindference_staking.py`

Wraps the `BlindferenceStaking` contract:
- `get_stake_info(node_address)` → returns `{staked, unbonding, unbondingAvailableAt, consecutiveFailures, active}`
- `record_failure(node_address)` → `recordFailure()` on-chain (slasher role)
- `reset_failures(node_address)` → `resetFailures()` on-chain (slasher role)
- `slash(node_address, amount, reason)` → `slash()` on-chain (slasher role)

### 5.8 Confirm Prompt Key Store Endpoint

```python
# POST /v1/inference/{request_id}/confirm-store-key
# Body: { "prompt_key_store_tx": "0x..." }

async def confirm_prompt_key_store(self, request_id: str, prompt_key_store_tx: str) -> InferenceRequestResponse:
    # 1. Verify request exists and status == "pending_store_key"
    # 2. Update metadata.prompt_key_store_tx and status = "stored_by_user"
    # 3. Verify key is on-chain via get_text_prompt_key_handles()
    # 4. Call _dispatch_request_to_quorum(request_id)
```

---

## 6. Frontend

### 6.1 Tech Stack
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Web3**: wagmi + viem
- **CoFHE**: `@cofhe/sdk` browser package
- **State**: TanStack Query (React Query)
- **Routing**: TanStack Router

### 6.2 Key Files

| File | Purpose |
|------|---------|
| `src/pages/InferenceNewPage.tsx` | Main inference submission UI. Handles CoFHE encryption, quorum preview, permit creation, storeKey tx, request submission |
| `src/pages/InferenceStatusPage.tsx` | Status polling. Shows stages: PREPARING → ENCRYPTING → SUBMITTING → QUORUM_FORMING → CLAIMING → PROCESSING → VERIFYING → COMPLETED/REJECTED/FAILED |
| `src/hooks/useInferenceStatus.ts` | React Query hook polling `GET /v1/inference/{id}/status` every 3s. Derives stage from response fields |
| `src/components/StatusTimeline.tsx` | Visual timeline component. Shows leader + verifier progress |
| `src/components/StatusBadge.tsx` | Status badge with colors |
| `src/api/inferenceApi.ts` | Axios-based API client for ICL |
| `src/utils/encryption.ts` | CoFHE encryption utilities. Wraps `@cofhe/sdk` browser client |

### 6.3 Status Stages (Frontend)

```typescript
export type InferenceStage =
  | "PREPARING"      // Initial state
  | "ENCRYPTING"     // CoFHE encrypting prompt/key
  | "SUBMITTING"     // Sending storeKey tx + request to ICL
  | "QUORUM_FORMING" // ICL selecting quorum
  | "CLAIMING"       // Nodes claiming assignments
  | "PROCESSING"     // Leader running inference
  | "VERIFYING"      // Verifiers checking result
  | "COMPLETED"      // Consensus reached, result committed
  | "REJECTED"       // Consensus failed
  | "FAILED";        // All nodes failed or timeout
```

**CRITICAL**: The `FAILED` stage was added on 2026-05-24. It renders with a red AlertCircle and shows `failure_reason` text from the ICL response.

### 6.4 Status Timeline Visual States

```typescript
// StatusTimeline.tsx mapping
{
  "PREPARING":      { icon: Clock,        color: "text-yellow-500" },
  "ENCRYPTING":     { icon: Lock,         color: "text-blue-500" },
  "SUBMITTING":     { icon: Upload,       color: "text-blue-500" },
  "QUORUM_FORMING": { icon: Users,        color: "text-purple-500" },
  "CLAIMING":       { icon: Hand,         color: "text-yellow-500" },
  "PROCESSING":     { icon: Cpu,          color: "text-blue-500" },
  "VERIFYING":      { icon: ShieldCheck,  color: "text-yellow-500" },
  "COMPLETED":      { icon: CheckCircle,  color: "text-green-500" },
  "REJECTED":       { icon: XCircle,      color: "text-red-500" },
  "FAILED":         { icon: XCircle,      color: "text-red-500" },  // Same as REJECTED
}
```

### 6.5 useInferenceStatus Hook

```typescript
// Key fields returned:
interface InferenceStatus {
  stage: InferenceStage;
  requestId: string;
  taskId: string;
  status: "queued" | "accepted" | "rejected" | "failed";
  leaderAddress: string;
  verifierAddresses: string[];
  resultHash: string | null;
  outputCid: string | null;
  failureReason: string | null;  // NEW: shows why job failed
  nodeAssignments: Record<string, {
    status: "pending" | "claimed" | "completed" | "failed";
    claimedAt: string | null;
    completedAt: string | null;
    failureReason: string | null;
  }>;
  // ... other fields
}
```

---

## 7. Node Runtime (Blindference-node Package)

**This is a SEPARATE REPO**: `github.com/AbhishekPanwarr/Blindference-node`
**PyPI package**: `blindference-node` v0.3.2

See `Blindference-node/AGENTS.md` for complete node documentation. Summary:

### 7.1 Node Lifecycle

1. **`blindference-node init`** — Create wallet, detect GPU, save config
2. **`blindference-node attest --mock`** — Get attestation cert from ICL
3. **`blindference-node staking stake <amount>`** — Stake BLIND tokens (min 1000)
4. **`blindference-node run`** — Start daemon (heartbeat + job poller)
5. **`blindference-node staking unstake`** — Initiate unbonding (96h)
6. **`blindference-node staking withdraw`** — Complete withdrawal after unbonding

### 7.2 Node Configuration (Critical Env Vars)

| Variable | Required | Description |
|----------|----------|-------------|
| `BLF_PRIVATE_KEY` | For `init` (non-interactive) | Hex private key to import |
| `BLF_KEY_PASSWORD` | Yes | Keystore decryption password |
| `GROQ_API_KEY` | For Groq inference | Groq API key (NO QUOTES in .env!) |
| `GOOGLE_API_KEY` | For Gemini inference | Google AI API key |
| `BLF_ICL_ENDPOINT` | No (default: `https://icl.blindference.xyz`) | ICL base URL |
| `BLF_RPC_URL` | Yes | Arbitrum Sepolia RPC (Alchemy preferred) |
| `BLF_COFHE_ENDPOINT` | Yes | Arbitrum Sepolia RPC for CoFHE bridge |
| `BLF_COFHE_CHAIN_ID` | No (default: 421614) | Chain ID |
| `MOCK_ATTESTATION_KEY` | No (default: `weloveblindference`) | Mock attestation key |

### 7.3 Critical Bug Fixed: .env Quote Stripping

**Date**: 2026-05-24
**Issue**: `.env` files with quoted values (`GROQ_API_KEY="gsk_..."`) were parsed literally, including the quotes in the API key, causing Groq to return 401 "Invalid API Key".
**Fix**: Both the fallback `.env` parser in `cli.py` and `groq_backend.py` now strip matching single/double quotes.

```python
# In cli.py fallback parser AND groq_backend._get_api_key():
if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
    value = value[1:-1]
```

### 7.4 Node Job Execution Flow

```python
# handle_job() in job_handler.py
async def handle_job(assignment: dict, config, wallet, w3, icl, ipfs, cofhe):
    role = assignment.get("role", "leader")
    
    # 1. Claim assignment
    claim_result = await icl.claim_task(job_id, node_address)
    kp_high_handle = claim_result["kpHighHandle"]
    kp_low_handle = claim_result["kpLowHandle"]
    permit = claim_result["permit"]
    
    # 2. Decrypt key halves via CoFHE bridge
    high_decrypted = await cofhe.decrypt(kp_high_handle, permit)
    low_decrypted = await cofhe.decrypt(kp_low_handle, permit)
    
    # 3. Reconstruct AES key
    aes_key = reconstruct_key(high_decrypted, low_decrypted)
    
    # 4. Download encrypted blob from IPFS
    encrypted_blob = await ipfs.download(prompt_cid)
    
    # 5. Decrypt blob
    prompt = decrypt_prompt_blob(encrypted_blob, aes_key)
    
    # 6. Run inference
    result = run_deterministic_inference(model_id, prompt)
    
    # 7. Hash result for commitment
    commitment_hash = compute_commitment(result)
    
    if role == "leader":
        # 8a. Encrypt output
        output_key = generate_output_key()
        encrypted_output = encrypt_output_blob(result, output_key)
        
        # 9a. Split output key for CoFHE
        out_high, out_low = split_key_for_cofhe(output_key)
        
        # 10a. Store output key on-chain
        store_output_key(w3, config, wallet, job_id, out_high, out_low, user_address)
        
        # 11a. Upload encrypted output to IPFS
        output_cid = await ipfs.upload(encrypted_output)
        
        # 12a. Submit to ICL
        await icl.submit_leader_result(job_id, output_cid, commitment_hash, 
                                       out_high, out_low, tx_hash)
    else:
        # 8b. Verifier just submits verdict
        await icl.submit_verifier_verdict(job_id, commitment_hash, verdict="CONFIRM"|"REJECT")
```

---

## 8. Known Bugs, Workarounds, and Critical Decisions

### 8.1 PromptKeyStore Has No `grantDecryptAccess`

**Status**: DEPLOYED CONTRACT LIMITATION — CANNOT FIX WITHOUT REDEPLOYMENT
**Workaround**: `storeKey(allowedNodes=[...])` already grants all nodes access atomically. Do NOT try to call `grantDecryptAccess`.

### 8.2 CoFHE `InvalidSigner` on ICL storeKey

**Root cause**: Only the address that created the encrypted input can call `FHE.asEuint128()`.
**Fix**: Two-phase flow. Frontend calls `storeKey()` with user wallet, then confirms tx hash to ICL.

### 8.3 Verifiers Blocked by `leader_output_ready` Gate

**Status**: FIXED 2026-05-24
**Bug**: Verifiers were blocked from claiming until leader finished, preventing parallel inference.
**Fix**: Removed the gate from `_get_pending_assignments`. Verifiers now claim immediately and run in parallel.

### 8.4 Groq 401 Due to .env Quote Literal

**Status**: FIXED 2026-05-24
**Bug**: `GROQ_API_KEY="gsk_..."` in .env included literal quotes in the API key.
**Fix**: Quote stripping in both fallback parser and Groq backend.

### 8.5 PyPI Publish Required Trusted Publishing

**Status**: FIXED
**Setup**: GitHub Actions workflow `publish.yml` uses `pypa/gh-action-pypi-publish@release/v1` with `permissions: id-token: write`. The PyPI project must have a Trusted Publisher configured for the repo + workflow + environment.

### 8.6 Node Auto-Re-Attestation on ICL Reset

**Implementation**: If the ICL responds 401/404 (node unknown after restart), the node automatically re-attests before resuming polling. See `_re_attest()` in `node_loop.py`.

### 8.7 MongoDB BSON Int64 Overflow

**Workaround**: All `uint256` values (CoFPE handles) are stored as STRINGS in MongoDB, not integers. The `metadata.text_request.encrypted_prompt_key` fields coerce `high` and `low` to `str()` before insertion.

### 8.8 Frontend `.env` Variable Prefix

The frontend uses `VITE_` prefix for env vars (Vite convention):
- `VITE_ICL_BASE_URL=http://localhost:8000`
- `VITE_PROMPT_KEY_STORE_ADDRESS=0x1E22dD12f448B15f1Ca8560fB6B4463834FaAf73`

---

## 9. How to Run the Full Stack

### 9.1 Prerequisites

- Node.js 18+ with npm/pnpm
- Python 3.11+ with uv/pip
- MongoDB (local or Atlas)
- MetaMask with Arbitrum Sepolia
- Arbitrum Sepolia ETH (for gas)
- API keys: Groq, Google AI, Alchemy (for RPC)

### 9.2 Environment Files

**ICL `.env`** (`network/packages/icl/.env`):
```bash
# MongoDB
MONGODB_URL=mongodb://localhost:27017/blindference

# ICL wallet (for on-chain txs)
ICL_PRIVATE_KEY=0x...

# RPC
ARBITRUM_SEPOLIA_RPC=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY

# Contract addresses
PROMPT_KEY_STORE_ADDRESS=0x1E22dD12f448B15f1Ca8560fB6B4463834FaAf73
NODE_REGISTRY_ADDRESS=0x72C0Ead949Fd2C346598a30AF1A69c3c5Cb86082

# Optional demo operator keys (for bootstrap)
DEMO_OPERATOR_PRIVATE_KEY1=0x...
DEMO_OPERATOR_PRIVATE_KEY2=0x...
DEMO_OPERATOR_PRIVATE_KEY3=0x...
```

**Frontend `.env`** (`network/packages/frontend/.env`):
```bash
VITE_ICL_BASE_URL=http://localhost:8000
VITE_PROMPT_KEY_STORE_ADDRESS=0x1E22dD12f448B15f1Ca8560fB6B4463834FaAf73
VITE_NODE_REGISTRY_ADDRESS=0x72C0Ead949Fd2C346598a30AF1A69c3c5Cb86082
```

**Node `.env`** (at project root or `~/.blindference/.env`):
```bash
# NO QUOTES around values!
GROQ_API_KEY=gsk_YOUR_ACTUAL_KEY_WITHOUT_QUOTES
GOOGLE_API_KEY=AIza...
BLF_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
BLF_COFHE_ENDPOINT=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
BLF_KEY_PASSWORD=your_keystore_password
MOCK_ATTESTATION_KEY=weloveblindference
```

### 9.3 Start Commands

```bash
# Terminal 1: Start ICL
cd network/packages/icl
./.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000

# Terminal 2: Bootstrap demo nodes (optional)
curl -s -X POST http://127.0.0.1:8000/admin/bootstrap-demo-nodes \
  -H 'Content-Type: application/json' \
  -d '{"count":3}'

# Terminal 3: Start Node 1 (leader)
cd Blindference-node
source .env
export BLF_PRIVATE_KEY=$DEMO_OPERATOR_PRIVATE_KEY1
blindference-node init
blindference-node attest --mock
blindference-node run

# Terminal 4: Start Node 2 (verifier)
export BLF_PRIVATE_KEY=$DEMO_OPERATOR_PRIVATE_KEY2
blindference-node init
blindference-node attest --mock
blindference-node run

# Terminal 5: Start Node 3 (verifier)
export BLF_PRIVATE_KEY=$DEMO_OPERATOR_PRIVATE_KEY3
blindference-node init
blindference-node attest --mock
blindference-node run

# Terminal 6: Start Frontend
cd network/packages/frontend
npm install
npm run dev -- --host 127.0.0.1
```

Open http://localhost:3000, connect MetaMask to Arbitrum Sepolia, and submit an inference request.

---

## 10. Testing

### 10.1 ICL Tests

```bash
cd network/packages/icl
python -m pytest tests/ -q
# Expected: 13 passed
```

### 10.2 Node Tests

```bash
cd Blindference-node
python -m pytest tests/ -q
# Expected: 84 passed, 1 skipped
```

### 10.3 Contract Tests

```bash
cd network/packages/blindference-demo
forge test
```

---

## 11. Git Branches and Repos

| Repo | Branch | Purpose |
|------|--------|---------|
| `blindference` | `dev` | Active development. All ICL + frontend changes go here |
| `blindference` | `main` | Stable releases |
| `Blindference-node` | `main` | Node package. PyPI auto-publish on git tags |

**Recent commits** (as of 2026-05-24):
- `blindference/dev`: `8f95fec` — removed leader_output_ready gate from verifier poll
- `Blindference-node/main`: `c866d59` — strip quotes from .env values and Groq API key

---

## 12. Security Model

### 12.1 Tier System

| Tier | Attestation | Hardware | Trust |
|------|-------------|----------|-------|
| 0 | Mock (software) | None | Development only |
| 1 | TPM 2.0 | TPM chip | Hardware-bound identity |
| 2 | TEE (SGX/SEV) | Intel/AMD enclave | Confidential computing |

### 12.2 Slashing Conditions

- **Expired attestation**: Node cert older than expiry → inactive
- **Missed heartbeat**: No ICL heartbeat within 5 minutes → removed from pool
- **Bad inference**: Verifier consensus shows wrong result → stake slashed
- **Timeout**: Failed to submit within execution window → marked failed

### 12.3 Economic Security

- **Phase 4**: Nodes stake **BLIND tokens** (not ETH) via `BlindferenceStaking`
  - Minimum stake: **1000 BLIND**
  - Unbonding period: **96 hours**
  - Auto-slash at **3 consecutive failures**
- Leader gets higher reward but bears higher slashing risk
- Verifiers earn smaller rewards for honest validation
- Disputes trigger on-chain arbitration with USDC payouts
- **Phase 4 reward distribution**: Payment Service sends **1 BLIND per verified job**
  - Split: **60% leader, 20% each verifier** (2 verifiers assumed)
  - Source: Payment Service wallet BLIND balance (funded by deployer)

---

## 13. API Reference Summary

### 13.1 ICL Create Request (Frontend → ICL)

```http
POST /v1/inference/requests
Content-Type: application/json

{
  "developer_address": "0x...",
  "text_request": {
    "prompt_cid": "Qm...",
    "encrypted_prompt_key": {
      "high": "1234567890...",   // uint256 as string
      "low": "9876543210..."
    },
    "model_id": "groq:llama-3.3-70b-versatile",
    "coverage_enabled": false
  },
  "model_id": "groq:llama-3.3-70b-versatile",
  "verifier_count": 2,
  "min_tier": 0,
  "zdr_required": false,
  "metadata": {
    "prompt_key_store_tx": "0x..."  // Frontend's storeKey tx hash
  }
}
```

### 13.2 ICL Confirm Store Key

```http
POST /v1/inference/{request_id}/confirm-store-key
Content-Type: application/json

{
  "prompt_key_store_tx": "0x..."
}
```

### 13.3 Node Get Assignments

```http
GET /internal/assignments/{node_address}
```

Response:
```json
[
  {
    "jobId": "0xabc123...",
    "role": "leader",
    "promptCid": "Qm...",
    "kpHighHandle": "1234567890...",
    "kpLowHandle": "9876543210...",
    "permit": "base64_encoded_permit...",
    "modelId": "groq:llama-3.3-70b-versatile",
    "claimDeadline": "2026-05-24T12:00:00Z"
  }
]
```

### 13.4 Node Claim Task

```http
POST /internal/task/claim
Content-Type: application/json

{
  "jobId": "0xabc123...",
  "nodeAddress": "0x..."
}
```

### 13.5 Node Submit Leader Result

```http
POST /internal/task/result
Content-Type: application/json

{
  "jobId": "0xabc123...",
  "outputCid": "Qm...",
  "commitmentHash": "0x...",
  "encryptedOutputKeyHigh": "1234567890...",
  "encryptedOutputKeyLow": "9876543210...",
  "outputKeyStoreTx": "0x...",
  "verdict": "CONFIRM",
  "confidence": 95
}
```

### 13.6 Node Submit Verifier Verdict

```http
POST /internal/task/verify
Content-Type: application/json

{
  "jobId": "0xabc123...",
  "verifierAddress": "0x...",
  "commitmentHash": "0x...",
  "verdict": "CONFIRM",
  "confidence": 90
}
```

### 13.7 Payment Service — Reward Distribution (Phase 4)

```http
POST /v1/rewards/distribute
Content-Type: application/json

{
  "job_id": "0xabc123...",
  "leader_address": "0x...",
  "verifier_addresses": ["0x...", "0x..."],
  "amount_blind_wei": 1000000000000000000
}
```

Response:
```json
{
  "status": "distributed",
  "job_id": "0xabc123...",
  "total_amount_wei": "1000000000000000000",
  "distributions": [
    {
      "node": "0x...",
      "role": "leader",
      "amount_wei": "600000000000000000",
      "tx_hash": "0x...",
      "status": "success"
    },
    {
      "node": "0x...",
      "role": "verifier",
      "amount_wei": "200000000000000000",
      "tx_hash": "0x...",
      "status": "success"
    }
  ]
}
```

---

## 14. Data Models (Complete)

### 14.1 InferenceRequestRecord

See section 5.3 above.

### 14.2 QuorumAssignmentRecord

```python
class QuorumAssignmentRecord(BaseModel):
    request_id: str
    task_id: str
    leader_address: str
    verifier_addresses: list[str]
    candidate_addresses: list[str]  # Nodes considered but not selected
    created_at: datetime
```

### 14.3 VerifierVerdictRecord

```python
class VerifierVerdictRecord(BaseModel):
    request_id: str
    task_id: str
    verifier_address: str
    accepted: bool | None = None   # True = CONFIRM, False = REJECT
    confidence: int
    reason: str | None = None
    result_hash: str | None = None
    risk_score: int | None = None
    provider: str | None = None
    model: str | None = None
    summary: str | None = None
    created_at: datetime
    updated_at: datetime
```

### 14.4 QuorumCertificateRecord

```python
class QuorumCertificateRecord(BaseModel):
    request_id: str
    task_id: str
    model_id: str
    leader_address: str
    verifier_addresses: list[str]
    result_hash: str
    confirm_count: int
    reject_count: int
    aggregated_confidence: int
    accepted: bool
    chain_tx_hash: str
    created_at: datetime
```

### 14.5 OperatorRecord (Node Runtime)

```python
class OperatorRecord(BaseModel):
    operator_address: str
    model_tiers: list[int]
    supported_model_ids: list[str]
    location: str
    zdr_compliant: bool
    jurisdiction: str
    min_stake: int
    registered_at: datetime
    last_heartbeat: datetime
    attestation_type: str
    attestation_document_hash: str
    attestation_counterparty: str = "0x0000..."
    attestation_effective_at: int
    attestation_expires_at: int
    tasks_completed: int = 0
    tasks_accepted: int = 0
    tasks_rejected: int = 0
    active: bool = True
```

---

## 15. Reineira Protocol Integration

Blindference is built on the Reineira protocol infrastructure (https://reineira.xyz/):

- **Reineira SDK**: Used for commitment schemes, permit handling, and settlement
- **CoverageManager**: On-chain insurance for inference results
- **Dispute flow**: Results can be disputed within 72 hours, triggering re-execution
- **PayoutClaimer**: Automatic USDC payout on accepted results or successful disputes

The Reineira contracts provide:
- Escrow management for inference fees
- Slashing and reward distribution
- Dispute arbitration
- Coverage premium calculation

---

## 16. Fhenix CoFHE Integration

Blindference uses Fhenix CoFHE (Confidential FHE) for key access control:

- **Browser SDK**: `@cofhe/sdk` for client-side encryption
- **Node Bridge**: `@cofhe/sdk/node` via TypeScript subprocess
- **ACL Model**: Only the encrypting address has access. Sharing permits delegate access to recipients.
- **Threshold Network**: `decryptForView()` calls the Fhenix threshold network via `/v2/sealoutput`

**Critical Fhenix Rule**: `decryptForView` uses the threshold network `/v2/sealoutput` path. The threshold network checks whether the permit issuer has ACL access to that ciphertext handle. A sharing permit delegates existing issuer access to a recipient. A sharing permit does NOT create ciphertext access by itself.

This is why `BlindferenceInputVault` exists — it creates on-chain ACL access by accepting encrypted inputs and calling `FHE.allowThis()` + `FHE.allow(msg.sender)`.

---

## 17. License and Contributing

- **License**: MIT
- **Contributing**: See `CONTRIBUTING.md` (if exists)
- **Contact**: https://blindference.xyz, Twitter @blindference

---

## 18. Last Updated

This document was last updated on **2026-05-24** after the following changes:

### Phase 4 — Node Staking with BLIND Token
- Deployed & verified `BlindferenceStaking.sol` at `0x222Ac74201Ed58915e42Ee5be626d939fd234D0b`
- Added `blindference-node staking` CLI commands: `stake`, `unstake`, `withdraw`, `status`
- Implemented ICL soft slashing: exclude nodes with ≥3 failures from quorum selection
- Implemented hard slashing: auto-slash entire stake at 3 consecutive failures via on-chain `recordFailure()`
- Added `BlindferenceStakingClient` in ICL (`network/packages/icl/chain/blindference_staking.py`)
- Added Payment Service reward distribution: `POST /v1/rewards/distribute` (1 BLIND/job, 60/20/20 split)
- Added staking documentation to frontend `NodeRegistrationPage.tsx`

### Previous Fixes (same day)
- Removed `leader_output_ready` gate from verifier assignment poll
- Added per-node assignment tracking with 5-minute timeout
- Added `FAILED` stage to frontend status display
- Fixed Groq API key quote stripping bug
- Fixed `.env` fallback parser quote stripping
- Published `blindference-node` v0.3.2 to PyPI
- All tests passing (13 ICL, 84 node, 10 contracts)
