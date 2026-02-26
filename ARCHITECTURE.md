# Architecture

## System Overview

```
User
 │
 ▼
UI (React/Vite, port 4241)          ← optional manual test harness
 │  HTTP + WebSocket
 ▼
Aegra Runtime (port 4242)           ← agent serving layer (pinned v0.7.2)
 │  LangGraph checkpoint + streaming
 ▼
Agent Graph (LangGraph)             ← canonical contribution surface
 │
 ├── Skills (local filesystem)      ← 7 skill packs in backend/agents/n8n_agent/skills/
 │
 └── MCP Client
      │  streamable-http
      ▼
     n8n-mcp (port 4244)            ← Docker container (backend/n8n-mcp.yml)
      │  REST API
      ▼
     n8n (port 4245)                ← workflow automation engine
```

PostgreSQL (port 4243) is managed automatically by `aegra dev` (auto-generated compose, not committed).

---

## Agent Graph

The agent is a **3-node ReAct loop** compiled with LangGraph:

```
__start__
    │
    ▼
agent_node ──(tool calls + retries available)──→ tool_node
    │                                                 │
    │◄────────────────────────────────────────────────┘
    │
    ├──(tool calls + retries exhausted)──→ error_summary_node ──→ __end__
    │
    └──(no tool calls)──→ __end__
```

| Node | File | Purpose |
|------|------|---------|
| `agent_node` | `utils/nodes.py` | Invoke LLM with all tools bound; decides next action |
| `tool_node` | `utils/nodes.py` | Execute skill tools and MCP tools; manages retry state |
| `error_summary_node` | `utils/nodes.py` | Generate plain-text failure summary when retries are exhausted |

The routing function `should_continue` reads the last message to decide which edge to follow.

---

## Skill-First Protocol

Before calling any MCP tool, the LLM must load the relevant skill pack. This is enforced by the system prompt — not by graph topology.

**Three levels of progressive disclosure:**

| Level | Mechanism | Cost |
|-------|-----------|------|
| Catalog | Injected into system prompt at startup | Always loaded |
| Instructions | `load_skill(name)` tool call | On demand, cached |
| Reference files | `read_skill_file(name, filename)` tool call | On demand, not cached |

---

## Components

### `config.py`
Central configuration and lazy-initialized runtime resources: LLM client, skill store, MCP tools list. All environment variables are mapped here.

### `skills.py`
Two-level cache (metadata + content). Scans `skills/` on first call, loads `SKILL.md` on demand.

### `utils/tools.py`
Two LangChain tools exposed to the LLM: `load_skill` and `read_skill_file`. Docstrings are rewritten at runtime to include the current skill catalog.

### `utils/mcp.py`
Connects to n8n-mcp via `langchain-mcp-adapters` with health check, retry logic, and graceful degradation (empty tool list on failure).

### `utils/prompts.py`
System prompt template. Filled at runtime with `{current_time}`, `{skill_catalog}`, `{mcp_tools_list}`.

### `utils/state.py`
Minimal LangGraph state: `MessagesState` + `tool_retry_attempts` + `tool_call_count`.

---

## Skill Directory Layout

```
backend/agents/n8n_agent/skills/
├── n8n-code-javascript/
│   ├── SKILL.md                  ← YAML frontmatter + instructions (required)
│   ├── BUILTIN_FUNCTIONS.md      ← supporting reference (optional)
│   ├── COMMON_PATTERNS.md
│   └── ...
├── n8n-code-python/
├── n8n-expression-syntax/
├── n8n-mcp-tools-expert/
├── n8n-node-configuration/
├── n8n-validation-expert/
└── n8n-workflow-patterns/
```

---

## Contribution Areas

| What you want to change | Where to look |
|------------------------|---------------|
| Agent behavior / reasoning | `utils/prompts.py` |
| Skill knowledge | `skills/<skill-name>/SKILL.md` and supporting files |
| Add a new skill | Create `skills/<new-skill>/SKILL.md` (auto-discovered) |
| Tool execution / retry logic | `utils/nodes.py` |
| MCP connection / error handling | `utils/mcp.py` |
| Configuration / env vars | `config.py` |
| Runtime wiring / Docker | `backend/` (secondary area) |
| UI test harness | `ui/` (optional) |

New skills are auto-discovered at startup — no registration required.

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/agents/n8n_agent/agent.py` | Graph compilation entry point (`graph` object) |
| `backend/agents/n8n_agent/config.py` | Configuration dataclass |
| `backend/agents/n8n_agent/skills.py` | Skill store |
| `backend/agents/n8n_agent/utils/nodes.py` | Graph node functions |
| `backend/agents/n8n_agent/utils/tools.py` | Skill tool definitions |
| `backend/agents/n8n_agent/utils/prompts.py` | System prompt |
| `backend/agents/n8n_agent/utils/state.py` | State definition |
| `backend/agents/n8n_agent/utils/mcp.py` | MCP client |
| `backend/aegra.json` | Graph registration with Aegra runtime |
| `backend/n8n-mcp.yml` | Docker Compose for n8n-mcp sidecar |
