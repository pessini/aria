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
- Pin file: `backend/n8n-mcp-version.txt`

The `n8n-mcp` sidecar runs alongside the Aegra backend and exposes n8n workflows and built-in n8n actions as MCP tools. The agent connects to it over the local Docker network; no source code from that project is vendored here.

Do not modify or fork `n8n-mcp` inside this repository.

## Upgrade Process

1. Update `backend/n8n-mcp-version.txt` to the desired release tag.
2. Run `make bump-n8n-mcp`.
3. Run `make backend-ci`.
4. Commit both `backend/n8n-mcp-version.txt` and `backend/n8n-mcp.yml`.

---

# n8n-skills

- Source project: `https://github.com/czlonkowski/n8n-skills`
- Consumed as: vendored skill packs under `backend/agents/n8n_agent/skills/`
- Pin file: `backend/n8n-skills-sha.txt` (commit SHA)

Skill packs under `backend/agents/n8n_agent/skills/` are copied from the upstream
`n8n-skills` repository at the commit pinned in `backend/n8n-skills-sha.txt`.

Do not manually edit vendored skill files. Changes should be made upstream
in `czlonkowski/n8n-skills` and then synced here.

## Sync / Upgrade Process

1. Update `backend/n8n-skills-sha.txt` to the desired upstream commit SHA.
2. Run `make sync-skills`.
3. Review changes with `git diff`.
4. Run `make backend-ci`.
5. Commit the updated pin file and skill files together.
