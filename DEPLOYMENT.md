# Deployment Guide

This document provides contract addresses, deployment procedures, and runtime configuration for the Blindference protocol on Arbitrum Sepolia.

## Network Targets

| Layer | Endpoint |
|-------|----------|
| Blockchain | Arbitrum Sepolia |
| CoFHE Threshold Network | `https://api.helios.fhenix.zone` |
| Blob Storage | Pinata / IPFS |
| Model APIs | Groq (`api.groq.com`), Google Gemini (`generativelanguage.googleapis.com`) |

## Deployed Contracts (Arbitrum Sepolia)

### Core Protocol Contracts

| Contract | Address | Explorer | Purpose |
|----------|---------|----------|---------|
| NodeAttestationRegistry | `0xB54e019e9717a8Ed4746bA9d7F1A3F83cf0a35E0` | [View](https://sepolia.arbiscan.io/address/0xB54e019e9717a8Ed4746bA9d7F1A3F83cf0a35E0) | Operator attestation storage with tier and expiry |
| ExecutionCommitmentRegistry | `0xcd45aefE9a16772528fa30B7d47958a95e83440C` | [View](https://sepolia.arbiscan.io/address/0xcd45aefE9a16772528fa30B7d47958a95e83440C) | Task dispatch, commit/reveal deadlines |
| AgentConfigRegistry | `0x85aE035d6a94c006B5d0808cAdF47F5c22536996` | [View](https://sepolia.arbiscan.io/address/0x85aE035d6a94c006B5d0808cAdF47F5c22536996) | Model ID to agent configuration mapping |
| ReputationRegistry | `0xdaDb4D46D231d3fe6D3754E0861c8bCD36aF0604` | [View](https://sepolia.arbiscan.io/address/0xdaDb4D46D231d3fe6D3754E0861c8bCD36aF0604) | Operator reputation scoring (tasks, slashes) |
| RewardAccumulator | `0xFa25Fb53eF8dAc88E4f43bB7558Cf3930Bf3e817` | [View](https://sepolia.arbiscan.io/address/0xFa25Fb53eF8dAc88E4f43bB7558Cf3930Bf3e817) | Reward distribution and claim management |
| PromptKeyStore | `0x1E22dD12f448B15f1Ca8560fB6B4463834FaAf73` | [View](https://sepolia.arbiscan.io/address/0x1E22dD12f448B15f1Ca8560fB6B4463834FaAf73) | CoFHE-encrypted AES key half storage for text inference |
| ResultRegistry | `0xCebd831eCd00915E299b8Ef2666cAbf942dc7150` | [View](https://sepolia.arbiscan.io/address/0xCebd831eCd00915E299b8Ef2666cAbf942dc7150) | On-chain result commitment for settlement |

### Supporting Contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| ArbiterSelectionRegistry | `0xAaf7Dd729Cb5873975D3643bE2b89CA121143d3f` | Arbiter selection for disputes |
| MockAgentIdentityRegistry | `0x723ef21650B66a5705eABB74c3f3a3dB1593bb62` | Agent identity mock (dev) |
| MockEscrowReleaser | `0x6B1dC5aca048e0F5FF7fdd4831Bd721c5501b9fc` | Escrow release mock (dev) |
| PrevRandaoRandomness | `0xA579Fb461FedA169d59481fE5A24Cb3B7beA8222` | VRF randomness source |

### Demo Vertical Contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| BlindferenceInputVault | `0x8dD7B2A9B69C76A69d33B2DF46426Cbe657a902b` | On-chain FHE input validation and ACL grant |
| BlindferenceAttestor | `0x957CEb3F3E77bF91A001ef9FB2cEeB40A860FD79` | Custom attestation validation |
| BlindferenceUnderwriter | `0xC7D3706Ca2a42d739429Aec1b452051dA5Eb68f0` | Insurance underwriter |
| BlindferenceAgent | `0x43132afC4F163C244f7b66Adafee32F6B904994c` | Agent configuration |
| MockPriceOracle | `0x5B01c9CcCe3E00DE92d3d76b312f2b9b2Db41e94` | Demo price feed |
| InferenceGate | `0xF3014a79985f83898912cAe2676226310A546905` | Inference access control |

### Important Notes

- **PromptKeyStore** (`0x597ed3E3a442ebB31481AC3BAc98815F98ED6B44`) is the current production address supporting `uint128` key halves
- Older deployment `0x3F883189F163950220993688E14A56F1474554E3` is **obsolete** — it used `uint256` key halves and is incompatible with current node runtime
- All contracts are verified on Arbiscan

## Deployment Procedure

### Prerequisites

- Foundry (`forge`) installed
- Arbitrum Sepolia RPC endpoint (e.g., Alchemy, Infura)
- Deployer private key with Sepolia ETH
- Arbiscan API key for verification

### Environment Setup

Create `.env` in `network/packages/contracts/`:

```bash
PRIVATE_KEY=0x...
ARB_SEPOLIA_RPC=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
ARBISCAN_API_KEY=YOUR_ARBISCAN_KEY
```

### Deploy Core Protocol

```bash
cd network/packages/contracts
source .env

# Deploy core registries
forge script script/DeployCore.s.sol:DeployCore \
  --rpc-url $ARB_SEPOLIA_RPC \
  --broadcast \
  --verify \
  --etherscan-api-key $ARBISCAN_API_KEY

# Deploy PromptKeyStore
forge script script/DeployPromptKeyStore.s.sol:DeployPromptKeyStore \
  --rpc-url $ARB_SEPOLIA_RPC \
  --broadcast \
  --verify \
  --etherscan-api-key $ARBISCAN_API_KEY
```

### Deploy Demo Vertical

```bash
cd network/packages/blindference-demo
source .env

forge script script/DeployDemo.s.sol:DeployDemo \
  --rpc-url $ARB_SEPOLIA_RPC \
  --broadcast \
  --verify \
  --etherscan-api-key $ARBISCAN_API_KEY
```

## Runtime Configuration

### ICL Environment (`network/packages/icl/.env`)

```bash
# Blockchain
ARBITRUM_SEPOLIA_RPC=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY

# CoFHE
COFHE_RPC_URL=https://api.helios.fhenix.zone
COFHE_CHAIN_ID=421614

# Contracts (update after deployment)
NODE_ATTESTATION_REGISTRY_ADDRESS=0xB54e019e9717a8Ed4746bA9d7F1A3F83cf0a35E0
EXECUTION_COMMITMENT_REGISTRY_ADDRESS=0xcd45aefE9a16772528fa30B7d47958a95e83440C
PROMPT_KEY_STORE_ADDRESS=0x1E22dD12f448B15f1Ca8560fB6B4463834FaAf73
RESULT_REGISTRY_ADDRESS=0xCebd831eCd00915E299b8Ef2666cAbf942dc7150
AGENT_CONFIG_REGISTRY_ADDRESS=0x85aE035d6a94c006B5d0808cAdF47F5c22536996
REPUTATION_REGISTRY_ADDRESS=0xdaDb4D46D231d3fe6D3754E0861c8bCD36aF0604
REWARD_ACCUMULATOR_ADDRESS=0xFa25Fb53eF8dAc88E4f43bB7558Cf3930Bf3e817

# ICL identity
ICL_PRIVATE_KEY=0x...

# Demo operators (comma-separated)
DEMO_OPERATOR_PRIVATE_KEYS=0x...,0x...,0x...

# Storage
PINATA_JWT=eyJ...
PINATA_GATEWAY_URL=https://gateway.pinata.cloud/ipfs

# Database (optional — falls back to in-memory)
USE_MONGO=true
MONGO_URI=mongodb+srv://...
MONGO_DB_NAME=blindference

# Quorum settings
DEFAULT_MIN_TIER=0
DEFAULT_VERIFIER_COUNT=2
HEARTBEAT_GRACE_SECONDS=300
EXECUTION_COMMIT_WINDOW_SECONDS=600
EXECUTION_REVEAL_WINDOW_SECONDS=600
```

### Frontend Environment (`network/packages/frontend/.env`)

```bash
VITE_ICL_BASE_URL=http://127.0.0.1:9000
VITE_ARBITRUM_SEPOLIA_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
VITE_CHAIN_ID=421614
VITE_WALLET_CONNECT_PROJECT_ID=your_project_id
VITE_BLINDFERENCE_AGENT_ADDRESS=0x43132afC4F163C244f7b66Adafee32F6B904994c
VITE_BLINDFERENCE_INPUT_VAULT_ADDRESS=0x8dD7B2A9B69C76A69d33B2DF46426Cbe657a902b
VITE_PROMPT_KEY_STORE_ADDRESS=0x1E22dD12f448B15f1Ca8560fB6B4463834FaAf73
VITE_PROMPT_UPLOAD_TIMEOUT_MS=20000
VITE_IPFS_GATEWAY_URL=https://gateway.pinata.cloud/ipfs
```

### Node Environment (per-node)

Each node needs:

```bash
# Node identity (from DEMO_OPERATOR_PRIVATE_KEYS or generated)
BLF_PRIVATE_KEY=0x...
BLF_KEY_PASSWORD=secure_password

# Endpoints
BLF_ICL_ENDPOINT=http://127.0.0.1:9000
BLF_FHENIX_RPC=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
BLF_COFHE_ENDPOINT=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
BLF_COFHE_CHAIN_ID=421614

# Payment Service (for earnings/staking queries)
BLF_PAYMENT_SERVICE_URL=http://127.0.0.1:8001

# Storage
BLF_IPFS_GATEWAY=https://node.lighthouse.storage

# Models
BLF_SUPPORTED_MODELS=qwen2.5-7b,groq:llama-3.3-70b-versatile,gemini:gemini-2.5-flash

# CoFHE mode (bridge = TypeScript subprocess, python = direct HTTP)
BLF_COFHE_MODE=bridge
```

## Demo Bring-Up

### Using Orchestration Scripts

```bash
# Start ICL + 3 nodes + frontend
bash network/scripts/demo/run-stack.sh

# Check all services
bash network/scripts/demo/status.sh

# Stop everything
bash network/scripts/demo/stop.sh

# View logs
ls network/scripts/demo/logs/
```

### Docker Deployment

**ICL Service:**

```bash
cd network/packages/icl
docker build -t blindference-icl .
docker run -p 8000:8000 --env-file .env blindference-icl
```

**Payment Service:**

```bash
cd network/packages/payment
docker build -t blindference-payment .
docker run -p 8001:8001 --env-file .env blindference-payment
```

### Manual Bring-Up

**1. Start ICL:**

```bash
cd network/packages/icl
./.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

**2. Start Payment Service:**

```bash
cd network/packages/payment
./.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8001
```

**3. Bootstrap operators:**

```bash
curl -s -X POST http://127.0.0.1:8000/admin/bootstrap-demo-nodes \
  -H 'Content-Type: application/json' \
  -d '{"count":3}'
```

**4. Start nodes:**

```bash
pip install blindference-node
blindference-node init        # creates wallet + config
blindference-node attest --mock
blindference-node run
```

For a full quorum, run three nodes with unique ports. See [Node Quickstart](docs/compute/quickstart.mdx) for details.

**5. Start frontend:**

```bash
cd network/packages/frontend
npm install
npm run dev -- --host=127.0.0.1
```

Open http://127.0.0.1:3000 and connect MetaMask.

## Validation Checklist

A successful text inference run should produce:

1. ✅ Frontend shows "AES-256-GCM encrypting..." → "CoFHE ZK proof generation"
2. ✅ MetaMask prompts for `storeKey` transaction to PromptKeyStore
3. ✅ ICL shows `POST /v1/inference/requests` with status 200
4. ✅ All 3 nodes show "Received 1 assignment(s)" and "claimed"
5. ✅ Nodes show "downloaded prompt blob" and "running inference"
6. ✅ Leader shows "storing output key" and "submitting leader result"
7. ✅ Verifiers show "verdict: match" or "verdict: no-match"
8. ✅ ICL aggregates and shows status "ACCEPTED" or "REJECTED"
9. ✅ Frontend polls and shows "Decrypting output..." → reveals answer
10. ✅ Arbiscan shows ResultRegistry transaction for accepted results

## Node CLI Reference

The `blindference-node` CLI provides everything needed to manage a node from the terminal.

### Lifecycle Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `init` | Create wallet, detect GPU, save config | `blindference-node init` |
| `attest --mock` | Attest with the ICL (mock TEE) | `blindference-node attest --mock` |
| `run` | Start the daemon | `blindference-node run` |
| `status` | Show node configuration and attestation | `blindference-node status` |

### Monitoring Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `jobs list` | List recent jobs with role, status, earnings | `blindference-node jobs list --limit 10` |
| `jobs earnings` | Total BLIND earned across all jobs | `blindference-node jobs earnings` |
| `balance` | Current BLIND token balance | `blindference-node balance` |
| `staking status` | On-chain stake, failures, slash risk | `blindference-node staking status` |

### Staking Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `staking stake <amount>` | Stake BLIND tokens (min 1000) | `blindference-node staking stake 1000` |
| `staking unstake` | Start 96h unbonding period | `blindference-node staking unstake` |
| `staking withdraw` | Complete unstake after unbond | `blindference-node staking withdraw` |

### Testing Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `test-determinism` | Verify inference outputs are consistent | `blindference-node test-determinism` |
| `models list` | Show available inference backends | `blindference-node models list` |
| `models test` | Quick inference test against a backend | `blindference-node models test --backend groq` |

## Troubleshooting

### "Failed to fetch" during CoFHE encryption

- Clear browser cache and hard reload (Ctrl+Shift+R)
- Remove `node_modules/.vite` cache: `rm -rf network/packages/frontend/node_modules/.vite`
- Verify `fheKeyStorage: null` in `useCofheClient.ts`

### Nodes show "claim failed (500)"

- Check ICL logs for `claim_task` errors
- Verify `attestation_expiry` is in the future
- Ensure node address matches an operator in ICL database
- Check `HEARTBEAT_GRACE_SECONDS` — nodes must heartbeat within 5 minutes

### "Too Many Requests" from Alchemy

- Alchemy free tier rate-limits at ~10 req/s
- Use separate API keys for frontend, ICL, and each node
- Or switch to paid tier / dedicated RPC endpoint

### ZK proof hangs / browser freezes

- Expected: CoFHE ZK proof generation takes 10-30s on main thread
- `useWorkers: false` is set in `useCofheClient.ts` — Web Workers are broken in Vite dev mode
- For production, enable workers with proper Vite configuration

## Security Considerations

- **Never commit `.env` files** with real private keys
- Use separate deployer keys for contracts vs ICL vs nodes
- Rotate `PINATA_JWT` tokens periodically
- MongoDB Atlas connections should use TLS and IP allowlisting
- Node private keys should be encrypted with `BLF_KEY_PASSWORD`
