"""MCP server connection management for the skills agent.

This module handles the connection between the Skills Agent and an external
MCP (Model Context Protocol) server — in this project, typically the
``n8n-mcp`` container that bridges n8n's REST API into MCP-compatible tools.

**What is MCP?**  Model Context Protocol is a standard for exposing tools to
LLMs.  An MCP server advertises a list of tools (with JSON schemas) that can
be invoked over HTTP.  This module uses ``langchain-mcp-adapters`` to
automatically convert those MCP tools into LangChain ``BaseTool`` objects
that the LangGraph agent can bind to its LLM.

**Connection lifecycle**:

1. ``check_mcp_server_health()`` — lightweight GET to ``/health`` to verify
   the server is reachable before attempting the heavier tool-loading step.
2. ``load_mcp_tools()`` — uses ``MultiServerMCPClient`` with streamable-http
   transport to fetch tool definitions from the ``/mcp`` endpoint.  Retries
   with exponential backoff on transient failures.
3. The returned tools are cached in ``Context._mcp_tools`` and reused across
   graph invocations.

**Graceful degradation**: If the MCP server is unavailable, the agent
continues with skill tools only (``load_skill``, ``read_skill_file``).  It
will retry MCP tool loading on the next ``Context.initialize()`` call.

**Error handling quirks**: The ``langchain-mcp-adapters`` library uses
``anyio.create_task_group()`` internally, which wraps errors in
``ExceptionGroup``.  The ``_extract_error_detail()`` helper recursively
unwraps these to produce human-readable error messages.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import httpx

if TYPE_CHECKING:
    from langchain_core.tools import BaseTool

logger = logging.getLogger(__name__)

# Number of times to retry loading MCP tools before giving up.
# The MCP server may be slow to start (especially in Docker Compose where
# service ordering is not guaranteed), so multiple attempts are needed.
MAX_LOAD_RETRIES = 3

# Base delay for exponential backoff: 2^1=2s, 2^2=4s between retries.
RETRY_BASE_DELAY = 2  # seconds


@dataclass
class MCPClientConfig:
    """Configuration for connecting to an MCP server."""

    server_url: str = "http://localhost:4244"
    auth_token: str | None = None
    timeout: float = 30.0


class MCPClientError(Exception):
    """Raised when MCP client operations fail."""


async def check_mcp_server_health(config: MCPClientConfig) -> bool:
    """Check if the MCP server is reachable and healthy.

    Args:
        config: MCP client configuration.

    Returns:
        True if the server is healthy, False otherwise.
    """
    try:
        async with httpx.AsyncClient(timeout=config.timeout) as client:
            headers = {}
            if config.auth_token:
                headers["Authorization"] = f"Bearer {config.auth_token}"

            response = await client.get(
                f"{config.server_url}/health",
                headers=headers,
            )
            return response.status_code == 200
    except httpx.RequestError as e:
        logger.warning(f"MCP server health check failed: {e}")
        return False


async def load_mcp_tools(config: MCPClientConfig) -> list[BaseTool]:
    """Load available MCP tools from the server.

    This function connects to the MCP server and retrieves all available tools,
    converting them to LangChain-compatible tool objects.

    Args:
        config: MCP client configuration.

    Returns:
        List of LangChain tools loaded from the MCP server.
        Returns an empty list if the server is unavailable.
    """
    try:
        from langchain_mcp_adapters.client import MultiServerMCPClient
    except ImportError:
        logger.warning(
            "langchain-mcp-adapters not installed. "
            "MCP tools will not be available. "
            "Install with: pip install langchain-mcp-adapters"
        )
        return []

    # Check server health first
    if not await check_mcp_server_health(config):
        logger.warning(
            f"MCP server at {config.server_url} is not available. "
            "Continuing without MCP tools."
        )
        return []

    # Configure the MCP client for Streamable HTTP transport.
    #
    # The ``MultiServerMCPClient`` supports multiple MCP servers, but we only
    # connect to one ("n8n-mcp").  The key "n8n-mcp" is used as a namespace
    # prefix for tool names if there were multiple servers.
    #
    # The ``/mcp`` path is the JSON-RPC endpoint exposed by the n8n-mcp
    # Docker image (ghcr.io/czlonkowski/n8n-mcp).  It speaks the MCP
    # "streamable-http" transport, which is a long-lived HTTP connection
    # that streams JSON-RPC messages.
    server_config: dict[str, Any] = {
        "n8n-mcp": {
            "url": f"{config.server_url}/mcp",
            "transport": "streamable_http",
        }
    }

    if config.auth_token:
        server_config["n8n-mcp"]["headers"] = {
            "Authorization": f"Bearer {config.auth_token}"
        }

    # Retry with exponential backoff.  Common transient failures:
    # - 429: n8n-mcp session pool exhausted (each get_tools() creates a session)
    # - 502/503: server still starting up behind a reverse proxy
    last_error: Exception | None = None
    for attempt in range(MAX_LOAD_RETRIES):
        try:
            # As of langchain-mcp-adapters 0.1.0, MultiServerMCPClient is no
            # longer a context manager. Each returned tool creates its own
            # session on invocation, so no persistent connection is needed.
            client = MultiServerMCPClient(server_config)
            tools = await client.get_tools()
            logger.info(f"Loaded {len(tools)} MCP tools from {config.server_url}")
            return tools

        except Exception as e:
            last_error = e
            detail = _extract_error_detail(e)
            if attempt < MAX_LOAD_RETRIES - 1:
                delay = RETRY_BASE_DELAY ** (attempt + 1)  # 2s, 4s
                logger.warning(
                    "Failed to load MCP tools (attempt %d/%d), retrying in %ds: %s",
                    attempt + 1,
                    MAX_LOAD_RETRIES,
                    delay,
                    detail,
                )
                await asyncio.sleep(delay)
            else:
                logger.warning("Failed to load MCP tools after %d attempts: %s", MAX_LOAD_RETRIES, detail)

    return []


def _extract_error_detail(exc: BaseException) -> str:
    """Extract a human-readable error message, unwrapping ExceptionGroup.

    The MCP streamable-http transport wraps errors in ExceptionGroup via
    anyio TaskGroup.  ``str(ExceptionGroup(...))`` only shows the group
    message, hiding the actual error, so we recursively extract it.
    """
    if isinstance(exc, ExceptionGroup):
        parts = [_extract_error_detail(sub) for sub in exc.exceptions]
        return "; ".join(parts)
    msg = str(exc)
    if "429" in msg:
        msg += (
            " (hint: the n8n-mcp server has a session limit — each tool call "
            "creates a new session. Reduce SESSION_TIMEOUT_MINUTES or increase "
            "N8N_MCP_MAX_SESSIONS in docker-compose.yml)"
        )
    return msg


async def get_mcp_tools_cached(
    config: MCPClientConfig,
    cache: dict | None = None,
) -> list[BaseTool]:
    """Load MCP tools with optional caching.

    This is a convenience wrapper around ``load_mcp_tools()`` that avoids
    repeated HTTP round-trips by storing the result in a caller-provided
    dict.  The ``Context`` class uses its own caching mechanism (via
    ``_mcp_tools``), so this function is primarily useful for standalone
    scripts or tests that don't go through the full Context lifecycle.

    Args:
        config: MCP client configuration.
        cache: Optional dict to use as cache storage.  If provided and the
               tools have been loaded before, returns the cached result.

    Returns:
        List of LangChain tools loaded from the MCP server.
    """
    cache_key = f"mcp_tools_{config.server_url}"

    if cache is not None and cache_key in cache:
        return cache[cache_key]

    tools = await load_mcp_tools(config)

    if cache is not None:
        cache[cache_key] = tools

    return tools
