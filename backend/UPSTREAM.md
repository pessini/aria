# Upstream Runtime Pin

This repository uses upstream Aegra through the official CLI flow.

- Source project: `https://github.com/ibbybuilds/aegra`
- CLI pin: `v0.7.2`
- Pin file: `backend/aegra-cli-version.txt`

## Installation Policy

Install CLI from the pinned tag:

```bash
# Recommended — via make (uses uv):
make backend-cli-install

# Manual via uv:
uv tool install aegra-cli==0.7.2

# Alternative via pipx:
pipx install aegra-cli==0.7.2
```

## Local Overlay Policy

1. Do not vendor upstream Aegra source in this repository.
2. Keep local code focused on:
   - `backend/agents/` (graph + skills)
   - `backend/` (config + optional service compose)
3. Upgrade process:
   - bump only `backend/aegra-cli-version.txt`,
   - update install URL/tag references,
   - run `make backend-ci`.

---

# n8n-mcp

- Source project: `https://github.com/czlonkowski/n8n-mcp`
- Consumed as: Docker image via `backend/n8n-mcp.yml`

The `n8n-mcp` sidecar runs alongside the Aegra backend and exposes n8n workflows and built-in n8n actions as MCP tools. The agent connects to it over the local Docker network; no source code from that project is vendored here.

Do not modify or fork `n8n-mcp` inside this repository. Pin updates are made by bumping the image tag reference in `backend/n8n-mcp.yml`.

---

# n8n-skills

- Source project: `https://github.com/czlonkowski/n8n-skills`
- Relationship: skill pack design patterns and reference implementations

The skill packs under `backend/agents/n8n_agent/skills/` follow the conventions established by `n8n-skills`. New skills contributed to this repo should align with those patterns (SKILL.md frontmatter, tool definitions, prompt structure).

No source files from `n8n-skills` are vendored here.
