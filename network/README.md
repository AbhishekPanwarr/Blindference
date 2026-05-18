# Blindference — Confidential AI Inference Protocol

**Confidential, quorum‑verified, and economically accountable inference for agentic AI.**

[![Contracts](https://img.shields.io/badge/contracts-arbitrum%20sepolia-blue)](https://sepolia.arbiscan.io/)
[![Node](https://img.shields.io/badge/node-v0.3.0-green)](../Blindference-node)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## Overview

Blindference guarantees three properties simultaneously:

1. **Confidentiality** — Prompts and outputs are AES‑256‑GCM encrypted before leaving the client. Keys are gated via CoFHE on Fhenix so only quorum‑assigned nodes can decrypt.
2. **Verifiability** — A 2/3 quorum of independent nodes executes the same deterministic inference and posts commitment hashes. Agreement = verified result.
3. **Economic accountability** — Payment sits in a Reineira `ConfidentialEscrow` and only releases when `InferenceGate` confirms the job is verified. Nodes stake collateral; bad outputs slash them.

## Architecture

```
User → Frontend → ICL (coordinator) → Leader + 2 Verifier nodes → Reineira Escrow
         │              │                    │                           │
    AES encrypt     Select quorum        Run inference              Releases USDC
    CoFHE key store   Dispatch tasks     Post commitments           on verified job
```

### Components

| Component | Stack | Purpose |
|---|---|---|
| **Frontend** | React 19 + Vite + wagmi | Browser‑side encryption, wallet UX, submission |
| **ICL** | FastAPI + Python | Quorum selection, job dispatch, commitment aggregation |
| **Contracts** | Solidity + Foundry | PromptKeyStore, ResultRegistry, InferenceGate, PayoutClaimer |
| **Node** | Python CLI + vLLM | Leader/verifier runtime, CoFHE bridge, inference execution |

## Quick Start

### Prerequisites

- Node.js 20+, Python 3.10+, Foundry
- Arbitrum Sepolia RPC access
- [blindference-node](../Blindference-node) package installed

### ICL

```bash
cd packages/icl
cp .env.example .env    # configure RPC + contract addresses
source .env && uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd packages/frontend
cp .env.example .env    # configure ICL endpoint + contract addresses
npm install && npm run dev
```

### Contracts

```bash
cd packages/contracts
cp .env.example .env
forge build
forge script script/DeployPhase1.s.sol --rpc-url $RPC_URL --broadcast
```

### Node

See the [blindference-node](../Blindference-node) repository for the compute provider CLI.

## Deployed Contracts (Arbitrum Sepolia)

| Contract | Address |
|---|---|
| PromptKeyStore | `0x1E22dD12f448B15f1Ca8560fB6B4463834FaAf73` |
| ResultRegistry | `0xCebd831eCd00915E299b8Ef2666cAbf942dc7150` |
| InferenceGate | `0xF3014a79985f83898912cAe2676226310A546905` |
| PayoutClaimer | `0xEfB565c7989dd1dEDD0C5B8c95dA24Ef2d94FBbd` |
| ExecutionCommitmentRegistry | `0xcd45aefE9a16772528fa30B7d47958a95e83440C` |
| NodeAttestationRegistry | `0xB54e019e9717a8Ed4746bA9d7F1A3F83cf0a35E0` |
| Reineira ConfidentialEscrow | `0xbe1eEB78504B71beEE1b33D3E3D367A2F9a549A6` |
| Reineira cUSDC | `0x42E47f9bA89712C317f60A72C81A610A2b68c48a` |

## Settlement Flow

```
1. User creates Reineira escrow (owner=PayoutClaimer, resolver=InferenceGate)
2. User funds escrow with cUSDC
3. User creates Blindference job with escrowId
4. ICL assigns leader + 2 verifiers → nodes execute inference
5. ICL evaluates consensus → writes ResultRegistry
6. PayoutClaimer.claim() → escrow.redeem() → cUSDC distributed 60/20/20
```

## Repository Layout

```
blindference/
├── packages/
│   ├── frontend/          React 19 + Vite + CoFHE encryption
│   ├── icl/               FastAPI coordinator
│   ├── contracts/         Solidity (Foundry) + deploy scripts
│   ├── blindference-demo/ Demo vertical contracts
│   ├── shared/            TypeScript utilities
│   └── shared-py/         Python utilities
├── scripts/               E2E test scripts
├── protocol/              pnpm workspace config
└── README.md
```

## Documentation

- [Blindference Node Package](../Blindference-node) — compute provider CLI + daemon
- [Node Context Transfer](../Blindference-node/context_transfer.md) — complete technical handoff
- [Node Quickstart](../Blindference-node/docs/quickstart.md) — zero‑to‑node guide

## License

MIT
