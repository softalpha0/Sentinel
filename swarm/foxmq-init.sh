#!/usr/bin/env bash
# One-time FoxMQ broker initialisation using the native macOS binary.
# Downloads foxmq, initialises the address book, and places the binary in ./bin/
# NOTE: foxmq is run from ./bin/ so it doesn't pick up the project .env file.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$ROOT/bin"
FOXMQ="$BIN_DIR/foxmq"
VERSION="0.3.1"
URL="https://github.com/tashigit/foxmq/releases/download/v${VERSION}/foxmq_${VERSION}_macos-universal.zip"
ZIP="$BIN_DIR/foxmq.zip"

mkdir -p "$BIN_DIR"

if [ ! -f "$FOXMQ" ]; then
  echo "==> Downloading FoxMQ v${VERSION} for macOS…"
  curl -L --progress-bar -o "$ZIP" "$URL"
  echo "==> Extracting…"
  unzip -o "$ZIP" -d "$BIN_DIR"
  rm "$ZIP"
  chmod +x "$FOXMQ"
  echo "==> Downloaded: $FOXMQ"
else
  echo "==> FoxMQ binary already present: $FOXMQ"
fi

# Run foxmq from bin/ — create an empty .env so foxmq doesn't
# walk up and find the project .env (which has non-foxmq content).
cd "$BIN_DIR"
touch .env

echo "==> Initialising address book (single-node on 127.0.0.1:19793)…"
./foxmq address-book from-range 127.0.0.1 19793 19793

echo ""
echo "Done. FoxMQ data directory: $BIN_DIR/foxmq.d/"
echo ""
echo "Start the broker:"
echo "  npm run foxmq:start"
echo ""
echo "Then launch the swarm (in a new terminal):"
echo "  npm run swarm"
