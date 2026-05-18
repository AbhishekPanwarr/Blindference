#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

ensure_demo_dirs

bash "${SCRIPT_DIR}/stop.sh" >/dev/null 2>&1 || true

start_service() {
  local name="$1"
  shift
  local pid_file
  pid_file="$(pid_file_for "${name}")"
  nohup "$@" >"${LOG_DIR}/${name}.log" 2>&1 &
  echo "$!" >"${pid_file}"
}

echo "Starting ICL..."
start_service icl bash "${SCRIPT_DIR}/run-icl.sh"

for _ in {1..30}; do
  if curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1; then
  echo "ICL did not become healthy. Check ${LOG_DIR}/icl.log" >&2
  exit 1
fi

echo "Bootstrapping demo nodes..."
bash "${SCRIPT_DIR}/bootstrap.sh" >"${LOG_DIR}/bootstrap.log" 2>&1

echo "Starting leader node..."
start_service node-leader bash "${SCRIPT_DIR}/run-node.sh" leader

echo "Starting verifier1 node..."
start_service node-verifier1 bash "${SCRIPT_DIR}/run-node.sh" verifier1

echo "Starting verifier2 node..."
start_service node-verifier2 bash "${SCRIPT_DIR}/run-node.sh" verifier2

echo "Starting frontend..."
start_service frontend bash "${SCRIPT_DIR}/run-frontend.sh"

echo
echo "Demo stack started."
echo "Frontend: http://127.0.0.1:3000"
echo "ICL:      http://127.0.0.1:8000"
echo "Logs:     ${LOG_DIR}"
