"""Deterministic SSRF defenses for research.sources.extract_from_url."""

from __future__ import annotations

import asyncio
import ipaddress
from typing import Any, Optional
from unittest.mock import patch

import pytest

from research.sources import (
    UnsafeURLError,
    _is_blocked_ip,
    _validate_url_for_fetch,
    _validate_url_structure,
    extract_from_url,
)


def _run(coro):
    return asyncio.run(coro)


class _FakeResponse:
    def __init__(
        self,
        status_code: int = 200,
        text: str = "<html><title>Public</title><body>ok body</body></html>",
        headers: Optional[dict[str, str]] = None,
        content: Optional[bytes] = None,
    ):
        self.status_code = status_code
        self.text = text
        self.headers = headers or {"content-type": "text/html"}
        self.content = content if content is not None else text.encode()

    @property
    def is_redirect(self) -> bool:
        return 300 <= self.status_code < 400

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class _FakeAsyncClient:
    """Minimal async context manager standing in for httpx.AsyncClient."""

    def __init__(self, responses: list[_FakeResponse], calls: list[dict[str, Any]]):
        self._responses = list(responses)
        self._calls = calls

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url: str, headers=None, extensions=None):
        self._calls.append(
            {"url": url, "headers": headers or {}, "extensions": extensions or {}}
        )
        if not self._responses:
            raise AssertionError("Unexpected HTTP call with no queued response")
        return self._responses.pop(0)


def test_rejects_direct_private_ipv4():
    result = _run(extract_from_url("http://10.0.0.5/secret"))
    assert result is None

    with pytest.raises(UnsafeURLError, match="non-public"):
        _run(_validate_url_for_fetch("http://192.168.1.10/"))


def test_rejects_dns_resolving_to_private(monkeypatch):
    async def fake_resolve(hostname: str):
        assert hostname == "evil.example"
        return [ipaddress.ip_address("10.0.0.1")]

    monkeypatch.setattr("research.sources._resolve_host", fake_resolve)
    result = _run(extract_from_url("https://evil.example/path"))
    assert result is None


def test_rejects_ipv6_private_and_loopback():
    assert _is_blocked_ip(ipaddress.ip_address("::1"))
    assert _is_blocked_ip(ipaddress.ip_address("fc00::1"))
    assert _is_blocked_ip(ipaddress.ip_address("fe80::1"))

    assert _run(extract_from_url("http://[::1]/")) is None
    assert _run(extract_from_url("http://[fc00::abcd]/")) is None


def test_rejects_unsafe_ipv4_mapped_ipv6():
    assert _is_blocked_ip(ipaddress.ip_address("::ffff:127.0.0.1"))
    assert _is_blocked_ip(ipaddress.ip_address("::ffff:10.0.0.1"))
    assert not _is_blocked_ip(ipaddress.ip_address("::ffff:8.8.8.8"))

    assert _run(extract_from_url("http://[::ffff:127.0.0.1]/")) is None
    assert _run(extract_from_url("http://[::ffff:169.254.169.254]/")) is None


def test_rejects_public_url_redirecting_to_private(monkeypatch):
    async def fake_resolve(hostname: str):
        if hostname == "public.example":
            return [ipaddress.ip_address("1.1.1.1")]
        raise AssertionError(f"unexpected resolve for {hostname}")

    monkeypatch.setattr("research.sources._resolve_host", fake_resolve)

    calls: list[dict[str, Any]] = []
    responses = [
        _FakeResponse(
            status_code=302,
            headers={"location": "http://127.0.0.1/admin", "content-type": "text/html"},
            text="",
        )
    ]

    def client_factory(*_args, **_kwargs):
        return _FakeAsyncClient(responses, calls)

    with patch("research.sources.httpx.AsyncClient", side_effect=client_factory):
        result = _run(extract_from_url("http://public.example/start"))

    assert result is None
    assert len(calls) == 1
    assert calls[0]["url"].startswith("http://1.1.1.1/")


def test_rejects_invalid_schemes_and_credentials():
    assert _run(extract_from_url("file:///etc/passwd")) is None
    assert _run(extract_from_url("ftp://example.com/x")) is None
    assert _run(extract_from_url("gopher://example.com/1")) is None
    assert _run(extract_from_url("http://user:pass@example.com/")) is None

    with pytest.raises(UnsafeURLError, match="scheme"):
        _validate_url_structure("file:///etc/passwd")
    with pytest.raises(UnsafeURLError, match="credentials"):
        _validate_url_structure("https://user:secret@example.com/a")
    with pytest.raises(UnsafeURLError, match="hostname"):
        _validate_url_structure("http:///nohost")
    with pytest.raises(UnsafeURLError, match="metadata"):
        _validate_url_structure("http://metadata.google.internal/computeMetadata/v1/")


def test_allows_valid_public_path(monkeypatch):
    async def fake_resolve(hostname: str):
        assert hostname == "docs.example"
        return [ipaddress.ip_address("8.8.8.8")]

    monkeypatch.setattr("research.sources._resolve_host", fake_resolve)

    calls: list[dict[str, Any]] = []
    responses = [
        _FakeResponse(
            status_code=200,
            text="<html><title>Threat Notes</title><body>public intel</body></html>",
        )
    ]

    def client_factory(*_args, **kwargs):
        assert kwargs.get("follow_redirects") is False
        assert kwargs.get("timeout") == 15.0
        return _FakeAsyncClient(responses, calls)

    with patch("research.sources.httpx.AsyncClient", side_effect=client_factory):
        result = _run(extract_from_url("https://docs.example/report"))

    assert result is not None
    assert result["title"] == "Threat Notes"
    assert result["url"] == "https://docs.example/report"
    assert "public intel" in result["snippet"]
    assert calls[0]["url"] == "https://8.8.8.8/report"
    assert calls[0]["headers"]["Host"] == "docs.example"
    assert calls[0]["extensions"]["sni_hostname"] == "docs.example"


def test_relative_redirect_revalidated(monkeypatch):
    """Public hop redirects relatively to another public path; both hops pinned."""

    async def fake_resolve(hostname: str):
        assert hostname == "docs.example"
        return [ipaddress.ip_address("8.8.8.8")]

    monkeypatch.setattr("research.sources._resolve_host", fake_resolve)

    calls: list[dict[str, Any]] = []
    responses = [
        _FakeResponse(
            status_code=301,
            headers={"location": "/final", "content-type": "text/html"},
            text="",
        ),
        _FakeResponse(
            status_code=200,
            text="<html><title>Final</title><body>arrived</body></html>",
        ),
    ]

    def client_factory(*_args, **_kwargs):
        return _FakeAsyncClient(responses, calls)

    with patch("research.sources.httpx.AsyncClient", side_effect=client_factory):
        result = _run(extract_from_url("https://docs.example/start"))

    assert result is not None
    assert result["title"] == "Final"
    assert [c["url"] for c in calls] == [
        "https://8.8.8.8/start",
        "https://8.8.8.8/final",
    ]
