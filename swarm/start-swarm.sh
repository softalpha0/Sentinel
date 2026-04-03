#!/usr/bin/env bash
# Launches the full Risk Sentinel swarm locally.
# Each agent runs as a separate background process.
# Ctrl-C kills all of them.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BROKER="${FOXMQ_URL:-mqtt://127.0.0.1:1883}"
RUN="node --import tsx/esm"

export FOXMQ_URL="$BROKER"

# Export Stellar vars from .env so agent subprocesses can read them
if [ -f "$ROOT/.env" ]; then
  _val=$(grep '^STELLAR_PUBLIC_KEY=' "$ROOT/.env" | cut -d= -f2-)
  [ -n "$_val" ] && export STELLAR_PUBLIC_KEY="$_val"
  _val=$(grep '^STELLAR_SECRET_KEY=' "$ROOT/.env" | tail -1 | cut -d= -f2-)
  [ -n "$_val" ] && export STELLAR_SECRET_KEY="$_val"
  _val=$(grep '^STELLAR_NETWORK=' "$ROOT/.env" | cut -d= -f2-)
  [ -n "$_val" ] && export STELLAR_NETWORK="$_val"
  unset _val
fi

echo "=================================================="
echo " Risk Sentinel Swarm — Vertex P2P (via FoxMQ)"
echo " Broker: $BROKER"
echo "=================================================="
echo ""

# Track child PIDs so Ctrl-C can kill them all
PIDS=()

cleanup() {
  echo ""
  echo "Stopping swarm…"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait
  echo "Swarm stopped."
}
trap cleanup EXIT INT TERM

# Launch agents — add more instances of scanner/risk for redundancy
echo "[swarm] Starting scanner-agent…"
cd "$ROOT" && $RUN swarm/scanner-agent.ts 2>&1 | sed 's/^/[scanner] /' &
PIDS+=($!)

echo "[swarm] Starting risk-agent (x2 for redundancy)…"
cd "$ROOT" && $RUN swarm/risk-agent.ts 2>&1 | sed 's/^/[risk-1]  /' &
PIDS+=($!)

cd "$ROOT" && $RUN swarm/risk-agent.ts 2>&1 | sed 's/^/[risk-2]  /' &
PIDS+=($!)

echo "[swarm] Starting consensus-agent…"
cd "$ROOT" && $RUN swarm/consensus-agent.ts 2>&1 | sed 's/^/[consens] /' &
PIDS+=($!)

echo "[swarm] Starting execution-agent…"
cd "$ROOT" && $RUN swarm/execution-agent.ts 2>&1 | sed 's/^/[execute] /' &
PIDS+=($!)

echo ""
echo "Swarm running ($(( ${#PIDS[@]} )) processes). Press Ctrl-C to stop."
echo ""

# Wait indefinitely — cleanup trap handles the rest
wait
