# Blindference — Wave 2

**Live Demo:** https://blindference.vercel.app/ · **Repo:** https://github.com/baync180705/blindference/tree/wave2

## The Gap No One Has Filled

Every AI inference API is a black box. No proof the model ran, no proof a quorum agreed, no recourse if it was wrong. Chainlink solved this for price feeds. **Blindference solves it for AI model output.**

Wave 2 is the first infrastructure where an inference result comes with a quorum certificate, an on-chain commitment, conditional settlement, and purchasable insurance — while keeping inputs completely private.

## What We Built

**Confidential quorum execution.** Features are encrypted in the browser via CoFHE. One sharing permit is created per node. The Leader and two Verifiers each decrypt locally using their own wallet-scoped permit — the coordinator never sees plaintext. Each runs the model independently and hashes the result. 2/3 must agree before anything commits.

**On-chain trust anchor.** The accepted result hash is committed to `ExecutionCommitmentRegistry` on Arbitrum Sepolia via Reineira's two-phase commit/reveal. Tamper-proof and permanent. Payment releases only after on-chain verification.

**Insurance for AI predictions.** `BlindferenceAttestor` stores `InferenceOutput` on-chain (risk score, confidence, model key). `BlindferenceUnderwriter` lets requesters buy coverage. If the prediction is wrong, `claimLoss()` pays out against an oracle — not a human.

**Compounding reputation.** Every quorum outcome updates `ReputationRegistry`. Bad nodes lose quorum slots. Good operators compound earnings.

## Why This Architecture

On-chain FHE compute can't run real models at production latency — Wave 1 hit that ceiling. Wave 2 moves compute off-chain and makes the **output** the on-chain trust primitive. CoFHE handles selective decryption via sharing permits. Reineira replaces our flat escrow with a two-phase settlement primitive. Private and economically accountable — neither is new alone. Together they are.

## What We Shipped

- **ICL**: quorum preview, dispatch, auto-finalization, two-phase commit/reveal to Arbitrum Sepolia
- **Node daemon**: CoFHE local decrypt → Groq/Gemini → result hash → ICL callback
- **5 core contracts** on Arbitrum Sepolia: `NodeAttestationRegistry`, `ExecutionCommitmentRegistry`, `AgentConfigRegistry`, `ReputationRegistry`, `RewardAccumulator`
- **Demo vertical**: `BlindferenceAttestor`, `BlindferenceUnderwriter`, `BlindferenceAgent`, Foundry integration test
- **Frontend**: live quorum progress, per-node verdicts, on-chain tx links, coverage + dispute UI
- **MCP server**: node metrics as AI agent tools

## What's Left

One external dependency: Reineira's `IEscrowReleaser` address and oracle feed were not finalized before our deadline. Everything else is built, deployed, and tested. The demo shows the full lifecycle end to end with a mock escrow release on the commitment tx. Two address swaps from full production.
