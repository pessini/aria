#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="backend/n8n-mcp.yml"
API_URL="http://localhost:${PORT:-4242}"
AEGRA_LOG="/tmp/aegra-dev.log"

if ! command -v uv >/dev/null 2>&1; then
  echo "ERROR: uv is required. Install uv first: https://docs.astral.sh/uv/"
  exit 1
fi

cleanup() {
  if [[ -n "${AEGRA_PID:-}" ]]; then
    kill "${AEGRA_PID}" >/dev/null 2>&1 || true
    wait "${AEGRA_PID}" >/dev/null 2>&1 || true
  fi
  docker compose -f "$COMPOSE_FILE" down --remove-orphans >/dev/null 2>&1 || true
}

trap cleanup EXIT

docker compose -f "$COMPOSE_FILE" up -d n8n-mcp

uv tool run --from aegra-cli aegra dev --config backend/aegra.json --port "${PORT:-4242}" >"$AEGRA_LOG" 2>&1 &
AEGRA_PID=$!

for _ in {1..90}; do
  if curl -fsS "$API_URL/health" >/dev/null; then
    break
  fi
  sleep 2
done

curl -fsS "$API_URL/health" >/dev/null
curl -fsS "$API_URL/assistants" >/dev/null

echo "Backend smoke checks passed."
