from __future__ import annotations

import json
import logging

from app.agents.state import AgentState
from app.services import openai_client

logger = logging.getLogger(__name__)

COMPANY_RESEARCH_SYSTEM_PROMPT = """You are a company research specialist.
Given raw page content scraped from a company website and/or job posting, extract structured information.

Return a valid JSON object with exactly these keys:
- company_summary: 2-3 sentence overview of what the company does
- products_or_services: list of main products or services (3-5 items)
- values: list of company values or culture highlights (3-5 items)
- recent_highlights: list of recent news or milestones (1-3 items, or empty list if none found)
- tech_stack: list of technologies mentioned (empty list if none)
- source_urls: list of URLs that were consulted

Return only valid JSON. No markdown, no extra text."""


async def research_company_node(state: AgentState) -> AgentState:
    """LangGraph node: use Browser MCP to research company background.

    Navigates to the job posting URL and the company homepage, passes the
    scraped content to GPT to extract structured company data, and stores
    it in state["company_background"].

    Falls back to the placeholder stub when:
    - langchain_mcp_adapters is not installed
    - @playwright/mcp fails to start
    - No page content could be extracted
    """
    job_json = state.get("job_json") or {}
    new_errors: list[str] = []

    company_name = job_json.get("company_name", "")
    job_url = job_json.get("job_url", "")

    if not company_name and not job_url:
        return {"company_background": None, "errors": new_errors}

    from app.services.browser_mcp_client import browser_mcp_session

    page_contents: list[str] = []

    async with browser_mcp_session() as tools:
        if tools:
            tool_map = {t.name: t for t in tools}
            navigate = tool_map.get("browser_navigate")
            snapshot = tool_map.get("browser_snapshot")

            # Scrape the job posting page
            if job_url and navigate and snapshot:
                try:
                    await navigate.ainvoke({"url": job_url})
                    result = await snapshot.ainvoke({})
                    page_contents.append(f"[Job Posting — {job_url}]\n{str(result)[:3000]}")
                except Exception as exc:
                    logger.warning("Browser MCP: job URL scrape failed for %s: %s", job_url, exc)

            # Guess company homepage and scrape it
            if company_name and navigate and snapshot:
                slug = company_name.lower().replace(" ", "").replace(",", "").replace(".", "")
                company_url = f"https://www.{slug}.com"
                try:
                    await navigate.ainvoke({"url": company_url})
                    result = await snapshot.ainvoke({})
                    page_contents.append(f"[Company Website — {company_url}]\n{str(result)[:3000]}")
                except Exception as exc:
                    logger.warning("Browser MCP: company homepage scrape failed for %s: %s", company_url, exc)

    if not page_contents:
        # No browser data — use the placeholder stub
        from app.services.company_research_service import get_company_background
        company_background = await get_company_background(company_name, job_url)
        return {"company_background": company_background, "errors": new_errors}

    # Ask GPT to extract structured company info from scraped content
    try:
        combined = "\n\n".join(page_contents)
        messages = [
            {"role": "system", "content": COMPANY_RESEARCH_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Company: {company_name}\n"
                    f"Job URL: {job_url}\n\n"
                    f"Scraped Content:\n{combined}"
                ),
            },
        ]
        raw = await openai_client.chat_completion(
            messages=messages,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        company_background: dict = json.loads(raw)
        company_background.setdefault("source_urls", [job_url])
    except Exception as exc:
        logger.warning("Company research GPT extraction failed: %s — using stub", exc)
        from app.services.company_research_service import get_company_background
        company_background = await get_company_background(company_name, job_url)
        new_errors.append(f"research_company_node: extraction failed: {exc}")

    return {**state, "company_background": company_background, "errors": new_errors}
