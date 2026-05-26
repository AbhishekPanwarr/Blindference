# Blindference Architecture

This document explains how Blindference works under the hood. It is written for developers, researchers, and operators who want to understand the system design, security properties, and economic model.

---

## Table of Contents

- [System Overview](#system-overview)
- [Components](#components)
  - [Frontend](#frontend)
  - [Inference Coordination Layer (ICL)](#inference-coordination-layer-icl)
  - [Payment Service](#payment-service)
  - [Compute Nodes](#compute-nodes)
  - [Smart Contracts](#smart-contracts)
- [Execution Flows](#execution-flows)
  - [Text Inference (ICL Mode)](#text-inference-icl-mode)
  - [Risk Scoring (ICL Mode)](#risk-scoring-icl-mode)
  - [On-Chain Mode](#on-chain-mode)
- [Privacy Model](#privacy-model)
- [Quorum Consensus](#quorum-consensus)
- [Security Model](#security-model)
- [Economic Model](#economic-model)

---

## System Overview

Blindference is a decentralised network for private AI inference. It sits between users who want to run models on sensitive data and compute providers who want to earn rewards for running them. The system guarantees three properties:

1. **Input privacy** — The user's prompt or data is encrypted before it leaves their device.
2. **Execution integrity** — A quorum of independent nodes runs the same inference and cross-validates the result.
3. **Economic accountability** — Payment is held in escrow until the quorum agrees, and bad behaviour is financially penalised.

The network runs on **Arbitrum Sepolia** for on-chain settlement and uses **Fhenix CoFHE** for confidential access control. Off-chain inference is performed through hosted APIs (Groq, Google Gemini) or local models (vLLM).

---

## Components

### Frontend

The frontend is a React application that runs entirely in the user's browser. It is the only component that ever sees plaintext prompts or answers.

**Responsibilities:**

- **Wallet connection** — MetaMask via wagmi/viem on Arbitrum Sepolia.
- **Local encryption** — AES-256-GCM for text prompts; CoFHE encryption for structured risk features.
- **Quorum preview** — Calls the ICL to preview which nodes will be assigned before the user pays.
- **Key storage** — For text inference, splits the AES key into two halves, CoFHE-encrypts each half, and stores them in the `PromptKeyStore` contract.
- **Request submission** — Sends encrypted inputs, permits, and payment preferences to the ICL.
- **Status polling** — Polls the ICL and Payment Service for quorum progress and result status.
- **Output decryption** — Retrieves the output key from `PromptKeyStore`, decrypts the answer, and displays it.

**Key directories:**

- `network/packages/frontend/src/pages/` — Inference UI, credit purchase, status pages.
- `network/packages/frontend/src/hooks/` — CoFHE client, encryption utilities, wallet hooks.
- `network/packages/frontend/src/utils/` — AES key generation, IPFS upload, permit creation.

### Inference Coordination Layer (ICL)

The ICL is a FastAPI service that coordinates the lifecycle of an inference job. It does not perform inference itself and cannot decrypt any data.

**Responsibilities:**

- **Request validation** — Checks encrypted inputs, model ID, and coverage preferences.
- **Quorum selection** — Picks 1 leader and 2 verifiers from the active, attested node pool based on reputation and tier.
- **Task dispatch** — Pushes tasks to node callback servers with role assignments and permits.
- **Result aggregation** — Collects leader results and verifier verdicts.
- **Consensus enforcement** — 2/3 hash match = accepted; <2/3 = rejected.
- **On-chain commitment** — Writes accepted results to `ResultRegistry`.
- **Notification** — Notifies the Payment Service of job completion so rewards can be distributed.

**Key files:**

- `network/packages/icl/routers/inference.py` — REST endpoints for job submission and status.
- `network/packages/icl/routers/internal.py` — Node-facing endpoints (assignments, heartbeats).
- `network/packages/icl/services/quorum_service.py` — Quorum selection, dispatch, and aggregation logic.
- `network/packages/icl/services/chain_service.py` — Web3 contract interactions.

**Database collections:**

- `inference_requests` — Job state and metadata.
- `quorum_assignments` — Leader/verifier mappings.
- `operators` — Registered nodes with attestation and reputation data.
- `verifier_verdicts` — Individual verifier submissions.

### Payment Service

The Payment Service is a FastAPI service that handles all financial operations: credit balances, escrow creation, insurance, and reward distribution.

**Responsibilities:**

- **Credit management** — Tracks user balances in cUSDC and BLIND tokens.
- **Job pricing** — Calculates fees based on model, coverage, and quorum tier.
- **Escrow creation** — Builds Reineira ConfidentialEscrows for direct-cUSDC jobs.
- **Completion callback** — Listens for ICL job completion and triggers payment release.
- **Reward distribution** — Sends BLIND rewards to nodes (60% leader, 20% each verifier).
- **Insurance** — Collects 2% premiums, manages dispute windows, and processes claims.

**Payment modes:**

- **Credit mode** — Deducts from pre-purchased credit balance. Faster, no per-job MetaMask popups.
- **Direct mode** — Creates a Reineira escrow for each job. More decentralised, requires per-job approval.

### Compute Nodes

Compute nodes are the workers that perform inference. Anyone with a GPU-capable machine and a wallet can run one. Nodes are event-driven: they register a callback URL with the ICL and receive tasks via HTTP push.

**Responsibilities:**

- **Attestation** — Submits a cryptographic attestation to the ICL on startup (mock TEE for testnet, TPM/TEE for production).
- **Heartbeat** — Sends a liveness signal every 60 seconds.
- **Task execution** — Receives assignments, decrypts inputs, runs inference, submits results.
- **CoFHE decryption** — Uses the Fhenix CoFHE bridge to decrypt prompt keys or structured features.
- **On-chain submission** — In on-chain mode, posts commitment hashes directly to the `BlindferenceInference` contract.

**Supported inference backends:**

- **Groq** — `llama-3.3-70b-versatile` and other frontier models via API.
- **Google Gemini** — `gemini-2.5-flash` and other Gemini models via API.
- **Local vLLM** — Self-hosted models for operators who want to run their own hardware.

**Standalone package:** `pip install blindference-node`

### Smart Contracts

All contracts are deployed on **Arbitrum Sepolia**.

#### Core Protocol

| Contract | Purpose |
|----------|---------|
| `NodeRegistry` | Operator registration, attestation, tier, and heartbeat tracking. |
| `PromptKeyStore` | Stores CoFHE-encrypted AES key halves. Enforces ACL: only assigned nodes can decrypt. |
| `ResultRegistry` | Records accepted inference outcomes with commitment hashes for audit. |
| `BlindferenceStaking` | BLIND token staking. Minimum 1000 BLIND. 96-hour unbond. Auto-slash at 3 consecutive failures. |
| `RewardAccumulator` | Tracks earned rewards per operator. Nodes claim when ready. |

#### Settlement & Insurance

| Contract | Purpose |
|----------|---------|
| `PayoutClaimer` | Reineira escrow resolver. Automatically distributes cUSDC to leader and verifiers on quorum consensus. |
| `BlindferencePolicyAdapter` | Insurance policy adapter. Calculates premiums and manages coverage pools. |

#### On-Chain Inference

| Contract | Purpose |
|----------|---------|
| `BlindferenceInference` (proxy) | On-chain quorum consensus. Accepts job submissions, emits `NodesAssigned`, enforces commit/reveal deadlines, auto-payouts. |
| `InferenceGate` | Access control for on-chain jobs. Validates model permissions and node eligibility. |
| `BlindferenceInputVault` | On-chain FHE input validation. Grants ACL access so nodes can decrypt browser-generated ciphertexts. |

#### Tokens

| Contract | Purpose |
|----------|---------|
| `BLIND Token` | ERC-20 utility token for staking, payments, and rewards. |

---

## Execution Flows

### Text Inference (ICL Mode)

This is the default flow for natural language prompts.

```
1. User types a confidential prompt in the browser.
2. Browser generates an AES-256 key and encrypts the prompt locally.
3. Encrypted blob is uploaded to Pinata IPFS. The IPFS CID is recorded.
4. AES key is split into two uint128 halves.
5. Each half is CoFHE-encrypted in the browser.
6. User signs a MetaMask transaction to store both halves in PromptKeyStore,
   gated to the future quorum nodes.
7. User submits the job to the ICL, referencing the CID and the key store handles.
8. ICL validates the request, selects 1 leader + 2 verifiers, and dispatches tasks.
9. Each node receives its role, permit, and task metadata.
10. Nodes call PromptKeyStore to decrypt their assigned key half via CoFHE ACL.
11. Nodes download the encrypted blob from IPFS.
12. Nodes combine key halves, decrypt the blob, and run inference via Groq/Gemini.
13. Leader submits a result hash + an output key (for the user) to the ICL.
14. Verifiers submit verdicts: match or no-match against the leader hash.
15. ICL waits for all verdicts.
    - If 2/3 match → status = ACCEPTED. ICL commits result to ResultRegistry.
      Payment Service distributes rewards.
    - If <2/3 match → status = REJECTED. Payment Service refunds or triggers dispute.
16. Frontend polls status, sees ACCEPTED.
17. Frontend requests the output key from PromptKeyStore (user-only ACL).
18. Frontend downloads the encrypted output blob from IPFS.
19. Frontend decrypts and displays the answer. Only the user ever sees it.
```

### Risk Scoring (ICL Mode)

This flow is for structured financial data (credit scores, loan amounts, etc.).

```
1. User enters structured features in the browser (credit score, loan amount, etc.).
2. Browser CoFHE-encrypts each feature directly via @cofhe/sdk.
3. User creates one sharing permit per quorum node.
4. User submits encrypted features + permits to the ICL.
5. ICL selects quorum and dispatches.
6. Nodes import their sharing permit and decrypt features via CoFHE.
7. Nodes run the risk model (a deterministic classification or regression).
8. Leader submits result hash; verifiers cross-validate.
9. Consensus and settlement proceed exactly like text inference.
```

### On-Chain Mode

In on-chain mode, the ICL is bypassed for dispatch and consensus. The smart contract enforces deadlines and payouts directly.

```
1. User submits a job directly to the BlindferenceInference contract via MetaMask.
2. Contract emits a NodesAssigned event with the task ID and assigned nodes.
3. Nodes listen for the event via WebSocket or polling.
4. Nodes decrypt inputs and run inference.
5. Nodes post commitment hashes directly to the contract within the commit window (600s).
6. After the reveal window (600s), the contract checks for 2/3 consensus.
7. If consensus is reached, the contract auto-distributes rewards from the escrow.
8. User polls the contract for status and decrypts the result locally.
```

On-chain mode is slower but fully decentralised. No single coordinator can censor or reorder jobs.

---

## Privacy Model

Blindference uses two layers of encryption depending on the data type.

### Text Prompts: AES-256 + CoFHE ACL

- **Why AES?** CoFHE encrypts numbers, not free-form text. AES handles arbitrary-length strings efficiently.
- **Why split the key?** The AES key is split into two uint128 halves so each half can be CoFHE-encrypted and stored in the `PromptKeyStore` contract. The contract enforces that only the assigned leader and verifiers can request decryption of each half.
- **Why IPFS?** The encrypted blob is public (anyone can fetch it), but unreadable without the AES key. Only the quorum can reconstruct the key.
- **Output protection** — The leader encrypts the answer with a fresh AES key and stores it in `PromptKeyStore` with user-only ACL. Even the leader cannot read the final output.

### Structured Features: Pure CoFHE

- Numeric features are CoFHE-encrypted directly in the browser as `euint32`, `euint64`, etc.
- The `BlindferenceInputVault` contract validates and stores them, granting ACL access to the user's wallet.
- Nodes receive sharing permits and decrypt via `decryptForView().withPermit()`.
- No AES layer is needed because the data is already numeric.

### Threat: ICL Compromise

The ICL never receives encryption keys. It only coordinates. Even a fully compromised ICL cannot decrypt user data because the CoFHE threshold network enforces ACL checks independently.

### Threat: Node Collusion

If two nodes collude, they still cannot reconstruct the full AES key unless they also compromise the third node or the CoFHE threshold network. The 2/3 quorum requires agreement, so a single honest verifier can detect and reject a bad result.

---

## Quorum Consensus

**Default topology:** 1 leader + 2 verifiers.

**Selection criteria:**
- Nodes must be attested and within heartbeat grace period.
- Nodes are ranked by reputation score (tasks completed, slashes avoided).
- Higher-tier nodes (TEE-attested) are preferred for sensitive jobs.
- Randomisation prevents predictable assignment patterns.

**Consensus rules:**

| Verdicts | Outcome | Action |
|----------|---------|--------|
| Leader + 1 verifier match | **ACCEPTED** | Commit to ResultRegistry, distribute rewards |
| Leader + 0 verifiers match | **REJECTED** | Refund or dispute |
| Leader disagrees with both | **REJECTED** | Leader may be slashed, dispute opened |

**Timeouts:**
- Execution commit window: 600 seconds.
- Execution reveal window: 600 seconds.
- Dispute deadline: 72 hours from job creation.

---

## Security Model

### Threat: Malicious Leader

A leader could return a fake result hash. Verifiers independently run the same inference with the same inputs. If the leader's hash does not match, verifiers reject. With <2/3 consensus, the job is rejected and the leader may be slashed.

### Threat: Compromised Node

Nodes must re-attest periodically. A compromised node will fail attestation (mock TEE checks for testnet, real TPM/TEE for production) and be excluded from quorum selection. Consecutive failures trigger automatic slashing.

### Threat: Front-End XSS

All encryption happens in the browser before any DOM rendering. Encryption keys are ephemeral (one per request) and never stored in `localStorage` or cookies.

### Threat: Sybil Attack

Running many cheap nodes is economically discouraged by the staking requirement (1000 BLIND minimum) and the reputation system. New nodes start at the lowest tier and must complete successful jobs to improve their score.

---

## Economic Model

### Fees

Users pay per inference job. The fee depends on:
- **Model** — Frontier models (Groq, Gemini) cost more than local models.
- **Coverage** — Optional insurance adds a 2% premium.
- **Quorum tier** — Higher-tier nodes (TEE-attested) command a premium.

### Payment Methods

- **cUSDC** — Confidential USDC via Reineira escrow. Direct, per-job.
- **BLIND tokens** — Bulk credit packages at a 20% discount vs. cUSDC.
- **Credits** — Pre-purchased balance. Fastest, no per-job MetaMask popups.

### Reward Distribution (per accepted job)

| Recipient | Share | Purpose |
|-----------|-------|---------|
| Leader | 60% | Primary compute + output key storage |
| Verifier 1 | 20% | Cross-validation |
| Verifier 2 | 20% | Cross-validation |

### Staking & Slashing

- **Minimum stake:** 1000 BLIND tokens.
- **Unbond period:** 96 hours. Funds are locked after unstaking.
- **Slashing conditions:**
  - 3 consecutive failed jobs → 10% of stake burned.
  - Verdict manipulation detected on-chain → 25% of stake burned.
  - Failure to heartbeat within grace period → Temporary exclusion from quorum.

### Insurance

- **Premium:** 2% of job fee.
- **Coverage:** Full job fee refund if quorum rejects the result.
- **Dispute window:** 72 hours.
- **Claim process:** User submits evidence to the PayoutClaimer contract. If the quorum record shows rejection, the contract auto-releases the payout.

---

## Deployment Boundaries

```
Frontend (Browser)
  ├── HTTPS ──> ICL (FastAPI)
  ├── MetaMask ──> Core Registries (Arbitrum Sepolia)
  └── HTTPS ──> Pinata IPFS

ICL (FastAPI)
  ├── HTTPS ──> Node Runtimes (Compute Providers)
  ├── JSON-RPC ──> Core Registries (Arbitrum Sepolia)
  └── HTTPS ──> Payment Service (FastAPI)

Node Runtime
  ├── HTTPS ──> ICL (assignments, heartbeats)
  ├── MetaMask/CoFHE ──> PromptKeyStore / InputVault
  ├── HTTPS ──> Pinata IPFS (blob download)
  └── HTTPS ──> Groq / Gemini (model APIs)
```

All on-chain interactions use Arbitrum Sepolia. CoFHE threshold network calls use Fhenix testnet endpoints. IPFS storage uses Pinata.
