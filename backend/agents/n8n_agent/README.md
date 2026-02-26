# Skills Agent — Technical Documentation

## Overview

The Skills Agent is a LangGraph-based AI agent that dynamically loads specialized knowledge modules ("skills") to answer user questions about n8n workflow automation. It combines local domain knowledge (skills) with remote tool execution (MCP tools) in a single ReAct loop.

The agent operates on a **Skill-First Protocol**: before calling any external MCP tool, the LLM must load the relevant skill to get best practices, required parameters, and common pitfalls. This dramatically reduces error rates compared to calling MCP tools blindly.

---

## Architecture

### Graph Structure

```
__start__ ──→ agent_node ──(should_continue)──→ tool_node ──→ agent_node
                   │                                              (loop)
                   ├──(retries exhausted)──→ error_summary_node ──→ __end__
                   └──(no tool calls)──→ __end__
```

The graph is a standard **ReAct (Reasoning + Acting) loop** with 3 nodes:

| Node | Purpose |
|------|---------|
| `agent_node` | Invoke the LLM with all tools bound. The LLM decides what to do next. |
| `tool_node` | Execute tool calls from the LLM's response (skill tools + MCP tools). |
| `error_summary_node` | Generate a user-friendly error summary when retries are exhausted. |

### Why a ReAct Loop?

An earlier version used a multi-phase pipeline with dedicated planning, loading, and execution nodes. That was replaced with a single ReAct loop because:

1. The LLM naturally chains tool calls (e.g. `load_skill` → `read_skill_file` → MCP tool) without explicit orchestration.
2. Tool ordering is guided by the system prompt's Skill-First Protocol, not by graph topology.
3. The simpler graph is easier to understand, debug, and extend.

---

## Core Components

### 1. State (`utils/state.py`)

```python
class State(MessagesState):
    tool_retry_attempts: int = 0
    tool_call_count: int = 0
```

Minimal state — just the conversation messages (inherited from `MessagesState` with the `add_messages` reducer) plus a retry counter for tool failures and a total tool call counter for loop prevention.

### 2. Config (`config.py`)

The `Context` dataclass holds all configuration and runtime resources:

- **LLM configuration**: provider (`ollama` / `openai`), model name, base URL
- **Skills configuration**: directory path for skill files
- **MCP configuration**: server URL, auth token, timeout, enabled flag
- **Runtime resources** (lazy-initialized): skill store, MCP tools, combined tools list

Environment variables override defaults when present (see the env var mapping table in `config.py`).

### 3. Graph Nodes (`utils/nodes.py`) & Graph Assembly (`agent.py`)

#### `agent_node` — The "Reasoning" Step

1. Lazy-initializes the Context (scans skills, loads MCP tools) on first call.
2. Builds a system prompt with the skill catalog and MCP tools list.
3. Binds all tools to the LLM and invokes it.
4. Returns an `AIMessage` (may contain `tool_calls`).

#### `tool_node` — The "Acting" Step

1. Extracts tool calls from the last `AIMessage`.
2. Executes each tool sequentially (with inter-call delays for MCP tools).
3. Returns `ToolMessage` results for each call.
4. Tracks retry attempts — resets on success, increments on failure.

**Error handling layers:**

| Layer | Scope | Strategy |
|-------|-------|----------|
| `_invoke_with_retry()` | Per tool call | Exponential backoff (1s, 2s, 4s) for retryable HTTP errors (429, 502, 503, 504) |
| `_execute_tool_calls()` | Per batch | Structured error messages in `ToolMessage` with retry metadata |
| `tool_node` try/except | Catastrophic | Fallback error messages for every tool_call to maintain state invariant |

#### `error_summary_node` — Graceful Degradation

Called when `tool_retry_attempts >= MAX_TOOL_RETRIES` (3). Invokes the LLM *without tools* to generate a plain-text summary of what went wrong and suggest next steps. Resets the retry counter so the thread can be reused.

#### `should_continue` — Router

| Condition | Route |
|-----------|-------|
| Last message has tool calls + retries available | → `tool_node` |
| Last message has tool calls + retries exhausted | → `error_summary_node` |
| No tool calls | → `__end__` |

### 4. Skill Store (`skills.py`)

Implements the **progressive disclosure pattern** at the filesystem level:

```
Discovery (scan)     →  Loading (load)       →  Detail (read_supporting_file)
Metadata only           Full SKILL.md body       Individual supporting files
Fast, all skills        On-demand, cached        On-demand, not cached
```

**Key classes:**

- `SkillMetadata` — lightweight struct from YAML frontmatter (name, description, tags)
- `ParsedSkill` — full skill with metadata + markdown body
- `SkillStore` — two-level cache (metadata cache + content cache) with lazy loading

**Skill directory structure:**

```
skills/
├── n8n-code-javascript/
│   ├── SKILL.md              # Required — YAML frontmatter + instructions
│   ├── BUILTIN_FUNCTIONS.md  # Optional — supporting reference file
│   ├── COMMON_PATTERNS.md
│   └── DATA_ACCESS.md
├── n8n-workflow-patterns/
│   ├── SKILL.md
│   └── ...
└── ...
```

**SKILL.md format:**

```yaml
---
name: n8n-code-javascript
description: JavaScript code node expertise for n8n
version: "1.0"
tags: [n8n, javascript, code]
dependencies: []
---
# JavaScript Code Node Guide

[Markdown instructions for the LLM...]
```

### 5. Skill Tools (`utils/tools.py`)

Two LangChain tools exposed to the LLM:

| Tool | Purpose | Returns |
|------|---------|---------|
| `load_skill(skill_name)` | Load a skill's full instructions | JSON with `instructions` + `available_files` list |
| `read_skill_file(skill_name, filename)` | Read a supporting file | JSON with file `content` |

Both return JSON strings so the LLM gets structured data. Error responses include the list of valid skill names so the LLM can self-correct.

Tool docstrings are dynamically overwritten to include available skill names — this is critical because the LLM sees docstrings as part of the tool schema.

### 6. MCP Client (`utils/mcp.py`)

Connects to the n8n-mcp server via `langchain-mcp-adapters`:

1. **Health check** — `GET /health` to verify reachability.
2. **Tool loading** — `MultiServerMCPClient` with streamable-http transport to `POST /mcp`.
3. **Retry logic** — exponential backoff (2s, 4s) for up to 3 attempts.
4. **Error unwrapping** — `ExceptionGroup` from anyio is recursively unpacked for human-readable messages.

Returns an empty list on failure (graceful degradation).

### 7. System Prompt (`utils/prompts.py`)

The system prompt establishes:

- **Skill-First Protocol** — load skill before calling MCP tools (mandatory)
- **Task-to-Skill Mapping** — which skills to load for each category of task
- **Progressive Discovery Workflow** — browse → load → inspect → reference → execute

Placeholders filled at runtime: `{current_time}`, `{skill_catalog}`, `{mcp_tools_list}`.

---

## Execution Flow Example

**User asks: "Create an HTTP webhook workflow in n8n"**

```
1. agent_node
   └─ LLM sees skill catalog + MCP tools list
   └─ Decides to load skills first (Skill-First Protocol)
   └─ Returns: tool_call[load_skill("n8n-workflow-patterns")]

2. should_continue → tool_node
   └─ Executes load_skill("n8n-workflow-patterns")
   └─ Returns: ToolMessage with SKILL.md content + available_files list

3. agent_node (2nd iteration)
   └─ LLM reads skill instructions, sees it references supporting files
   └─ Returns: tool_call[load_skill("n8n-mcp-tools-expert")]

4. should_continue → tool_node
   └─ Executes load_skill("n8n-mcp-tools-expert")
   └─ Returns: ToolMessage with MCP tools expert instructions

5. agent_node (3rd iteration)
   └─ LLM now has both skills loaded, ready to call MCP tools
   └─ Returns: tool_call[mcp_create_workflow(...)]

6. should_continue → tool_node
   └─ Executes MCP tool (with inter-call delay)
   └─ Returns: ToolMessage with workflow creation result

7. agent_node (4th iteration)
   └─ LLM generates final response with the workflow details
   └─ Returns: AIMessage (no tool calls)

8. should_continue → __end__
```

---

## Available Skills

| Skill | Description | Supporting Files |
|-------|-------------|-----------------|
| `n8n-code-javascript` | JavaScript code node expertise | BUILTIN_FUNCTIONS.md, COMMON_PATTERNS.md, DATA_ACCESS.md, ERROR_PATTERNS.md |
| `n8n-code-python` | Python code node expertise | COMMON_PATTERNS.md, DATA_ACCESS.md, ERROR_PATTERNS.md, STANDARD_LIBRARY.md |
| `n8n-expression-syntax` | n8n expression language reference | COMMON_MISTAKES.md, EXAMPLES.md |
| `n8n-mcp-tools-expert` | MCP tools integration guidance | SEARCH_GUIDE.md, VALIDATION_GUIDE.md, WORKFLOW_GUIDE.md |
| `n8n-node-configuration` | Node setup patterns | DEPENDENCIES.md, OPERATION_PATTERNS.md |
| `n8n-validation-expert` | Error troubleshooting | ERROR_CATALOG.md, FALSE_POSITIVES.md |
| `n8n-workflow-patterns` | Common workflow designs | ai_agent_workflow.md, database_operations.md, http_api_integration.md, scheduled_tasks.md |

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `ollama` | LLM provider: `ollama` or `openai` |
| `OLLAMA_MODEL` | `qwen3` | Model name for Ollama |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model name for OpenAI |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `SKILLS_DIR` | `./skills` (relative to package) | Skills directory path |
| `MCP_SERVER_URL` | `http://localhost:4244` | MCP server URL |
| `MCP_AUTH_TOKEN` / `N8N_MCP_AUTH_TOKEN` | `None` | MCP server auth token |
| `MCP_ENABLED` | `true` | Enable/disable MCP tools |
| `MCP_TIMEOUT` | `30.0` | MCP request timeout (seconds) |

### Runtime Services

The backend consists of three services:

- **n8n-mcp** — MCP server bridging n8n's API (port 4244), runs via `backend/n8n-mcp.yml`
- **aegra dev** — the agent runtime (port 4242), runs directly via `make backend-up`
- **PostgreSQL** — LangGraph state persistence, managed by aegra's auto-generated `docker-compose.yml` (not committed)

### aegra.json

```json
{
  "dependencies": ["agents"],
  "graphs": {
    "aria": "agents/n8n_agent/agent.py:graph"
  }
}
```

---

## Key Design Patterns

### Progressive Disclosure

The LLM sees information at three levels of detail, loading each level only when needed:

1. **Catalog** (system prompt) — skill names + one-line descriptions
2. **Instructions** (`load_skill`) — full SKILL.md body + available_files list
3. **Reference** (`read_skill_file`) — individual supporting documents

### Lazy Loading with Caching

- Skill metadata: scanned once, cached for process lifetime
- Skill content: loaded on first request, cached in store
- MCP tools: loaded on first request, cached in Context (retried if empty)

### Structured Error Messages

Tool errors follow a parseable format:
```
TOOL_ERROR attempt=2 type=execution_error retryable=true
message: 429 Too Many Requests
```

This lets the LLM reason about whether to retry, try a different tool, or give up.

### State Invariant Protection

Every `tool_call` in an `AIMessage` must have a matching `ToolMessage`. The catastrophic fallback in `tool_node` guarantees this invariant even when tool execution crashes, preventing corrupted checkpoint state.

---

## Security

- **Directory traversal prevention**: `read_skill_supporting_file()` rejects filenames containing `..` or starting with `/`.
- **MCP authentication**: Bearer token in HTTP headers (optional but recommended).
- **Input validation**: Invalid SKILL.md files are logged as warnings and skipped — they don't crash the system.

---

## File Manifest

| File | Purpose |
|------|---------|
| `agent.py` | Compiled graph: `StateGraph(...).compile()` |
| `config.py` | Configuration dataclass, lazy initialization, env var override |
| `skills.py` | Skill discovery, caching, lazy loading, catalog generation |
| `utils/nodes.py` | Graph node functions, routing, tool execution, retry logic, LLM model loading |
| `utils/tools.py` | `load_skill` and `read_skill_file` tool definitions |
| `utils/prompts.py` | System prompt template with Skill-First Protocol |
| `utils/state.py` | Minimal state: messages + retry counter |
| `utils/mcp.py` | MCP server connection, tool loading, error unwrapping |
| `skills/` | 7 skill directories with SKILL.md + supporting files |
