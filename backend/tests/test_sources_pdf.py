"""PDF source extraction with pypdf: real text, corrupt bytes, and text-free PDFs."""

from __future__ import annotations

import asyncio
import base64
import io
from unittest.mock import AsyncMock, patch

import pytest
from pypdf import PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
)

from models import SourceInput
from research import engine
from research.sources import MAX_PDF_PAGES, _extract_pdf_bytes

KNOWN_TEXT = "APT29 phishing campaign indicators"


def _run(coro):
    return asyncio.run(coro)


def _pdf_with_pages(page_texts: list[str]) -> bytes:
    """Build a PDF in memory with one Helvetica text line per page."""
    writer = PdfWriter()
    for text in page_texts:
        page = writer.add_blank_page(width=612, height=792)
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
        page[NameObject("/Resources")] = DictionaryObject(
            {
                NameObject("/Font"): DictionaryObject(
                    {NameObject("/F1"): writer._add_object(font)}
                )
            }
        )
        stream = DecodedStreamObject()
        stream.set_data(f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode("latin-1"))
        page[NameObject("/Contents")] = ArrayObject([writer._add_object(stream)])
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _blank_pdf() -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def test_pdf_with_known_text_yields_that_text():
    result = _run(_extract_pdf_bytes(_pdf_with_pages([KNOWN_TEXT]), "https://x.example/apt29-report.pdf"))
    assert result is not None
    assert KNOWN_TEXT in result["snippet"]
    assert result["url"] == "https://x.example/apt29-report.pdf"
    assert result["title"] == "apt29 report"


def test_corrupt_pdf_returns_none():
    assert _run(_extract_pdf_bytes(b"%PDF-1.7\nthis is not really a pdf", "corrupt.pdf")) is None
    assert _run(_extract_pdf_bytes(b"", "empty.pdf")) is None


def test_text_free_pdf_returns_none():
    assert _run(_extract_pdf_bytes(_blank_pdf(), "scan.pdf")) is None


def test_encrypted_pdf_returns_none():
    writer = PdfWriter(clone_from=io.BytesIO(_pdf_with_pages([KNOWN_TEXT])))
    writer.encrypt(user_password="secret", algorithm="RC4-128")
    buf = io.BytesIO()
    writer.write(buf)
    assert _run(_extract_pdf_bytes(buf.getvalue(), "locked.pdf")) is None


def test_oversized_pdf_returns_none():
    with patch("research.sources.MAX_PDF_BYTES", 10):
        assert _run(_extract_pdf_bytes(_pdf_with_pages([KNOWN_TEXT]), "big.pdf")) is None


def test_page_cap_limits_pages_read():
    pages = [f"page{i}" for i in range(MAX_PDF_PAGES + 5)]
    result = _run(_extract_pdf_bytes(_pdf_with_pages(pages), "long.pdf"))
    assert result is not None
    assert "page0" in result["snippet"]
    assert f"page{MAX_PDF_PAGES - 1}" in result["snippet"]
    assert f"page{MAX_PDF_PAGES}" not in result["snippet"]


def _fake_bundle():
    from models import ResearchBundle, ResearchTier

    return ResearchBundle(topic="t", tier=ResearchTier.FREE)


def test_engine_reports_unreadable_pdf_as_skipped(monkeypatch):
    monkeypatch.delenv("PERPLEXITY_API_KEY", raising=False)
    sources = [
        SourceInput(type="pdf", value=base64.b64encode(_pdf_with_pages([KNOWN_TEXT])).decode(), label="good.pdf"),
        SourceInput(type="pdf", value=base64.b64encode(_blank_pdf()).decode(), label="scan.pdf"),
        SourceInput(type="url", value="https://unreachable.example/a"),
    ]
    synth = AsyncMock(return_value=_fake_bundle())
    with patch.object(engine, "synthesize_gemini", synth), patch.object(
        engine, "extract_from_url", AsyncMock(return_value=None)
    ):
        bundle = _run(engine.run_research_from_sources("t", sources))

    sent = synth.call_args.kwargs["search_results"]
    assert [r.url for r in sent] == ["good.pdf"]
    assert KNOWN_TEXT in sent[0].snippet

    skipped = bundle.model_dump(by_alias=True)["metadata"]["skippedSources"]
    assert [s["url"] for s in skipped] == ["scan.pdf", "https://unreachable.example/a"]
    assert all(s["reason"] for s in skipped)


def test_engine_error_names_skipped_sources_when_nothing_readable():
    sources = [SourceInput(type="pdf", value=base64.b64encode(b"garbage").decode(), label="bad.pdf")]
    with pytest.raises(ValueError, match="bad.pdf"):
        _run(engine.run_research_from_sources("t", sources))
