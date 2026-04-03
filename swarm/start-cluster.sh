#!/usr/bin/env bash
# Start a 3-node FoxMQ cluster locally.
# Each node listens on different ports; Vertex P2P consensus runs between them.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$ROOT/bin"
FOXMQ="$BIN_DIR/foxmq"

if [ ! -f "$FOXMQ" ]; then
  echo "FoxMQ binary not found. Run: npm run foxmq:init"
  exit 1
fi

for i in 0 1 2; do
  if [ ! -d "$BIN_DIR/node${i}/foxmq.d" ]; then
    echo "Node ${i} not initialised. Run: npm run foxmq:cluster-init"
    exit 1
  fi
done

PIDS=()
cleanup() {
  echo "Stopping cluster…"
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait
}
trap cleanup EXIT INT TERM

# Node 0: MQTT :1883, WS :8080, Vertex P2P :19793
echo "==> Starting node0 (MQTT :1883, WS :8080, Vertex :19793)…"
cd "$BIN_DIR/node0"
"$FOXMQ" run foxmq.d/ \
  --secret-key-file foxmq.d/key_0.pem \
  --allow-anonymous-login \
  --mqtt-addr 0.0.0.0:1883 \
  --cluster-addr 0.0.0.0:19793 \
  --websockets \
  --websockets-addr 0.0.0.0:8080 \
  2>&1 | sed 's/^/[foxmq-0] /' &
PIDS+=($!)
sleep 0.5

# Node 1: MQTT :1884, WS :8081, Vertex P2P :19794
echo "==> Starting node1 (MQTT :1884, WS :8081, Vertex :19794)…"
cd "$BIN_DIR/node1"
"$FOXMQ" run foxmq.d/ \
  --secret-key-file foxmq.d/key_1.pem \
  --allow-anonymous-login \
  --mqtt-addr 0.0.0.0:1884 \
  --cluster-addr 0.0.0.0:19794 \
  --websockets \
  --websockets-addr 0.0.0.0:8081 \
  2>&1 | sed 's/^/[foxmq-1] /' &
PIDS+=($!)
sleep 0.5

# Node 2: MQTT :1885, WS :8082, Vertex P2P :19795
echo "==> Starting node2 (MQTT :1885, WS :8082, Vertex :19795)…"
cd "$BIN_DIR/node2"
"$FOXMQ" run foxmq.d/ \
  --secret-key-file foxmq.d/key_2.pem \
  --allow-anonymous-login \
  --mqtt-addr 0.0.0.0:1885 \
  --cluster-addr 0.0.0.0:19795 \
  --websockets \
  --websockets-addr 0.0.0.0:8082 \
  2>&1 | sed 's/^/[foxmq-2] /' &
PIDS+=($!)

echo ""
echo "3-node Vertex cluster running. Press Ctrl-C to stop."
echo "  Node 0: mqtt://127.0.0.1:1883 | ws://127.0.0.1:8080"
echo "  Node 1: mqtt://127.0.0.1:1884 | ws://127.0.0.1:8081"
echo "  Node 2: mqtt://127.0.0.1:1885 | ws://127.0.0.1:8082"
echo ""
wait
