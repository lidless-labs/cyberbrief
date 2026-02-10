"""Source upload handler — extract content from URLs, PDFs, and raw text."""

from __future__ import annotations

import logging
import re
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Limits
MAX_URL_COUNT = 20
MAX_TEXT_LENGTH = 500_000  # 500KB of text
MAX_PDF_BYTES = 10 * 1024 * 1024  # 10MB per PDF
FETCH_TIMEOUT = 15.0


async def extract_from_url(url: str) -> Optional[dict]:
    """Fetch a URL and extract readable text content.
    
    Returns dict with title, url, snippet (extracted text), or None on failure.
    """
    try:
        async with httpx.AsyncClient(
            timeout=FETCH_TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": "CyberBRIEF/1.0 (Threat Intelligence Research)"},
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            
            content_type = resp.headers.get("content-type", "")
            
            # PDF handling
            if "pdf" in content_type.lower() or url.lower().endswith(".pdf"):
                return await _extract_pdf_bytes(resp.content, url)
            
            # HTML/text handling
            text = resp.text
            
            # Strip HTML tags (basic extraction)
            title = _extract_title(text) or url
            clean = _strip_html(text)
            
            # Truncate to reasonable size
            snippet = clean[:10000]
            
            return {
                "title": title,
                "url": url,
                "snippet": snippet,
            }
    except Exception as e:
        logger.warning("Failed to fetch URL %s: %s", url, e)
        return None


async def _extract_pdf_bytes(content: bytes, url: str) -> Optional[dict]:
    """Extract text from PDF bytes using pymupdf if available, else basic fallback."""
    if len(content) > MAX_PDF_BYTES:
        logger.warning("PDF too large (%d bytes), skipping: %s", len(content), url)
        return None
    
    try:
        import fitz  # pymupdf
        doc = fitz.open(stream=content, filetype="pdf")
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
        
        full_text = "\n".join(text_parts)
        title = url.split("/")[-1].replace(".pdf", "").replace("-", " ").replace("_", " ")
        
        return {
            "title": title,
            "url": url,
            "snippet": full_text[:10000],
        }
    except ImportError:
        logger.warning("pymupdf not installed, cannot extract PDF text from: %s", url)
        return {
            "title": url.split("/")[-1],
            "url": url,
            "snippet": "[PDF content — install pymupdf for text extraction]",
        }
    except Exception as e:
        logger.warning("PDF extraction failed for %s: %s", url, e)
        return None


def extract_from_text(text: str, label: str = "User-provided text") -> dict:
    """Wrap raw text as a source entry."""
    return {
        "title": label,
        "url": "user-input",
        "snippet": text[:10000],
    }


def _extract_title(html: str) -> Optional[str]:
    """Extract <title> from HTML."""
    match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    if match:
        title = match.group(1).strip()
        # Clean up HTML entities
        title = re.sub(r"&amp;", "&", title)
        title = re.sub(r"&lt;", "<", title)
        title = re.sub(r"&gt;", ">", title)
        title = re.sub(r"&#\d+;", "", title)
        return title[:200]
    return None


def _strip_html(html: str) -> str:
    """Strip HTML tags and collapse whitespace for readable text extraction."""
    # Remove script and style blocks
    text = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.IGNORECASE | re.DOTALL)
    # Remove nav, header, footer blocks (common noise)
    text = re.sub(r"<(nav|header|footer)[^>]*>.*?</\1>", " ", text, flags=re.IGNORECASE | re.DOTALL)
    # Strip remaining tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Decode common entities
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&quot;", '"', text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text
