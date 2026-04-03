#!/usr/bin/env bash
# Initialise a 3-node FoxMQ cluster for multi-node Vertex P2P consensus.
# Each node gets its own data directory: bin/node0/ bin/node1/ bin/node2/
#
# MQTT ports:  1883, 1884, 1885
# WS ports:    8080, 8081, 8082
# Vertex P2P:  19793, 19794, 19795 (UDP/QUIC — inter-broker consensus)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$ROOT/bin"
FOXMQ="$BIN_DIR/foxmq"

if [ ! -f "$FOXMQ" ]; then
  echo "FoxMQ binary not found. Run: npm run foxmq:init"
  exit 1
fi

for i in 0 1 2; do
  NODE_DIR="$BIN_DIR/node${i}"
  mkdir -p "$NODE_DIR"

  # Empty .env so foxmq doesn't walk up and find the project one
  touch "$NODE_DIR/.env"

  echo "==> Initialising node${i} at $NODE_DIR …"
  cd "$NODE_DIR"
  # Addresses are space-separated arguments, one per node in the cluster
  "$FOXMQ" address-book from-list 127.0.0.1:19793 127.0.0.1:19794 127.0.0.1:19795
  cd "$ROOT"
done

echo ""
echo "Cluster initialised (3 nodes)."
echo ""
echo "Start the cluster:"
echo "  ./swarm/start-cluster.sh"
echo ""
echo "Then launch the swarm across all nodes:"
echo "  npm run swarm:cluster"
