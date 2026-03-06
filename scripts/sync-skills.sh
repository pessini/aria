#!/usr/bin/env bash
set -euo pipefail

REPO="https://github.com/czlonkowski/n8n-skills.git"
PIN_FILE="backend/n8n-skills-sha.txt"
SKILLS_DIR="backend/agents/n8n_agent/skills"

if [[ ! -f "$PIN_FILE" ]]; then
  echo "ERROR: $PIN_FILE not found"
  exit 1
fi

SHA=$(tr -d '[:space:]' < "$PIN_FILE")
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ERROR: $PIN_FILE must contain a valid 40-char commit SHA (got: $SHA)"
  exit 1
fi

echo "Syncing skills from czlonkowski/n8n-skills @ ${SHA:0:12}"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

git -C "$TMPDIR" init -q
git -C "$TMPDIR" fetch --depth=1 "$REPO" "$SHA" 2>/dev/null
git -C "$TMPDIR" checkout -q FETCH_HEAD

if [[ ! -d "$TMPDIR/skills" ]]; then
  echo "ERROR: upstream repo has no skills/ directory at this commit"
  exit 1
fi

echo ""
echo "=== Changes ==="
diff -rq "$TMPDIR/skills/" "$SKILLS_DIR/" 2>/dev/null || true
echo ""

rm -rf "${SKILLS_DIR:?}"/*
cp -R "$TMPDIR/skills/"* "$SKILLS_DIR/"

echo "Skills synced to ${SHA:0:12}"
echo ""
git diff --stat "$SKILLS_DIR/" 2>/dev/null || true
