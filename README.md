# Blindference — Confidential, Quorum-Verified AI Inference

> A decentralised private inference network where prompts are encrypted, outputs are verified by a three-node quorum, and every job is economically settled on-chain.

[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](./)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Python](https://img.shields.io/badge/python-3.11%2B-blue)](./)
[![Node](https://img.shields.io/badge/node-20%2B-blue)](./)

---

## Table of Contents

- [What is Blindference?](#what-is-blindference)
- [How It Works](#how-it-works)
- [Key Features](#key-features)
- [Quick Start](#quick-start)
- [Deployed Contracts](#deployed-contracts)
- [Repository Structure](#repository-structure)
- [Documentation](#documentation)
- [License](#license)

---

## What is Blindference?

AI inference today exposes your prompts to model providers, offers no proof that the output came from the claimed model, and provides no recourse if a node returns garbage. Blindference fixes all three.

**The problem:**
- **No input privacy** — Your prompts, financial data, and personal information are visible to whoever runs the model.
- **No output verifiability** — You have to trust that the provider ran the exact model they claim to have run.
- **No financial accountability** — If a node fails or cheats, you bear the cost.

**Blindference solves this with:**
- **AES-256-GCM encryption** in the browser before your prompt ever leaves your device.
- **Fhenix CoFHE** access control so only the assigned quorum nodes can decrypt your key.
- **A 2/3 quorum** of independent nodes that run the same inference and cross-validate results.
- **Reineira escrows** that hold payment until the quorum agrees, then distribute rewards automatically.

In short: **No party — not the node operators, not the coordinator, not the blockchain — ever sees your prompt or answer in plaintext.** Only your wallet can decrypt the final result.

---

## How It Works

```text
User Wallet          Frontend              ICL              Quorum Nodes           Blockchain
    |                  |                    |                    |                    |
    |-- type prompt -->|                    |                    |                    |
    |                  |-- AES encrypt -----|                    |                    |
    |                  |-- upload blob ---->|                    |                    |
    |                  |-- store key ------>|                    |                    |
    |                  |-- submit job ----->|                    |                    |
    |                  |                    |-- dispatch ------>|                    |
    |                  |                    |                    |-- decrypt key ---->|
    |                  |                    |                    |-- run inference    |
    |                  |                    |<-- result hash ----|                    |
    |                  |                    |<-- verdicts ---------------------------|
    |                  |                    |-- 2/3 match?                               |
    |                  |                    |-- commit result ------------------------>|
    |                  |<-- accepted -------|                    |                    |
    |<-- decrypt output |                    |                    |                    |
    |                  |                    |                    |                    |
```

1. **Encrypt locally** — The browser AES-256 encrypts your prompt before upload.
2. **Store key on-chain** — The encryption key is split into halves, CoFHE-encrypted, and stored in a smart contract gated to the quorum.
3. **Select quorum** — The Inference Coordination Layer (ICL) picks 1 leader and 2 verifiers from the active node pool.
4. **Run and verify** — Each node decrypts the prompt, runs the identical model, and submits a commitment hash. The leader also stores an output key for you.
5. **Reach consensus** — If at least 2 of 3 hashes match, the result is accepted. If not, the job is rejected.
6. **Settle payment** — Accepted results trigger automatic payment distribution from the escrow. Rejected results trigger a refund or dispute process.
7. **Decrypt answer** — Only your wallet can request the output key from the contract and decrypt the final answer.

---

## Key Features

- **End-to-end encryption** — Prompts are encrypted in the browser with AES-256-GCM. Keys are protected by Fhenix CoFHE threshold FHE.
- **Quorum-verified outputs** — Three independent nodes run the same inference. A 2/3 hash match guarantees execution integrity.
- **Economic accountability** — Every job is backed by an escrow. Nodes stake BLIND tokens to participate. Bad behaviour is slashed.
- **Optional insurance** — Purchase coverage for an additional 2% premium. If the quorum rejects a result, you can claim a payout.
- **Flexible payment** — Pay per call with cUSDC or BLIND tokens, or buy bulk credit packages at a discount.
- **Agent SDK** — A TypeScript SDK lets autonomous agents submit jobs, poll status, and decrypt results programmatically.
- **Two execution modes** —
  - **ICL mode**: Fast, coordinated through the Inference Coordination Layer.
  - **On-Chain mode**: Fully decentralised. Jobs are posted directly to a smart contract, nodes listen for events, and consensus is enforced on-chain.

---

## Quick Start

### Prerequisites

- Node.js 20+ and npm
- Python 3.11+ with pip or uv
- MongoDB (or use in-memory fallback for local dev)
- MetaMask with Arbitrum Sepolia configured
- Sepolia ETH for gas (get from [the faucet](https://faucet.quicknode.com/arbitrum/sepolia))

### 1. Clone the repository

```bash
git clone https://github.com/baync180705/blindference.git
cd blindference
```

### 2. Start the Inference Coordination Layer

```bash
cd network/packages/icl
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn main:app --host 127.0.0.1 --port 8000
```

### 3. Start the Payment Service

```bash
cd network/packages/payment
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn main:app --host 127.0.0.1 --port 8001
```

### 4. Install and run a compute node

```bash
pip install blindference-node
blindference-node init
blindference-node attest --mock
blindference-node run
```

For a full quorum, run three nodes on separate ports. See the [node documentation](https://pypi.org/project/blindference-node/) for details.

### 5. Monitor your node

```bash
# Check node status and configuration
blindference-node status

# View recent jobs and earnings
blindference-node jobs list --limit 10

# Check total BLIND earned
blindference-node jobs earnings

# Check on-chain stake and slash status
blindference-node staking status

# View BLIND token balance
blindference-node balance
```

You can also open the **Node Dashboard** in the web frontend (connect your wallet → sidebar → "Node Dashboard") to see a live visualization of your stake, earnings, job history, and slash warnings.

### 5. Start the frontend

```bash
cd network/packages/frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), connect MetaMask to Arbitrum Sepolia, and submit your first confidential inference job.

---

## Deployed Contracts (Arbitrum Sepolia)

| Contract | Address | Purpose |
|----------|---------|---------|
| **BLIND Token** | `0x232D5470DaaC7AD552a42d876aDEF1f778033cE0` | ERC-20 utility token for staking, payments, and rewards |
| **BlindFaucet** | `0xA74e70f2b3e9B68C2D537EE52E881F9A3F4Bf2E9` | Free BLIND token distribution for testnet users |
| **BlindferenceStaking** | `0x222Ac74201Ed58915e42Ee5be626d939fd234D0b` | Node staking: stake, unbond, slash. Min 1000 BLIND, 96h unbond |
| **BlindferencePolicyAdapter** | `0xc8Ae5892bf5b91726FCb9B2a7EceDee596B795cF` | Insurance policy adapter for coverage premiums |
| **PromptKeyStore** | `0x1E22dD12f448B15f1Ca8560fB6B4463834FaAf73` | Stores CoFHE-encrypted AES key halves for text inference |
| **ResultRegistry** | `0xCebd831eCd00915E299b8Ef2666cAbf942dc7150` | On-chain commitment of accepted inference results |
| **InferenceGate** | `0x6a3fA63542d0b69937949372c11348A9EE3f6459` | Access control for on-chain inference jobs |
| **PayoutClaimer** | `0xEfB565c7989dd1dEDD0C5B8c95dA24Ef2d94FBbd` | Reineira escrow resolver for automatic reward distribution |
| **NodeRegistry** | `0xB54e019e9717a8Ed4746bA9d7F1A3F83cf0a35E0` | Operator attestation, tier, and heartbeat tracking |
| **BlindferenceInputVault** | `0x8dD7B2A9B69C76A69d33B2DF46426Cbe657a902b` | On-chain FHE input validation and ACL grant |
| **BlindferenceInference** (proxy) | `0x98b08590D1CB28E6687eFea59A32BE8B16571C86` | On-chain quorum consensus and auto-payout |

All contracts are verified on [Arbiscan Sepolia](https://sepolia.arbiscan.io/).

---

## Repository Structure

```text
blindference/
├── network/
│   ├── packages/
│   │   ├── frontend/          # React/Vite browser client
│   │   │   ├── src/pages/     # Inference UI, credit purchase, status polling
│   │   │   └── src/hooks/     # CoFHE client, encryption, wallet connection
│   │   ├── icl/               # FastAPI inference coordination layer
│   │   │   ├── routers/       # REST endpoints for requests and nodes
│   │   │   └── services/      # Quorum selection, dispatch, aggregation
│   │   ├── payment/           # Credit, escrow, insurance, rewards service
│   │   │   ├── routers/       # Job creation, completion, balance APIs
│   │   │   └── services/      # BLIND/cUSDC accounting, Reineira integration
│   │   ├── contracts/         # Protocol and demo smart contracts (Solidity)
│   │   ├── blindference-demo/ # Demo vertical contracts (risk scoring, text)
│   │   ├── agent-sdk/         # TypeScript SDK for agent builders
│   │   └── node-reineira/     # Standalone compute node (see PyPI package)
│   └── README.md
├── docs/                      # Mintlify documentation site
├── README.md                  # This file
├── ARCHITECTURE.md            # Deep dive into system design
├── SETTLEMENT.md              # Reineira escrow and insurance mechanics
├── DEPLOYMENT.md              # Contract deployment and configuration
└── LICENSE                    # MIT License
```

---

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Component-level architecture, data flows, and security model.
- **[SETTLEMENT.md](./SETTLEMENT.md)** — How escrows, insurance, rewards, and slashing work.
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Full deployment guide, environment variables, and troubleshooting.
- **[docs/](./docs/)** — Mintlify documentation site (compute node guides, agent builder guides, API reference).

### External Resources

- **Compute node package:** [blindference-node on PyPI](https://pypi.org/project/blindference-node/)
- **Reineira protocol:** [reineira.xyz](https://reineira.xyz)
- **Fhenix CoFHE:** [fhenix.io](https://www.fhenix.io/)
- **Demo frontend:** [blindference.vercel.app](https://blindference.vercel.app)

---

## License

MIT License — see [LICENSE](./LICENSE) for details.
