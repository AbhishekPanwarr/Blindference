# Blindference — Confidential AI Inference for Agents

**Live:** www.blindference.xyz | **Docs:** www.blindference.xyz/docs | **Node:** `pip install blindference-node` | **SDK:** `npm install -g @abhieren/blindference-agent` | **WP:** [IPFS](https://ivory-late-quokka-745.mypinata.cloud/ipfs/bafybeicnnfmvj6xt2w2dhvv6idfxje3fvtgu7ngbwmreknn53utneomezy) | **YT:** [Playlist](https://www.youtube.com/playlist?list=PL...) | **GH:** [github.com/AbhishekPanwarr/blindference](https://github.com/AbhishekPanwarr/blindference)

Blindference is the verifiable compute layer for agentic AI — encrypted end-to-end, quorum-validated, on-chain settled through Reineira.

**1. Testnet live** — Text inference on Arbitrum Sepolia. Browser AES-256-GCM encrypts prompts; CoFHE gates keys via `BlindferenceInputVault`; IPFS blob; 1 leader + 2 verifiers run identical models (Groq Llama 3.3 70B / Gemini 2.5 Flash); ≥2/3 hash match commits on-chain; only the caller wallet decrypts. Verified with real MetaMask wallets.

**2. Payments live** — cUSDC/BLIND credit balances or Reineira escrows. Auto-release on `ACCEPTED`, auto-refund on rejection. 2% insurance premium. Node rewards split 60/20/20.

**3. Reineira settlement** — `PayoutClaimer` + `InferenceGate` implement `IConditionResolver`. `BlindferenceInference` enforces quorum before payout. `BlindferenceUnderwriter` handles disputes. Auto-verify, auto-payout, auto-refund all on testnet.

**4. Builder packages** — `blindference-node` on PyPI: one-command `init` → `run` with CoFHE bridge. `@abhieren/blindference-agent` on npm: CLI (`infer`, `balance`, `buy-package`), TypeScript SDK (`createJob`, `pollUntilTerminal`), and MCP server for Claude/Cursor.

**5. YouTube** — 5 videos: intro, live demo, architecture deep-dive, node setup, agent SDK integration.

**6. Tested by builders** — @ashishexee: *"smooth and confidential, easy testing"*; @Lakshay7847: *"loved the UI and end-to-end testing"*; @Oggy113: *"smooth testing across quorum and agent SDK"*.

**7. Docs live** — Mintlify at /docs: node setup, SDK quickstart, CLI reference, Python interop, troubleshooting. Product pages at /vision and /architecture.

Blindference is **live, tested, builder-ready** — one confidential inference rail for humans and autonomous agents.
