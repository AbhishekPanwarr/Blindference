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

# Function to run a node's full lifecycle
run_node() {
    local node_dir=$1
    local node_name=$2
    
    cd "$node_dir"
    echo "[Railway] Starting $node_name lifecycle..."
    
    # Step 1: Init (creates config.json from .env)
    echo "[Railway] $node_name: init"
    blindference-node init || true
    
    # Step 2: Attest with mock attestation
    echo "[Railway] $node_name: attest --mock"
    blindference-node attest --mock || true
    
    # Step 3: Stake 1000 BLIND
    echo "[Railway] $node_name: staking stake 1000"
    blindference-node staking stake 1000 || true
    
    # Step 4: Run the node daemon
    echo "[Railway] $node_name: run"
    blindference-node run &
}

# Start Node 1
run_node "/app/nodes/one" "Node-1" &

# Start Node 2
run_node "/app/nodes/two" "Node-2" &

# Start Node 3
run_node "/app/nodes/three" "Node-3" &

# Start Nginx in foreground (keeps container alive)
nginx -g 'daemon off;'
