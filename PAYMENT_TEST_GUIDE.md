# Blindference Payment & Staking — Complete Test Guide

> **Goal**: Verify all payment features work end-to-end: node staking, credit deposits, inference payments, insurance, reward distribution, and slashing.

---

## Prerequisites Checklist

Before starting, ensure all services are running:

```bash
# Terminal 1: ICL
cd /path/to/blindference/network/packages/icl
uvicorn main:app --host 127.0.0.1 --port 8000

# Terminal 2: Payment Service
cd /path/to/blindference/network/packages/payment
uvicorn main:app --host 127.0.0.1 --port 8001

# Terminal 3: MongoDB
mongod --dbpath /var/lib/mongodb  # or use Docker

# Terminal 4: Frontend
cd /path/to/blindference/network/packages/frontend
npm run dev -- --host 127.0.0.1
```

Verify services are healthy:

```bash
curl http://127.0.0.1:8000/health        # ICL
curl http://127.0.0.1:8001/v1/credits/packages  # Payment Service
curl http://127.0.0.1:3000              # Frontend
```

---

## Test 1: Node Staking (CLI)

### 1A. Stake BLIND Tokens

From each node directory:

```bash
cd real/one/Blindference-node
blindference-node staking status          # Check current stake (should be 0)
blindference-node staking stake 1000      # Stake 1000 BLIND
```

**Expected output:**
```
Staking 1000.0 BLIND (1000000000000000000000 wei) …
  Approving BLIND transfer …
    Approve tx         : 0x...
  Staking …
    Stake tx           : 0x...
  Staked successfully: 0x...
  Total staked: 1000.0 BLIND
```

**What to verify on-chain:**
```bash
# Query stake info (replace with node address)
cast call 0x222Ac74201Ed58915e42Ee5be626d939fd234D0b \
  "getStakeInfo(address)((uint256,uint256,uint256,uint256,bool))" \
  0xdDef3Cf5A4d0A6404Bc084D74de3E2c0d6147dA5 \
  --rpc-url https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
# Expected: (1000000000000000000000, 0, 0, 0, true)
```

**Repeat for all 3 nodes:**
- Node 1 (`real/one/Blindference-node`): `0xdDef3Cf5A4d0A6404Bc084D74de3E2c0d6147dA5`
- Node 2 (`real/two/Blindference-node`): `0x9Cc0cBfCc4e3F45e2958F6EC0F5e70B500D0bB3E`
- Node 3 (`real/three/Blindference-node`): `0x61e72a024aE31ed2f0656a37b3B3172CDC364C85`

### 1B. Verify Stake Status

```bash
blindference-node staking status
```

**Expected:**
```
============================================================
  BLIND Stake Status
============================================================
  Staked          : 1000.00 BLIND
  Unbonding       : 0.00 BLIND
  Failures        : 0
  Active          : Yes
============================================================
```

### 1C. Verify Node Appears in ICL Active Pool

```bash
curl http://127.0.0.1:8000/internal/nodes | jq '.nodes[] | {address, active}'
```

**Expected:** 3 active nodes listed.

### 1D. Test Unstake Flow (Optional)

```bash
blindference-node staking unstake         # Initiate 96h unbonding
blindference-node staking status          # Check unbonding status
# Wait 96 hours (or mock on testnet)
blindference-node staking withdraw        # Complete unstake
```

**Expected after initiate:**
```
  Staked          : 0.00 BLIND
  Unbonding       : 1000.00 BLIND
  Unbond ready in : 345600s
```

---

## Test 2: Credit Deposits (Frontend + API)

### 2A. Check Credit Packages

```bash
curl http://127.0.0.1:8001/v1/credits/packages | jq
```

**Expected:**
```json
{
  "packages": [
    { "id": "starter", "name": "Starter", "base_calls": 100, "price_blind_wei": "100000000000000000000", "bonus_percent": 0 },
    { "id": "pro", "name": "Pro", "base_calls": 500, "price_blind_wei": "450000000000000000000", "bonus_percent": 5 },
    { "id": "enterprise", "name": "Enterprise", "base_calls": 5000, "price_blind_wei": "4000000000000000000000", "bonus_percent": 10 }
  ]
}
```

### 2B. Check User Credit Balance

```bash
# Replace with your MetaMask address
curl "http://127.0.0.1:8001/v1/credits/0xYourAddress" | jq
```

**Expected (new user):**
```json
{
  "address": "0xYourAddress",
  "balance_cusdc": 0,
  "total_deposited_cusdc": 0,
  "total_spent_cusdc": 0,
  "total_refunded_cusdc": 0
}
```

### 2C. Frontend: Buy Credits Page

1. Open http://localhost:3000/buy-credits
2. Connect MetaMask (Arbitrum Sepolia)
3. Select "Starter" package
4. Click "Purchase with BLIND"
5. Confirm MetaMask transaction
6. Wait for "Purchase successful!" toast

**What happens on-chain:**
- You send 100 BLIND to Payment Service wallet (`0x7F9B...`)
- Payment Service detects the transfer and credits your account with cUSDC-equivalent credits

**Verify via API:**
```bash
curl "http://127.0.0.1:8001/v1/credits/0xYourAddress" | jq
# Expected: balance_cusdc > 0
```

### 2D. Alternative: Direct cUSDC Deposit

If you have cUSDC:
```bash
# Notify Payment Service of a cUSDC deposit tx
curl -X POST "http://127.0.0.1:8001/v1/credits/deposit" \
  -H "Content-Type: application/json" \
  -d '{"tx_hash": "0xYourDepositTxHash", "user_address": "0xYourAddress"}' | jq
```

---

## Test 3: Inference with Credit Payment

### 3A. Frontend: Submit Text Inference

1. Open http://localhost:3000
2. Switch to "Text Inference" tab
3. Enter prompt: "What is 2+2?"
4. Select model: `groq:llama-3.3-70b-versatile`
5. Select payment mode: **Credits**
6. Select currency: **cUSDC** (or BLIND)
7. Optional: Check "Insurance coverage" (+2% premium)
8. Click "Submit"
9. MetaMask: Confirm `storeKey` transaction (stores encrypted prompt key)
10. Wait for status to reach **COMPLETED**

### 3B. Watch ICL Logs

In ICL terminal, look for:

```
# Request created
INFO | Request created: request_id=... task_id=... mode=text

# Quorum forming
INFO | Quorum formed: request_id=... leader=0x... verifiers=[0x..., 0x...]

# Nodes claiming
INFO | Node 0x... claimed assignment for task_id=...

# Leader result
INFO | Leader result submitted: request_id=... commitment_hash=0x...

# Verifier verdicts
INFO | Verifier verdict: request_id=... verifier=0x... verdict=CONFIRM

# Consensus reached
INFO | Consensus reached: request_id=... accepted=True confirmations=2

# On-chain commit
INFO | Result committed on-chain: tx_hash=0x...

# Reward distribution (Phase 4)
INFO | Rewards distributed for job=... status=distributed distributions=3
```

### 3C. Verify Credit Deduction

```bash
curl "http://127.0.0.1:8001/v1/credits/0xYourAddress" | jq
# balance_cusdc should have decreased by job price (+ insurance premium if opted in)
```

### 3D. Verify Job Status in MongoDB

```bash
mongosh blindference --eval 'db.inference_requests.findOne({}, {status: 1, metadata: 1, leader_address: 1, verifier_addresses: 1})'
```

**Expected:**
```json
{
  "status": "accepted",
  "leader_address": "0x...",
  "verifier_addresses": ["0x...", "0x..."],
  "metadata": {
    "prompt_key_store_tx": "0x...",
    "leader_submission": { ... },
    "text_leader_result": { ... }
  }
}
```

---

## Test 4: Insurance Purchase

### 4A. Submit Job with Insurance

1. On inference form, check "Insurance coverage"
2. Job price increases by 2%
3. Submit and pay

**ICL/Payment Service logs should show:**
```
INFO | Insurance opted in: job_price=5000 premium=100
INFO | Insurance purchased: coverage_id=123 escrow=456 job=...
```

### 4B. Verify Insurance on Reineira (Optional)

```bash
# Query Reineira coverage
cast call 0xC7D3706Ca2a42d739429Aec1b452051dA5Eb68f0 \
  "getCoverage(uint256)" 123 \
  --rpc-url https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
```

### 4C. File Dispute (if result is wrong)

Frontend: On completed job, click "File Dispute" (only if insurance was purchased).

**What happens:**
1. Frontend calls ICL dispute endpoint
2. ICL re-executes inference with new quorum
3. If result differs → dispute successful, insurance pays out
4. If result matches → dispute rejected

---

## Test 5: Reward Distribution (Phase 4)

### 5A. Check Payment Service BLIND Balance

```bash
cast call 0x232D5470DaaC7AD552a42d876aDEF1f778033cE0 \
  "balanceOf(address)(uint256)" \
  0x7F9B413Da50e72415b16Eb9df6e5E59774a338dc \
  --rpc-url https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
```

**If low, fund it:**
```bash
# From deployer wallet
cast send 0x232D5470DaaC7AD552a42d876aDEF1f778033cE0 \
  "transfer(address,uint256)" \
  0x7F9B413Da50e72415b16Eb9df6e5E59774a338dc \
  500000000000000000000 \
  --rpc-url https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY \
  --private-key 0x5ea99166e1520909188c93c423bdea9f9a539a7ae29965e7dc92df17a9faaf6b
```

### 5B. Check Node BLIND Balances Before Job

```bash
# Node 1
cast call 0x232D5470DaaC7AD552a42d876aDEF1f778033cE0 \
  "balanceOf(address)(uint256)" 0xdDef3Cf5A4d0A6404Bc084D74de3E2c0d6147dA5 \
  --rpc-url https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
# Node 2
cast call 0x232D5470DaaC7AD552a42d876aDEF1f778033cE0 \
  "balanceOf(address)(uint256)" 0x9Cc0cBfCc4e3F45e2958F6EC0F5e70B500D0bB3E \
  --rpc-url https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
# Node 3
cast call 0x232D5470DaaC7AD552a42d876aDEF1f778033cE0 \
  "balanceOf(address)(uint256)" 0x61e72a024aE31ed2f0656a37b3B3172CDC364C85 \
  --rpc-url https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
```

### 5C. Submit Job and Verify Rewards

After a job completes with consensus:

```bash
# Check Payment Service logs for reward distribution
# Should see: "Rewards distributed for job=... status=distributed"

# Verify node balances increased
cast call 0x232D5470DaaC7AD552a42d876aDEF1f778033cE0 \
  "balanceOf(address)(uint256)" 0xdDef3Cf5A4d0A6404Bc084D74de3E2c0d6147dA5 \
  --rpc-url https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
```

**Expected split:** 1 BLIND per job
- Leader (60%): 0.6 BLIND
- Verifier 1 (20%): 0.2 BLIND
- Verifier 2 (20%): 0.2 BLIND

### 5D. Manual Reward Distribution (Testing)

```bash
curl -X POST "http://127.0.0.1:8001/v1/rewards/distribute" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "test-job-1",
    "leader_address": "0xdDef3Cf5A4d0A6404Bc084D74de3E2c0d6147dA5",
    "verifier_addresses": [
      "0x9Cc0cBfCc4e3F45e2958F6EC0F5e70B500D0bB3E",
      "0x61e72a024aE31ed2f0656a37b3B3172CDC364C85"
    ],
    "amount_blind_wei": 1000000000000000000
  }' | jq
```

**Expected response:**
```json
{
  "status": "distributed",
  "job_id": "test-job-1",
  "distributions": [
    { "node": "0xdDef3...", "role": "leader", "amount_wei": "600000000000000000", "status": "success" },
    { "node": "0x9Cc0c...", "role": "verifier", "amount_wei": "200000000000000000", "status": "success" },
    { "node": "0x61e72...", "role": "verifier", "amount_wei": "200000000000000000", "status": "success" }
  ]
}
```

---

## Test 6: Slashing (Negative Test)

### 6A. Simulate Node Failure

Kill one node mid-job (after claiming but before completing):

```bash
# Find node PID
ps aux | grep "blindference-node run"
kill -9 <PID_OF_ONE_NODE>
```

### 6B. Submit Job and Watch Timeout

Submit a job while one node is down. After 5-minute timeout:

**ICL logs should show:**
```
WARNING | Node 0x... timed out for task_id=...
WARNING | On-chain failure recorded: node=0x... consecutive_failures=1
```

### 6C. Verify Soft Slashing (Exclusion)

```bash
curl http://127.0.0.1:8000/internal/nodes | jq '.nodes[] | select(.address == "0x...")'
# Node should be marked inactive or have failures recorded
```

### 6D. Verify Hard Slashing (3 Failures)

Kill the same node 3 times mid-job:

**After 3rd failure, ICL logs:**
```
WARNING | Node 0x... reached MAX_CONSECUTIVE_FAILURES=3 — initiating hard slash
INFO | Hard slash executed: node=0x... amount=1000000000000000000000 reason="3 consecutive timeouts"
```

**Verify on-chain:**
```bash
cast call 0x222Ac74201Ed58915e42Ee5be626d939fd234D0b \
  "getStakeInfo(address)((uint256,uint256,uint256,uint256,bool))" \
  0xKilledNodeAddress \
  --rpc-url https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
# Expected: (0, 0, 0, 0, false) — entire stake slashed
```

### 6E. Restart Node and Re-stake

```bash
blindference-node run          # Restart
blindference-node staking stake 1000  # Must re-stake to rejoin quorum
```

---

## Test 7: Frontend UI Checks

### 7A. Node Registration Page

1. Open http://localhost:3000/node-registration
2. Verify staking docs are visible:
   - "Nodes must stake at least 1000 BLIND"
   - CLI commands: `stake`, `status`, `unstake`, `withdraw`
   - Slashing conditions listed
3. Check "Staking Economics" section shows:
   - Min stake: 1000 BLIND
   - Unbonding: 96 hours
   - 3 failures → hard slash

### 7B. Buy Credits Page

1. Open http://localhost:3000/buy-credits
2. Verify 3 packages displayed: Starter, Pro, Enterprise
3. Check prices in BLIND
4. Verify "Connect Wallet" button works
5. Test purchase flow (MetaMask confirmation)

### 7C. Inference Status Page

1. Submit a job
2. Navigate to status page
3. Verify status timeline shows stages:
   - PREPARING → ENCRYPTING → SUBMITTING → QUORUM_FORMING → CLAIMING → PROCESSING → VERIFYING → COMPLETED
4. Verify leader and verifier addresses are shown
5. If insurance purchased, verify "File Dispute" button appears
6. If job fails, verify FAILED stage with red AlertCircle

### 7D. Credit Balance Component

1. Look for credit balance display in header/nav
2. Click to open DepositModal
3. Verify deposit form accepts tx hash
4. After deposit, verify balance updates

---

## Test 8: API Endpoints (Direct Testing)

### 8A. Credit Deduction (ICL → Payment Service)

```bash
# Simulate ICL deducting credits for a job
curl -X POST "http://127.0.0.1:8001/v1/deduct" \
  -H "Content-Type: application/json" \
  -d '{
    "user_address": "0xYourAddress",
    "amount_cusdc": 5000,
    "job_id": "test-deduct-1",
    "insurance_opt_in": false
  }' | jq
```

### 8B. Credit Refund

```bash
curl -X POST "http://127.0.0.1:8001/v1/credits/refund" \
  -H "Content-Type: application/json" \
  -d '{
    "user_address": "0xYourAddress",
    "amount_cusdc": 5000,
    "reason": "dispute_resolved"
  }' | jq
```

### 8C. Debug Credits

```bash
curl "http://127.0.0.1:8001/v1/credits/debug/0xYourAddress" | jq
```

---

## Quick Reference: All Commands

### Node CLI (from each node directory)

```bash
blindference-node staking status           # Show stake
blindference-node staking stake 1000       # Stake 1000 BLIND
blindference-node staking unstake          # Start unbonding
blindference-node staking withdraw         # Complete withdrawal
blindference-node status                   # Node identity + attestation
blindference-node run                      # Start job poller
```

### On-Chain Queries (cast)

```bash
# BLIND token balance
cast call 0x232D5470DaaC7AD552a42d876aDEF1f778033cE0 \
  "balanceOf(address)(uint256)" <ADDRESS> \
  --rpc-url https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY

# Stake info
cast call 0x222Ac74201Ed58915e42Ee5be626d939fd234D0b \
  "getStakeInfo(address)((uint256,uint256,uint256,uint256,bool))" <NODE_ADDRESS> \
  --rpc-url https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY

# Transfer BLIND (from deployer)
cast send 0x232D5470DaaC7AD552a42d876aDEF1f778033cE0 \
  "transfer(address,uint256)" <TO> <AMOUNT_WEI> \
  --rpc-url https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY \
  --private-key 0x5ea99166e1520909188c93c423bdea9f9a539a7ae29965e7dc92df17a9faaf6b
```

### Service Health Checks

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/internal/nodes
curl http://127.0.0.1:8001/v1/credits/packages
curl "http://127.0.0.1:8001/v1/credits/<ADDRESS>"
```

---

## Log Monitoring Checklist

### ICL Terminal — Watch For

| What | Log Pattern | Severity |
|------|-------------|----------|
| Request created | `Request created: request_id=` | INFO |
| Quorum formed | `Quorum formed: request_id=` | INFO |
| Node claimed | `Node ... claimed assignment` | INFO |
| Node timeout | `Node ... timed out` | WARNING |
| Failure recorded | `On-chain failure recorded` | WARNING |
| Consensus reached | `Consensus reached: accepted=True` | INFO |
| Result committed | `Result committed on-chain: tx_hash=` | INFO |
| Reward distributed | `Rewards distributed for job=` | INFO |
| Reward failed | `Reward distribution failed` | ERROR |

### Payment Service Terminal — Watch For

| What | Log Pattern | Severity |
|------|-------------|----------|
| Credits deducted | `Deducted credits: user=` | INFO |
| Insurance opted in | `Insurance opted in:` | INFO |
| Package purchased | `Package purchased: user=` | INFO |
| Reward distributed | `Rewards distributed: job=` | INFO |
| Insufficient balance | `Insufficient BLIND balance` | WARNING |

### Node Terminal — Watch For

| What | Log Pattern | Severity |
|------|-------------|----------|
| Job claimed | `Claiming assignment` | INFO |
| Decrypting | `Decrypting prompt key` | INFO |
| Inference | `Running inference` | INFO |
| Result submitted | `Submitting result to ICL` | INFO |
| Heartbeat | `Heartbeat tx` | INFO |
| Error | `ERROR:` | ERROR |

---

## Troubleshooting

### "Insufficient BLIND balance for reward distribution"

**Fix:** Fund Payment Service wallet:
```bash
cast send 0x232D5470DaaC7AD552a42d876aDEF1f778033cE0 \
  "transfer(address,uint256)" 0x7F9B413Da50e72415b16Eb9df6e5E59774a338dc 500000000000000000000 \
  --rpc-url https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY \
  --private-key 0x5ea99166e1520909188c93c423bdea9f9a539a7ae29965e7dc92df17a9faaf6b
```

### "No active nodes in ICL pool"

**Fix:** Ensure nodes are attested, staked, and heartbeating:
```bash
blindference-node attest --mock
blindference-node staking stake 1000
blindference-node run
```

### "Node not receiving assignments"

**Check:**
1. Node status: `blindference-node status` — attestation valid?
2. ICL heartbeat logs
3. Node address matches registered address
4. Node has sufficient stake (≥1000 BLIND)

### "Credit balance not updating after purchase"

**Check:**
1. MetaMask transaction confirmed on Arbitrum Sepolia
2. Payment Service logs show transfer detection
3. Call `/v1/credits/debug/<address>` to inspect raw record

---

## Contract Addresses (Arbitrum Sepolia)

| Contract | Address |
|----------|---------|
| BLIND Token | `0x232D5470DaaC7AD552a42d876aDEF1f778033cE0` |
| BlindferenceStaking | `0x222Ac74201Ed58915e42Ee5be626d939fd234D0b` |
| Payment Service Wallet | `0x7F9B413Da50e72415b16Eb9df6e5E59774a338dc` |
| NodeRegistry | `0x72C0Ead949Fd2C346598a30AF1A69c3c5Cb86082` |
| PromptKeyStore | `0x1E22dD12f448B15f1Ca8560fB6B4463834FaAf73` |
| ResultRegistry | `0xCebd831eCd00915E299b8Ef2666cAbf942dc7150` |

---

## Success Criteria

- [ ] All 3 nodes staked ≥1000 BLIND and show `Active: Yes`
- [ ] User can buy credits via frontend
- [ ] User can submit inference with credit payment
- [ ] Job completes with consensus (2/3 CONFIRM)
- [ ] Leader and verifiers receive BLIND rewards
- [ ] Node balances increase after reward distribution
- [ ] Insurance can be purchased and disputed
- [ ] Node with 3 failures gets hard-slashed (stake goes to 0)
- [ ] Frontend shows correct status timeline for all stages
- [ ] All ICL, Payment Service, and node logs show expected patterns
