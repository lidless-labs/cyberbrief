"""Research engine orchestrator — coordinates search and synthesis by tier."""

from __future__ import annotations

import base64
import os
import time
import logging
from typing import Optional

from models import ResearchBundle, ResearchTier, ResearchMetadata, ApiKeys, SearchResult, SourceInput
from research.brave import search_brave
from research.gemini import synthesize_gemini
from research.perplexity import search_perplexity_sonar, deep_research_perplexity, PerplexityNotAvailable
from research.sources import extract_from_url, extract_from_text, _extract_pdf_bytes

logger = logging.getLogger(__name__)


async def run_research(
    topic: str,
    tier: str | ResearchTier,
    api_keys: Optional[ApiKeys] = None,
) -> ResearchBundle:
    """
    Run the research pipeline for the given topic and tier.

    Args:
        topic: The threat intelligence topic to research.
        tier: Research tier (FREE, STANDARD, DEEP).
        api_keys: Optional API keys passed from frontend settings.

    Returns:
        ResearchBundle with all collected intelligence.

    Raises:
        ValueError: On missing keys or invalid tier.
        PerplexityNotAvailable: If Perplexity API is unreachable or misconfigured.
    """
    if isinstance(tier, str):
        tier = ResearchTier(tier)

    total_start = time.monotonic()

    # Resolve Perplexity key: frontend-provided > env var
    pplx_key = (api_keys.perplexity if api_keys else None) or os.environ.get("PERPLEXITY_API_KEY")

    if tier == ResearchTier.FREE:
        return await _run_free_tier(topic, api_keys, pplx_key, total_start)
    elif tier in (ResearchTier.STANDARD, ResearchTier.DEEP):
        if not pplx_key:
            raise ValueError(
                "Perplexity API key required for Standard/Deep tier. "
                "Add your key in Settings."
            )
        if tier == ResearchTier.STANDARD:
            return await search_perplexity_sonar(topic, pplx_key)
        else:
            return await deep_research_perplexity(topic, pplx_key)
    else:
        raise ValueError(f"Unknown research tier: {tier}")


async def _run_free_tier(
    topic: str,
    api_keys: Optional[ApiKeys],
    pplx_key: Optional[str],
    total_start: float,
) -> ResearchBundle:
    """FREE tier: Perplexity Sonar (preferred) or Brave Search → Gemini Flash fallback."""

    # Prefer Perplexity Sonar for free tier (server-side key from env)
    if pplx_key:
        logger.info("Free tier using Perplexity Sonar for: %s", topic)
        bundle = await search_perplexity_sonar(topic, pplx_key)
        total_duration_ms = int((time.monotonic() - total_start) * 1000)
        bundle.metadata.total_duration_ms = total_duration_ms
        bundle.metadata.search_provider = "perplexity-sonar (free tier)"
        return bundle

    # Fallback: Brave Search → Gemini Flash synthesis
    brave_key = (api_keys.brave if api_keys else None) or os.environ.get("BRAVE_API_KEY")
    search_start = time.monotonic()

    logger.info("Free tier fallback: Brave Search for topic: %s", topic)
    search_results = await search_brave(
        query=topic,
        count=10,
        api_key=brave_key,
    )
    search_duration_ms = int((time.monotonic() - search_start) * 1000)
    logger.info("Brave Search completed in %dms, got %d results", search_duration_ms, len(search_results))

    if not search_results:
        raise ValueError(
            f"No search results found for '{topic}'. Try a different query."
        )

    gemini_key = (api_keys.gemini if api_keys else None) or os.environ.get("GEMINI_API_KEY")
    synth_start = time.monotonic()

    logger.info("Starting Gemini synthesis for topic: %s", topic)
    bundle = await synthesize_gemini(
        topic=topic,
        search_results=search_results,
        api_key=gemini_key,
    )
    synth_duration_ms = int((time.monotonic() - synth_start) * 1000)
    total_duration_ms = int((time.monotonic() - total_start) * 1000)

    bundle.metadata = ResearchMetadata(
        search_duration_ms=search_duration_ms,
        synthesis_duration_ms=synth_duration_ms,
        total_duration_ms=total_duration_ms,
        search_provider="brave",
        synthesis_model="gemini-2.0-flash",
    )

    return bundle


async def run_research_from_sources(
    topic: str,
    sources: list[SourceInput],
    api_keys: Optional[ApiKeys] = None,
) -> ResearchBundle:
    """
    Run the research pipeline from user-provided sources instead of search.

    Accepts URLs (fetched server-side), raw text, and base64-encoded PDFs.
    Feeds extracted content into Gemini synthesis.
    """
    import asyncio

    total_start = time.monotonic()
    extract_start = time.monotonic()

    extracted: list[dict] = []

    # Process all sources
    for source in sources:
        if source.type == "url":
            result = await extract_from_url(source.value)
            if result:
                extracted.append(result)
        elif source.type == "text":
            label = source.label or "User-provided text"
            extracted.append(extract_from_text(source.value, label))
        elif source.type == "pdf":
            try:
                pdf_bytes = base64.b64decode(source.value)
                result = await _extract_pdf_bytes(pdf_bytes, source.label or "Uploaded PDF")
                if result:
                    extracted.append(result)
            except Exception as e:
                logger.warning("Failed to decode/extract PDF: %s", e)
        else:
            logger.warning("Unknown source type: %s", source.type)

    if not extracted:
        raise ValueError("No content could be extracted from the provided sources.")

    extract_duration_ms = int((time.monotonic() - extract_start) * 1000)
    logger.info(
        "Extracted content from %d/%d sources in %dms",
        len(extracted), len(sources), extract_duration_ms,
    )

    # Convert to SearchResult format for the existing synthesis pipeline
    search_results = [
        SearchResult(
            title=item["title"],
            url=item["url"],
            snippet=item["snippet"],
        )
        for item in extracted
    ]

    # Synthesize: prefer Perplexity, fall back to Gemini
    pplx_key = (api_keys.perplexity if api_keys else None) or os.environ.get("PERPLEXITY_API_KEY")
    synth_start = time.monotonic()

    if pplx_key:
        # Build combined content from sources for Perplexity synthesis
        combined_text = f"Topic: {topic}\n\nSources:\n"
        for sr in search_results:
            combined_text += f"\n--- {sr.title} ({sr.url}) ---\n{sr.snippet}\n"

        logger.info("Synthesizing %d sources via Perplexity Sonar", len(search_results))
        bundle = await search_perplexity_sonar(
            topic=f"{topic}\n\nAnalyze the following source material:\n{combined_text}",
            api_key=pplx_key,
        )
        synthesis_model = "perplexity-sonar"
    else:
        logger.info("Synthesizing %d sources via Gemini Flash (fallback)", len(search_results))
        bundle = await synthesize_gemini(
            topic=topic,
            search_results=search_results,
            api_key=(api_keys.gemini if api_keys else None) or os.environ.get("GEMINI_API_KEY"),
        )
        synthesis_model = "gemini-2.0-flash"

    synth_duration_ms = int((time.monotonic() - synth_start) * 1000)
    total_duration_ms = int((time.monotonic() - total_start) * 1000)

    bundle.metadata = ResearchMetadata(
        search_duration_ms=extract_duration_ms,
        synthesis_duration_ms=synth_duration_ms,
        total_duration_ms=total_duration_ms,
        search_provider="user-sources",
        synthesis_model=synthesis_model,
    )

    return bundle
