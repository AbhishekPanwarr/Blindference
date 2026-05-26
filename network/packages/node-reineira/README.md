# blindference-node

> Turn any GPU-capable machine into a confidential AI compute node for the Blindference network.

[![PyPI](https://img.shields.io/pypi/v/blindference-node)](https://pypi.org/project/blindference-node/)
[![Python](https://img.shields.io/badge/python-3.11%2B-blue)](https://www.python.org/)
[![License](https://img.shields.io/badge/license-BUSL--1.1-yellow)](./LICENSE)

---

## Table of Contents

- [What It Does](#what-it-does)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running a Node](#running-a-node)
- [Inference Backends](#inference-backends)
- [How Earnings Work](#how-earnings-work)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)

---

## What It Does

`blindference-node` is the reference runtime for compute providers in the Blindference network. It connects your machine to the Inference Coordination Layer (ICL), receives confidential inference tasks, decrypts inputs via Fhenix CoFHE, runs frontier AI models, and submits verifiable results back to the network.

**Key capabilities:**

- **Event-driven task dispatch** — No polling. The ICL pushes tasks to your node's HTTP callback server.
- **CoFHE decryption** — Decrypts encrypted prompt keys and structured features through the Fhenix threshold network.
- **Multiple inference backends** — Run Groq, Google Gemini, or local vLLM models.
- **Deterministic hashing** — Every output is hashed before submission so verifiers can cross-check without revealing content.
- **On-chain commitments** — In on-chain mode, posts result hashes directly to the BlindferenceInference contract.
- **Auto-attestation** — Self-healing attestation that re-registers with the ICL if connection is lost.

As a node operator, you earn BLIND token rewards for every job your node helps verify. Leaders earn 60% of the job fee; verifiers earn 20% each.

---

## Prerequisites

- **Python** 3.11 or higher
- **Node.js** 18 or higher (for the CoFHE bridge subprocess)
- **A wallet** with some Sepolia ETH for gas (testnet) or mainnet ETH (production)
- **API keys** for at least one inference backend (Groq or Google Gemini)
- **Optional:** GPU for local vLLM inference

---

## Installation

```bash
pip install blindference-node
```

For development or GPU support:

```bash
pip install blindference-node[dev]     # Includes pytest, mypy, ruff
pip install blindference-node[gpu]     # Includes vLLM for local inference
```

Verify the installation:

```bash
blindference-node --help
```

---

## Configuration

Create a `.env` file in your working directory. All variables are prefixed with `BLINDFERENCE_NODE_`.

### Required

| Variable | Example | Description |
|----------|---------|-------------|
| `BLINDFERENCE_NODE_ICL_BASE_URL` | `http://localhost:8000` | URL of the ICL coordinator |
| `BLINDFERENCE_NODE_OPERATOR_PRIVATE_KEY` | `0xabc123...` | Your node's Ethereum private key (with 0x prefix) |
| `BLINDFERENCE_NODE_GROQ_API_KEY` | `gsk_...` | Groq API key (if using Groq backend) |
| `BLINDFERENCE_NODE_GEMINI_API_KEY` | `AIza...` | Google Gemini API key (if using Gemini backend) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `BLINDFERENCE_NODE_PROVIDER` | `groq` | Inference provider: `groq`, `gemini`, or `vllm` |
| `BLINDFERENCE_NODE_GROQ_MODEL` | `llama-3.3-70b-versatile` | Model ID for Groq |
| `BLINDFERENCE_NODE_GEMINI_MODEL` | `gemini-2.5-flash` | Model ID for Gemini |
| `BLINDFERENCE_NODE_RPC_URL` | `http://127.0.0.1:8545` | Arbitrum Sepolia JSON-RPC endpoint |
| `BLINDFERENCE_NODE_COFHE_CHAIN_ID` | `421614` | Chain ID (421614 for Arbitrum Sepolia) |
| `BLINDFERENCE_NODE_CALLBACK_HOST` | `127.0.0.1` | IP address for the node's HTTP callback server |
| `BLINDFERENCE_NODE_CALLBACK_PORT` | `9101` | Port for the callback server |
| `BLINDFERENCE_NODE_CALLBACK_PUBLIC_URL` | (auto) | Public URL if running behind NAT/reverse proxy |
| `BLINDFERENCE_NODE_PROMPT_KEY_STORE_ADDRESS` | (from ICL) | PromptKeyStore contract address |
| `BLINDFERENCE_NODE_MOCK_CLOUD_INFERENCE` | `true` | Set `false` to call real model APIs |
| `BLINDFERENCE_NODE_MOCK_COFHE_DECRYPT` | `false` | Set `true` to skip real CoFHE decryption (dev only) |
| `BLINDFERENCE_NODE_MAX_ITERATIONS` | `0` | Max tasks to process (0 = unlimited) |

### Example `.env` for testnet

```bash
# Identity
BLINDFERENCE_NODE_OPERATOR_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# Coordination
BLINDFERENCE_NODE_ICL_BASE_URL=http://localhost:8000

# Blockchain
BLINDFERENCE_NODE_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
BLINDFERENCE_NODE_COFHE_CHAIN_ID=421614

# Model provider
BLINDFERENCE_NODE_PROVIDER=groq
BLINDFERENCE_NODE_GROQ_API_KEY=gsk_YOUR_GROQ_KEY_HERE
BLINDFERENCE_NODE_GROQ_MODEL=llama-3.3-70b-versatile

# Callback (use a public URL if running remotely)
BLINDFERENCE_NODE_CALLBACK_HOST=0.0.0.0
BLINDFERENCE_NODE_CALLBACK_PORT=9101
BLINDFERENCE_NODE_CALLBACK_PUBLIC_URL=https://your-node.example.com:9101

# Disable mocks for production
BLINDFERENCE_NODE_MOCK_CLOUD_INFERENCE=false
BLINDFERENCE_NODE_MOCK_COFHE_DECRYPT=false
```

---

## Running a Node

### 1. Initialise

```bash
blindference-node init --data-dir ~/.blindference
```

This creates the local data directory for keys, logs, and state.

### 2. Start

```bash
blindference-node start
```

The node will:
1. Load configuration from `.env`.
2. Start an HTTP callback server on the configured host/port.
3. Register (or re-attest) with the ICL.
4. Begin listening for tasks.

### 3. Verify

Check that your node appears in the ICL's active node list:

```bash
curl http://localhost:8000/internal/operators
```

You should see your operator address, tier, and last heartbeat timestamp.

### Running Multiple Nodes

To form a full quorum locally, run three nodes on separate ports:

**Terminal 1 (Leader-capable):**
```bash
BLINDFERENCE_NODE_CALLBACK_PORT=9101 BLINDFERENCE_NODE_GROQ_API_KEY=gsk_... blindference-node start
```

**Terminal 2 (Verifier):**
```bash
BLINDFERENCE_NODE_CALLBACK_PORT=9102 BLINDFERENCE_NODE_GROQ_API_KEY=gsk_... blindference-node start
```

**Terminal 3 (Verifier):**
```bash
BLINDFERENCE_NODE_CALLBACK_PORT=9103 BLINDFERENCE_NODE_GEMINI_API_KEY=AIza... blindference-node start
```

Each node needs a **unique private key** and a **unique callback port**. They can share the same model provider or use different ones.

---

## Inference Backends

### Groq

Fast, hosted API access to frontier open-weight models.

- **Models:** `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`, `gemma-7b-it`
- **Setup:** Set `BLINDFERENCE_NODE_GROQ_API_KEY`
- **Cost:** Charged by Groq per token. Blindference adds a fixed network fee on top.

### Google Gemini

Google's hosted Gemini models with long context windows.

- **Models:** `gemini-2.5-flash`, `gemini-1.5-pro`
- **Setup:** Set `BLINDFERENCE_NODE_GEMINI_API_KEY`
- **Cost:** Charged by Google per token.

### Local vLLM

Run models on your own GPU for maximum privacy and lowest marginal cost.

- **Models:** Any HuggingFace model compatible with vLLM (Llama, Mistral, Qwen, etc.)
- **Setup:** Install `[gpu]` extras, configure `vllm_model` and `vllm_port`.
- **Cost:** Electricity + hardware depreciation. No per-token API fees.

```bash
# Install GPU extras
pip install blindference-node[gpu]

# Configure for vLLM
BLINDFERENCE_NODE_PROVIDER=vllm
BLINDFERENCE_NODE_VLLM_MODEL=meta-llama/Llama-2-7b-chat-hf
BLINDFERENCE_NODE_VLLM_PORT=8000
```

---

## How Earnings Work

Node operators earn BLIND tokens for every job they participate in. The exact amount depends on your role and the job's fee.

### Reward Split (per accepted job)

| Role | Share | Example (1000 cUSDC wei job) |
|------|-------|---------------------------|
| Leader | 60% | 600 cUSDC wei |
| Verifier | 20% each | 200 cUSDC wei |

### Factors That Affect Earnings

- **Reputation score** — Higher reputation = more frequent quorum selection.
- **Tier** — TEE-attested nodes (tier 1) are preferred for high-value jobs and earn a premium.
- **Model diversity** — Nodes supporting rare models face less competition for assignment.
- **Uptime** — Nodes that miss heartbeats or fail to respond are temporarily excluded.

### Claiming Rewards

Rewards accumulate in the `RewardAccumulator` contract. You can claim them at any time:

```bash
# Via the frontend
# Connect your node wallet to the Blindference app, go to "Node Dashboard", click "Claim Rewards"

# Via direct contract call
# Interact with RewardAccumulator at 0xFa25Fb53eF8dAc88E4f43bB7558Cf3930Bf3e817
```

---

## Monitoring

The node logs structured output to stdout. In production, pipe these logs to your preferred aggregation system (Datadog, Grafana Loki, etc.).

### Log Levels

| Level | What It Means |
|-------|---------------|
| `INFO` | Normal operation: heartbeats, task received, inference started, result submitted. |
| `WARNING` | Recoverable issues: retrying CoFHE decrypt, temporary API timeout. |
| `ERROR` | Task failures: missing permit, inference error, submission failed. |
| `CRITICAL` | Node cannot continue: invalid private key, ICL unreachable, out of gas. |

### Key Metrics to Watch

- **Heartbeat interval** — Should be ~60 seconds. Gaps > 5 minutes trigger exclusion.
- **Task queue depth** — Should stay near 0. A growing queue means inference is slower than dispatch.
- **Inference latency** — Groq/Gemini typically 2-10s. vLLM depends on model size and GPU.
- **Success rate** — Ratio of accepted results to total tasks. Below 90% hurts reputation.

### Health Endpoint

The callback server exposes a health check:

```bash
curl http://localhost:9101/health
```

Expected response:
```json
{"status": "ok", "operator": "0x...", "queue_depth": 0, "last_heartbeat": "2024-05-27T12:34:56Z"}
```

---

## Troubleshooting

### "Failed to attest with ICL"

- Check that `BLINDFERENCE_NODE_ICL_BASE_URL` is reachable: `curl http://localhost:8000/health`
- Verify your private key is valid and has Sepolia ETH for gas.
- Ensure `BLINDFERENCE_NODE_CALLBACK_PUBLIC_URL` is correct and publicly accessible.

### "CoFHE decrypt failed (403)"

- This means the node's wallet does not have ACL access to the ciphertext handle.
- Verify the ICL assigned your node to the job.
- Check that the node's operator address matches the one registered in the ICL.
- Ensure the CoFHE bridge script path is correct: `BLINDFERENCE_NODE_COFHE_BRIDGE_SCRIPT`.

### "Inference API timeout"

- Groq and Gemini APIs occasionally rate-limit or timeout.
- The node retries automatically with exponential backoff.
- If timeouts persist, switch to a different model provider or run a local vLLM instance.

### "Task queue growing indefinitely"

- Your inference backend is slower than the dispatch rate.
- Increase `BLINDFERENCE_NODE_MAX_ITERATIONS` to limit concurrency, or scale up your GPU.
- Consider running multiple node instances behind a load balancer.

### "Out of gas" errors

- On-chain mode requires gas for every commitment transaction.
- Ensure your operator wallet has sufficient Sepolia ETH.
- The gas price on Arbitrum Sepolia is typically low (~0.001 ETH per transaction).

---

## API Reference

### CLI Commands

```bash
blindference-node init [--data-dir PATH]     # Initialise local state directory
blindference-node start                      # Start the node runtime
blindference-node status                     # Print configuration summary
blindference-node attest <type> --document <hash> [--counterparty <addr>] [--expires-at <ts>]
                                             # Submit an attestation (advanced)
```

### Environment Variables

All configuration is loaded from environment variables prefixed with `BLINDFERENCE_NODE_`. See [Configuration](#configuration) for the full list.

### Callback Server Endpoints

The node exposes an HTTP server for the ICL to push tasks to.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/internal/task` | `POST` | ICL dispatches a task assignment |
| `/health` | `GET` | Health check and status |
| `/metrics` | `GET` | Prometheus-compatible metrics (optional) |

### Task Payload (POST /internal/task)

```json
{
  "request_id": "uuid-string",
  "task_id": "uuid-string",
  "role": "leader",
  "model_id": "groq:llama-3.3-70b-versatile",
  "encrypted_inputs": { ... },
  "permit": "base64-encoded-sharing-permit",
  "prompt_key_store_tx": "0x...",
  "ipfs_cid": "Qm..."
}
```

---

## Links

- **Blindference main repo:** [github.com/baync180705/blindference](https://github.com/baync180705/blindference)
- **PyPI package:** [pypi.org/project/blindference-node](https://pypi.org/project/blindference-node/)
- **Blindference docs:** [docs.blindference.xyz](https://docs.blindference.xyz)
- **Fhenix CoFHE:** [fhenix.io](https://www.fhenix.io/)
- **Reineira protocol:** [reineira.xyz](https://reineira.xyz)

---

## License

BUSL-1.1 (Business Source License) — see [LICENSE](./LICENSE) for details.

The license transitions to MIT after a specified change date, at which point the code becomes fully open source.
