#!/bin/bash

# Start ICL Service
cd /app/icl
PYTHONPATH=/app/icl:/app/shared-py uvicorn main:app --host 127.0.0.1 --port 8000 --no-access-log &

# Start Payment Service
cd /app/payment
PYTHONPATH=/app/payment:/app/shared-py uvicorn main:app --host 127.0.0.1 --port 8001 --no-access-log &

# Wait for ICL to be healthy before starting nodes
echo "[Railway] Waiting for ICL to start..."
until curl -s http://127.0.0.1:8000/health > /dev/null; do
    sleep 1
done
echo "[Railway] ICL is ready!"

# Function to generate .env for a node
generate_node_env() {
    local node_dir=$1
    local private_key=$2
    
    cat > "$node_dir/.env" <<EOF
BLF_PRIVATE_KEY=$private_key
BLF_KEY_PASSWORD=${BLF_KEY_PASSWORD:-mock}
BLF_ICL_ENDPOINT=http://127.0.0.1:8000
BLF_RPC_URL=${BLF_RPC_URL:-https://arb-sepolia.g.alchemy.com/v2/demo}
BLF_COFHE_ENDPOINT=${BLF_COFHE_ENDPOINT:-https://arb-sepolia.g.alchemy.com/v2/demo}
BLF_COFHE_CHAIN_ID=421614
BLF_INFERENCE_CONTRACT_ADDRESS=${BLF_INFERENCE_CONTRACT_ADDRESS:-0x98b08590D1CB28E6687eFea59A32BE8B16571C86}
BLF_PROMPT_KEY_STORE_ADDRESS=${BLF_PROMPT_KEY_STORE_ADDRESS:-0x7120fAbdAD2FC5B05CD814A59457eB5fCd9Cfa7E}
BLF_NODE_REGISTRY_ADDRESS=${BLF_NODE_REGISTRY_ADDRESS:-0x72C0Ead949Fd2C346598a30AF1A69c3c5Cb86082}
GROQ_API_KEY=${GROQ_API_KEY:-}
GOOGLE_API_KEY=${GOOGLE_API_KEY:-}
BLF_IPFS_UPLOAD_JWT=${BLF_IPFS_UPLOAD_JWT:-}
BLF_IPFS_GATEWAY=${BLF_IPFS_GATEWAY:-https://gateway.pinata.cloud/ipfs}
BLF_COFHE_MODE=bridge
BLF_SKIP_OUTPUT_KEY_STORAGE=false
BLF_NETWORK=fhenix_testnet
BLF_LOG_LEVEL=INFO
BLF_STAKE_AMOUNT=1
EOF
}

# Function to run a node's full lifecycle
run_node() {
    local node_dir=$1
    local node_name=$2
    local private_key=$3
    
    # Generate .env file
    generate_node_env "$node_dir" "$private_key"
    
    cd "$node_dir"
    echo "[Railway] Starting $node_name lifecycle..."
    
    # Step 1: Init (creates config.json + keystore from .env)
    echo "[Railway] $node_name: init"
    blindference-node init || true
    
    # Step 2: Attest with mock attestation
    echo "[Railway] $node_name: attest --mock"
    blindference-node attest --mock || true
    
    # Step 3: Stake 1000 BLIND (only if not already staked)
    echo "[Railway] $node_name: checking stake status..."
    STAKE_STATUS=$(blindference-node staking status 2>/dev/null || echo "0")
    if echo "$STAKE_STATUS" | grep -q "staked.*0\|stake.*0\|not staked\|No stake"; then
        echo "[Railway] $node_name: staking stake 1000"
        blindference-node staking stake 1000 || true
    else
        echo "[Railway] $node_name: already staked, skipping"
    fi
    
    # Step 4: Run the node daemon
    echo "[Railway] $node_name: run"
    blindference-node run &
}

# Start Node 1
run_node "/app/nodes/one" "Node-1" "$NODE1_PRIVATE_KEY" &

# Start Node 2
run_node "/app/nodes/two" "Node-2" "$NODE2_PRIVATE_KEY" &

# Start Node 3
run_node "/app/nodes/three" "Node-3" "$NODE3_PRIVATE_KEY" &

# Start Nginx in foreground (keeps container alive)
nginx -g 'daemon off;'
