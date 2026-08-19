"""Source upload handler — extract content from URLs, PDFs, and raw text."""

from __future__ import annotations

import asyncio
import ipaddress
import logging
import re
import socket
from typing import Optional, Union
from urllib.parse import urljoin, urlparse, urlunparse

import httpx

logger = logging.getLogger(__name__)

# Limits
MAX_URL_COUNT = 20
MAX_TEXT_LENGTH = 500_000  # 500KB of text
MAX_PDF_BYTES = 10 * 1024 * 1024  # 10MB per PDF
FETCH_TIMEOUT = 15.0
MAX_REDIRECTS = 5
ALLOWED_SCHEMES = frozenset({"http", "https"})
# Cloud metadata hostnames (IP form 169.254.169.254 is caught as link-local).
BLOCKED_METADATA_HOSTS = frozenset(
    {
        "metadata",
        "metadata.google.internal",
        "metadata.goog",
    }
)

IPAddress = Union[ipaddress.IPv4Address, ipaddress.IPv6Address]


class UnsafeURLError(ValueError):
    """Raised when a URL or redirect target fails SSRF checks."""


def _normalize_host(hostname: str) -> str:
    host = hostname.strip().rstrip(".").lower()
    if host.startswith("[") and host.endswith("]"):
        host = host[1:-1]
    return host


def _is_blocked_ip(ip: IPAddress) -> bool:
    """Return True if the address must not be contacted.

    IPv4-mapped IPv6 is unwrapped so ::ffff:10.0.0.1 is treated as 10.0.0.1.
    ``not is_global`` also rejects shared/CGNAT space (100.64.0.0/10).
    """
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        return _is_blocked_ip(ip.ipv4_mapped)

    return bool(
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
        or not ip.is_global
    )


def _validate_url_structure(url: str) -> tuple[str, str, Optional[int]]:
    """Parse and structurally validate a fetch URL.

    Returns (clean_url, hostname, port).
    """
    parsed = urlparse(url)
    scheme = (parsed.scheme or "").lower()
    if scheme not in ALLOWED_SCHEMES:
        raise UnsafeURLError(f"URL scheme not allowed: {parsed.scheme!r}")
    if parsed.username is not None or parsed.password is not None:
        raise UnsafeURLError("URLs with embedded credentials are not allowed")

    hostname = parsed.hostname
    if not hostname:
        raise UnsafeURLError("URL hostname is missing or invalid")
    host = _normalize_host(hostname)
    if not host:
        raise UnsafeURLError("URL hostname is missing or invalid")
    if host in BLOCKED_METADATA_HOSTS:
        raise UnsafeURLError("Cloud metadata destinations are not allowed")

    # Drop credentials/fragments; keep host/port/path/query for the fetch.
    netloc = host if parsed.port is None else f"{host}:{parsed.port}"
    if ":" in host and parsed.port is not None:
        netloc = f"[{host}]:{parsed.port}"
    elif ":" in host:
        netloc = f"[{host}]"

    clean = urlunparse((scheme, netloc, parsed.path or "", parsed.params, parsed.query, ""))
    return clean, host, parsed.port


def _resolve_host_sync(hostname: str) -> list[IPAddress]:
    try:
        infos = socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise UnsafeURLError(f"DNS resolution failed for {hostname!r}") from exc

    ips: list[IPAddress] = []
    seen: set[str] = set()
    for info in infos:
        ip_str = info[4][0]
        if ip_str in seen:
            continue
        seen.add(ip_str)
        try:
            ips.append(ipaddress.ip_address(ip_str))
        except ValueError as exc:
            raise UnsafeURLError(
                f"Invalid resolved address for {hostname!r}: {ip_str}"
            ) from exc
    if not ips:
        raise UnsafeURLError(f"No addresses resolved for {hostname!r}")
    return ips


async def _resolve_host(hostname: str) -> list[IPAddress]:
    return await asyncio.to_thread(_resolve_host_sync, hostname)


async def _validate_url_for_fetch(url: str) -> tuple[str, str, list[IPAddress]]:
    """Validate URL structure and DNS/IP safety."""
    clean_url, hostname, _port = _validate_url_structure(url)

    try:
        literal = ipaddress.ip_address(hostname)
    except ValueError:
        ips = await _resolve_host(hostname)
    else:
        ips = [literal]

    blocked = [str(ip) for ip in ips if _is_blocked_ip(ip)]
    if blocked:
        raise UnsafeURLError(
            f"URL resolves to non-public address(es): {', '.join(blocked)}"
        )
    return clean_url, hostname, ips


def _host_header(hostname: str, port: Optional[int], scheme: str) -> str:
    host = hostname
    try:
        ip = ipaddress.ip_address(hostname)
        if ip.version == 6:
            host = f"[{hostname}]"
    except ValueError:
        pass

    if port is None:
        return host
    default = 443 if scheme == "https" else 80
    if port == default:
        return host
    return f"{host}:{port}"


def _pin_url_to_ip(url: str, ip: IPAddress) -> str:
    """Rewrite URL netloc to a pre-validated IP (IPv6 bracketed)."""
    parsed = urlparse(url)
    host = f"[{ip}]" if ip.version == 6 else str(ip)
    netloc = f"{host}:{parsed.port}" if parsed.port is not None else host
    return urlunparse(
        (parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, "")
    )


async def extract_from_url(url: str) -> Optional[dict]:
    """Fetch a URL and extract readable text content.

    Returns dict with title, url, snippet (extracted text), or None on failure.

    Each request and redirect target is validated and connected through a
    pinned public IP. This prevents DNS rebinding from changing that hop's TCP
    peer, but it cannot control application-level routing or returned content.
    """
    try:
        current_url = url
        async with httpx.AsyncClient(
            timeout=FETCH_TIMEOUT,
            follow_redirects=False,
            headers={"User-Agent": "CyberBRIEF/1.0 (Threat Intelligence Research)"},
        ) as client:
            resp: Optional[httpx.Response] = None
            for hop in range(MAX_REDIRECTS + 1):
                clean_url, hostname, ips = await _validate_url_for_fetch(current_url)
                parsed = urlparse(clean_url)
                pinned = _pin_url_to_ip(clean_url, ips[0])
                headers = {"Host": _host_header(hostname, parsed.port, parsed.scheme)}
                extensions = (
                    {"sni_hostname": hostname} if parsed.scheme == "https" else {}
                )

                resp = await client.get(pinned, headers=headers, extensions=extensions)
                if resp.is_redirect:
                    if hop >= MAX_REDIRECTS:
                        raise UnsafeURLError("Too many redirects")
                    location = resp.headers.get("location")
                    if not location:
                        raise UnsafeURLError("Redirect missing Location header")
                    current_url = urljoin(clean_url, location)
                    continue
                break
            else:
                raise UnsafeURLError("Too many redirects")

            assert resp is not None
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
    except UnsafeURLError as e:
        logger.warning("Blocked unsafe URL %s: %s", url, e)
        return None
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
