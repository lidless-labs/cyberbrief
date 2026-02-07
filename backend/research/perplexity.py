"""Perplexity API integration for enhanced cyber threat intelligence research.

STANDARD tier uses Sonar (sonar) for fast, citation-backed research.
DEEP tier uses Sonar Deep Research (sonar-deep-research) for comprehensive analysis.
"""

from __future__ import annotations

import json
import os
import logging
import re
import time
from typing import Optional

import httpx

from models import (
    ResearchBundle,
    ResearchTier,
    ResearchMetadata,
    SearchResult,
    IOC,
    IOCType,
    AttackTechnique,
    Evidence,
    ReportSource,
)

logger = logging.getLogger(__name__)

PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"


class PerplexityNotAvailable(Exception):
    """Raised when Perplexity API is not configured or unavailable."""
    pass


def _build_sonar_prompt(topic: str) -> str:
    """Build a structured prompt for Perplexity Sonar cyber research."""
    return f"""You are a senior cyber threat intelligence analyst. Research the following topic thoroughly and provide a comprehensive intelligence assessment.

TOPIC: {topic}

Provide your response as a JSON object with this exact structure:
{{
  "bluf": "Bottom Line Up Front: 2-3 sentence executive summary",
  "search_results": [
    {{
      "title": "Source title",
      "url": "Source URL",
      "snippet": "Key information from this source"
    }}
  ],
  "synthesized_content": "Detailed analysis covering: campaign overview, tactics/techniques/procedures, victimology, infrastructure, indicators of compromise, and defensive recommendations. Cite sources inline.",
  "iocs": [
    {{
      "type": "ip|domain|hash_md5|hash_sha1|hash_sha256|url|email|cve",
      "value": "The indicator value",
      "context": "Where/how this IOC was observed"
    }}
  ],
  "techniques": [
    {{
      "id": "T1566.001",
      "name": "Spearphishing Attachment",
      "tactic": "Initial Access",
      "description": "How this technique was used"
    }}
  ]
}}

Be thorough. Extract ALL indicators of compromise mentioned. Map ALL observed TTPs to MITRE ATT&CK. Cite your sources."""


def _build_deep_prompt(topic: str) -> str:
    """Build a comprehensive prompt for Perplexity Deep Research."""
    return f"""Conduct a deep, comprehensive cyber threat intelligence investigation on the following topic. This is for a professional intelligence report.

TOPIC: {topic}

Research extensively and provide your response as a JSON object:
{{
  "bluf": "Bottom Line Up Front: 2-3 sentence executive summary of the most critical findings",
  "search_results": [
    {{
      "title": "Source title",
      "url": "Source URL",
      "snippet": "Key intelligence from this source"
    }}
  ],
  "synthesized_content": "Comprehensive multi-section analysis covering:\\n\\n## Campaign Overview\\n...\\n\\n## Threat Actor Profile\\n...\\n\\n## Tactics, Techniques & Procedures\\n...\\n\\n## Victimology\\n...\\n\\n## Infrastructure Analysis\\n...\\n\\n## Indicators of Compromise\\n...\\n\\n## Defensive Recommendations\\n...\\n\\n## Intelligence Gaps\\n...",
  "iocs": [
    {{
      "type": "ip|domain|hash_md5|hash_sha1|hash_sha256|url|email|cve",
      "value": "The indicator value",
      "context": "Detailed context of this IOC"
    }}
  ],
  "techniques": [
    {{
      "id": "T1566.001",
      "name": "Spearphishing Attachment",
      "tactic": "Initial Access",
      "description": "Detailed description of how this technique was employed"
    }}
  ]
}}

Be exhaustive. This is a DEEP research report. Cover every angle. Extract every IOC. Map every TTP. Identify intelligence gaps."""


def _parse_ioc_type(type_str: str) -> IOCType:
    """Map a string IOC type to the IOCType enum."""
    mapping = {
        "ip": IOCType.IP,
        "ipv4": IOCType.IP,
        "ipv6": IOCType.IP,
        "domain": IOCType.DOMAIN,
        "hash_md5": IOCType.HASH_MD5,
        "md5": IOCType.HASH_MD5,
        "hash_sha1": IOCType.HASH_SHA1,
        "sha1": IOCType.HASH_SHA1,
        "hash_sha256": IOCType.HASH_SHA256,
        "sha256": IOCType.HASH_SHA256,
        "url": IOCType.URL,
        "email": IOCType.EMAIL,
        "cve": IOCType.CVE,
    }
    return mapping.get(type_str.lower(), IOCType.DOMAIN)


def _parse_response(raw: dict, tier: ResearchTier) -> ResearchBundle:
    """Parse Perplexity API response into a ResearchBundle."""
    # Extract the assistant message content
    choices = raw.get("choices", [])
    if not choices:
        raise ValueError("Empty response from Perplexity API")

    content = choices[0].get("message", {}).get("content", "")
    citations = raw.get("citations", [])

    # Try to parse as JSON
    data = None
    try:
        # Try direct JSON parse
        data = json.loads(content)
    except json.JSONDecodeError:
        # Try extracting JSON from markdown code block
        json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

    if not data:
        # Fall back to treating the whole response as synthesized content
        logger.warning("Could not parse JSON from Perplexity response, using raw content")
        search_results = [
            SearchResult(title=f"Source {i+1}", url=url, snippet="")
            for i, url in enumerate(citations)
        ] if citations else []

        return ResearchBundle(
            topic="",
            tier=tier,
            searchResults=search_results,
            synthesizedContent=content,
            extractedIOCs=[],
            suggestedTechniques=[],
        )

    # Parse structured response
    search_results = []
    for sr in data.get("search_results", []):
        search_results.append(SearchResult(
            title=sr.get("title", ""),
            url=sr.get("url", ""),
            snippet=sr.get("snippet", ""),
        ))

    # Add citation URLs that aren't already in search results
    existing_urls = {r.url for r in search_results}
    for url in citations:
        if url not in existing_urls:
            search_results.append(SearchResult(
                title="", url=url, snippet=""
            ))

    iocs = []
    for ioc_data in data.get("iocs", []):
        try:
            iocs.append(IOC(
                type=_parse_ioc_type(ioc_data.get("type", "domain")),
                value=ioc_data.get("value", ""),
                context=ioc_data.get("context", ""),
            ))
        except Exception as e:
            logger.warning("Skipping malformed IOC: %s", e)

    techniques = []
    for tech in data.get("techniques", []):
        try:
            techniques.append(AttackTechnique(
                id=tech.get("id", ""),
                name=tech.get("name", ""),
                tactic=tech.get("tactic", ""),
                description=tech.get("description", ""),
            ))
        except Exception as e:
            logger.warning("Skipping malformed technique: %s", e)

    return ResearchBundle(
        topic="",
        tier=tier,
        searchResults=search_results,
        synthesizedContent=data.get("synthesized_content", data.get("bluf", content)),
        extractedIOCs=iocs,
        suggestedTechniques=techniques,
    )


async def search_perplexity_sonar(
    topic: str,
    api_key: str,
) -> ResearchBundle:
    """
    STANDARD tier: Use Perplexity Sonar for citation-backed research.

    Args:
        topic: The threat intelligence topic to research.
        api_key: Perplexity API key.

    Returns:
        ResearchBundle with search results and synthesized content.
    """
    if not api_key:
        raise PerplexityNotAvailable("Perplexity API key required for Standard tier.")

    start = time.monotonic()

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "sonar",
        "messages": [
            {
                "role": "system",
                "content": "You are a cyber threat intelligence analyst. Always respond with valid JSON. Be thorough and cite sources."
            },
            {
                "role": "user",
                "content": _build_sonar_prompt(topic),
            },
        ],
        "temperature": 0.1,
        "return_citations": True,
        "return_related_questions": False,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                PERPLEXITY_API_URL,
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
        except httpx.TimeoutException:
            logger.error("Perplexity Sonar timed out for topic: %s", topic)
            raise ValueError("Perplexity request timed out. Please try again.")
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            if status == 401:
                raise ValueError("Invalid Perplexity API key.")
            elif status == 429:
                raise ValueError("Perplexity rate limit exceeded. Try again later.")
            else:
                logger.error("Perplexity HTTP error %d: %s", status, e.response.text)
                raise ValueError(f"Perplexity API error: {status}")

    raw = response.json()
    duration_ms = int((time.monotonic() - start) * 1000)
    logger.info("Perplexity Sonar completed in %dms for: %s", duration_ms, topic)

    bundle = _parse_response(raw, ResearchTier.STANDARD)
    bundle.topic = topic
    bundle.metadata = ResearchMetadata(
        search_duration_ms=duration_ms,
        synthesis_duration_ms=0,
        total_duration_ms=duration_ms,
        search_provider="perplexity-sonar",
        synthesis_model="sonar",
    )

    return bundle


async def deep_research_perplexity(
    topic: str,
    api_key: str,
) -> ResearchBundle:
    """
    DEEP tier: Use Perplexity Sonar Deep Research for comprehensive analysis.

    Args:
        topic: The threat intelligence topic to research.
        api_key: Perplexity API key.

    Returns:
        ResearchBundle with comprehensive research results.
    """
    if not api_key:
        raise PerplexityNotAvailable("Perplexity API key required for Deep tier.")

    start = time.monotonic()

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "sonar-deep-research",
        "messages": [
            {
                "role": "system",
                "content": "You are a senior cyber threat intelligence analyst conducting deep research. Provide exhaustive analysis with valid JSON output. Cite all sources."
            },
            {
                "role": "user",
                "content": _build_deep_prompt(topic),
            },
        ],
        "temperature": 0.1,
        "return_citations": True,
        "return_related_questions": False,
    }

    # Deep research can take longer
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(
                PERPLEXITY_API_URL,
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
        except httpx.TimeoutException:
            logger.error("Perplexity Deep Research timed out for topic: %s", topic)
            raise ValueError("Deep research timed out. This can take up to 2 minutes. Please try again.")
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            if status == 401:
                raise ValueError("Invalid Perplexity API key.")
            elif status == 429:
                raise ValueError("Perplexity rate limit exceeded. Try again later.")
            else:
                logger.error("Perplexity HTTP error %d: %s", status, e.response.text)
                raise ValueError(f"Perplexity API error: {status}")

    raw = response.json()
    duration_ms = int((time.monotonic() - start) * 1000)
    logger.info("Perplexity Deep Research completed in %dms for: %s", duration_ms, topic)

    bundle = _parse_response(raw, ResearchTier.DEEP)
    bundle.topic = topic
    bundle.metadata = ResearchMetadata(
        search_duration_ms=duration_ms,
        synthesis_duration_ms=0,
        total_duration_ms=duration_ms,
        search_provider="perplexity-deep-research",
        synthesis_model="sonar-deep-research",
    )

    return bundle
