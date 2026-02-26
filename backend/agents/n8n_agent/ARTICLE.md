# Building a Skills System for LLM Agents in LangGraph

*Giving agents domain expertise without bloating prompts — inspired by Claude Code's skill pattern*

---

Your agent has access to 50 API endpoints. It can call any of them. But it doesn't know which one to call first, what parameters actually work, or the three things that will silently break in production. Tools give agents hands. Skills give them experience.

I built a skills system for a LangGraph agent that manages n8n workflows. The idea is simple: domain expertise lives in markdown files that the agent loads on demand, *before* it takes action. The approach borrows from how Claude Code manages its own skills, adapted for LangGraph.

This article covers what we built, how it works, and what we learned along the way — including the things that didn't work.

---

## What Are Skills?

A skill is a package of domain expertise stored as a markdown file. It contains instructions, best practices, parameter guides, and common pitfalls — everything an LLM needs to do a specific task well.

Think of it as the difference between handing someone a wrench and handing them the wrench plus the repair manual.

Here's what a skill looks like on disk:

```
skills/n8n-workflow-patterns/
├── SKILL.md                    # Primary instructions (YAML frontmatter + markdown)
├── http_api_integration.md     # Supporting reference
├── database_operations.md      # Supporting reference
├── ai_agent_workflow.md        # Supporting reference
└── scheduled_tasks.md          # Supporting reference
```

The `SKILL.md` file uses YAML frontmatter for machine-readable metadata, followed by markdown instructions for the LLM:

```yaml
---
name: n8n-workflow-patterns
description: Proven workflow architectural patterns from real n8n workflows.
version: "1.0"
tags: [n8n, workflows, architecture]
dependencies: []
---

# n8n Workflow Patterns

Proven architectural patterns for building n8n workflows.

## The 5 Core Patterns

1. **Webhook Processing** (Most Common)
   - Receive HTTP requests → Process → Output
   - Pattern: Webhook → Validate → Transform → Respond/Notify

2. **HTTP API Integration**
   - Fetch from REST APIs → Transform → Store/Use
   ...
```

The agent doesn't see any of this content upfront. It only sees a lightweight catalog — names, descriptions, tags. When a relevant task comes up, it loads the skill it needs, reads the instructions, and *then* takes action.

---

## Skills vs. MCP Tools

If you're using MCP (Model Context Protocol), you might wonder: "Why not put everything in MCP tools?"

They do different things:

| | Skills | MCP Tools |
|---|---|---|
| **What they are** | Knowledge packages (markdown files) | Executable actions (API calls) |
| **What they do** | Teach the LLM *how* to do something | *Do* something |
| **When loaded** | On-demand, when the LLM requests them | Once, at agent startup |
| **Token cost** | Variable — only loaded when needed | Fixed — schemas always in context |
| **Example** | "Here's how to configure a webhook node correctly" | `create_workflow(nodes=[...])` |

They work together in sequence. The agent loads a skill to understand *how* to approach a task, then calls MCP tools to *execute* it. We call this the **Skill-First Protocol** — knowledge before action.

```
User: "Create a webhook workflow that validates incoming JSON"

Agent's internal flow:
1. load_skill("n8n-workflow-patterns")     ← Learn the pattern
2. load_skill("n8n-mcp-tools-expert")      ← Learn the tools
3. n8n_create_workflow(nodes=[...])         ← Execute with knowledge
```

Without the skill step, the agent guesses at parameters and misses validation steps. With skills loaded first, it follows proven patterns.

---

## Why Skills Should Be Tool Calls, Not Prompt Injections

The obvious approach to giving an agent domain knowledge is to stuff it all into the system prompt. Concatenate every skill file, prepend it to every conversation, done.

It's tempting because it's simple — no tools, no loading logic, just a bigger prompt. But it breaks down for four reasons, and the fourth is the one most teams discover too late.

### 1. Token cost scales linearly

If you have 7 skills averaging 2,000 tokens each, that's 14,000 tokens in every request — even for "Hello, how are you?" conversations. With a pay-per-token model, this adds up fast. With a local model, it eats into your context window.

### 2. Attention dilution is real

LLMs have finite attention. Instruction-following degrades as system prompt length increases. When the model has to sift through 14,000 tokens of documentation to find the 2,000 tokens relevant to the current task, accuracy drops. The "Lost in the Middle" problem is well-documented — information buried in long contexts gets overlooked.

### 3. Static prompts go stale

When skills are embedded in the prompt, updating a skill means redeploying the agent. When skills live on the filesystem, you update a markdown file and the next request picks up the changes. No restart needed.

### 4. You lose all observability

This is the one that matters most in production. When skills are baked into the system prompt, they're invisible. Your traces show a giant prompt blob, and you can't answer basic questions: *Which skills did the agent actually use? Did it read the right one for this task? Did it ignore instructions?*

When skills are tool calls, every `load_skill("n8n-workflow-patterns")` shows up as a distinct, timestamped event in your trace. You can see:

- **Which skills were loaded** — and which weren't
- **When they were loaded** — before or after the first MCP tool call?
- **What the agent did after loading** — did it follow the skill's instructions, or call the MCP tool with wrong parameters anyway?

With prompt injection, all of this is a black box. With tool calls, you get structured, filterable traces that connect skill loading to downstream actions. If you're using something like Langfuse, you can correlate skill usage with success rates and build a feedback loop for improving skill content.

The progressive disclosure approach solves all four: the agent sees a lightweight catalog (~500 tokens), loads full instructions (~2,000 tokens) only for the skills it needs, and every load is a traceable event.

---

## The Implementation

The full system has four parts: a skill store, two tools the LLM calls, a system prompt, and a graph. Rather than walking through them step-by-step, I'll focus on the design decisions that matter — the things that aren't obvious from reading the code.

### Three Tiers of Knowledge

The system loads knowledge progressively, in three tiers:

**Tier 1 — Catalog (~500 tokens, always present).** The system prompt includes an XML-structured list of all skills: names, descriptions, tags, supporting file names. Enough for the LLM to decide *which* skills to load, cheap enough to include every time.

```xml
<skill>
  <name>n8n-workflow-patterns</name>
  <description>Proven workflow architectural patterns from real n8n workflows.</description>
  <tags>n8n, workflows, architecture</tags>
  <supporting_files>ai_agent_workflow.md, database_operations.md, http_api_integration.md</supporting_files>
</skill>
```

Why XML? Structured formats help LLMs parse options more reliably than plain text. The catalog also includes supporting file names so the LLM knows what reference docs exist *before* loading a skill.

**Tier 2 — Instructions (~2,000 tokens, on-demand).** When the LLM calls `load_skill("n8n-workflow-patterns")`, it gets the full SKILL.md content plus a list of available supporting files. Best practices, parameter guides, decision trees.

**Tier 3 — Reference details (variable, fine-grained).** If the instructions reference a specific topic ("see COMMON_PATTERNS.md for JavaScript examples"), the LLM can call `read_skill_file("n8n-code-javascript", "COMMON_PATTERNS.md")` to get just that file.

The result: a conversation about JavaScript code nodes might load ~4,000 tokens of skill content, while a simple greeting loads zero.

```
                    Token Budget
                    ┌──────────────┐
Prompt Stuffing:    │██████████████│ 14,000 tokens every request
                    └──────────────┘

Progressive:        │██│              500 tokens (catalog only) — greeting
                    │██████│          4,000 tokens — JS code task
                    │████████│        6,000 tokens — multi-skill task
```

### The Skill Store

The `SkillStore` manages discovery and caching. Two levels: metadata (always cached after first scan) and content (cached lazily on first load).

```python
class SkillStore:
    def __init__(self, skills_dir: str | Path) -> None:
        self.skills_dir = Path(skills_dir)
        self._metadata_cache: dict[str, SkillMetadata] = {}
        self._content_cache: dict[str, ParsedSkill] = {}
        self._scanned = False

    def scan(self) -> dict[str, SkillMetadata]:
        """Discover all skills — parse only YAML frontmatter (fast)."""
        if self._scanned and self._metadata_cache:
            return self._metadata_cache

        self._metadata_cache.clear()
        self._content_cache.clear()

        for skill_file in self.skills_dir.rglob("SKILL.md"):
            try:
                metadata = parse_metadata_only(skill_file)
                skill_name = metadata.name if metadata.name != "unknown" else skill_file.parent.name
                metadata.path = skill_file
                self._metadata_cache[skill_name] = metadata
            except Exception as e:
                logger.warning(f"Failed to parse skill at {skill_file}: {e}")

        self._scanned = True
        return self._metadata_cache

    def load(self, skill_name: str) -> ParsedSkill | None:
        """Lazy-load the full SKILL.md content for a skill."""
        if skill_name in self._content_cache:
            return self._content_cache[skill_name]

        metadata = self._metadata_cache.get(skill_name)
        if not metadata or not metadata.path:
            return None

        parsed = parse_skill_file(metadata.path)
        self._content_cache[skill_name] = parsed
        return parsed
```

A few things to note:

`scan()` only parses YAML frontmatter — a regex splits YAML from markdown, so we extract metadata without reading file bodies. This keeps startup fast even with dozens of skills.

When `scan()` hits a malformed SKILL.md, it logs a warning and skips it instead of crashing the entire discovery process. This matters when you have multiple teams contributing skills — one bad file shouldn't take down the agent.

`load()` caches on first access. In a long conversation about JavaScript, `load_skill("n8n-code-javascript")` hits the filesystem once; everything after that is from cache.

The data types behind this are intentionally split. `SkillMetadata` (lightweight, for the catalog) and `ParsedSkill` (full content, loaded on demand) are separate dataclasses. Scanning 50 skills to build a catalog stays fast because we never touch the markdown bodies.

```python
@dataclass
class SkillMetadata:
    """Lightweight metadata extracted from YAML frontmatter."""
    name: str
    description: str
    version: str = "1.0"
    tags: list[str] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)
    path: Path | None = None

@dataclass
class ParsedSkill:
    """Full skill — metadata plus the markdown body."""
    metadata: SkillMetadata
    content: str
```

### The Skill Tools

The LLM interacts with the store through two tools: `load_skill` and `read_skill_file`. They're created via a factory function that captures the store instance through closure.

```python
def create_skill_tools(store: SkillStore) -> list[BaseTool]:
    available = ", ".join(store.get_skill_names()) or "none"

    @tool
    def load_skill(skill_name: str) -> str:
        """Load expert knowledge for a skill."""
        parsed = store.load(skill_name)
        if parsed is None:
            names = ", ".join(store.get_skill_names())
            return json.dumps(
                {"error": f"Skill '{skill_name}' not found", "available_skills": names}
            )
        return json.dumps({
            "skill_name": skill_name,
            "description": parsed.metadata.description,
            "instructions": parsed.content,
            "available_files": store.list_supporting_files(skill_name),
        })

    @tool
    def read_skill_file(skill_name: str, filename: str) -> str:
        """Read a supporting file from a skill folder."""
        try:
            content = store.read_supporting_file(skill_name, filename)
            return json.dumps({
                "skill_name": skill_name, "filename": filename, "content": content,
            })
        except (FileNotFoundError, ValueError) as e:
            return json.dumps({"error": f"Error reading file: {e}"})

    # Dynamic docstrings — the LLM sees these as part of the tool schema
    load_skill.__doc__ = (
        f"Load expert knowledge for a skill. Returns JSON with the skill's "
        f"instructions and a list of available supporting files.\n\n"
        f"Available skills: {available}\n\n"
        f"Args:\n    skill_name: Exact name of the skill to load."
    )

    return [load_skill, read_skill_file]
```

Three design choices worth calling out:

**Dynamic docstrings.** The tool's description gets overwritten at creation time to include the list of valid skill names. The LLM sees tool descriptions as part of the tool schema — without this, it wouldn't know which names are valid arguments. This is one of those things that's easy to miss: you define the tool, it works in tests, but the LLM keeps hallucinating skill names because it never saw the valid options.

**Self-correcting errors.** When `load_skill` fails, it returns the full list of valid names in the error response. The LLM can read this and retry with the right name. This cuts down on wasted turns from hallucinated skill names.

**Directory traversal protection in `read_skill_file`.** Since the LLM controls the `filename` argument, a call like `read_skill_file("my-skill", "../../etc/passwd")` could read arbitrary files. The store validates that filenames don't contain `..` or start with `/`. This is a security consideration that most LangGraph tutorials don't mention, but it matters the moment your agent is exposed to untrusted input.

### The System Prompt and Graph

The system prompt establishes the **Skill-First Protocol** — skills must be loaded before MCP tools are called.

```python
SYSTEM_PROMPT = """You are an AI assistant specialized in workflow automation.

Current time: {current_time}

<skills_system>

## Progressive Discovery Workflow

1. **Browse**: Review the skill summaries below
2. **Load**: When a task matches a skill, call `load_skill(skill_name)` first
3. **Inspect**: Check the `available_files` list in the response
4. **Reference**: Use `read_skill_file` to access specific documentation as needed
5. **Execute**: Only then call MCP tools, informed by the skill's best practices

## Skill-First Protocol

**Before calling any MCP tool, you MUST load the relevant skill first.**

### Task-to-Skill Mapping

| Task | Required Skill(s) |
|------|-------------------|
| Creating or modifying workflows | `n8n-workflow-patterns` + `n8n-mcp-tools-expert` |
| Writing JavaScript code nodes | `n8n-code-javascript` |
| Validation or troubleshooting | `n8n-validation-expert` |

## Available Skills

{skill_catalog}

</skills_system>

## MCP Tools

{mcp_tools_list}
"""
```

The task-to-skill mapping table is the most important part. It tells the LLM exactly which skills to load for each type of task, removing guesswork. Without it, the LLM has to figure out from descriptions alone which skills are relevant — and it often gets that wrong.

The graph itself is a standard ReAct loop:

```python
builder = StateGraph(State, context_schema=Context)
builder.add_node(agent_node)
builder.add_node(tool_node)
builder.add_node(error_summary_node)

builder.add_edge("__start__", "agent_node")
builder.add_conditional_edges(
    "agent_node",
    should_continue,
    {"tool_node": "tool_node", "error_summary_node": "error_summary_node", "__end__": "__end__"},
)
builder.add_edge("tool_node", "agent_node")
builder.add_edge("error_summary_node", "__end__")

graph = builder.compile(name="Skills Agent")
```

```
__start__ → agent_node ⟷ tool_node → __end__
                ↓ (max retries)
          error_summary_node → __end__
```

Skill tools and MCP tools are bound to the LLM simultaneously. The LLM decides which to call based on the system prompt's guidance. The Skill-First Protocol is enforced by prompting, not by rigid graph topology.

---

## What We Tried That Didn't Work

This section is the part I wish I'd found in other articles about LangGraph agent design.

### The multi-phase pipeline

The first version of this agent had separate nodes for skill loading, planning, and execution. The graph looked like:

```
__start__ → plan_skill → [conditional] → load_skill → execute_with_skill → [conditional]
```

The state carried fields like `selected_skill`, `skill_context`, and `execution_phase` to track which phase the agent was in. It looked clean on a whiteboard.

In practice, it was brittle. The planning node would select a skill, but then the execution node would realize it needed a *different* skill. The conditional routing got complicated. Adding a new skill required updating the routing logic. And the LLM was already good at chaining tool calls on its own — `load_skill` → `read_skill_file` → MCP tool — without us telling it which node to be in.

We ripped it out and replaced it with the single ReAct loop. The state went from five fields to two: messages and a retry counter. The ordering that used to be encoded in graph edges is now a sentence in the system prompt ("load the relevant skill first"). It works better and is half the code.

The lesson: prompting beats graph topology for soft constraints. Use the graph for hard requirements (like "always summarize errors before ending") and the prompt for behavioral guidance (like "load skills before calling tools").

### MCP session pool bursting

The tool node originally executed tool calls in parallel. This worked fine for skill tools (which are local and fast), but MCP tools hit an external HTTP server — the n8n-mcp server — that has a session pool. Parallel calls would burst the pool and trigger 429 rate-limit errors.

We switched to sequential execution with a small delay between MCP calls:

```python
for i, tool_call in enumerate(tool_calls):
    if i > 0 and tool_name not in SKILL_TOOLS:
        await asyncio.sleep(INTER_CALL_DELAY)  # 0.5s delay between MCP calls
```

Skill tools still execute immediately (they're just reading from a local cache). The delay only applies to remote MCP calls. Not elegant, but it stopped the 429s.

### Error detection via string matching

The `langchain-mcp-adapters` library doesn't expose structured HTTP status codes. Errors come back as generic `Exception` objects with the status code somewhere in the message string. To decide whether an error is retryable (429, 502, 503, 504) or permanent, we parse the exception message:

```python
def _is_retryable_error(exc: BaseException) -> bool:
    if isinstance(exc, ExceptionGroup):
        return any(_is_retryable_error(sub) for sub in exc.exceptions)
    msg = str(exc)
    return any(code in msg for code in RETRYABLE_STATUS_CODES)
```

The `ExceptionGroup` unwrapping is there because Python 3.11+ groups concurrent exceptions. If you're running async tool calls and multiple fail, you get an `ExceptionGroup` instead of a single exception.

This is fragile — a library update could change the error message format and break detection. But it's the only reliable method available today with the adapter library.

### The API invariant that breaks state persistence

This one was subtle. The OpenAI Chat Completions API has a strict invariant: every `tool_call` in an `AIMessage` must have a matching `ToolMessage` with the same `tool_call_id`. If the tool node crashes before producing any `ToolMessages`, the checkpointer persists a broken state. The next request loads that state, the API rejects it, and the conversation is permanently stuck.

The fix is a fallback function that always produces `ToolMessage` responses, even when the actual tool execution threw an unhandled exception:

```python
def _create_fallback_error_messages(tool_calls, error_message) -> list[ToolMessage]:
    """Last-resort guarantee that the tool_call/ToolMessage invariant holds."""
    return [
        ToolMessage(content=json.dumps({"error": error_message}), tool_call_id=tc["id"])
        for tc in tool_calls
    ]
```

This runs in the `except` block of the tool node. Without it, one bad tool call can corrupt the conversation state for good.

### The error summary node

When the agent exhausts its retry budget, it needs to stop. But you can't just end the conversation with a raw error — the user sees gibberish. And you can't give the LLM its tools back, because it'll just retry and burn more tokens.

The solution: call the LLM one more time, *without binding any tools*, and ask it to summarize what went wrong in plain language. Since it has no tools, it can only produce a text response — no infinite retry loops.

```python
async def error_summary_node(state: State, runtime: Runtime[Context]) -> dict:
    model = load_chat_model(...)
    # Deliberately NOT binding tools here
    response = await model.ainvoke([
        {"role": "system", "content": ERROR_SUMMARY_SYSTEM_PROMPT},
        *state["messages"],
    ])
    return {"messages": [response]}
```

This is the one place where graph topology does matter. The `error_summary_node` is a hard constraint — when retries are exhausted, the conversation must end with a human-readable summary, not another tool call.

---

## ARIA: Where This Runs in Production

The skills system described above is the core of **ARIA** (Automation & Reasoning Intelligent Agent), an open-source project for building and managing [n8n](https://n8n.io/) automation workflows through natural language.

ARIA is a full-stack app: a React/TypeScript chat interface that connects to a LangGraph agent backend. The user describes what they want, and the agent creates, modifies, and validates n8n workflows programmatically — loading the right domain expertise before every action.

### The Stack

```
┌──────────────────────────────────────┐
│          ARIA Frontend               │
│     React / TypeScript / Vite        │
└──────────────┬───────────────────────┘
               │ HTTP (Agent Protocol)
               ▼
┌──────────────────────────────────────┐
│       AEGRA (LangGraph Server)       │
│     FastAPI + LangGraph + Postgres   │
│                                      │
│   Skills Store ◄─► Agent ◄─► MCP    │
└──────────────┬───────────────────────┘
               │ HTTP (MCP)
               ▼
┌──────────────────────────────────────┐
│     n8n-mcp Server → n8n Instance   │
└──────────────────────────────────────┘
```

**[AEGRA](https://github.com/ibbybuilds/aegra)** is an open-source, self-hosted LangGraph platform alternative created by [Muhammad Ibrahim](https://github.com/ibbybuilds) (Apache 2.0). It handles the infrastructure — HTTP routing, PostgreSQL state persistence, authentication, streaming — so the skills system only needs to focus on domain logic. The graph registers via a single config file:

```json
{
  "dependencies": ["."],
  "graphs": {
    "skills_agent": "./graphs/skills_agent/agent.py:graph"
  }
}
```

### The Skills Catalog

The agent ships with seven skills:

| Skill | What It Teaches | Supporting Files |
|-------|----------------|-----------------|
| `n8n-workflow-patterns` | Architectural patterns (webhooks, APIs, scheduled tasks, AI agents, database ops) | 4 pattern-specific guides |
| `n8n-mcp-tools-expert` | How to use MCP tools correctly (search, validation, workflow management) | SEARCH_GUIDE, VALIDATION_GUIDE, WORKFLOW_GUIDE |
| `n8n-code-javascript` | JavaScript code node best practices | BUILTIN_FUNCTIONS, COMMON_PATTERNS, DATA_ACCESS, ERROR_PATTERNS |
| `n8n-code-python` | Python code node best practices | COMMON_PATTERNS, DATA_ACCESS, ERROR_PATTERNS, STANDARD_LIBRARY |
| `n8n-expression-syntax` | n8n's expression language | COMMON_MISTAKES, EXAMPLES |
| `n8n-node-configuration` | Node setup and configuration | DEPENDENCIES, OPERATION_PATTERNS |
| `n8n-validation-expert` | Error troubleshooting and debugging | ERROR_CATALOG, FALSE_POSITIVES |

The MCP server (`n8n-mcp`) provides the *actions* — tools like `n8n_create_workflow`, `search_nodes`, `validate_node`. The skills provide the *knowledge* about when and how to use those actions correctly.

Since skills are markdown files in a Git repo, they get version control, PR reviews, and blame history for free. Domain experts can update them without touching Python code. During development, the store's `invalidate()` method clears all caches so changes are picked up on the next request — no restart needed.

### A Typical Interaction

When a user types: *"Create an HTTP webhook workflow that validates incoming JSON and stores it in Postgres"*

**Turn 1** — The agent sees the skill catalog in its system prompt and decides which skills are relevant:

```
Agent thinks: This involves workflow creation and database operations.
              I need n8n-workflow-patterns and n8n-mcp-tools-expert.
Agent calls:  load_skill("n8n-workflow-patterns")
```

**Turn 2** — Now it knows the Webhook Processing pattern (Webhook → Validate → Transform → Respond) and the Database Operations pattern. It loads the MCP tools guide:

```
Agent calls:  load_skill("n8n-mcp-tools-expert")
```

**Turn 3** — It needs specific details about workflow creation parameters, so it drills into a supporting file:

```
Agent calls:  read_skill_file("n8n-mcp-tools-expert", "WORKFLOW_GUIDE.md")
```

**Turn 4** — With domain expertise loaded, the agent calls the MCP tool with correct parameters, proper node ordering, and error handling:

```
Agent calls:  n8n_create_workflow(nodes=[
                Webhook node (validated JSON input),
                IF node (schema validation),
                Postgres node (insert),
                Respond to Webhook (success/error)
              ])
```

The frontend streams this entire process back to the user in real-time. Every `load_skill` call shows up in the conversation as the agent "thinking" before acting.

### Why n8n Needs This

n8n has hundreds of nodes, each with unique configuration options. The MCP tools expose CRUD operations for workflows, but they don't encode best practices. Without skills, the agent guesses at parameter formats, misses validation steps that experienced n8n users always include, and creates workflows that work but aren't robust. The skills are the accumulated expertise of someone who has built many n8n workflows, packaged so the LLM can load it on demand.

### Observability

Since skills are tool calls, every `load_skill` shows up as a traceable event. ARIA integrates with [Langfuse](https://langfuse.com/) for observability — each trace is tagged with session, user, and thread IDs. You can filter the Langfuse dashboard to answer:

- Is the agent loading the right skills for each task type?
- Are there skills that never get loaded (candidates for removal)?
- How much token overhead does skill loading add per conversation?
- Which MCP tool calls fail most often, and does the skill content need updating?

Enable it with a single environment variable (`LANGFUSE_LOGGING=true`) and the agent's entire reasoning chain becomes visible. This is where the observability argument from earlier pays off in practice — you can actually measure whether skills are helping.

---

## What I'd Tell Someone Building This

The implementation is compact — under 600 lines of Python, most of it error handling.

If I were starting over, here's what I'd keep in mind:

**Start with one ReAct loop.** Don't build a multi-phase pipeline. The LLM chains tool calls on its own. Use the graph for hard constraints (error handling, retry limits) and the prompt for behavioral guidance (load skills first).

**Skills are just markdown.** That's the whole point. Don't overthink the format. YAML frontmatter for metadata, markdown for instructions, one directory per skill. Anyone who understands the domain can write one.

**The system prompt does the heavy lifting.** The task-to-skill mapping table matters more than any code in the graph. If the LLM doesn't know which skill to load for which task, nothing else works.

**Watch for the edges.** Directory traversal in file-reading tools. The OpenAI tool_call/ToolMessage invariant. ExceptionGroup unwrapping in Python 3.11+. MCP session pool limits. These are the things that bit us and that most articles don't cover.

**Measure what the agent loads.** The strongest argument for skills-as-tool-calls is that you can trace them. If you're not looking at those traces, you're missing half the value.

The pattern works with any LLM, any tool protocol, and any domain. The only requirement is that someone writes down what "doing it right" looks like for their domain — and that part doesn't require any code at all.

---

### Open-Source Projects

- **[ARIA](https://github.com/pessini/aria-workflow-assistant)** — The full-stack workflow assistant. Skills system lives under `skills-agent/n8n_agent/`.
- **[AEGRA](https://github.com/ibbybuilds/aegra)** — Self-hosted LangGraph platform alternative (Apache 2.0). Agent Protocol server, PostgreSQL persistence, auth.
- **[n8n-mcp](https://github.com/czlonkowski/n8n-mcp)** — MCP server bridging n8n's API into the Model Context Protocol.
- **[n8n](https://github.com/n8n-io/n8n)** — The workflow automation platform.
