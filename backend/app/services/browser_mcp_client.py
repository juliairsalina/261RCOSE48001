from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

logger = logging.getLogger(__name__)

# Requires: npm install -g @playwright/mcp   (or npx will auto-install on first run)
_PLAYWRIGHT_MCP_SERVER = {
    "command": "npx",
    "args": ["--yes", "@playwright/mcp@latest", "--headless"],
    "transport": "stdio",
}


@asynccontextmanager
async def browser_mcp_session():
    """Async context manager that yields LangChain-compatible browser tools.

    Connects to @playwright/mcp via langchain-mcp-adapters. Yields an empty
    list if the package is not installed or the MCP server fails to start,
    so callers can fall back gracefully.

    Usage:
        async with browser_mcp_session() as tools:
            if not tools:
                # fall back to stub
                ...
            tool_map = {t.name: t for t in tools}
            await tool_map["browser_navigate"].ainvoke({"url": "https://..."})
    """
    try:
        from langchain_mcp_adapters.client import MultiServerMCPClient

        async with MultiServerMCPClient({"browser": _PLAYWRIGHT_MCP_SERVER}) as client:
            tools = client.get_tools()
            logger.info("Browser MCP connected — %d tools available", len(tools))
            yield tools
    except ImportError:
        logger.warning("langchain_mcp_adapters not installed — browser tools unavailable")
        yield []
    except Exception as exc:
        logger.warning("Browser MCP session failed (%s) — falling back to no browser tools", exc)
        yield []
