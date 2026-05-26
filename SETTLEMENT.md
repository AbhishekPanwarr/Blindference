# Settlement Mechanics

This document explains how payment, escrow, insurance, and rewards work in the Blindference network. It is written for users who want to understand the financial flow, and for node operators who want to know how they get paid.

---

## Table of Contents

- [Overview](#overview)
- [Payment Methods](#payment-methods)
- [Escrow Creation](#escrow-creation)
- [Insurance](#insurance)
- [Reward Distribution](#reward-distribution)
- [Slashing](#slashing)
- [Disputes](#disputes)
- [Wrapping USDC to cUSDC](#wrapping-usdc-to-cusdc)
- [FAQ](#faq)

---

## Overview

Every inference job in Blindference is financially backed. When a user submits a job, the system collects payment, locks it in an escrow, runs the inference through a quorum of nodes, and distributes rewards only after the quorum reaches consensus. If the quorum rejects the result, the user is protected by either a refund or an insurance payout.

This creates a simple rule: **Nodes are paid for correct work. Users are protected against bad work.**

---

## Payment Methods

Users can pay for inference jobs in three ways. Each has different trade-offs between speed, cost, and decentralisation.

### 1. Credit Mode (Fastest)

Users pre-purchase credits in bulk using BLIND tokens or cUSDC. The Payment Service deducts the job fee from their balance instantly. No per-job MetaMask popups. No gas fees for the user.

- **Best for:** Power users, agents, and applications making many calls.
- **Discount:** 20% cheaper than direct cUSDC payment.
- **Refund:** If a job is rejected, credits are refunded to the user's balance immediately.

### 2. Direct cUSDC Mode (Most Decentralised)

Users pay per job with confidential USDC (cUSDC) through a Reineira escrow. Each job creates a separate escrow contract that locks the payment until the quorum reaches consensus.

- **Best for:** Users who want full on-chain transparency for each job.
- **Cost:** Exact job fee + gas for escrow creation.
- **Refund:** If rejected, the escrow releases funds back to the user.

### 3. BLIND Token Mode (Protocol Native)

Users pay with BLIND tokens. The Payment Service converts the BLIND amount to a cUSDC-equivalent fee at the current rate.

- **Best for:** Users who already hold BLIND tokens (e.g., from staking rewards or the faucet).
- **Discount:** Same as credit mode — 20% cheaper than direct cUSDC.

---

## Escrow Creation

When a user submits a job in direct cUSDC mode, the Payment Service builds a Reineira ConfidentialEscrow. The escrow is a smart contract that holds the payment and releases it only when a specific condition is met.

### Escrow Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Owner | `PayoutClaimer` contract | The contract that distributes rewards to nodes |
| Amount | Job fee in cUSDC wei | Determined by model, coverage, and quorum tier |
| Resolver | `InferenceGate` contract | The contract that checks whether the quorum reached consensus |
| Resolver Data | `abi.encode(bytes32(jobId))` | The specific job ID the resolver validates |

### Escrow Lifecycle

```
1. User approves cUSDC transfer.
2. Payment Service calls Reineira SDK: build escrow → create → fund.
3. Escrow holds cUSDC. Ownership is encrypted (FHE). Only the owner can claim.
4. Quorum runs inference and submits results.
5. ICL commits accepted result to ResultRegistry.
6. InferenceGate checks: was this jobId accepted by the quorum?
7. If yes → PayoutClaimer calls escrow.redeem() → cUSDC is released.
8. If no → Escrow remains locked. User can claim refund after dispute window.
```

The escrow uses FHE-encrypted ownership. The amount and owner are encrypted on-chain. This means:
- The escrow balance is confidential.
- The owner address is confidential.
- Only the resolver contract (InferenceGate) can trigger release.

---

## Insurance

Users can purchase optional insurance for any job. Insurance protects against quorum rejection due to node failure or malicious behaviour.

### How It Works

- **Premium:** 2% of the job fee.
- **Coverage:** 100% of the job fee.
- **Duration:** 72 hours from job creation.
- **Trigger:** Quorum rejects the result (all three nodes disagree, or leader fails to submit).

### Insurance Flow

```
1. User selects "Add insurance" at checkout.
2. Payment Service calculates premium: jobFee * 0.02.
3. Premium is sent to the Insurance Pool (managed by BlindferenceUnderwriter).
4. Job proceeds normally.
5. If quorum ACCEPTS → insurance expires unused. Premium stays in the pool.
6. If quorum REJECTS → user opens a claim within 72 hours.
7. PayoutClaimer checks ResultRegistry: was this jobId rejected?
8. If verified rejected → user receives full job fee + premium back.
9. If user doesn't claim within 72h → claim expires.
```

### Insurance Pool

The pool is funded by premiums from all insured jobs. It is managed by the `BlindferenceUnderwriter` contract. In the testnet deployment, the pool is seeded with a mock balance for demonstration purposes. In production, the pool would be backed by a combination of premium accumulation and protocol treasury reserves.

---

## Reward Distribution

When a job is accepted, the escrow releases cUSDC to the `PayoutClaimer` contract, which automatically distributes it to the quorum nodes.

### Distribution Split

| Recipient | Share | Calculation |
|-----------|-------|-------------|
| Leader | 60% | `totalFee * 0.60` |
| Verifier 1 | 20% | `totalFee * 0.20` |
| Verifier 2 | 20% | `totalFee * 0.20` |

### Example

For a job fee of 1000 cUSDC wei ($0.001 at 6 decimals):

- Leader receives: 600 cUSDC wei
- Each verifier receives: 200 cUSDC wei

### Payment Timing

- **ICL mode:** Payment Service distributes within seconds of ICL notification. Nodes see BLIND rewards in their balance immediately.
- **On-chain mode:** The `BlindferenceInference` contract auto-distributes on-chain. Nodes claim rewards via the `RewardAccumulator` contract.

---

## Slashing

Node operators stake BLIND tokens to participate in the network. Bad behaviour results in financial penalties.

### Slashing Conditions

| Condition | Penalty | Trigger |
|-----------|---------|---------|
| 3 consecutive failed jobs | 10% of stake burned | Automatic on third failure |
| Verdict manipulation | 25% of stake burned | On-chain detection of hash mismatch with evidence |
| Missing heartbeat | Temporary exclusion | No heartbeat within 300-second grace period |
| Failure to commit within window | Job rejected, reputation hit | 600-second commit window expires |

### Staking Requirements

- **Minimum stake:** 1000 BLIND tokens.
- **Unbond period:** 96 hours. After initiating unstake, funds are locked for 4 days before withdrawal.
- **Re-staking:** Slashed nodes can re-stake after a cooldown period, but their reputation score is reset.

### Reputation System

Nodes earn reputation points for each successful job:
- **Leader, accepted:** +10 points
- **Verifier, match:** +5 points
- **Verifier, mismatch (correct rejection):** +8 points
- **Failed job:** -15 points
- **Slashed:** -50 points

Quorum selection weights nodes by reputation. Higher reputation = more frequent assignment = more earnings.

---

## Disputes

If a user believes the quorum was wrong — for example, the result was correct but verifiers incorrectly rejected it — they can open a dispute.

### Dispute Window

- **Duration:** 72 hours from job creation.
- **Cost:** Free to open. A bond of 100 BLIND is required to prevent spam. The bond is returned if the dispute is upheld.

### Dispute Process

```
1. User opens a dispute via the frontend, providing evidence (original prompt, expected output).
2. The dispute is assigned to an arbiter from the ArbiterSelectionRegistry.
3. The arbiter reviews the evidence and the on-chain quorum record.
4. Arbiter votes: uphold or reject.
5. If upheld → user's job fee is refunded from the insurance pool. Leader is slashed 25%.
6. If rejected → user's bond is forfeited to the insurance pool.
```

### Arbiter Selection

Arbiters are high-reputation nodes or protocol governors selected randomly from the `ArbiterSelectionRegistry`. They are incentivised to vote correctly because their own reputation is at stake.

---

## Wrapping USDC to cUSDC

Blindference uses confidential USDC (cUSDC) for all on-chain payments. cUSDC is a FHE-encrypted ERC-20 token on Arbitrum Sepolia. Users who hold regular USDC must wrap it into cUSDC before paying for jobs.

### Wrap Process

```
1. User holds USDC on Arbitrum Sepolia (0x75fa...AA4d).
2. User calls the Reineira SDK escrow flow:
   a. Create an unconditional escrow.
   b. Fund the escrow with USDC (SDK auto-approves).
   c. Redeem the escrow → receive cUSDC.
3. cUSDC is now in the user's wallet.
4. User can pay for jobs or stake in the protocol.
```

The wrap process uses a temporary Reineira escrow to convert plain USDC to confidential cUSDC. The escrow ensures the conversion is atomic and verifiable.

### cUSDC Token

- **Address:** `0x42E47f9bA89712C317f60A72C81A610A2b68c48a`
- **Decimals:** 6 (same as USDC)
- **Properties:** FHE-encrypted balances. `balanceOf()` returns a ciphertext handle, not a plain number.
- **Transfers:** `confidentialTransfer()` encrypts the amount on-chain before sending.

### Adding cUSDC to MetaMask

1. Open MetaMask and select Arbitrum Sepolia network.
2. Click "Import tokens" → "Custom token".
3. Paste address: `0x42E47f9bA89712C317f60A72C81A610A2b68c48a`
4. Symbol: cUSDC, Decimals: 6.
5. Click "Add custom token".

Note: MetaMask may not display the balance numerically because it is encrypted. The Blindference frontend provides a balance checker that queries the encrypted handle.

---

## FAQ

**Q: Why do I need to wrap USDC to cUSDC?**
A: Blindference uses confidential tokens for all on-chain financial operations. cUSDC is FHE-encrypted, meaning balances and transfer amounts are private. This prevents observers from tracking who paid for what.

**Q: What happens if all three nodes fail?**
A: The job is marked as REJECTED. If you purchased insurance, you can claim a full refund within 72 hours. If not, your payment is refunded to your credit balance (credit mode) or held in escrow for manual release (direct mode).

**Q: How do nodes get paid if the escrow is encrypted?**
A: The escrow owner is set to the `PayoutClaimer` contract. When the `InferenceGate` resolver confirms consensus, `PayoutClaimer` calls `redeem()` and the escrow releases cUSDC to the contract. The contract then distributes it to the nodes according to the pre-defined split. The encrypted ownership prevents anyone else from claiming the funds.

**Q: Can I pay with regular ETH?**
A: Not directly. The protocol only accepts cUSDC or BLIND tokens for job payment. You can acquire BLIND tokens from the BlindFaucet (testnet) or purchase them on a DEX.

**Q: What is the minimum job fee?**
A: Job fees are calculated per-model. The cheapest model (Groq Llama 3) starts at approximately 1000 cUSDC wei ($0.001). Higher-tier models and larger context windows cost more.

**Q: Do I pay gas for every job?**
A: Only in direct cUSDC mode. In credit mode, the Payment Service batches operations and pays gas on your behalf. In on-chain mode, you pay gas for the initial contract call.

**Q: How long does a job take?**
A: Typical end-to-end time is 30-120 seconds: 5-10s for encryption, 10-30s for quorum execution, 5-10s for consensus and settlement. On-chain mode adds 15-30s for block confirmation.
