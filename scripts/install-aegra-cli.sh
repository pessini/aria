#!/usr/bin/env bash
set -euo pipefail

if ! command -v uv >/dev/null 2>&1; then
  echo "ERROR: uv is required to install aegra-cli. Install uv first: https://docs.astral.sh/uv/"
  exit 1
fi

uv tool install --force  "aegra-cli==0.7.2" \
  --with langchain-openai \
  --with langchain-ollama \
  --with langchain-mcp-adapters
