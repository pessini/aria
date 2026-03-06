#!/usr/bin/env bash
set -euo pipefail

PIN_FILE="backend/n8n-skills-sha.txt"

if [[ ! -f "$PIN_FILE" ]]; then
  echo "ERROR: $PIN_FILE missing"
  exit 1
fi

SHA=$(tr -d '[:space:]' < "$PIN_FILE")
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ERROR: $PIN_FILE must contain a valid 40-char commit SHA (got: $SHA)"
  exit 1
fi

echo "Skills pin file valid: ${SHA:0:12}"
