# Blindference Payment Service — Manual Test Guide (Phase 1-4)

> **Goal**: Verify every part of the Payment Service gateway architecture manually: credit purchases, job submission, escrow/insurance, ICL forwarding, callback handling, reward distribution, refunds, node earnings, and edge cases.

**Architecture under test:**
```
Frontend → Payment Service (8001) → ICL (8000) → Nodes
                          ↑______________│
                          (callback on complete/fail)
```

The ICL never touches payment logic. All payment state lives in the Payment Service.

---

## Quick Start — 5 Minutes to First Test

### Step 0: Pre-Flight Checklist

Run this in your shell before starting anything:

```bash
# Check MongoDB
mongosh --eval 'db.adminCommand({ping:1})' 2>/dev/null && echo "MongoDB: OK" || echo "MongoDB: START IT FIRST"

# Check Python envs exist
ls blindference/network/packages/icl/.venv/bin/uvicorn 2>/dev/null && echo "ICL venv: OK" || echo "ICL venv: MISSING — run: cd blindference/network/packages/icl && python -m venv .venv && source .venv/bin/activate && pip install -e ."
ls blindference/network/packages/payment/.venv/bin/uvicorn 2>/dev/null && echo "Payment venv: OK" || echo "Payment venv: MISSING"

# Check node CLI
blindference-node --version 2>/dev/null && echo "Node CLI: OK" || echo "Node CLI: MISSING — run: cd Blindference-node && pip install -e ."

# Check cast (Foundry)
cast --version 2>/dev/null && echo "Foundry: OK" || echo "Foundry: MISSING — install from https://getfoundry.sh"
```

### Step 1: Start Services (4 Terminals)

```bash
# Terminal 1 — MongoDB (if not already running as service)
sudo systemctl start mongod 2>/dev/null || mongod --dbpath ~/mongodb-data --fork --logpath ~/mongodb.log

# Terminal 2 — ICL
cd blindference/network/packages/icl
source .venv/bin/activate
export $(cat .env | xargs) 2>/dev/null
uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 3 — Payment Service
cd blindference/network/packages/payment
source .venv/bin/activate
export $(cat .env | xargs) 2>/dev/null
uvicorn main:app --host 127.0.0.1 --port 8001 --reload

# Terminal 4 — Frontend (optional, for browser tests)
cd blindference/network/packages/frontend
npm run dev -- --host 127.0.0.1
```

### Step 2: Verify Services Are Up

```bash
curl -s http://127.0.0.1:8000/health | jq .status 2>/dev/null || echo "ICL: DOWN"
curl -s http://127.0.0.1:8001/v1/credits/packages | jq '.packages | length' 2>/dev/null || echo "Payment: DOWN"
```

Expected: `3` packages from Payment Service.

### Step 3: Start 3 Nodes (3 More Terminals)

```bash
# Terminal 5 — Node 1 (Leader)
cd Blindference-node
blindference-node run

# Terminal 6 — Node 2 (Verifier 1)
cd Blindference-node
# Use a different private key via config or env
BLF_PRIVATE_KEY=0x... blindference-node run

# Terminal 7 — Node 3 (Verifier 2)
cd Blindference-node
BLF_PRIVATE_KEY=0x... blindference-node run
```

> **Tip**: If you only have 1 node configured, the ICL bootstrap demo creates 3 mock operators. For real testing you need 3 actual nodes. See [Blindference-node/AGENTS.md](../Blindference-node/AGENTS.md) for setup.

---

## Smoke Test — Automated (No Browser Needed)

Run the Node.js smoke test script to verify the Payment Service → ICL flow:

```bash
cd blindference/network/scripts/demo
# Install deps if first time
npm install axios

# Run smoke test (requires ICL + Payment Service running)
node smoke-gateway-flow.mjs
```

**What it does:**
1. Submits a job to Payment Service
2. Verifies 200 response with `job_id`
3. Polls Payment Service for status
4. Checks credit balance was deducted
5. Waits for completion (or timeout)

**Look for:**
- `✓ Job submitted: job_... status=RUNNING`
- `✓ Credits deducted: balance=...`
- `✓ Job completed: status=COMPLETED` (if nodes are running)
- `✓ Job failed with refund: status=FAILED` (if nodes not running — this is also valid!)

**If it fails early:**
- Check ICL is on port 8000: `curl http://127.0.0.1:8000/health`
- Check Payment Service is on port 8001: `curl http://127.0.0.1:8001/v1/credits/packages`
- Check MongoDB: `mongosh --eval 'db.adminCommand({ping:1})'`

---

## Full Prerequisites

Ensure these are set in `network/packages/payment/.env`:
```bash
MONGODB_URL=mongodb://localhost:27017/blindference_payments
ARBITRUM_SEPOLIA_RPC=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
BLIND_TOKEN_ADDRESS=0x232D5470DaaC7AD552a42d876aDEF1f778033cE0
CUSDC_TOKEN_ADDRESS=0x42E47f9bA89712C317f60A72C81A610A2b68c48a
PAYOUT_CLAIMER_ADDRESS=0xEfB565c7989dd1dEDD0C5B8c95dA24Ef2d94FBbd
INFERENCE_GATE_ADDRESS=0xF3014a79985f83898912cAe2676226310A546905
ICL_WALLET_PRIVATE_KEY=0x...        # For on-chain txs
PAYMENT_SERVICE_WALLET_KEY=0x...    # For reward distribution
```

Ensure these are set in `network/packages/icl/.env`:
```bash
PAYMENT_SERVICE_URL=http://127.0.0.1:8001
```

### 4. Funding Requirements

| Account | Needs | How to Fund |
|---------|-------|-------------|
| Payment Service wallet (`0x7F9B...`) | BLIND for rewards | Deployer sends BLIND |
| Your MetaMask test wallet | ETH for gas, BLIND to buy credits | Faucet + deployer |
| Node 1, 2, 3 | ETH for gas | Faucet |

**Fund Payment Service wallet (from deployer):**
```bash
cast send 0x232D5470DaaC7AD552a42d876aDEF1f778033cE0 \
  "transfer(address,uint256)" \
  0x7F9B413Da50e72415b16Eb9df6e5E59774a338dc \
  10000000000000000000000 \
  --rpc-url https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY \
  --private-key 0x5ea99166e1520909188c93c423bdea9f9a539a7ae29965e7dc92df17a9faaf6b
```

---

## Test 1: Credit Packages & Balance (API)

### 1A. List Credit Packages

```bash
curl -s http://127.0.0.1:8001/v1/credits/packages | jq
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

**What to verify:**
- [ ] 3 packages returned
- [ ] `price_blind_wei` is a string (not number, to prevent int64 overflow)
- [ ] Response is fast (< 100ms, no DB query needed)

### 1B. Check User Balance (Empty)

```bash
curl -s "http://127.0.0.1:8001/v1/credits/0xYourMetaMaskAddress" | jq
```

**Expected:**
```json
{
  "address": "0xYourMetaMaskAddress",
  "balance_cusdc": 0,
  "total_deposited_cusdc": 0,
  "total_spent_cusdc": 0,
  "total_refunded_cusdc": 0
}
```

**What to verify:**
- [ ] All values are `0` for new user
- [ ] `balance_cusdc` is integer (cents), not wei

---

## Test 2: Buy Credits via Frontend

### 2A. Frontend Flow

1. Open http://localhost:3000/buy-credits
2. Connect MetaMask (Arbitrum Sepolia)
3. Select "Starter" package (100 BLIND)
4. Click "Purchase with BLIND"
5. **MetaMask popup**: Confirm BLIND token transfer to Payment Service wallet
6. Wait for "Purchase successful!" toast

### 2B. Verify On-Chain Transfer

```bash
cast call 0x232D5470DaaC7AD552a42d876aDEF1f778033cE0 \
  "balanceOf(address)(uint256)" \
  0x7F9B413Da50e72415b16Eb9df6e5E59774a338dc \
  --rpc-url https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
# Should have increased by package price (100 BLIND = 100000000000000000000 wei)
```

### 2C. Verify API Balance Updated

```bash
curl -s "http://127.0.0.1:8001/v1/credits/0xYourMetaMaskAddress" | jq
```

**Expected:**
```json
{
  "address": "0xYourMetaMaskAddress",
  "balance_cusdc": 10000,   // 100 * 100 (cents per credit)
  "total_deposited_cusdc": 10000,
  "total_spent_cusdc": 0,
  "total_refunded_cusdc": 0
}
```

**What to verify:**
- [ ] `balance_cusdc` increased by `base_calls * 100` (100 * 100 = 10,000 cents)
- [ ] `total_deposited_cusdc` matches
- [ ] No `total_spent` or `total_refunded` yet

### 2D. Verify MongoDB Storage (Decimal128)

```bash
mongosh blindference_payments --eval 'db.credit_balances.findOne({address: "0xYourMetaMaskAddress"})'
```

**What to verify:**
- [ ] Document exists with `_id`
- [ ] `balance` field is `Decimal128` type (not `int64` or `Number`)
- [ ] `balance` equals `NumberDecimal("10000")`
- [ ] `total_deposited`, `total_spent`, `total_refunded` are also `Decimal128`

---

## Test 3: Submit Job with Insufficient Credits (402)

### 3A. API Test

```bash
curl -s -X POST http://127.0.0.1:8001/v1/jobs/submit \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "user_address": "0xYourMetaMaskAddress",
    "model_id": "groq:llama-3.3-70b-versatile",
    "prompt_cid": "QmTest",
    "encrypted_prompt_key": {"high": "123", "low": "456"},
    "metadata": {},
    "amount_credits": 999999
  }' | jq
```

**Expected:**
```json
{
  "detail": "Insufficient credits. Required: 999999, Available: 10000"
}
```

**HTTP status:** `402 Payment Required`

### 3B. Verify No State Changes

```bash
mongosh blindference_payments --eval 'db.jobs.find({"user_address": "0xYourMetaMaskAddress"}).count()'
# Expected: 0 (no job document created)
```

```bash
curl -s "http://127.0.0.1:8001/v1/credits/0xYourMetaMaskAddress" | jq '.balance_cusdc'
# Expected: 10000 (no deduction happened)
```

**What to verify:**
- [ ] HTTP 402 returned immediately
- [ ] No job document created in MongoDB
- [ ] User credit balance unchanged
- [ ] No on-chain transactions sent
- [ ] ICL was never contacted

---

## Test 4: Submit Job Successfully (Full Flow)

### 4A. Prepare: Ensure Nodes Are Running

Start 3 nodes (in separate terminals):
```bash
cd Blindference-node
blindference-node run
```

Verify they appear in ICL:
```bash
curl -s http://127.0.0.1:8000/internal/nodes | jq '.nodes | length'
# Expected: 3
```

### 4B. Submit Job via API

```bash
curl -s -X POST http://127.0.0.1:8001/v1/jobs/submit \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "0x'$(openssl rand -hex 32)'",
    "user_address": "0xYourMetaMaskAddress",
    "model_id": "groq:llama-3.3-70b-versatile",
    "prompt_cid": "QmTestPrompt123",
    "encrypted_prompt_key": {"high": "12345678901234567890", "low": "98765432109876543210"},
    "metadata": {
      "prompt_key_store_tx": "0xabc123",
      "cofhe_prompt_key_inputs": {"high": "enc_high_123", "low": "enc_low_456"}
    },
    "amount_credits": 100
  }' | jq
```

**Expected (immediate response):**
```json
{
  "job_id": "job_0x...",
  "status": "RUNNING",
  "request_id": "req_...",
  "amount_credits": 100,
  "transaction_hash": "0x...",
  "created_at": "2026-05-25T..."
}
```

### 4C. Verify Credit Deduction

```bash
curl -s "http://127.0.0.1:8001/v1/credits/0xYourMetaMaskAddress" | jq
```

**Expected:**
```json
{
  "balance_cusdc": 9900,      // 10000 - 100
  "total_spent_cusdc": 100,
  ...
}
```

**What to verify:**
- [ ] Balance decreased by exactly 100
- [ ] `total_spent_cusdc` increased by 100
- [ ] `total_deposited` unchanged

### 4D. Verify Job Document in MongoDB

```bash
mongosh blindference_payments --eval 'db.jobs.findOne({}).pretty()'
```

**What to verify:**
- [ ] Document has `job_id`, `task_id`, `user_address`, `status: "RUNNING"`
- [ ] `amount_credits` is `Decimal128` (not int)
- [ ] `metadata` includes `cofhe_prompt_key_inputs` (passthrough from submit)
- [ ] `transaction_hash` exists (escrow creation tx)
- [ ] `request_id` exists (ICL request ID returned from internal endpoint)

### 4E. Verify ICL Received the Request

Check ICL terminal logs:
```
INFO | Request created: request_id=... task_id=... mode=text
INFO | Quorum formed: request_id=... leader=0x... verifiers=[0x..., 0x...]
```

Or query ICL directly:
```bash
curl -s "http://127.0.0.1:8000/v1/inference/requests" | jq '.requests[0]'
```

**What to verify:**
- [ ] ICL has a request with matching `task_id`
- [ ] `status` is `queued` or later
- [ ] `metadata.prompt_key_store_tx` is `"0xabc123"` (from your submit)
- [ ] `metadata.cofhe_prompt_key_inputs` is present

### 4F. Watch Job Completion

Poll Payment Service:
```bash
curl -s "http://127.0.0.1:8001/v1/jobs/job_0x..." | jq
```

**During execution:** `status: "RUNNING"`
**After completion:** `status: "COMPLETED"` or `status: "FAILED"`

**What to verify for COMPLETED:**
- [ ] `status` changed from `RUNNING` → `COMPLETED`
- [ ] `completed_at` timestamp present
- [ ] `rewards` field has leader + verifier addresses with amounts:
  ```json
  "rewards": {
    "0xLeaderAddress...": 0.6,
    "0xVerifier1Address...": 0.2,
    "0xVerifier2Address...": 0.2
  }
  ```
- [ ] `request_id` matches ICL's request

### 4G. Verify ICL Callback

Check Payment Service terminal logs:
```
INFO | Job completion callback received: job_id=... status=COMPLETED
INFO | Distributing rewards for job=... leader=0x... verifiers=[0x..., 0x...]
INFO | Rewards distributed: job=... status=success
```

**What to verify:**
- [ ] Callback was received (not 404)
- [ ] Rewards were distributed (if COMPLETED)
- [ ] No error logs about callback failures

---

## Test 5: Reward Distribution Verification

### 5A. Check Payment Service BLIND Balance Before

```bash
cast call 0x232D5470DaaC7AD552a42d876aDEF1f778033cE0 \
  "balanceOf(address)(uint256)" \
  0x7F9B413Da50e72415b16Eb9df6e5E59774a338dc \
  --rpc-url https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
```

### 5B. Check Node BLIND Balances Before

```bash
# Node 1 (leader usually)
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

### 5C. Run a Job and Wait for Completion

Repeat Test 4. After `status: "COMPLETED"`:

### 5D. Verify Node Balances Increased

```bash
# Re-run the same cast calls as 5B
```

**Expected increases (per job):**
- Leader: +0.6 BLIND
- Verifier 1: +0.2 BLIND  
- Verifier 2: +0.2 BLIND
- Payment Service wallet: -1.0 BLIND

### 5E. Verify via Node CLI

```bash
cd Blindference-node
blindference-node jobs list --limit 5
```

**Expected output:**
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃              BLINDFERENCE NODE — JOB HISTORY             ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  Node Address : 0x...                                     ┃
┃  Total Jobs   : 1                                         ┃
┃  Total Earned : 0.6 BLIND                                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

  Job ID          Role      Status     Earned (BLIND)
  ─────────────────────────────────────────────────────
  job_0xabc...    leader    COMPLETED  0.6
```

**What to verify:**
- [ ] `jobs list` returns the completed job
- [ ] `role` matches what the node actually did (leader/verifier)
- [ ] `amount_blind_earned` is correct (0.6 for leader, 0.2 for verifier)
- [ ] Total earned is sum of all jobs

---

## Test 6: Job Failure → Credit Refund

### 6A. Kill All Nodes Mid-Job

Submit a job, then immediately kill all 3 nodes:
```bash
pkill -f "blindference-node run"
```

### 6B. Wait for Quorum Timeout

After ~5 minutes (node claim timeout) + ICL processing:
```bash
curl -s "http://127.0.0.1:8001/v1/jobs/job_0x..." | jq
```

**Expected:**
```json
{
  "job_id": "job_0x...",
  "status": "FAILED",
  "failure_reason": "Quorum timeout — no consensus reached",
  ...
}
```

### 6C. Verify Credit Refund

```bash
curl -s "http://127.0.0.1:8001/v1/credits/0xYourMetaMaskAddress" | jq
```

**Expected:**
```json
{
  "balance_cusdc": 10000,      // Refunded back to original amount
  "total_spent_cusdc": 0,      // Or subtracted then added back
  "total_refunded_cusdc": 100
}
```

**What to verify:**
- [ ] `status` is `FAILED` (not `RUNNING`)
- [ ] `failure_reason` is descriptive
- [ ] Credits were refunded (balance restored)
- [ ] `total_refunded_cusdc` tracked the refund
- [ ] No BLIND rewards were distributed

### 6D. Restart Nodes

```bash
blindference-node run
```

---

## Test 7: ICL Down → Payment Service Retry

### 7A. Stop ICL

```bash
# Kill ICL process
pkill -f "uvicorn main:app --host 127.0.0.1 --port 8000"
```

### 7B. Submit Job to Payment Service

```bash
curl -s -X POST http://127.0.0.1:8001/v1/jobs/submit \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "0x'$(openssl rand -hex 32)'",
    "user_address": "0xYourMetaMaskAddress",
    "model_id": "groq:llama-3.3-70b-versatile",
    "prompt_cid": "QmTest",
    "encrypted_prompt_key": {"high": "123", "low": "456"},
    "metadata": {},
    "amount_credits": 50
  }' | jq
```

**Expected:**
- Response may still return `job_id` and `status: "RUNNING"`
- BUT check Payment Service logs for retry attempts:
  ```
  WARNING | ICL forwarding failed (attempt 1/3): Connection refused
  WARNING | ICL forwarding failed (attempt 2/3): Connection refused
  ERROR | ICL forwarding failed after 3 attempts
  ```

### 7C. Check Job State

```bash
curl -s "http://127.0.0.1:8001/v1/jobs/job_0x..." | jq
```

**Expected:**
```json
{
  "status": "FAILED",
  "failure_reason": "ICL forwarding failed after retries"
}
```

### 7D. Verify Refund

```bash
curl -s "http://127.0.0.1:8001/v1/credits/0xYourMetaMaskAddress" | jq '.balance_cusdc'
# Should be refunded (original amount)
```

**What to verify:**
- [ ] Payment Service attempted 3 retries with exponential backoff
- [ ] Job eventually marked as `FAILED`
- [ ] Credits refunded to user
- [ ] No on-chain reward txs (since job failed)

### 7E. Restart ICL

```bash
cd blindference/network/packages/icl
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

---

## Test 8: Frontend Integration

### 8A. Inference Submission Page

1. Open http://localhost:3000
2. Connect MetaMask
3. Enter prompt: "What is the capital of France?"
4. Select model: `groq:llama-3.3-70b-versatile`
5. **Check credits indicator** — should show your balance (e.g., "9900 credits")
6. Click "Submit"
7. MetaMask: Confirm `storeKey` transaction

**What to verify:**
- [ ] Frontend calls `POST /v1/jobs/submit` (not `/v1/inference/requests`)
- [ ] `task_id` is generated by frontend (matches `storeKey` tx)
- [ ] Request body includes `metadata.prompt_key_store_tx`
- [ ] No payment mode/currency selection (removed in Phase 2)

### 8B. Status Polling

Watch browser Network tab:
1. First poll: `GET /v1/jobs/{job_id}` → Payment Service
2. If legacy `request_id`: falls back to `GET /v1/inference/requests/{request_id}/status`

**What to verify:**
- [ ] Frontend polls Payment Service first (not ICL)
- [ ] Status shows `RUNNING` while nodes work
- [ ] Status shows `COMPLETED` with result
- [ ] Status timeline shows all stages

### 8C. Buy Credits Page

1. Open http://localhost:3000/buy-credits
2. Check gas estimation — should show dynamic EIP-1559 estimate
3. Purchase package
4. Verify balance updates in header

**What to verify:**
- [ ] Gas estimation shows `maxFeePerGas` and `maxPriorityFeePerGas`
- [ ] Purchase succeeds without manual gas limit override
- [ ] Balance updates in real-time

---

## Test 9: Node Earnings Endpoint

### 9A. Query via API

```bash
curl -s "http://127.0.0.1:8001/v1/nodes/0xdDef3Cf5A4d0A6404Bc084D74de3E2c0d6147dA5/jobs?limit=10" | jq
```

**Expected:**
```json
{
  "node_address": "0xdDef3Cf5A4d0A6404Bc084D74de3E2c0d6147dA5",
  "total_jobs": 5,
  "total_earned_blind": 3.0,
  "jobs": [
    {
      "job_id": "job_0x...",
      "role": "leader",
      "status": "COMPLETED",
      "amount_blind_earned": 0.6
    },
    {
      "job_id": "job_0x...",
      "role": "verifier",
      "status": "COMPLETED",
      "amount_blind_earned": 0.2
    }
  ]
}
```

**What to verify:**
- [ ] `total_jobs` matches number of completed jobs this node participated in
- [ ] `total_earned_blind` is sum of all `amount_blind_earned`
- [ ] Each job has correct `role`
- [ ] `amount_blind_earned` is decimal (not wei string)
- [ ] Running jobs show `amount_blind_earned: null`

### 9B. Query Non-Existent Node

```bash
curl -s "http://127.0.0.1:8001/v1/nodes/0x0000000000000000000000000000000000000000/jobs" | jq
```

**Expected:**
```json
{
  "node_address": "0x0000...",
  "total_jobs": 0,
  "total_earned_blind": 0.0,
  "jobs": []
}
```

---

## Test 10: Insurance Purchase (Optional)

### 10A. Submit Job with Insurance

The `amount_credits` should include a 2% premium. If your base job price is 100 credits, submit with 102:

```bash
curl -s -X POST http://127.0.0.1:8001/v1/jobs/submit \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "0x'$(openssl rand -hex 32)'",
    "user_address": "0xYourMetaMaskAddress",
    "model_id": "groq:llama-3.3-70b-versatile",
    "prompt_cid": "QmTest",
    "encrypted_prompt_key": {"high": "123", "low": "456"},
    "metadata": {"insurance_opt_in": true},
    "amount_credits": 102
  }' | jq
```

**What to verify:**
- [ ] Payment Service creates insurance policy on-chain
- [ ] `transaction_hash` includes insurance purchase tx
- [ ] Total deducted = 102 credits (100 base + 2 premium)

### 10B. File Dispute (After Job Completes)

If you believe the result is wrong:
```bash
curl -s -X POST "http://127.0.0.1:8000/v1/inference/requests/{request_id}/dispute" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Result appears incorrect"}'
```

**What to verify:**
- [ ] Dispute triggers re-execution with new quorum
- [ ] Insurance pays out if result differs
- [ ] Refund processed if dispute is successful

---

## Test 11: Decimal128 Storage Verification

This test verifies the critical bug fix for wei overflow.

### 11A. Direct MongoDB Inspection

```bash
mongosh blindference_payments --eval '
  const job = db.jobs.findOne({status: "COMPLETED"});
  print("amount_credits type:", typeof job.amount_credits, "value:", job.amount_credits);
  print("rewards type check:");
  for (const [addr, amt] of Object.entries(job.rewards || {})) {
    print("  ", addr, "=", amt, "type:", typeof amt);
  }
'
```

**What to verify:**
- [ ] `amount_credits` is `Decimal128` ( BSON type `19` )
- [ ] Values are not truncated or negative
- [ ] `rewards` values are floats (human-readable BLIND)

### 11B. Verify No Int64 Overflow

```bash
mongosh blindference_payments --eval '
  // Try to store a value > 2^63-1 (int64 max)
  db.test_overflow.insertOne({
    big_value: NumberDecimal("999999999999999999999999999999")
  });
  const doc = db.test_overflow.findOne();
  print("Stored successfully:", doc.big_value);
  db.test_overflow.drop();
'
```

**What to verify:**
- [ ] Large wei values store without overflow
- [ ] `NumberDecimal` handles arbitrary precision

---

## Test 12: Metadata Passthrough (Phase 3 Bug Fix)

### 12A. Submit with Complex Metadata

```bash
curl -s -X POST http://127.0.0.1:8001/v1/jobs/submit \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "0x'$(openssl rand -hex 32)'",
    "user_address": "0xYourMetaMaskAddress",
    "model_id": "groq:llama-3.3-70b-versatile",
    "prompt_cid": "QmTest",
    "encrypted_prompt_key": {"high": "123", "low": "456"},
    "metadata": {
      "prompt_key_store_tx": "0xabc",
      "cofhe_prompt_key_inputs": {"high": "enc_high", "low": "enc_low"},
      "custom_field": "should_passthrough",
      "nested": {"a": 1, "b": [1, 2, 3]}
    },
    "amount_credits": 10
  }' | jq '.request_id'
```

### 12B. Verify in ICL

```bash
REQUEST_ID=$(curl -s -X POST http://127.0.0.1:8001/v1/jobs/submit ... | jq -r '.request_id')
curl -s "http://127.0.0.1:8000/v1/inference/requests/${REQUEST_ID}" | jq '.metadata'
```

**What to verify:**
- [ ] `cofhe_prompt_key_inputs` present in ICL metadata
- [ ] `custom_field` and `nested` objects preserved
- [ ] No data loss during Payment Service → ICL forwarding

---

## Test 13: Task ID Consistency (Phase 3 Bug Fix)

### 13A. Frontend-Generated Task ID

The frontend generates a deterministic `taskId` from the prompt hash. This must be the same `taskId` used for:
1. `PromptKeyStore.storeKey(taskId, ...)` — on-chain
2. `POST /v1/jobs/submit` — body.task_id
3. ICL internal request — metadata uses same task_id

```bash
# After submitting from frontend:
TASK_ID="0x..."  # from browser console or MetaMask tx data

# Check job document
curl -s "http://127.0.0.1:8001/v1/jobs/job_${TASK_ID}" | jq '.task_id'
# Should match exactly

# Check ICL request
curl -s "http://127.0.0.1:8000/v1/inference/requests" | jq '.requests[] | select(.task_id == "'${TASK_ID}'")'
# Should exist with same task_id
```

**What to verify:**
- [ ] `job.task_id` matches frontend-generated `taskId`
- [ ] ICL `request.task_id` matches
- [ ] On-chain `PromptKeyStore.getEncryptedKey(taskId)` works

---

## Test 14: Concurrent Job Submission

### 14A. Submit 5 Jobs Rapidly

```bash
for i in {1..5}; do
  curl -s -X POST http://127.0.0.1:8001/v1/jobs/submit \
    -H "Content-Type: application/json" \
    -d "{
      \"task_id\": \"0x$(openssl rand -hex 32)\",
      \"user_address\": \"0xYourMetaMaskAddress\",
      \"model_id\": \"groq:llama-3.3-70b-versatile\",
      \"prompt_cid\": \"QmTest${i}\",
      \"encrypted_prompt_key\": {\"high\": \"123\", \"low\": \"456\"},
      \"metadata\": {},
      \"amount_credits\": 10
    }" &
done
wait
```

### 14B. Check All Jobs Created

```bash
curl -s "http://127.0.0.1:8001/v1/jobs/"  # If list endpoint exists, or query MongoDB:
mongosh blindference_payments --eval 'db.jobs.countDocuments({user_address: "0xYourMetaMaskAddress"})'
```

**What to verify:**
- [ ] All 5 jobs created with unique `job_id`s
- [ ] Credit balance decreased by exactly 50 (5 × 10)
- [ ] No race conditions (balance not under/over-deducted)
- [ ] ICL received all 5 requests

---

## Quick Reference: All API Endpoints

### Payment Service

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/credits/packages` | GET | List credit packages |
| `/v1/credits/{address}` | GET | Check user balance |
| `/v1/jobs/submit` | POST | Submit inference job |
| `/v1/jobs/{job_id}` | GET | Get job status & rewards |
| `/v1/jobs/{job_id}/complete` | POST | ICL callback (internal) |
| `/v1/nodes/{address}/jobs` | GET | Node earnings history |

### ICL (Internal)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/inference/request` | POST | Payment Service forwards prepared request |
| `/v1/inference/requests/{id}` | GET | Get request details |
| `/v1/inference/requests/{id}/status` | GET | Get request status |

---

## Log Monitoring Checklist

### Payment Service Terminal

| Pattern | Meaning | Severity |
|---------|---------|----------|
| `Job submitted: user=... amount=...` | New job received | INFO |
| `Credits deducted: user=... amount=...` | Balance updated | INFO |
| `Escrow created: tx=...` | On-chain escrow success | INFO |
| `Forwarding to ICL: attempt X/3` | Retry in progress | WARNING |
| `ICL forwarding failed after retries` | ICL unreachable | ERROR |
| `Job completion callback: job=... status=...` | ICL notified completion | INFO |
| `Distributing rewards: job=...` | Reward tx starting | INFO |
| `Rewards distributed: job=...` | Success | INFO |
| `Refunding credits: user=... amount=...` | Failure refund | INFO |
| `Insufficient credits` | 402 returned | INFO |

### ICL Terminal

| Pattern | Meaning | Severity |
|---------|---------|----------|
| `Request created: request_id=... task_id=...` | Internal request received | INFO |
| `Quorum formed: ...` | Nodes selected | INFO |
| `Node ... claimed` | Node picked up job | INFO |
| `Consensus reached: accepted=True` | Success | INFO |
| `Notifying Payment Service: job=...` | Callback sent | INFO |
| `Payment Service callback failed` | Retry scheduled | WARNING |

---

## Success Criteria

- [ ] **Credit System**: Buy credits → balance updates → MongoDB stores Decimal128
- [ ] **Job Submission**: Submit job → credits deducted → escrow created → forwarded to ICL
- [ ] **Insufficient Credits**: 402 returned → no state changes → no on-chain txs
- [ ] **ICL Retry**: ICL down → 3 retries → job fails → credits refunded
- [ ] **Job Success**: Nodes complete → ICL callback → rewards distributed → balances increase
- [ ] **Job Failure**: Nodes fail/timeout → ICL callback → credits refunded → no rewards
- [ ] **Task ID Consistency**: Frontend `taskId` = Payment Service `task_id` = ICL `task_id` = On-chain `taskId`
- [ ] **Metadata Passthrough**: `cofhe_prompt_key_inputs` and custom fields survive forwarding
- [ ] **Node Earnings**: `GET /v1/nodes/{addr}/jobs` returns accurate history
- [ ] **Frontend Integration**: Uses `jobApi.submit()` → polls Payment Service → shows correct status
- [ ] **Gas Estimation**: Frontend uses EIP-1559 dynamic gas for credit purchases
- [ ] **Concurrent Safety**: 5 rapid jobs → correct balance deduction, no race conditions

---

## Troubleshooting

### "Cannot connect to Payment Service"
- Check `uvicorn` is running on port 8001
- Check firewall / port binding

### "Credits not deducted"
- Verify `amount_credits` is sent as integer (not string)
- Check MongoDB `credit_balances` collection exists

### "ICL forwarding failed"
- Verify ICL is running on port 8000
- Check `PAYMENT_SERVICE_URL` in ICL `.env`
- Check network connectivity between services

### "Rewards not distributed"
- Check Payment Service wallet has BLIND: `cast call BLIND_TOKEN "balanceOf(address)" PAYMENT_WALLET`
- Check `PAYMENT_SERVICE_WALLET_KEY` is set correctly
- Check job `status` is `COMPLETED` (not `FAILED`)

### "Node jobs endpoint returns 0 jobs"
- Verify node address is checksum format
- Check `rewards` field exists in completed job documents
- Ensure jobs are `COMPLETED` (not `RUNNING`)

### "Decimal128 errors in logs"
- This should not happen after Phase 3 fix
- Check all amounts are converted with `_to_decimal128()`
- Never use `-amount_dec` directly on Decimal128 objects

### "Fhenix CoFHE testnet ENOTFOUND"
- The Fhenix testnet (`api.helios.fhenix.zone`) is currently down
- Nodes cannot decrypt prompts without CoFHE — this blocks the full inference flow
- **Workaround**: Test Payment Service + ICL integration without actual inference:
  1. Submit job → verify Payment Service deducts credits and forwards to ICL
  2. Stop ICL mid-job → verify Payment Service retries and refunds
  3. Check MongoDB state at each step
  4. Use `smoke-gateway-flow.mjs` for automated API-only testing
  5. Test credit purchase, balance queries, and node earnings endpoint without running nodes
- When CoFHE is back: run full Test 4 with nodes for end-to-end inference

---

## Minimal 5-Test Checklist (15 Minutes)

Don't have time for all 14 tests? Run these 5 in order:

### Test 1: Health Check (1 min)
```bash
curl -s http://127.0.0.1:8001/v1/credits/packages | jq '.packages | length'
```
**Pass if:** Returns `3`

### Test 2: Credit Purchase (3 min)
1. Open http://localhost:3000/buy-credits
2. Buy Starter package with MetaMask
3. ```bash
   curl -s "http://127.0.0.1:8001/v1/credits/0xYourAddress" | jq '.balance_cusdc'
   ```
**Pass if:** Balance > 0

### Test 3: Job Submit + Deduct (2 min)
```bash
curl -s -X POST http://127.0.0.1:8001/v1/jobs/submit \
  -H "Content-Type: application/json" \
  -d '{"task_id":"0x'$(openssl rand -hex 32)'","user_address":"0xYourAddress","model_id":"groq:llama-3.3-70b-versatile","prompt_cid":"QmTest","encrypted_prompt_key":{"high":"123","low":"456"},"metadata":{},"amount_credits":10}' | jq '.status'
```
**Pass if:** Returns `"RUNNING"`

Then verify balance decreased:
```bash
curl -s "http://127.0.0.1:8001/v1/credits/0xYourAddress" | jq '.balance_cusdc'
```
**Pass if:** Decreased by exactly 10

### Test 4: Insufficient Credits (1 min)
```bash
curl -s -X POST http://127.0.0.1:8001/v1/jobs/submit \
  -H "Content-Type: application/json" \
  -d '{"task_id":"0x'$(openssl rand -hex 32)'","user_address":"0xYourAddress","model_id":"groq:llama-3.3-70b-versatile","prompt_cid":"QmTest","encrypted_prompt_key":{"high":"123","low":"456"},"metadata":{},"amount_credits":999999}'
```
**Pass if:** HTTP 402, balance unchanged

### Test 5: Kill ICL → Verify Retry/Refund (8 min)
1. Start ICL: `uvicorn main:app --host 127.0.0.1 --port 8000`
2. Submit a job (see Test 3)
3. Kill ICL: `pkill -f "uvicorn main:app --host 127.0.0.1 --port 8000"`
4. Wait 30 seconds, check Payment Service logs for retry attempts
5. Check job status: `curl -s "http://127.0.0.1:8001/v1/jobs/job_..." | jq '.status'`
**Pass if:** Eventually `"FAILED"` with `"failure_reason"` about ICL
6. Check balance refunded: `curl -s "http://127.0.0.1:8001/v1/credits/0xYourAddress" | jq '.balance_cusdc'`
**Pass if:** Back to original amount (before Test 3)

**All 5 pass?** Your Payment Service gateway is working correctly.
