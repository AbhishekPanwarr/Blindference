#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash network/scripts/demo/run-node.sh <leader|verifier1|verifier2>" >&2
  exit 1
fi

ROLE="$1"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

load_icl_env
resolve_operator_keys

case "${ROLE}" in
  leader)
    OPERATOR_KEY="${DEMO_OPERATOR_PRIVATE_KEY1}"
    CALLBACK_PORT="9101"
    ;;
  verifier1)
    OPERATOR_KEY="${DEMO_OPERATOR_PRIVATE_KEY2}"
    CALLBACK_PORT="9102"
    ;;
  verifier2)
    OPERATOR_KEY="${DEMO_OPERATOR_PRIVATE_KEY3}"
    CALLBACK_PORT="9103"
    ;;
  *)
    echo "Unknown node role: ${ROLE}" >&2
    exit 1
    ;;
esac

cd "${NODE_DIR}"

export BLINDFERENCE_NODE_OPERATOR_PRIVATE_KEY="${OPERATOR_KEY}"
export BLINDFERENCE_NODE_RPC_URL="${ARBITRUM_SEPOLIA_RPC}"
export BLINDFERENCE_NODE_CALLBACK_PORT="${CALLBACK_PORT}"
export BLINDFERENCE_NODE_CALLBACK_PUBLIC_URL="http://127.0.0.1:${CALLBACK_PORT}"
export BLINDFERENCE_NODE_ICL_BASE_URL="http://127.0.0.1:8000"
export BLINDFERENCE_NODE_COFHE_CHAIN_ID="${COFHE_CHAIN_ID}"
export BLINDFERENCE_NODE_GROQ_API_KEY="${GROQ_API_KEY:-}"
export BLINDFERENCE_NODE_GEMINI_API_KEY="$(resolve_gemini_api_key)"
export BLINDFERENCE_NODE_MOCK_CLOUD_INFERENCE=false
export PYTHONPATH=src
export PYTHONUNBUFFERED=1

# Phase 4: Auto-stake BLIND tokens if configured
# Requires blindference-node CLI to be installed (pip install blindference-node)
BLIND_STAKE_AMOUNT="${BLIND_STAKE_AMOUNT:-0}"
if [[ "${BLIND_STAKE_AMOUNT}" -gt 0 ]]; then
    echo "Phase 4: Staking ${BLIND_STAKE_AMOUNT} BLIND..."
    if command -v blindference-node &> /dev/null; then
        blindference-node staking stake "${BLIND_STAKE_AMOUNT}" || echo "Warning: Staking failed (may already be staked)"
    else
        echo "Warning: blindference-node CLI not found — skipping auto-stake"
        echo "  Install: pip install blindference-node"
    fi
fi

# Start the node daemon
# NOTE: If using the separate Blindference-node package, use: blindference-node run
../icl/.venv/bin/python -m blindference_node.cli start
