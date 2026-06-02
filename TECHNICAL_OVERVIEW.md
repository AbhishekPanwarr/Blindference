# Blindference — Complete Technical Overview

> **Confidential AI Inference Protocol**
> 
> Encrypted inputs. Quorum-verified outputs. Confidential payments.
> No trusted coordinator. No exposed data.

---

## Table of Contents

1. [Project Mission](#1-project-mission)
2. [System Architecture](#2-system-architecture)
3. [Core Components](#3-core-components)
4. [Data Flow](#4-data-flow)
5. [Smart Contracts](#5-smart-contracts)
6. [Roles & Actors](#6-roles--actors)
7. [APIs & Interfaces](#7-apis--interfaces)
8. [Security Model](#8-security-model)
9. [Testing & Validation](#9-testing--validation)
10. [Deployment](#10-deployment)
11. [Repositories & Packages](#11-repositories--packages)
12. [Environment & Configuration](#12-environment--configuration)
13. [Known Limitations](#13-known-limitations)
14. [Roadmap](#14-roadmap)

---

## 1. Project Mission

Blindference is a **confidential AI inference protocol** that enables users to run Large Language Model (LLM) queries on **sensitive private data** without ever exposing that data to:

- The model provider (OpenAI, Groq, Gemini)
- The protocol operator
- The public blockchain
- Individual quorum nodes (each node sees only a fragment)

### How It Works (High-Level)

1. **User encrypts** features (credit score, loan amount, etc.) in their browser using Fhenix CoFHE
2. **ICL selects a quorum** of 3 nodes (1 leader + 2 verifiers) from the staked node pool
3. **Each node decrypts** via a CoFHE sharing permit, runs inference, hashes the result
4. **ICL aggregates** leader + verifier outputs — if quorum agrees, commits accepted result on-chain
5. **Payment settles** via 3 confidential Reineira escrows (leader 60%, each verifier 20%)
6. **User receives** the decrypted output via the leader's IPFS CID

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER BROWSER                               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ MetaMask    │  │ CoFHE SDK    │  │ React/Vite Frontend      │   │
│  │ (wallet)    │  │ (encrypt)    │  │ (UI + polling)           │   │
│  └──────┬──────┘  └──────┬───────┘  └────────────┬─────────────┘   │
└─────────┼────────────────┼───────────────────────┼─────────────────┘
          │                │                       │
          │  tx signature  │  encrypted payload    │  HTTP
          ▼                ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    INFERENCE COORDINATION LAYER (ICL)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ Quorum       │  │ Task         │  │ Result                   │   │
│  │ Selection    │  │ Dispatch     │  │ Aggregation              │   │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬──────────────┘   │
│         │                 │                       │                   │
│         └─────────────────┴───────────────────────┘                   │
│                            FastAPI (Python)                          │
│                            Supabase (PostgreSQL)                     │
└─────────────────────────────────────────────────────────────────────┘
          │                │                       │
          │  push task     │  push task            │  callback
          ▼                ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         NODE RUNTIMES (×3)                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Node 1 (Leader)          Node 2 (Verifier)  Node 3 (V)   │   │
│  │  ┌─────────────┐          ┌─────────────┐   ┌───────────┐ │   │
│  │  │ CoFHE Decrypt│          │ CoFHE Decrypt│   │ CoFHE Dec.│ │   │
│  │  │ Groq/Gemini  │          │ Groq/Gemini  │   │ Groq/Gem.│ │   │
│  │  │ Result Hash  │          │ Result Hash  │   │ Res. Hash│ │   │
│  │  └──────┬───────┘          └──────┬───────┘   └─────┬─────┘ │   │
│  └─────────┼─────────────────────────┼─────────────────┼───────┘   │
└────────────┼─────────────────────────┼─────────────────┼───────────┘
             │                         │                 │
             └─────────────┬───────────┴─────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        BLOCKCHAIN (Arbitrum Sepolia)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ ResultRegistry│  │ Blindference │  │ Reineira Escrow        │   │
│  │ (commit results)│  │ Staking      │  │ (confidential payment) │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐                                  │
│  │ InferenceGate │  │ Blindference │                                  │
│  │ (escrow unlock)│  │ Inference   │  (on-chain consensus mode)       │
│  └──────────────┘  └──────────────┘                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Components

### 3.1 Frontend (`network/packages/frontend/`)

**Stack:** React 18, TypeScript, Vite, Tailwind CSS, wagmi/viem, shadcn/ui

**Key Files:**
- `src/App.tsx` — Main router, navbar with logo, TutorialManager
- `src/pages/InferenceNewPage.tsx` — Primary inference submission flow
- `src/hooks/useCofheClient.ts` — CoFHE browser client initialization
- `src/utils/encryption.ts` — Feature encryption (credit score, loan amount, account age, defaults)
- `src/api/inferenceApi.ts` — HTTP client for ICL communication
- `src/components/chat/ChatInterface.tsx` — Chat UI with ☁️ICL / ⛓On-Chain toggle
- `src/lib/inputVault.ts` — BlindferenceInputVault interaction for ACL grant

**Features:**
- **Wallet connection** via wagmi (MetaMask, WalletConnect)
- **CoFHE encryption** — 4 numeric features encrypted with threshold FHE
- **Quorum preview** — calls `/v1/inference/quorum-preview` to show nodes before payment
- **Per-node permit creation** — one sharing permit per quorum member
- **Live status polling** — 3-second interval, shows leader + verifier progress
- **Text-mode rejection UI** — displays leader output preview, per-node verdicts, dispute button
- **Coverage toggle** — optional insurance purchase during job submit
- **Brand theme** — violet-indigo (`#8B5CF6` primary), logo in navbar/footer/chat button

**Build:** Vite with manual chunk splitting (vendor-react/ui/web3/crypto/utils) — 44s production build

---

### 3.2 ICL — Inference Coordination Layer (`network/packages/icl/`)

**Stack:** Python 3.13, FastAPI, Pydantic, Supabase (PostgreSQL), Web3.py

**Key Files:**
- `main.py` — FastAPI application bootstrap, health checks
- `routers/inference.py` — Job submission, quorum preview, status polling
- `routers/operators.py` — Node operator registration, staking info
- `routers/internal.py` — Node callbacks (task assignment, result submission)
- `services/quorum_service.py` — Quorum selection, task dispatch, result aggregation
- `services/chain_service.py` — On-chain transaction submission (ResultRegistry, staking)
- `services/node_selector.py` — Tier-based node selection with geographic diversity
- `services/verdict_aggregator.py` — Leader/verifier output comparison
- `models/db_models.py` — Pydantic models for Supabase schema
- `db/database.py` — Async Supabase client wrapper

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service + DB + chain health check |
| POST | `/v1/inference/quorum-preview` | Preview available quorum for a model |
| POST | `/v1/inference/request` | Submit encrypted inference job |
| GET | `/v1/inference/request/{job_id}/status` | Poll job status |
| POST | `/v1/inference/request/{job_id}/dispute` | File a dispute |
| POST | `/admin/bootstrap-demo-nodes` | Seed demo operators |
| POST | `/internal/task` | Node runtime callback (task assignment) |
| POST | `/internal/result` | Node runtime callback (result submission) |

**Database Schema (Supabase):**

| Table | Purpose |
|-------|---------|
| `inference_requests` | Job records (status, features, permits, results) |
| `quorum_assignments` | Quorum member assignments per job |
| `verifier_verdicts` | Per-verifier acceptance/rejection records |
| `credits` | User balances (cUSDC + BLIND) |
| `transactions` | Payment history |
| `jobs` | Payment service job records |
| `operators` | Registered node operators |

**Quorum Selection Algorithm:**
1. Filter nodes by minimum tier requirement
2. Check staking balance > minimum stake
3. Apply geographic diversity (different regions if possible)
4. Random selection weighted by stake amount
5. Assign 1 leader + N verifiers

---

### 3.3 Node Runtime (`network/packages/node-reineira/`)

**Stack:** Python 3.13 (worker + server), Node.js 20 (CoFHE bridge), Docker-ready

**Key Files:**
- `src/blindference_node/cli.py` — Entry point, `start`/`register`/`status` commands
- `src/blindference_node/server.py` — FastAPI callback server (receives tasks from ICL)
- `src/blindference_node/worker.py` — Task processing, inference execution
- `src/blindference_node/cofhe_bridge.py` — Python wrapper for JS CoFHE bridge
- `src/blindference_node/event_listener.py` — Contract event polling (on-chain mode)
- `src/blindference_node/onchain_submitter.py` — Direct contract submission (on-chain mode)
- `src/blindference_node/contract_dispatch.py` — Event → worker bridge
- `scripts/cofhe_bridge.mjs` — Node.js CoFHE decrypt bridge using `@cofhe/sdk`

**Architecture:**
```
┌─────────────────┐
│  ICL pushes    │
│  task via HTTP  │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Callback Server │  (FastAPI, port configurable)
│  POST /internal/task │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Worker Queue   │  (asyncio queue)
└────────┬────────┘
         ▼
┌─────────────────┐
│  CoFHE Bridge   │  (Node.js subprocess)
│  Import permit  │
│  decryptForView │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Inference        │
│  Groq / Gemini    │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Hash result    │
│  Submit to ICL  │
└─────────────────┘
```

**PyPI Package:** `blindference-node`
```bash
pip install blindference-node
blindference-node start
```

**Environment Variables:**
```bash
BLINDFERENCE_NODE_OPERATOR_KEY=0x...
BLINDFERENCE_NODE_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/...
BLINDFERENCE_NODE_CALLBACK_PORT=9101
BLINDFERENCE_NODE_CALLBACK_URL=http://host:9101
BLINDFERENCE_NODE_MODELS=groq:llama-3.3-70b-versatile,gemini:gemini-2.5-flash
```

---

### 3.4 Payment Service (`network/packages/payment/`)

**Stack:** Python 3.13, FastAPI, Supabase, Web3.py, Reineira SDK (Node.js)

**Key Files:**
- `main.py` — FastAPI app, health endpoint
- `services/job_service.py` — Job lifecycle: submit, track, complete, settle
- `services/credit_service.py` — Credit balance management, atomic deduct/refund
- `services/chain_service.py` — On-chain interactions (escrow, BLIND transfers)
- `scripts/complete_job.ts` — **Unified on-chain settlement script** (all wallet ops in one process)

**Payment Flow:**

```
1. User calls POST /v1/jobs/submit
   ├── Atomic credit deduction (cUSDC + BLIND)
   ├── Create job record in Supabase
   └── Forward to ICL

2. ICL completes inference
   └── Calls POST /v1/jobs/{id}/complete

3. Payment Service settles:
   ├── (success) Unified settlement script:
   │   ├── BLIND transfers to 3 nodes (60/20/20)
   │   ├── Create 3 Reineira escrows (60/20/20)
   │   ├── Fund 3 escrows
   │   └── Redeem 3 escrows
   ├── Reset node failure counters
   └── Update job status = COMPLETED

4. (failure/timeout)
   └── Refund credits to user
```

**Unified Settlement Script** (`scripts/complete_job.ts`):
- Single Node.js process handles ALL wallet operations
- Eliminates nonce collisions between Web3.py and Reineira SDK
- Sequential execution: BLIND transfers → escrow create/fund → escrow redeem
- JSON output with full transaction details

---

### 3.5 Smart Contracts (`network/packages/contracts/`)

**Framework:** Foundry (Solidity 0.8.28)

**Core Contracts:**

| Contract | Address (Arbitrum Sepolia) | Purpose |
|----------|---------------------------|---------|
| `ResultRegistry` | `0xCebd831eCd00915E299b8Ef2666cAbf942dc7150` | Commits accepted/rejected inference results |
| `BlindferenceStaking` | Deployed | Node operator staking and slashing |
| `BlindferenceInference` (proxy) | `0x98b08590D1CB28E6687eFea59A32BE8B16571C86` | On-chain inference job creation |
| `BlindferenceInferenceGate` | `0x6a3fA63542d0b69937949372c11348A9EE3f6459` | Escrow unlock condition resolver |
| `PayoutClaimer` v3 | `0xA27b6C2b21E09F703b4be3ce70E7433B1F4210B3` | Simplified escrow redemption |
| `BlindferenceInputVault` | `0x8dD7B2A9B69C76A69d33B2DF46426Cbe657a902b` | Grants ACL access for encrypted inputs |

**ResultRegistry Functions:**
```solidity
function commitResult(
    bytes32 taskId,
    bytes32 resultHash,
    address leader,
    address[] calldata verifiers,
    uint8 confirmCount,
    uint8 rejectCount,
    uint8 aggregatedConfidence,
    bytes32 modelId
) external onlyIclService;

function isConditionMet(bytes32 taskId, uint8 minConfidence, uint8 minConfirmations) 
    external view returns (bool);
```

**PayoutClaimer v3 (Simplified):**
```solidity
function redeem(uint256 escrowId, bytes32 jobId) external;
function onConditionSet(uint256 escrowId, bytes calldata data) external;
function isConditionMet(uint256 escrowId) external view returns (bool);
event Claimed(uint256 indexed escrowId, bytes32 indexed jobId, address indexed leader);
```

---

## 4. Data Flow

### 4.1 ICL Mode (☁️) — Complete Flow

```
┌────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ User   │───▶│ Frontend │───▶│   ICL    │───▶│  Nodes   │───▶│  Chain   │
│ Browser│◀───│ (React)  │◀───│ (FastAPI)│◀───│ (Python) │◀───│ (Solidity)│
└────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │              │              │              │              │
     │ 1. Connect   │              │              │              │
     │    wallet    │              │              │              │
     │─────────────▶│              │              │              │
     │              │              │              │              │
     │ 2. Encrypt   │              │              │              │
     │    features  │              │              │              │
     │  (CoFHE)     │              │              │              │
     │              │              │              │              │
     │ 3. Preview   │              │              │              │
     │    quorum    │              │              │              │
     │─────────────▶│─────────────▶│              │              │
     │◀─────────────│◀─────────────│              │              │
     │              │              │              │              │
     │ 4. Create    │              │              │              │
     │    permits   │              │              │              │
     │  (1 per node)│              │              │              │
     │              │              │              │              │
     │ 5. Submit job│             │              │              │
     │ + pay cUSDC  │─────────────▶│─────────────▶│              │
     │              │              │              │              │
     │              │ 6. Poll      │              │              │
     │              │    status    │              │              │
     │              │◀─────────────│              │              │
     │              │              │              │              │
     │              │              │ 7. Push task │              │
     │              │              │    to nodes  │─────────────▶│
     │              │              │              │              │
     │              │              │              │ 8. Decrypt  │
     │              │              │              │    + infer  │
     │              │              │              │              │
     │              │              │ 9. Submit    │              │
     │              │              │◀─────────────│              │
     │              │              │    results   │              │
     │              │              │              │              │
     │              │              │ 10. Aggregate│              │
     │              │              │    + commit  │─────────────▶│
     │              │              │              │              │
     │              │              │ 11. Settle   │              │
     │              │              │    payment   │              │
     │              │              │─────────────▶│              │
     │              │              │ (3 escrows)   │              │
     │              │              │              │              │
     │ 12. Show     │              │              │              │
     │     result   │              │              │              │
     │◀─────────────│              │              │              │
```

### 4.2 On-Chain Mode (⛓) — Complete Flow

```
User ──▶ BlindferenceInference.createJob() ──▶ Contract emits NodesAssigned
                                                  │
                                                  ▼
                                         Node Event Listeners
                                         (event_listener.py)
                                                  │
                                                  ▼
                                         Node processes job
                                         (same decrypt + infer flow)
                                                  │
                                                  ▼
                                         Node submits to contract
                                         (onchain_submitter.py)
                                                  │
                                                  ▼
                                         Contract auto-verifies
                                         + auto-payouts
                                                  │
                                                  ▼
                                         User polls contract
                                         for final status
```

---

## 5. Smart Contracts

### 5.1 Contract Inventory

#### ResultRegistry
- **Purpose:** Authoritative on-chain record of inference outcomes
- **Access Control:** Only ICL service address can commit results
- **Key Data:**
  - `results[taskId]` → `InferenceResult` struct
  - `taskExists[taskId]` → bool
  - `developerByTask[taskId]` → address (for disputes)
- **Dispute Window:** 72 hours after commitment
- **Events:** `ResultCommitted`, `ResultRejected`, `DisputeSubmitted`, `DisputeResolved`

#### BlindferenceInference (On-Chain Mode)
- **Purpose:** Fully decentralized inference without ICL
- **Flow:**
  1. `createJob(encryptedInputs, modelId, permit)` — user calls directly
  2. Contract selects nodes from staking registry
  3. Emits `NodesAssigned(jobId, leader, verifiers[])`
  4. Nodes listen and self-assign
  5. Nodes call `submitCommitment(jobId, resultHash)`
  6. Contract auto-verifies when quorum threshold met
  7. Auto-payouts from pre-deposited escrow

#### BlindferenceInferenceGate
- **Purpose:** Reineira escrow condition resolver
- **Function:** `isConditionMet(uint256 escrowId)` checks ResultRegistry for task success
- **Data:** `escrowToJob[escrowId] → bytes32 taskId`

#### PayoutClaimer v3
- **Purpose:** User-created escrow redemption (fallback mode)
- **Simplified:** No on-chain FHE math — just `redeem()` + emit `Claimed` event
- **Off-chain service** reads event and forwards cUSDC via cofhejs

#### BlindferenceInputVault
- **Purpose:** Grants ACL access for browser-generated ciphertexts
- **Flow:**
  1. Frontend sends `storeEncryptedInputs(ct1, ct2, ct3, ct4)` tx
  2. Vault verifies via `FHE.asEuint32/64/8`
  3. Grants ACL: `FHE.allowThis(ct)` + `FHE.allow(ct, msg.sender)`
  4. Now permits work for threshold network decryption

### 5.2 Contract Addresses (Arbitrum Sepolia)

```
ResultRegistry:           0xCebd831eCd00915E299b8Ef2666cAbf942dc7150
BlindferenceInference proxy: 0x98b08590D1CB28E6687eFea59A32BE8B16571C86
BlindferenceInference impl:  0x0627Db53614a23BE22412D82F5F49C96Bd7EFCdC
BlindferenceInferenceGate:   0x6a3fA63542d0b69937949372c11348A9EE3f6459
PayoutClaimer v3:           0xA27b6C2b21E09F703b4be3ce70E7433B1F4210B3
BlindferenceInputVault:     0x8dD7B2A9B69C76A69d33B2DF46426Cbe657a902b
Reineira Escrow:           0xbe1eEB78504B71beEE1b33D3E3D367A2F9a549A6
Reineira cUSDC:            0x42E47f9bA89712C317f60A72C81A610A2b68c48a
BLIND Token:               0x232D5470DaaC7AD552a42d876aDEF1f778033cE0
```

---

## 6. Roles & Actors

### 6.1 User / Developer
- **Actions:** Connect wallet, encrypt inputs, submit job, view results, file disputes
- **Payment:** cUSDC for job fee, optional BLIND for insurance
- **Visibility:** Sees quorum nodes, status, result preview (if rejected)

### 6.2 ICL Service (Protocol Operator)
- **Role:** Centralized coordinator for ICL mode
- **Responsibilities:**
  - Quorum selection
  - Task dispatch
  - Result aggregation
  - On-chain commitment
  - Payment settlement trigger
- **Key:** `0x7F9B413Da50e72415b16Eb9df6e5E59774a338dc`
- **Note:** Can be replaced by on-chain mode for full decentralization

### 6.3 Node Operator
- **Requirements:**
  - Stake BLIND tokens (minimum TBD)
  - Run node runtime (Python + Node.js)
  - Maintain callback server (publicly reachable)
  - Pass periodic heartbeat/attestation
- **Rewards:**
  - 60% of job fee (leader)
  - 20% of job fee (each verifier)
  - BLIND reputation tokens
- **Slashing:** For failed commitments, missed deadlines, or incorrect outputs

### 6.4 Payment Service
- **Role:** Manages credit balances and on-chain settlement
- **Actions:**
  - Atomic credit deduction on job submit
  - Unified on-chain settlement on job complete
  - Credit refund on job failure/timeout
- **Integration:** Supabase for balances, Reineira SDK for escrow, Web3.py for BLIND

### 6.5 Blindference Agent (SDK)
- **Purpose:** Programmatic access for developers
- **Features:**
  - `OnChainInferenceClient` — createJob, getJobStatus, poll_until_terminal
  - `submit_contract()` / `inference_contract()` — full on-chain flow
- **Package:** Installable Python package for agent builders

---

## 7. APIs & Interfaces

### 7.1 ICL REST API

Base URL: `http://127.0.0.1:8000` (dev) / `https://api.blindference.xyz` (prod)

**Authentication:** None (public read), API key (admin write)

**Key Endpoints:**

```http
### Health Check
GET /health

### Quorum Preview
POST /v1/inference/quorum-preview
Content-Type: application/json
{
  "model_id": "groq:llama-3.3-70b-versatile",
  "min_tier": 1,
  "verifier_count": 2
}

### Submit Job (ICL Mode)
POST /v1/inference/request
Content-Type: application/json
{
  "job_id": "uuid",
  "developer_address": "0x...",
  "model_id": "groq:llama-3.3-70b-versatile",
  "encrypted_features": [{"ctHash": "...", "securityZone": 0}],
  "permits": [{"issuer": "...", "recipient": "...", "contractAddress": "..."}],
  "coverage_enabled": false,
  "min_tier": 1,
  "verifier_count": 2
}

### Get Job Status
GET /v1/inference/request/{job_id}/status

### File Dispute
POST /v1/inference/request/{job_id}/dispute
Content-Type: application/json
{
  "evidence_hash": "0x...",
  "evidence_uri": "ipfs://..."
}
```

### 7.2 Payment Service REST API

Base URL: `http://127.0.0.1:8001` (dev)

```http
### Health Check
GET /health

### Submit Job (with payment)
POST /v1/jobs/submit
Content-Type: application/json
{
  "task_id": "0x...",
  "user_address": "0x...",
  "model_id": "groq:llama-3.3-70b-versatile",
  "amount_cusdc": 5000,
  "amount_blind": 0,
  "payment_mode": "credits",
  "permits": [...],
  "coverage_enabled": false
}

### Job Completion Callback (from ICL)
POST /v1/jobs/{job_id}/complete
Content-Type: application/json
{
  "status": "success",
  "leader_address": "0x...",
  "verifier_addresses": ["0x...", "0x..."],
  "result_hash": "0x...",
  "output_cid": "bafy..."
}

### Get Job Status
GET /v1/jobs/{job_id}
```

### 7.3 Node Runtime API

Base URL: `http://node-host:PORT` (configurable, default 9101-9103)

```http
### Receive Task (from ICL)
POST /internal/task
Content-Type: application/json
{
  "request_id": "uuid",
  "task_id": "0x...",
  "encrypted_features": [...],
  "model_id": "groq:llama-3.3-70b-versatile",
  "permit": {...}
}

### Submit Result (to ICL)
POST /internal/result
Content-Type: application/json
{
  "request_id": "uuid",
  "task_id": "0x...",
  "result_hash": "0x...",
  "output_cid": "bafy...",
  "confidence": 95
}
```

---

## 8. Security Model

### 8.1 Threats & Mitigations

| Threat | Mitigation |
|--------|-----------|
| **ICL is malicious** | On-chain mode available — user calls contract directly |
| **Leader lies** | 2 verifiers cross-check; if disagree, job rejected |
| **Verifier collusion** | Leader + 1 verifier still can't pass without 2nd verifier |
| **Node sees raw data** | Each node gets encrypted inputs + one permit; data only decrypted locally |
| **Payment front-running** | Reineira FHE escrows hide amount and recipient |
| **Replay attacks** | Task IDs are unique (keccak256 of UUID); nonces managed per-wallet |
| **Sybil nodes** | Staking requirement + slashing for misbehavior |
| **CoFHE 403 errors** | InputVault grants ACL before permit creation |

### 8.2 Trust Assumptions

**ICL Mode:**
- ICL selects quorum honestly (mitigated by staking + random selection)
- ICL commits correct result (mitigated by verifiers + on-chain record)
- ICL doesn't censor (mitigated by on-chain mode as fallback)

**On-Chain Mode:**
- Smart contracts are correct (mitigated by Foundry tests + audit)
- Nodes respond to events (mitigated by economic incentives)
- Fhenix threshold network is honest (external assumption)

---

## 9. Testing & Validation

### 9.1 Test Coverage

| Suite | Tests | Status | Framework |
|-------|-------|--------|-----------|
| Foundry Contracts | 106/106 | ✅ Pass | Foundry |
| ICL API | 13/13 | ✅ Pass | pytest |
| Node Runtime | 41/41 | ✅ Pass | pytest |
| Blindference-Agent | 23/23 | ✅ Pass | pytest |
| Frontend Build | Clean | ✅ Pass | Vite + tsc |
| PyPI Package | Clean | ✅ Pass | build + twine |

### 9.2 E2E Validation

| Test | Status | Details |
|------|--------|---------|
| 3-escrow creation + redemption | ✅ | IDs 214/215/216 on Arbitrum Sepolia |
| ResultRegistry commit | ✅ | Via ICL service key |
| BLIND transfer | ⚠️ | Fails on test addresses (no ETH for gas) |
| CoFHE encrypt → vault → decrypt | ✅ | Full browser-to-node flow |
| On-chain consensus | ✅ | Contract emits + nodes respond |

---

## 10. Deployment

### 10.1 Current Deployment (Dev)

| Service | Host | Port | Status |
|---------|------|------|--------|
| ICL | `127.0.0.1` | 8000 | ✅ Running |
| Payment Service | `127.0.0.1` | 8001 | ✅ Running |
| Frontend | `127.0.0.1` | 3000 | ✅ Running (dev) |
| Node 1 | `host` | 9101 | ✅ Registered |
| Node 2 | `host` | 9102 | ✅ Registered |
| Node 3 | `host` | 9103 | ✅ Registered |

### 10.2 Production Deployment Plan

| Component | Target Platform | Status |
|-----------|----------------|--------|
| Frontend | Vercel | `frontend-revamp` branch ready |
| ICL | Render / Railway | Docker-ready |
| Payment Service | Render / Railway | Docker-ready |
| Nodes | Self-hosted / VPS | Operator-run |
| Docs | Mintlify | Configured, needs domain connect |
| PyPI | pypi.org | `blindference-node` v0.3.0 published |

---

## 11. Repositories & Packages

### 11.1 Monorepo Structure

```
blindference/
├── network/
│   └── packages/
│       ├── frontend/           # React/Vite UI
│       ├── icl/              # Inference Coordination Layer
│       ├── node-reineira/    # Node runtime
│       ├── payment/          # Payment + settlement service
│       ├── contracts/        # Foundry smart contracts
│       ├── blindference-demo/# Demo vertical contracts
│       └── fhe-mocks/        # Local FHE test helpers
├── docs/                     # Mintlify documentation
├── README.md
├── ARCHITECTURE.md
├── DEPLOYMENT.md
└── CONTEXT.md                # LLM handoff context
```

### 11.2 Git Repository

```bash
git clone git@github.com:AbhishekPanwarr/blindference.git
cd blindference
```

**Active Branches:**
- `main` — stable
- `frontend-revamp` — UI changes (deploy-ready)
- `payout` — escrow + settlement fixes (current working branch)

### 11.3 PyPI Package

```bash
pip install blindference-node
```

**Published versions:**
- `v0.3.0` — Current stable

---

## 12. Environment & Configuration

### 12.1 ICL Environment

```bash
# .env
ARBITRUM_SEPOLIA_RPC=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
ICL_PRIVATE_KEY=0x...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=sb_secret_...
RESULT_REGISTRY_ADDRESS=0xCebd831eCd00915E299b8Ef2666cAbf942dc7150
BLINDFERENCE_STAKING_ADDRESS=0x...
BLIND_TOKEN_ADDRESS=0x232D5470DaaC7AD552a42d876aDEF1f778033cE0
```

### 12.2 Payment Service Environment

```bash
# .env
ARBITRUM_SEPOLIA_RPC=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
ICL_WALLET_PRIVATE_KEY=0x...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=sb_secret_...
INFERENCE_GATE_ADDRESS=0xF3014a79985f83898912cAe2676226310A546905
REINEIRA_ESCROW_ADDRESS=0xbe1eEB78504B71beEE1b33D3E3D367A2F9a549A6
BLIND_TOKEN_ADDRESS=0x232D5470DaaC7AD552a42d876aDEF1f778033cE0
```

### 12.3 Frontend Environment

```bash
# .env
VITE_ICL_BASE_URL=http://127.0.0.1:8000
VITE_PAYMENT_BASE_URL=http://127.0.0.1:8001
VITE_BLINDFERENCE_INPUT_VAULT=0x8dD7B2A9B69C76A69d33B2DF46426Cbe657a902b
VITE_ARBITRUM_SEPOLIA_RPC=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
```

---

## 13. Known Limitations

1. **BLIND transfers fail in dev** — Test node addresses have no ETH for gas; real node operators would
2. **ICL single point of failure** — Mitigated by on-chain mode, but ICL mode is default for UX
3. **Node runtime requires public IP** — Callback server must be reachable; VPN/cloud solves this
4. **Fhenix testnet latency** — Decrypt via threshold network adds 2-5s per operation
5. **Model support limited** — Currently Groq Llama-3.3-70B and Gemini 2.5 Flash; more models need integration
6. **No insurance implementation** — Schema exists but purchase flow not fully wired
7. **Frontend not deployed** — `frontend-revamp` branch ready but not on Vercel yet

---

## 14. Roadmap

| Phase | Milestone | Status |
|-------|-----------|--------|
| **Phase 1** | Core encryption + ICL + node runtime | ✅ Complete |
| **Phase 2** | On-chain consensus + staking | ✅ Complete |
| **Phase 3** | Confidential payment (3-escrow) | ✅ Complete |
| **Phase 4** | Frontend revamp + branding | ✅ Complete |
| **Phase 5** | PyPI package + docs | ✅ Complete |
| **Phase 6** | Mainnet deployment | 🔄 Pending audit |
| **Phase 7** | Insurance + dispute resolution | 🔄 Partial |
| **Phase 8** | Additional models (GPT-4, Claude) | 🔄 Planned |
| **Phase 9** | Mobile app | 📋 Planned |
| **Phase 10** | DAO governance | 📋 Planned |

---

## Appendix A: Glossary

| Term | Definition |
|------|-----------|
| **CoFHE** | Fhenix's Co-Fully Homomorphic Encryption — encrypts data in browser |
| **cUSDC** | Confidential USDC — FHE-wrapped stablecoin via Reineira |
| **BLIND** | Protocol reputation/token for node staking |
| **ICL** | Inference Coordination Layer — centralized task dispatcher |
| **Quorum** | 1 leader + N verifiers who run the same inference |
| **Permit** | CoFHE sharing permit — delegates decryption rights |
| **Escrow** | Reineira confidential escrow — hides amount + recipient |
| **Task ID** | `keccak256(uuid)` — unique on-chain identifier |
| **Result Hash** | `keccak256(output)` — commitment to inference result |
| **CID** | Content Identifier — IPFS hash for encrypted output |

---

## Appendix B: Run Commands

### Start ICL
```bash
cd network/packages/icl
./.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

### Start Payment Service
```bash
cd network/packages/payment
./.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8001
```

### Start Frontend
```bash
cd network/packages/frontend
npm run dev -- --host 127.0.0.1 --port 3000
```

### Start Node (×3 terminals)
```bash
cd network/packages/node-reineira
source ../icl/.env
export BLINDFERENCE_NODE_OPERATOR_KEY=$DEMO_OPERATOR_PRIVATE_KEY1
export BLINDFERENCE_NODE_CALLBACK_PORT=9101
./.venv/bin/python -m blindference_node.cli start
```

### Bootstrap Demo Nodes
```bash
curl -X POST http://127.0.0.1:8000/admin/bootstrap-demo-nodes \
  -H "Content-Type: application/json" \
  -d '{"count":3}'
```

### Run Tests
```bash
# Contracts
cd network/packages/contracts
forge test

# ICL
cd network/packages/icl
./.venv/bin/pytest

# Node
cd network/packages/node-reineira
./.venv/bin/pytest
```

---

*Document version: 2025-06-01*
*Repository: https://github.com/AbhishekPanwarr/blindference*
*Contact: [project team]*
