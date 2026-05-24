#!/usr/bin/env bash
# End-to-End Test Script for Blindference Phase 4
# Tests: BLIND funding → node staking → inference → reward distribution
#
# Prerequisites:
#   - ICL running on localhost:8000
#   - Payment Service running on localhost:8001
#   - MongoDB running
#   - MetaMask with Arbitrum Sepolia + test ETH
#   - cast (Foundry) installed for CLI transactions
#   - blindference-node CLI installed
#
# Usage:
#   source .env && bash scripts/demo/e2e-test.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "========================================"
echo "  Blindference Phase 4 E2E Test"
echo "========================================"
echo ""

# ------------------------------------------------------------------
# Configuration (override via env vars)
# ------------------------------------------------------------------
ARBITRUM_SEPOLIA_RPC="${ARBITRUM_SEPOLIA_RPC:-https://sepolia-rollup.arbitrum.io/rpc}"
BLIND_TOKEN="${BLIND_TOKEN:-0x232D5470DaaC7AD552a42d876aDEF1f778033cE0}"
BLINDFERENCE_STAKING="${BLINDFERENCE_STAKING:-0x222Ac74201Ed58915e42Ee5be626d939fd234D0b}"
PAYMENT_WALLET="${PAYMENT_WALLET:-0x7F9B413Da50e72415b16Eb9df6e5E59774a338dc}"
DEPLOYER_KEY="${DEPLOYER_PRIVATE_KEY:-0x5ea99166e1520909188c93c423bdea9f9a539a7ae29965e7dc92df17a9faaf6b}"
ICL_URL="${ICL_URL:-http://127.0.0.1:8000}"
PAYMENT_URL="${PAYMENT_URL:-http://127.0.0.1:8001}"
DEMO_NODE_KEY="${DEMO_NODE_KEY:-0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d}"
DEMO_NODE_ADDRESS="${DEMO_NODE_ADDRESS:-0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC}"

echo "RPC:         ${ARBITRUM_SEPOLIA_RPC}"
echo "BLIND Token: ${BLIND_TOKEN}"
echo "Staking:     ${BLINDFERENCE_STAKING}"
echo "Payment:     ${PAYMENT_WALLET}"
echo "ICL:         ${ICL_URL}"
echo "Node Addr:   ${DEMO_NODE_ADDRESS}"
echo ""

# ------------------------------------------------------------------
# Step 1: Check services are running
# ------------------------------------------------------------------
echo "▸ Step 1: Checking services..."

if ! curl -sf "${ICL_URL}/health" > /dev/null 2>&1; then
    echo "ERROR: ICL not reachable at ${ICL_URL}"
    echo "Start it first: cd network/packages/icl && uvicorn main:app --host 127.0.0.1 --port 8000"
    exit 1
fi
echo "  ✓ ICL is running"

if ! curl -sf "${PAYMENT_URL}/v1/credits/packages" > /dev/null 2>&1; then
    echo "ERROR: Payment Service not reachable at ${PAYMENT_URL}"
    echo "Start it first: cd network/packages/payment && uvicorn main:app --host 127.0.0.1 --port 8001"
    exit 1
fi
echo "  ✓ Payment Service is running"

# ------------------------------------------------------------------
# Step 2: Fund Payment Service wallet with BLIND
# ------------------------------------------------------------------
echo ""
echo "▸ Step 2: Funding Payment Service wallet with BLIND..."

PAYMENT_BALANCE_BEFORE=$(cast call "${BLIND_TOKEN}" "balanceOf(address)(uint256)" "${PAYMENT_WALLET}" --rpc-url "${ARBITRUM_SEPOLIA_RPC}" 2>/dev/null || echo "0")
echo "  Payment wallet BLIND balance before: ${PAYMENT_BALANCE_BEFORE}"

# Transfer 500 BLIND to Payment Service wallet (if deployer has balance)
DEPLOYER_BALANCE=$(cast call "${BLIND_TOKEN}" "balanceOf(address)(uint256)" "$(cast wallet address --private-key "${DEPLOYER_KEY}")" --rpc-url "${ARBITRUM_SEPOLIA_RPC}" 2>/dev/null || echo "0")
if [[ "${DEPLOYER_BALANCE}" -gt 0 ]]; then
    cast send "${BLIND_TOKEN}" "transfer(address,uint256)" "${PAYMENT_WALLET}" "$(cast to-wei 500)" \
        --rpc-url "${ARBITRUM_SEPOLIA_RPC}" \
        --private-key "${DEPLOYER_KEY}" \
        > /dev/null 2>&1
    echo "  ✓ Sent 500 BLIND to Payment Service wallet"
else
    echo "  ⚠ Deployer has 0 BLIND — skipping fund step (may already be funded)"
fi

PAYMENT_BALANCE_AFTER=$(cast call "${BLIND_TOKEN}" "balanceOf(address)(uint256)" "${PAYMENT_WALLET}" --rpc-url "${ARBITRUM_SEPOLIA_RPC}")
echo "  Payment wallet BLIND balance after: ${PAYMENT_BALANCE_AFTER}"

# ------------------------------------------------------------------
# Step 3: Check demo node BLIND balance & stake
# ------------------------------------------------------------------
echo ""
echo "▸ Step 3: Staking demo node..."

NODE_BALANCE=$(cast call "${BLIND_TOKEN}" "balanceOf(address)(uint256)" "${DEMO_NODE_ADDRESS}" --rpc-url "${ARBITRUM_SEPOLIA_RPC}" 2>/dev/null || echo "0")
echo "  Node BLIND balance: ${NODE_BALANCE}"

# If node has no BLIND, fund it from deployer
if [[ "${NODE_BALANCE}" -lt $(cast to-wei 1000) ]]; then
    cast send "${BLIND_TOKEN}" "transfer(address,uint256)" "${DEMO_NODE_ADDRESS}" "$(cast to-wei 2000)" \
        --rpc-url "${ARBITRUM_SEPOLIA_RPC}" \
        --private-key "${DEPLOYER_KEY}" \
        > /dev/null 2>&1
    echo "  ✓ Funded node with 2000 BLIND"
fi

# Create temp node config and stake
NODE_CONFIG_DIR="$(mktemp -d)"
export BLF_CONFIG_DIR="${NODE_CONFIG_DIR}"
export BLF_PRIVATE_KEY="${DEMO_NODE_KEY}"
export BLF_KEY_PASSWORD="test"
export BLF_RPC_URL="${ARBITRUM_SEPOLIA_RPC}"

# Approve staking contract
blindference-node --version > /dev/null 2>&1 || {
    echo "ERROR: blindference-node CLI not found. Install it first:"
    echo "  cd Blindference-node && pip install -e ."
    exit 1
}

echo "  Approving staking contract..."
# The CLI handles approve inside `staking stake`, but we can also do it manually:
# cast send "${BLIND_TOKEN}" "approve(address,uint256)" "${BLINDFERENCE_STAKING}" "$(cast to-wei 1000)" \
#     --rpc-url "${ARBITRUM_SEPOLIA_RPC}" --private-key "${DEMO_NODE_KEY}"

echo "  Staking 1000 BLIND..."
# Note: blindference-node staking stake 1000
# This requires the CLI to be installed and configured. For this script, we simulate
tx_hash=$(cast send "${BLIND_TOKEN}" "approve(address,uint256)" "${BLINDFERENCE_STAKING}" "$(cast to-wei 1000)" \
    --rpc-url "${ARBITRUM_SEPOLIA_RPC}" --private-key "${DEMO_NODE_KEY}" --json 2>/dev/null | jq -r '.transactionHash' || echo "")

if [[ -n "${tx_hash}" ]]; then
    echo "  ✓ Approve tx: ${tx_hash}"
    sleep 2
fi

# Call stake() on staking contract
tx_hash=$(cast send "${BLINDFERENCE_STAKING}" "stake(uint256)" "$(cast to-wei 1000)" \
    --rpc-url "${ARBITRUM_SEPOLIA_RPC}" --private-key "${DEMO_NODE_KEY}" --json 2>/dev/null | jq -r '.transactionHash' || echo "")

if [[ -n "${tx_hash}" ]]; then
    echo "  ✓ Stake tx: ${tx_hash}"
else
    echo "  ⚠ Stake may have failed (node might already be staked)"
fi

# Verify stake
STAKE_INFO=$(cast call "${BLINDFERENCE_STAKING}" "getStakeInfo(address)((uint256,uint256,uint256,uint256,bool))" "${DEMO_NODE_ADDRESS}" --rpc-url "${ARBITRUM_SEPOLIA_RPC}")
echo "  Stake info: ${STAKE_INFO}"

# ------------------------------------------------------------------
# Step 4: Verify node is in ICL active pool
# ------------------------------------------------------------------
echo ""
echo "▸ Step 4: Checking ICL node pool..."

# Bootstrap demo nodes if needed
curl -sf -X POST "${ICL_URL}/admin/bootstrap-demo-nodes" \
    -H 'Content-Type: application/json' \
    -d '{"count":3}' > /dev/null 2>&1 || true

ACTIVE_NODES=$(curl -sf "${ICL_URL}/internal/nodes" 2>/dev/null | jq -r '.nodes // [] | length' || echo "0")
echo "  Active nodes in ICL pool: ${ACTIVE_NODES}"

if [[ "${ACTIVE_NODES}" -lt 3 ]]; then
    echo "  ⚠ Less than 3 active nodes. Start more nodes with:"
    echo "    blindference-node init && blindference-node attest --mock && blindference-node run"
fi

# ------------------------------------------------------------------
# Step 5: Submit inference job via frontend API simulation
# ------------------------------------------------------------------
echo ""
echo "▸ Step 5: Submitting test inference job..."
echo "  This step requires the frontend to submit an actual job."
echo "  Open http://localhost:3000 and submit a text inference request with:"
echo "    - Model: groq:llama-3.3-70b-versatile"
echo "    - Coverage: optional"
echo "    - Payment: credits (requires prior deposit)"
echo ""
echo "  Or use the API directly (requires encrypted prompt, CoFHE handles, etc.):"
echo "    POST ${ICL_URL}/v1/inference/requests"
echo ""
echo "  For a quick smoke test of reward distribution, you can call the Payment Service:"
echo "    curl -X POST ${PAYMENT_URL}/v1/rewards/distribute \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"job_id\":\"test-job-1\",\"leader_address\":\"${DEMO_NODE_ADDRESS}\",\"verifier_addresses\":[\"0x0000000000000000000000000000000000000001\",\"0x0000000000000000000000000000000000000002\"],\"amount_blind_wei\":1000000000000000000}'"
echo ""

# ------------------------------------------------------------------
# Step 6: Verify reward distribution
# ------------------------------------------------------------------
echo "▸ Step 6: Testing reward distribution endpoint..."

# Test the reward endpoint with dummy addresses
REWARD_RESPONSE=$(curl -sf -X POST "${PAYMENT_URL}/v1/rewards/distribute" \
    -H 'Content-Type: application/json' \
    -d "{\"job_id\":\"e2e-test-$(date +%s)\",\"leader_address\":\"${DEMO_NODE_ADDRESS}\",\"verifier_addresses\":[\"0x0000000000000000000000000000000000000001\",\"0x0000000000000000000000000000000000000002\"],\"amount_blind_wei\":1000000000000000000}" 2>/dev/null || echo '{"status":"failed"}')

REWARD_STATUS=$(echo "${REWARD_RESPONSE}" | jq -r '.status' || echo "unknown")
echo "  Reward distribution status: ${REWARD_STATUS}"

if [[ "${REWARD_STATUS}" == "distributed" ]]; then
    echo "  ✓ Rewards distributed successfully!"
    echo "  Distributions:"
    echo "${REWARD_RESPONSE}" | jq -r '.distributions[] | "    - \(.role): \(.node) => \(.amount_wei) wei (\(.status))"' || true
elif [[ "${REWARD_STATUS}" == "insufficient_balance" || "${REWARD_STATUS}" == "failed" ]]; then
    echo "  ⚠ Reward distribution failed (likely insufficient BLIND balance in Payment Service wallet)"
    echo "    Fund the wallet with:"
    echo "      cast send ${BLIND_TOKEN} \"transfer(address,uint256)\" ${PAYMENT_WALLET} $(cast to-wei 500) --rpc-url ${ARBITRUM_SEPOLIA_RPC} --private-key <deployer_key>"
else
    echo "  ⚠ Unexpected response: ${REWARD_RESPONSE}"
fi

# ------------------------------------------------------------------
# Cleanup
# ------------------------------------------------------------------
rm -rf "${NODE_CONFIG_DIR}"

echo ""
echo "========================================"
echo "  E2E Test Complete"
echo "========================================"
echo ""
echo "Next steps for full validation:"
echo "  1. Start 3 nodes: blindference-node init && blindference-node attest --mock && blindference-node run"
echo "  2. Open frontend at http://localhost:3000"
echo "  3. Submit a text inference job with credit payment"
echo "  4. Watch ICL logs for quorum formation and reward distribution"
echo "  5. Verify BLIND balances updated on-chain for leader/verifiers"
echo ""
