#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

ensure_demo_dirs

print_pid_status() {
  local label="$1"
  local name="$2"
  local pid_file
  pid_file="$(pid_file_for "${name}")"

  if [[ -f "${pid_file}" ]]; then
    local pid
    pid="$(cat "${pid_file}")"
    if [[ -n "${pid}" ]] && kill -0 "${pid}" >/dev/null 2>&1; then
      echo "${label}: running (pid ${pid})"
      return
    fi
  fi

  echo "${label}: not running"
}

echo "ICL health:"
curl -s http://127.0.0.1:8000/health || true
echo
echo
echo "Admin status:"
curl -s http://127.0.0.1:8000/admin/status || true
echo
echo
echo "Tracked services:"
print_pid_status "ICL" "icl"
print_pid_status "Leader" "node-leader"
print_pid_status "Verifier1" "node-verifier1"
print_pid_status "Verifier2" "node-verifier2"
print_pid_status "Frontend" "frontend"
echo
echo "Matching processes:"
ps -ef | grep -E 'uvicorn main:app|blindference_node.cli start|vite --port=3000' | grep -v grep || true
