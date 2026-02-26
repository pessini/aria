#!/usr/bin/env bash
set -euo pipefail

ROOT_REQUIRED=(
  "README.md"
  "ARCHITECTURE.md"
  "CONTRIBUTING.md"
  "CODE_OF_CONDUCT.md"
  "LICENSE"
  "SECURITY.md"
)

for file in "${ROOT_REQUIRED[@]}"; do
  if [[ ! -s "$file" ]]; then
    echo "ERROR: required root file missing or empty: $file"
    exit 1
  fi
done

if [[ -d "langgraph-agents" ]]; then
  echo "ERROR: vendored backend directory langgraph-agents/ must not exist"
  exit 1
fi

if [[ ! -s "backend/UPSTREAM.md" ]]; then
  echo "ERROR: backend/UPSTREAM.md missing or empty"
  exit 1
fi

if [[ ! -f "backend/aegra-cli-version.txt" ]]; then
  echo "ERROR: backend/aegra-cli-version.txt missing"
  exit 1
fi

if ! grep -qx 'v0.7.2' backend/aegra-cli-version.txt; then
  echo "ERROR: backend/aegra-cli-version.txt must pin v0.7.2"
  exit 1
fi

echo "Thin runtime guard checks passed."
