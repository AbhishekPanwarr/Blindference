# Blindference Updates

Wave-by-wave changelog for the Blindference confidential AI inference network.

---

## Wave 5 — Live on Arbitrum Sepolia Testnet

**Date**: June 2026  
**Status**: Testnet live, builder-ready  
**Network**: Arbitrum Sepolia  
**Frontend**: [www.blindference.xyz](https://www.blindference.xyz)  
**YouTube**: [youtube.com/@Blindference](https://www.youtube.com/@Blindference)

---

### 1. Text Inference Live

End-to-end confidential text inference is now operational on Arbitrum Sepolia testnet.

**How it works:**
1. **Browser encryption** — User types a prompt in the web app. The frontend generates an ephemeral AES-256-GCM key and encrypts the prompt locally. The ciphertext is uploaded to IPFS via Pinata.
2. **CoFHE key split** — The AES key is split into two uint128 halves. Each half is encrypted with Fhenix CoFHE (Fully Homomorphic Encryption) and stored on-chain in the `BlindferenceInputVault` contract with ACL enforcement. Only the assigned quorum nodes can decrypt.
3. **Quorum assignment** — The ICL (Inference Coordination Layer) selects 1 Leader + 2 Verifiers from the pool of attested nodes. Selection is weighted by stake, reputation score, and model support.
4. **Node execution** — Each node:
   - Fetches the encrypted prompt from IPFS
   - Retrieves its key half from `BlindferenceInputVault` via CoFHE threshold decryption
   - Reconstructs the AES key and decrypts the prompt
   - Runs inference via Groq Llama 3.3 70B or Google Gemini 2.5 Flash
   - Encrypts the output with a new AES key
   - Uploads the encrypted result to IPFS
   - Submits a SHA-256 commitment hash to the ICL
5. **Consensus** — The Leader submits first. Verifiers independently re-run inference and submit their hashes. If ≥2/3 hashes match, the job is `ACCEPTED`. If not, it's `REJECTED`.
6. **Result delivery** — The user polls the ICL for status. On `ACCEPTED`, the frontend downloads the encrypted result from IPFS, decrypts the output key via CoFHE, and AES-decrypts the plaintext locally.

**Verified with:** Real MetaMask wallets, real Arbitrum Sepolia transactions, real Groq/Gemini API calls.

---

### 2. Payments Live

Two payment modes are now supported:

**Credits Mode (default):**
- Users hold cUSDC or BLIND token balances in the Payment Service
- Balances are deducted at job submission
- On `ACCEPTED`: credits are spent, rewards distributed to nodes
- On `REJECTED` / `FAILED`: automatic refund to user balance
- Insurance optional: 2% premium for dispute coverage

**Escrow Mode:**
- Users create a Reineira escrow on-chain before submitting
- Escrow holds cUSDC until quorum consensus is reached
- `PayoutClaimer.claim()` releases funds to nodes on `ACCEPTED`
- Auto-refund on `REJECTED` via `InferenceGate` + `IConditionResolver`

**Node Rewards:**
- Leader: 60% of job fee
- Verifier 1: 20% of job fee
- Verifier 2: 20% of job fee
- Distributed automatically on `ACCEPTED` consensus

---

### 3. Reineira Settlement

Full Reineira protocol integration for trustless payment settlement:

- **`PayoutClaimer` v3** (`0xA27b6C2b21E09F703b4be3ce70E7433B1F4210B3`) — Simplified escrow redemption. Calls `claim(escrowId, jobId)` to release funds.
- **`InferenceGate`** (`0xF3014a79985f83898912cAe2676226310A546905`) — Implements `IConditionResolver`. Checks `ResultRegistry` for task success before allowing payout.
- **`BlindferenceInference`** (`0x98b08590D1CB28E6687eFea59A32BE8B16571C86`) — Enforces quorum consensus before marking a job as settled. Emits `NodesAssigned`, `CommitReceived`, `ConsensusReached`.
- **`BlindferenceUnderwriter`** (`0xC7D3706Ca2a42d739429Aec1b452051dA5Eb68f0`) — Handles insurance disputes. Auto-verify with mock resolution (non-empty evidence = approved).

All auto-verify, auto-payout, and auto-refund logic is live on Arbitrum Sepolia testnet.

---

### 4. Builder Packages

**`blindference-node` (PyPI):**
- One-command setup: `pip install blindference-node && blindference-node init && blindference-node run`
- CoFHE bridge integration for threshold decryption
- Auto-attestation on startup (TPM/SGX/mock tiers)
- Heartbeat every 60s to ICL
- Supports Groq Llama 3.3 70B and Gemini 2.5 Flash

**`@abhieren/blindference-agent` (npm):**
- CLI commands: `infer`, `balance`, `buy-package`, `start` (REST server)
- TypeScript SDK: `BlindferenceAgent` class with `createJob()`, `pollUntilTerminal()`, `decryptResult()`
- REST server on port 3000 for language-agnostic integration
- Multi-gateway IPFS fallback (ipfs.io → pinata.cloud → dweb.link)

---

### 5. YouTube

Channel: [youtube.com/@Blindference](https://www.youtube.com/@Blindference)

Planned videos:
- Introduction to Blindference
- Live demo of confidential inference
- Development timeline and waves
- Architecture deep-dive
- Node setup tutorial
- Agent SDK integration guide

---

### 6. Frontend Overhaul

Major frontend revamp for Wave 5:

- **New design system** — Dark mode with violet accents, glass morphism cards, grain texture overlay
- **Mobile responsive** — Hamburger menu, collapsible trace panel, adaptive layouts
- **Rejection transparency** — On `REJECTED`, user sees the leader's unverified output with a disclaimer + feedback button
- **Leader output preview** — Verified output shown in violet card; unverified in amber card
- **On-chain proof panel** — Task ID, storeKey tx, prompt CID, leader address, verifier addresses, model ID all visible
- **Conversation history** — Multi-turn chat with localStorage persistence
- **Progress tracking** — Execution trace sidebar shows real-time quorum status
- **Docs site** — `/docs` with MDX content: quickstart, architecture, CLI reference, SDK API, Python interop, troubleshooting, contract addresses

---

### 7. Documentation

Comprehensive documentation now live at `/docs`:

- **Node Setup** — Hardware requirements, attestation tiers, CoFHE bridge configuration, heartbeat monitoring
- **SDK Quickstart** — 5-minute guide to first confidential inference
- **CLI Reference** — All commands and options for `blindference-agent`
- **Architecture** — Data flow, components, security model, threat mitigations
- **Python Interop** — Using the SDK from Python via subprocess or HTTP
- **Troubleshooting** — Common errors and solutions
- **Contract Addresses** — All deployed Arbitrum Sepolia addresses

---

## Wave 4 — Risk Scoring + Reineira Integration

**Date**: May 2026

- Added confidential risk scoring pipeline (structured financial features)
- Integrated Reineira escrow and insurance contracts
- Built Payment Service with credit balances and escrow creation
- Added node attestation registry (TPM/SGX/mock tiers)
- Implemented reward distribution (60/20/20 split)

## Wave 3 — Quorum Consensus

**Date**: April 2026

- Built ICL (Inference Coordination Layer) for quorum selection and dispatch
- Implemented leader-verifier consensus (2/3 hash match)
- Added ResultRegistry for on-chain commitment storage
- Built node runtime with Groq/Gemini inference backends

## Wave 2 — CoFHE Integration

**Date**: March 2026

- Integrated Fhenix CoFHE for threshold decryption
- Built PromptKeyStore for encrypted key half storage
- Added AES-256-GCM browser encryption
- Implemented IPFS upload/download pipeline

## Wave 1 — Foundation

**Date**: February 2026

- Initial smart contract suite: BlindferenceInference, ResultRegistry, BlindferenceStaking
- Basic frontend with MetaMask integration
- Node registration and staking
- Mock inference pipeline for testing

---

## Testnet Details

| Parameter | Value |
|-----------|-------|
| Network | Arbitrum Sepolia |
| Chain ID | 421614 |
| RPC | `https://arb-sepolia.g.alchemy.com/v2/...` |
| Frontend | `https://www.blindference.xyz` |
| ICL API | `https://icl.blindference.xyz` |
| Payment Service | `https://payment.blindference.xyz` |
| Faucet | `https://www.blindference.xyz/faucet` |
| Explorer | `https://sepolia.arbiscan.io` |

---

## Next Steps (Post-Wave 5)

- **Mainnet deployment** — After testnet stability validation
- **GPU node support** — vLLM backend for local model hosting
- **Additional models** — Claude, DeepSeek, custom fine-tunes
- **Mobile app** — React Native agent SDK
- **DAO governance** — BLIND token voting for protocol parameters

---

*For technical deep-dives, see [TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md)*  
*For support: Telegram [@abhieren](https://t.me/abhieren)*
