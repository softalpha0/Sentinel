#!/usr/bin/env bash
# Launch the swarm distributed across all 3 FoxMQ cluster nodes.
# Each agent connects to a different broker — demonstrates true P2P mesh:
#   Scanner  → node0 (mqtt://127.0.0.1:1883)
#   Risk ×2  → node1 (mqtt://127.0.0.1:1884)
#   Consensus→ node2 (mqtt://127.0.0.1:1885)
#   Execution→ node0 (mqtt://127.0.0.1:1883)
#
# Messages published to any node are delivered to all subscribers on all nodes
# via the Vertex P2P consensus layer — no central broker.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="node --import tsx/esm"

echo "============================================================"
echo " Risk Sentinel Swarm — 3-node Vertex Cluster"
echo " Agents distributed across 3 FoxMQ nodes"
echo "============================================================"
echo ""

PIDS=()
cleanup() {
  echo "Stopping swarm…"
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait
}
trap cleanup EXIT INT TERM

cd "$ROOT"

FOXMQ_URL=mqtt://127.0.0.1:1883 $RUN swarm/scanner-agent.ts 2>&1 | sed 's/^/[scanner] /' &
PIDS+=($!)

FOXMQ_URL=mqtt://127.0.0.1:1884 $RUN swarm/risk-agent.ts 2>&1 | sed 's/^/[risk-1]  /' &
PIDS+=($!)

FOXMQ_URL=mqtt://127.0.0.1:1884 $RUN swarm/risk-agent.ts 2>&1 | sed 's/^/[risk-2]  /' &
PIDS+=($!)

FOXMQ_URL=mqtt://127.0.0.1:1885 $RUN swarm/consensus-agent.ts 2>&1 | sed 's/^/[consens] /' &
PIDS+=($!)

FOXMQ_URL=mqtt://127.0.0.1:1883 $RUN swarm/execution-agent.ts 2>&1 | sed 's/^/[execute] /' &
PIDS+=($!)

echo "Swarm running across 3 nodes. Press Ctrl-C to stop."
echo ""
wait
