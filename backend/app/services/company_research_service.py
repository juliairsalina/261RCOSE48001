from __future__ import annotations

# Browser MCP integration can be added here in future to extract real company data.
# For now this service returns structured placeholder data derived from the company name
# and job URL. In production, the Browser MCP (or a headless browser service) would
# navigate to the company website, LinkedIn page, and Crunchbase profile to extract
# real details.


async def get_company_background(company_name: str, job_url: str) -> dict:
    """Return background information about a company.

    In the MVP this returns structured placeholder data. A future version will
    integrate the Browser MCP to fetch live data from the company's website,
    LinkedIn, and Crunchbase.

    Args:
        company_name: The name of the company.
        job_url: The URL of the job posting (used to infer the company domain).

    Returns:
        A dict with keys:
            - company_summary: Brief overview of the company.
            - products_or_services: Main products or services offered.
            - values: Company values or culture highlights.
            - recent_highlights: Recent news or milestones.
            - source_urls: List of URLs that were consulted.
    """
    # Derive a rough domain from the job URL for display purposes
    domain = ""
    if job_url:
        try:
            from urllib.parse import urlparse
            parsed = urlparse(job_url)
            domain = parsed.netloc or ""
        except Exception:
            domain = ""

    return {
        "company_summary": (
            f"{company_name} is a technology company focused on building innovative solutions. "
            "Further details will be available once Browser MCP integration is enabled."
        ),
        "products_or_services": [
            "Software products and services",
            "Platform solutions",
            "Enterprise tools",
        ],
        "values": [
            "Innovation",
            "Customer focus",
            "Collaboration",
            "Continuous improvement",
        ],
        "recent_highlights": [
            "Details to be populated via Browser MCP in a future release.",
        ],
        "source_urls": [
            job_url,
            f"https://www.linkedin.com/company/{company_name.lower().replace(' ', '-')}",
            f"https://{domain}" if domain else "",
        ],
    }
