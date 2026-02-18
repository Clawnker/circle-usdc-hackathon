#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

LOCAL_URL="${LOCAL_URL:-http://localhost:3000}"
PROD_URL="${PROD_URL:-https://circle-usdc-hackathon.onrender.com}"
NETWORK_MODE="${NETWORK_MODE:-testnet}"

echo "[release-gate] local smoke -> $LOCAL_URL ($NETWORK_MODE)"
BASE_URL="$LOCAL_URL" NETWORK_MODE="$NETWORK_MODE" node tests/scripts/release_gate_smoke.js

echo "[release-gate] prod smoke -> $PROD_URL ($NETWORK_MODE)"
BASE_URL="$PROD_URL" NETWORK_MODE="$NETWORK_MODE" node tests/scripts/release_gate_smoke.js

echo "[release-gate] artifacts:"
ls -1 tests/artifacts/release-gate-smoke-*.json
