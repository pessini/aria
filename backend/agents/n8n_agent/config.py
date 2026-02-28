"""Define the configurable parameters for the skills agent.

The ``Context`` dataclass is the central configuration object for the Skills
Agent.  It is passed to every graph node via LangGraph's ``Runtime[Context]``
dependency injection mechanism (declared in the ``StateGraph`` constructor as
``context_schema=Context``).

Responsibilities:

1. **Declarative configuration** — all tuneable parameters (LLM provider,
   model names, MCP server URL, skills directory, etc.) are declared as
   dataclass fields with sensible defaults.

2. **Environment variable override** — ``__post_init__`` inspects environment
   variables and overrides any field that still has its default value.  This
   allows the same code to run locally with defaults and in Docker with
   env-based configuration, without requiring a separate config file.

3. **Lazy initialization** — expensive resources (skill store, MCP tools)
   are not created at construction time.  The async ``initialize()`` method
   must be called once before the first graph execution.  This is done
   lazily in ``agent_node`` so that the graph can be imported and compiled
   without side effects.

4. **Caching** — once initialized, the skill store and combined tools list
   are cached for the lifetime of the Context instance.  If MCP tools failed
   to load on the first attempt (e.g. the MCP server was still starting),
   ``initialize()`` will retry on subsequent calls.
"""

from __future__ import annotations

import logging
import os
from dataclasses import MISSING, dataclass, field, fields
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from langchain_core.tools import BaseTool

    from n8n_agent.skills import SkillStore

logger = logging.getLogger(__name__)


def _get_default_skills_dir() -> str:
    """Get the default skills directory relative to this file."""
    return str(Path(__file__).parent / "skills")


@dataclass(kw_only=True)
class Context:
    """The context configuration for the skills agent.

    This dataclass serves a dual purpose:

    - **Configuration schema**: LangGraph uses it as the ``context_schema`` for
      the graph, meaning it defines the shape of the configuration that callers
      can pass when invoking the graph.
    - **Runtime container**: After ``initialize()`` is called, it also holds
      the live skill store and tool instances used by graph nodes.

    All fields use ``kw_only=True`` so they must be passed by name, preventing
    accidental positional argument mistakes.
    """

    # -- LLM Configuration --------------------------------------------------
    provider: str = field(
        default="ollama",
        metadata={"description": "LLM provider to use: 'ollama' or 'openai'."},
    )

    ollama_model: str = field(
        default="qwen3",
        metadata={"description": "Model name for Ollama."},
    )

    openai_model: str = field(
        default="gpt-5-mini",
        metadata={"description": "Model name for OpenAI."},
    )

    base_url: str = field(
        default="http://localhost:11434",
        metadata={"description": "The base URL for the Ollama server."},
    )

    # -- Skills Configuration -------------------------------------------------
    skills_dir: str = field(
        default_factory=_get_default_skills_dir,
        metadata={"description": "Directory containing skill subdirectories."},
    )

    # -- MCP Configuration ---------------------------------------------------
    # MCP (Model Context Protocol) allows the agent to call tools exposed by
    # an external server.  In this project, the MCP server is typically the
    # n8n-mcp container, which bridges n8n's API into the MCP protocol so
    # the LLM can create/modify/execute n8n workflows programmatically.
    mcp_server_url: str = field(
        default="http://localhost:4244",
        metadata={"description": "URL of the MCP server for tool execution."},
    )

    mcp_auth_token: str | None = field(
        default=None,
        metadata={"description": "Authentication token for the MCP server."},
    )

    mcp_enabled: bool = field(
        default=True,
        metadata={"description": "Enable/disable MCP tool execution."},
    )

    mcp_timeout: float = field(
        default=30.0,
        metadata={"description": "Timeout in seconds for MCP server requests."},
    )

    # -- n8n Configuration ---------------------------------------------------
    # The n8n web URL is the browser-accessible URL for viewing/editing workflows.
    # This is separate from N8N_API_URL (used by the MCP server) because the API
    # URL may use Docker-internal hostnames (e.g. host.docker.internal) while
    # the web URL should use localhost or the actual domain name.
    n8n_web_url: str = field(
        default="http://localhost:4245",
        metadata={"description": "Browser-accessible URL of the n8n web UI."},
    )

    def __post_init__(self) -> None:
        """Override defaults with environment variables when present.

        The override logic only activates when a field still has its *default*
        value — meaning the caller did not explicitly set it.  This lets
        explicit constructor arguments take precedence over env vars, which in
        turn take precedence over coded defaults.

        Mapping of field names → environment variable names:

        ===============  ====================  ============================
        Field            Env Var               Notes
        ===============  ====================  ============================
        provider         LLM_PROVIDER          "ollama" or "openai"
        ollama_model     OLLAMA_MODEL
        openai_model     OPENAI_MODEL
        base_url         OLLAMA_BASE_URL
        skills_dir       SKILLS_DIR
        mcp_server_url   MCP_SERVER_URL
        mcp_auth_token   MCP_AUTH_TOKEN        Falls back to N8N_MCP_AUTH_TOKEN
        mcp_enabled      MCP_ENABLED           Parsed as boolean
        mcp_timeout      MCP_TIMEOUT           Parsed as float
        n8n_web_url      N8N_WEB_URL           Browser-accessible n8n URL
        ===============  ====================  ============================
        """
        for f in fields(self):
            if not f.init:
                continue

            env_var_name = f.name.upper()
            # Special cases for environment variable names
            if f.name == "provider":
                env_var_name = "LLM_PROVIDER"
            elif f.name == "ollama_model":
                env_var_name = "OLLAMA_MODEL"
            elif f.name == "openai_model":
                env_var_name = "OPENAI_MODEL"
            elif f.name == "base_url":
                env_var_name = "OLLAMA_BASE_URL"
            elif f.name == "skills_dir":
                env_var_name = "SKILLS_DIR"

            current_value = getattr(self, f.name)
            if f.default is not MISSING:
                default_value = f.default
            elif f.default_factory is not MISSING:
                default_value = f.default_factory()
            else:
                continue

            if current_value == default_value:
                env_value = os.environ.get(env_var_name)

                # mcp_auth_token supports two env var names because the Docker
                # Compose stack originally used N8N_MCP_AUTH_TOKEN for the
                # n8n-mcp container, and MCP_AUTH_TOKEN was added later for
                # consistency.  We check both so either works.
                if f.name == "mcp_auth_token" and not env_value:
                    env_value = os.environ.get("N8N_MCP_AUTH_TOKEN")

                if env_value:
                    if f.name == "mcp_enabled":
                        setattr(self, f.name, env_value.lower() in ("true", "1", "yes"))
                    elif f.name == "mcp_timeout":
                        setattr(self, f.name, float(env_value))
                    else:
                        setattr(self, f.name, env_value)

        # These are lazily initialized by initialize() and cached for the
        # lifetime of this Context instance.  They are "private" (prefixed
        # with _) because callers should use the corresponding @property
        # accessors which raise a clear error if initialize() hasn't been
        # called yet.
        self._skill_store: SkillStore | None = None
        self._mcp_tools: list[BaseTool] | None = None
        self._all_tools: list[BaseTool] | None = None

    @property
    def model(self) -> str:
        """Get the effective model based on provider."""
        if self.provider == "openai":
            return self.openai_model
        return self.ollama_model

    async def initialize(self) -> None:
        """Scan the skill store, load MCP tools, and build the combined tools list.

        This method is called lazily from ``agent_node`` on the first graph
        invocation.  It performs three sequential steps:

        1. **Skill store scan** — walks the ``skills_dir`` to find SKILL.md
           files and builds a metadata cache.  This is synchronous and fast
           (only YAML frontmatter is parsed, not the full file body).

        2. **MCP tools loading** — connects to the MCP server via
           ``langchain-mcp-adapters`` and retrieves the list of available tools.
           This is async and may fail if the server is starting up.  On failure,
           the agent continues with skill tools only and retries on the next
           ``initialize()`` call (the ``len(self._mcp_tools) == 0`` check).

        3. **Combined tools list** — merges skill tools (``load_skill``,
           ``read_skill_file``) with MCP tools into a single list that gets
           bound to the LLM via ``bind_tools()``.
        """
        from n8n_agent.skills import SkillStore
        from n8n_agent.utils.mcp import MCPClientConfig, load_mcp_tools
        from n8n_agent.utils.tools import create_skill_tools

        if self._skill_store is None:
            self._skill_store = SkillStore(self.skills_dir)
            self._skill_store.scan()
            logger.info("Skill store initialized with %d skills", len(self._skill_store.get_skill_names()))

        # Load MCP tools — retry on each initialize() call if previous
        # attempt returned empty (transient failure like 429).
        if self._mcp_tools is None or (self.mcp_enabled and len(self._mcp_tools) == 0):
            if self.mcp_enabled:
                config = MCPClientConfig(
                    server_url=self.mcp_server_url,
                    auth_token=self.mcp_auth_token,
                    timeout=self.mcp_timeout,
                )
                tools = await load_mcp_tools(config)
                if tools:
                    self._mcp_tools = tools
                    # Rebuild combined list when MCP tools become available
                    self._all_tools = None
                    logger.info("Loaded %d MCP tools", len(self._mcp_tools))
                elif self._mcp_tools is None:
                    self._mcp_tools = []
                    logger.warning("MCP tools unavailable — continuing with skill tools only")
            else:
                self._mcp_tools = []
                logger.info("MCP tools disabled")

        if self._all_tools is None:
            skill_tools = create_skill_tools(self._skill_store)
            self._all_tools = [*skill_tools, *self._mcp_tools]
            logger.info("Cached %d total tools (skill + MCP)", len(self._all_tools))

    @property
    def skill_store(self) -> SkillStore:
        """Access the initialized skill store."""
        if self._skill_store is None:
            raise RuntimeError("Context not initialized. Call await context.initialize() first.")
        return self._skill_store

    @property
    def mcp_tools(self) -> list[BaseTool]:
        """Access the loaded MCP tools."""
        if self._mcp_tools is None:
            raise RuntimeError("Context not initialized. Call await context.initialize() first.")
        return self._mcp_tools

    @property
    def all_tools(self) -> list[BaseTool]:
        """Access the combined skill + MCP tools list (cached)."""
        if self._all_tools is None:
            raise RuntimeError("Context not initialized. Call await context.initialize() first.")
        return self._all_tools
