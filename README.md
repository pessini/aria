# Aria Workflow Assistant

Open-source **agent** for n8n workflows, running on **Aegra `v0.7.2`**.

The contributor focus is the agent graphs and skills in `backend/agents/`.
Backend runtime wiring lives in `backend/` (thin overlay).
The UI in `ui/` is optional — used for manual end-to-end testing.

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [uv](https://docs.astral.sh/uv/getting-started/installation/) (Python package manager)
- A running **n8n instance** with API access enabled (see [n8n Setup](#n8n-setup) below)

> **Important:** The agent connects to n8n via its REST API to read workflows, execute actions,
> and use n8n tools. Without a configured n8n instance the agent starts but cannot do useful work,
> and the UI will show errors on every message.

---

## Quick Start

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

---

### Step 2 — Start n8n *(Terminal 2)*

```bash
make n8n-up
```

n8n is available at **http://localhost:4245**

**First-time setup (do this once):**

1. Open http://localhost:4245 and complete the owner account setup
2. Go to **Settings → n8n API**
3. Click **Create an API key** and copy it — you will need it in Step 3

---

### Step 3 — Configure your environment

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in:

| Variable | Value |
| --- | --- |
| `OPENAI_API_KEY` | Your OpenAI key (or switch to Ollama — see [LLM Configuration](#llm-configuration)) |
| `N8N_API_KEY` | The API key you created in Step 2 |

`N8N_API_URL` is pre-filled to `http://localhost:4245/api/v1` and works with `make n8n-up` as-is.

---

### Step 4 — Start the backend *(Terminal 1 — stays in foreground)*

```bash
make backend-up
```

This starts `n8n-mcp` via Docker and then runs `aegra dev` with your agents loaded.
**Keep this terminal open** — aegra logs stream here.

---

### Step 5 — Verify it's running *(Terminal 2)*

```bash
curl http://localhost:4242/health
```

Expected: `200 OK`

---

### Step 6 — Start the UI *(Terminal 2)*

> **Security warning — local development only.**
> The UI stores conversations and app settings in the browser's IndexedDB (plaintext, no encryption).
> Any JavaScript running on the same origin — including browser extensions and XSS payloads —
> can read this local data. **Do not deploy this UI to a public or shared host.**
> It exists solely as a local manual testing harness.

```bash
cp ui/.env.example ui/.env
make ui-docker-up
```

UI is available at **http://localhost:4241**

---

## n8n Setup

### Local (recommended for development)

The `n8n/` folder contains a Docker Compose file for running n8n locally:

```bash
make n8n-up    # start
make n8n-down  # stop
```

Data is persisted in a named Docker volume (`aria_n8n_data`) so your workflows survive restarts.

### Generating an API key

1. Open http://localhost:4245
2. Complete the initial owner account setup if you haven't already
3. Navigate to **Settings → n8n API**
4. Click **Create an API key**, give it a name, and copy the key
5. Paste it into `backend/.env` as `N8N_API_KEY`

### Using an existing n8n instance

Point the agent at any reachable n8n instance by setting these in `backend/.env`:

```bash
N8N_API_URL=https://your-n8n.example.com/api/v1
N8N_API_KEY=your-api-key
N8N_WEB_URL=https://your-n8n.example.com
```

---

## LLM Configuration

Edit `backend/.env` and activate one of the two options:

**Option A — OpenAI (cloud):**

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

**Option B — Ollama (local, free):**

```bash
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3
```

---

## Port Reference

| Port | Service |
| --- | --- |
| `4241` | UI (Vite dev server) |
| `4242` | Aegra backend |
| `4244` | n8n-mcp sidecar |
| `4245` | n8n |

---

## Repository Layout

| Path | Purpose |
| --- | --- |
| `backend/agents/` | Agent graph, tools, prompts, and skill packs |
| `backend/` | Thin runtime overlay (Aegra config + service compose) pinned to `v0.7.2` |
| `n8n/` | Local n8n Docker Compose for development |
| `ui/` | Optional React harness for manual end-to-end checks — **local dev only, not production-safe** (stores local conversations/settings in IndexedDB) |
| `scripts/` | CI and local guard/smoke scripts |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines,
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [SECURITY.md](SECURITY.md), and [LICENSE](LICENSE).

Contribute to `backend/agents/` first — that's the canonical surface for skill work.

## Upstream Pin

This repo does not vendor Aegra source code. Runtime is pinned to:

- `aegra-cli v0.7.2`

See [backend/UPSTREAM.md](backend/UPSTREAM.md) for upgrade policy.

---

## Acknowledgements

This project builds on the work of:

- **[Aegra](https://github.com/ibbybuilds/aegra)** — the agent runtime framework that powers the backend.
- **[n8n-mcp](https://github.com/czlonkowski/n8n-mcp)** — the MCP server that exposes n8n workflows and tools to the agent.
- **[n8n-skills](https://github.com/czlonkowski/n8n-skills)** — skill pack patterns and reference implementations the agent skills are based on.
- **[Lovable](https://lovable.dev)** — the UI was scaffolded and developed using Lovable.
