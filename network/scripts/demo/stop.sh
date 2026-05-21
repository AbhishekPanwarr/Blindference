#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

ensure_demo_dirs

stop_service() {
  local name="$1"
  local pattern="$2"
  local pid_file
  pid_file="$(pid_file_for "${name}")"

  if [[ -f "${pid_file}" ]]; then
    local pid
    pid="$(cat "${pid_file}")"
    if [[ -n "${pid}" ]] && kill -0 "${pid}" >/dev/null 2>&1; then
      kill "${pid}" >/dev/null 2>&1 || true
    fi
    rm -f "${pid_file}"
  fi

  pkill -f "${pattern}" >/dev/null 2>&1 || true
}

target="${1:-all}"

case "${target}" in
  all)
    stop_service icl 'uvicorn main:app --host 127.0.0.1 --port 8000'
    stop_service node-leader 'run-node.sh leader'
    stop_service node-verifier1 'run-node.sh verifier1'
    stop_service node-verifier2 'run-node.sh verifier2'
    stop_service frontend 'vite --port=3000 --host=127.0.0.1'
    stop_service node-runtime 'python -m blindference_node.cli start'
    ;;
  icl)
    stop_service icl 'uvicorn main:app --host 127.0.0.1 --port 8000'
    ;;
  leader)
    stop_service node-leader 'run-node.sh leader'
    ;;
  verifier1)
    stop_service node-verifier1 'run-node.sh verifier1'
    ;;
  verifier2)
    stop_service node-verifier2 'run-node.sh verifier2'
    ;;
  frontend)
    stop_service frontend 'vite --port=3000 --host=127.0.0.1'
    ;;
  nodes)
    stop_service node-leader 'run-node.sh leader'
    stop_service node-verifier1 'run-node.sh verifier1'
    stop_service node-verifier2 'run-node.sh verifier2'
    stop_service node-runtime 'python -m blindference_node.cli start'
    ;;
  *)
    echo "Usage: bash network/scripts/demo/stop.sh [all|icl|leader|verifier1|verifier2|frontend|nodes]" >&2
    exit 1
    ;;
esac
