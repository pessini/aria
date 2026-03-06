#!/usr/bin/env bash
set -euo pipefail

PIN_FILE="backend/n8n-mcp-version.txt"
COMPOSE_FILE="backend/n8n-mcp.yml"

if [[ ! -f "$PIN_FILE" ]]; then
  echo "ERROR: $PIN_FILE not found"
  exit 1
fi

VERSION=$(tr -d '[:space:]' < "$PIN_FILE")
if [[ -z "$VERSION" ]]; then
  echo "ERROR: $PIN_FILE is empty"
  exit 1
fi

sed -i.bak "s|image: ghcr.io/czlonkowski/n8n-mcp:.*|image: ghcr.io/czlonkowski/n8n-mcp:${VERSION}|" "$COMPOSE_FILE"
rm -f "${COMPOSE_FILE}.bak"

echo "Pinned n8n-mcp image to: ghcr.io/czlonkowski/n8n-mcp:${VERSION}"
