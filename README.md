<p align="center">
  <img src="ui/public/aria-logo.svg" alt="Aria logo" width="140" />
</p>

<h1 align="center">Automation & Reasoning Intelligent Agent</h1>

<p align="center">
  Open-source AI agent for building and operating n8n workflows with a skills-first architecture.
</p>

<p align="center">
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-GPL--3.0-blue" /></a>
  <a href="./.github/workflows/backend-ci.yml"><img alt="Backend CI" src="https://img.shields.io/badge/backend-CI-informational" /></a>
  <a href="./SECURITY.md"><img alt="Security Policy" src="https://img.shields.io/badge/security-policy-brightgreen" /></a>
  <img alt="Aegra" src="https://img.shields.io/badge/aegra-v0.7.2-6f42c1" />
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="./ARCHITECTURE.md">Architecture</a> •
  <a href="./CONTRIBUTING.md">Contributing</a> •
  <a href="./SECURITY.md">Security</a>
</p>

Open-source AI agent for n8n workflows, powered by Aegra and a skills-first tool execution model.

Aria helps automation builders and agent developers create, modify, and operate n8n workflows through a single assistant. It combines local skill packs, MCP tools, and n8n API access so workflow tasks are guided by domain best practices before tool execution.

## Why Aria?

n8n workflow automation often requires combining workflow design knowledge, node-level configuration details, and reliable execution tooling. Aria packages these concerns into one assistant workflow so users can move faster with fewer errors.

## Feature Highlights

- Skills-first workflow guidance before MCP tool calls
- Direct n8n integration through n8n-mcp
- Thin runtime overlay for Aegra config and service wiring
- Modular skills architecture under `backend/agents/`
- Optional UI for local manual end-to-end testing
- Docker-based local stack for backend + n8n + UI

## Quick Start

### Fast Path (Under 2 Minutes)

Run these commands from repository root:

```bash
make backend-cli-install
make n8n-up
cp backend/.env.example backend/.env
# edit backend/.env and set OPENAI_API_KEY + N8N_API_KEY
make backend-up
```

In a second terminal:

```bash
curl http://localhost:4242/health
cp ui/.env.example ui/.env
make ui-docker-up
```

Expected outcomes:

- `n8n` UI at `http://localhost:4245`
- backend health check returns `200 OK` at `http://localhost:4242/health`
- optional UI at `http://localhost:4241`

## Detailed Setup

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [uv](https://docs.astral.sh/uv/getting-started/installation/) (Python package manager)
- A running **n8n instance** with API access enabled (see [n8n Setup](#n8n-setup) below)

> **Important:** The agent connects to n8n via its REST API to read workflows, execute actions,
> and use n8n tools. Without a configured n8n instance the agent starts but cannot do useful work,
> and the UI will show errors on every message.

### Step 1 — Install Aegra CLI

```bash
make backend-cli-install
```

Or directly with uv:

```bash
uv tool install aegra-cli==0.7.2
```

Verify:

```bash
aegra --version
# aegra 0.7.2
```

### Step 2 — Start n8n *(Terminal 2)*

```bash
make n8n-up
```

n8n is available at **http://localhost:4245**

First-time setup:

1. Open http://localhost:4245 and complete the owner account setup
2. Go to **Settings → n8n API**
3. Click **Create an API key** and copy it

### Step 3 — Configure Environment

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in:

| Variable | Value |
| --- | --- |
| `OPENAI_API_KEY` | Your OpenAI key (or switch to Ollama — see [LLM Configuration](#llm-configuration)) |
| `N8N_API_KEY` | The API key you created in Step 2 |

`N8N_API_URL` is pre-filled to `http://localhost:4245/api/v1` and works with `make n8n-up` as-is.

### Step 4 — Start Backend *(Terminal 1 — stays in foreground)*

```bash
make backend-up
```

This starts `n8n-mcp` via Docker and then runs `aegra dev` with your agents loaded. Keep this terminal open; Aegra logs stream here.

### Step 5 — Verify Backend *(Terminal 2)*

```bash
curl http://localhost:4242/health
```

Expected: `200 OK`

### Step 6 — Start UI *(Optional, Terminal 2)*

```bash
cp ui/.env.example ui/.env
make ui-docker-up
```

UI is available at **http://localhost:4241**

## Usage Examples

Typical prompts for Aria:

- "Create a workflow that receives webhook data and stores it in a database."
- "Review this workflow JSON and suggest reliability improvements."
- "Add retry, timeout, and error-handling patterns to my HTTP Request nodes."
- "Generate a scheduled reporting workflow and explain each node configuration."

## Security Notes

- The UI is **local development only** and not production-safe.
- The UI stores conversations and app settings in browser IndexedDB (plaintext).
- Any JavaScript on the same origin can read this local data.
- See [SECURITY.md](./SECURITY.md) for vulnerability reporting.

## n8n Setup

### Local (recommended for development)

The `n8n/` folder contains a Docker Compose file for running n8n locally:

```bash
make n8n-up    # start
make n8n-down  # stop
```

Data is persisted in a named Docker volume (`aria_n8n_data`) so your workflows survive restarts.

### Generating an API Key

1. Open http://localhost:4245
2. Complete the initial owner account setup if needed
3. Navigate to **Settings → n8n API**
4. Click **Create an API key**, give it a name, and copy the key
5. Paste it into `backend/.env` as `N8N_API_KEY`

### Using an Existing n8n Instance

Point the agent at any reachable n8n instance by setting these in `backend/.env`:

```bash
N8N_API_URL=https://your-n8n.example.com/api/v1
N8N_API_KEY=your-api-key
N8N_WEB_URL=https://your-n8n.example.com
```

## LLM Configuration

Edit `backend/.env` and activate one of the two options:

Option A — OpenAI (cloud):

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-mini
```

Option B — Ollama (local, free):

```bash
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3
```

## Port Reference

| Port | Service |
| --- | --- |
| `4241` | UI (Vite dev server) |
| `4242` | Aegra backend |
| `4244` | n8n-mcp sidecar |
| `4245` | n8n |

## Repository Layout

| Path | Purpose |
| --- | --- |
| `backend/agents/` | Agent graph, tools, prompts, and skill packs |
| `backend/` | Thin runtime overlay (Aegra config + service compose) |
| `n8n/` | Local n8n Docker Compose for development |
| `ui/` | Optional React harness for manual end-to-end checks (stores local conversations/settings in IndexedDB) |
| `scripts/` | CI and local guard/smoke scripts |

Where to start if you are:

- user/integrator: this `README.md`
- contributor: `CONTRIBUTING.md`
- maintainer: `ARCHITECTURE.md` and `backend/UPSTREAM.md`

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines and preferred workflows.

## Upstream Pin

This repository does not vendor Aegra source code.
See [backend/UPSTREAM.md](./backend/UPSTREAM.md) for runtime pinning and upgrade policy.

## Acknowledgements

This project builds on the work of:

- **[Aegra](https://github.com/ibbybuilds/aegra)** — the agent runtime framework that powers the backend.
- **[n8n-mcp](https://github.com/czlonkowski/n8n-mcp)** — the MCP server that exposes n8n workflows and tools to the agent.
- **[n8n-skills](https://github.com/czlonkowski/n8n-skills)** — skill pack patterns and reference implementations the agent skills are based on.
- **[Lovable](https://lovable.dev)** — the UI was scaffolded and developed using Lovable.
