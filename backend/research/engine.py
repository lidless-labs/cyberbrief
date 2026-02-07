"""Research engine orchestrator — coordinates search and synthesis by tier."""

from __future__ import annotations

import time
import logging
from typing import Optional

from models import ResearchBundle, ResearchTier, ResearchMetadata, ApiKeys
from research.brave import search_brave
from research.gemini import synthesize_gemini
from research.perplexity import search_perplexity_sonar, deep_research_perplexity, PerplexityNotAvailable

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

    if tier == ResearchTier.FREE:
        return await _run_free_tier(topic, api_keys, total_start)
    elif tier in (ResearchTier.STANDARD, ResearchTier.DEEP):
        key = api_keys.perplexity if api_keys else None
        if not key:
            raise ValueError(
                "Perplexity API key required for Standard/Deep tier. "
                "Add your key in Settings or use the Free tier."
            )
        if tier == ResearchTier.STANDARD:
            return await search_perplexity_sonar(topic, key)
        else:
            return await deep_research_perplexity(topic, key)
    else:
        raise ValueError(f"Unknown research tier: {tier}")


async def _run_free_tier(
    topic: str,
    api_keys: Optional[ApiKeys],
    total_start: float,
) -> ResearchBundle:
    """FREE tier: Brave Search → Gemini Flash synthesis."""

    # Step 1: Search
    brave_key = (api_keys.brave if api_keys else None)
    search_start = time.monotonic()

    logger.info("Starting Brave Search for topic: %s", topic)
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

    # Step 2: Synthesize
    gemini_key = (api_keys.gemini if api_keys else None)
    synth_start = time.monotonic()

    logger.info("Starting Gemini synthesis for topic: %s", topic)
    bundle = await synthesize_gemini(
        topic=topic,
        search_results=search_results,
        api_key=gemini_key,
    )
    synth_duration_ms = int((time.monotonic() - synth_start) * 1000)
    total_duration_ms = int((time.monotonic() - total_start) * 1000)

    logger.info(
        "Gemini synthesis completed in %dms (total: %dms)",
        synth_duration_ms,
        total_duration_ms,
    )

    # Update metadata with timing
    bundle.metadata = ResearchMetadata(
        search_duration_ms=search_duration_ms,
        synthesis_duration_ms=synth_duration_ms,
        total_duration_ms=total_duration_ms,
        search_provider="brave",
        synthesis_model="gemini-2.0-flash",
    )

    return bundle
