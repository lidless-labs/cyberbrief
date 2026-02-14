"""CyberBRIEF FastAPI application -- threat intelligence research & reporting API."""

from __future__ import annotations

import logging
import os
import time
from collections import defaultdict
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from models import (
    AttackTechnique,
    HealthResponse,
    NavigatorRequest,
    Report,
    ReportGenerateRequest,
    ResearchRequest,
    SourceResearchRequest,
    TLPLevel,
)
from research.engine import run_research, run_research_from_sources
from research.perplexity import PerplexityNotAvailable
from report.generator import generate_report
from export.markdown import export_markdown
from export.html import export_html
from attack.mapper import lookup_technique as attack_lookup_technique, map_techniques_from_text
from attack.navigator import generate_navigator_layer

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="CyberBRIEF API",
    description="Automated cyber threat intelligence research and reporting.",
    version="0.1.0",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────

# In production (single container), frontend is served from the same origin.
# In development, Vite dev server proxies /api requests here.
_cors_origins = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Rate Limiting ────────────────────────────────────────────────────────────

RATE_LIMIT_PER_HOUR = int(os.environ.get("RATE_LIMIT_PER_HOUR", "10"))
RATE_LIMIT_PER_DAY = int(os.environ.get("RATE_LIMIT_PER_DAY", "50"))
_rate_hits: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(client_ip: str) -> None:
    """Raise 429 if client exceeds hourly or daily research limits."""
    now = time.time()
    hits = _rate_hits[client_ip]
    # Prune entries older than 24h
    _rate_hits[client_ip] = hits = [t for t in hits if now - t < 86400]
    hour_hits = sum(1 for t in hits if now - t < 3600)
    if hour_hits >= RATE_LIMIT_PER_HOUR:
        raise HTTPException(429, "Rate limit exceeded. Try again in an hour.")
    if len(hits) >= RATE_LIMIT_PER_DAY:
        raise HTTPException(429, "Daily limit reached. Try again tomorrow.")
    hits.append(now)


# ─── Health ───────────────────────────────────────────────────────────────────


@app.get("/api/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(status="ok", version="0.1.0")


# ─── Research ─────────────────────────────────────────────────────────────────


@app.post("/api/research")
async def research_endpoint(request: ResearchRequest, req: Request) -> dict:
    """
    Run the research pipeline for a given topic and tier.

    Returns a ResearchBundle with search results, synthesized content,
    extracted IOCs, and suggested ATT&CK techniques.
    """
    _check_rate_limit(req.client.host if req.client else "unknown")
    try:
        bundle = await run_research(
            topic=request.topic,
            tier=request.tier,
            api_keys=request.api_keys,
        )
        return bundle.model_dump(by_alias=True)
    except ValueError as exc:
        # ValueError carries user-facing messages (missing keys, no results)
        raise HTTPException(status_code=400, detail=str(exc))
    except PerplexityNotAvailable as exc:
        raise HTTPException(status_code=501, detail=str(exc))
    except Exception as exc:
        logger.exception("Research pipeline failed for topic: %s", request.topic)
        raise HTTPException(
            status_code=500,
            detail="Research pipeline encountered an internal error. Check server logs.",
        ) from exc


# ─── Research from Sources ────────────────────────────────────────────────────


@app.post("/api/research/from-sources")
async def research_from_sources_endpoint(request: SourceResearchRequest, req: Request) -> dict:
    """
    Run the research pipeline from user-provided sources (URLs, text, PDFs).

    Skips the search step and goes straight to synthesis from the provided content.
    Accepts URLs (fetched server-side), raw text, and base64-encoded PDFs.
    """
    _check_rate_limit(req.client.host if req.client else "unknown")
    if not request.sources:
        raise HTTPException(status_code=400, detail="At least one source is required.")
    if len(request.sources) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 sources per request.")

    try:
        bundle = await run_research_from_sources(
            topic=request.topic,
            sources=request.sources,
            api_keys=request.api_keys,
        )
        return bundle.model_dump(by_alias=True)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Source research pipeline failed for topic: %s", request.topic)
        raise HTTPException(
            status_code=500,
            detail="Source research pipeline encountered an internal error.",
        ) from exc


# ─── Report Generation ───────────────────────────────────────────────────────


@app.post("/api/report/generate")
async def report_generate_endpoint(request: ReportGenerateRequest) -> dict:
    """
    Generate a structured intelligence report from a research bundle.

    Returns a full Report with BLUF, sections, IOCs, ATT&CK mapping,
    confidence assessments, and Chicago NB citations.
    """
    try:
        # Extract report type and TLP from settings if provided
        report_type = "full"
        tlp = TLPLevel.GREEN
        if request.settings:
            report_type = request.settings.get("reportType", "full")
            tlp_raw = request.settings.get("defaultTlp")
            if tlp_raw:
                try:
                    tlp = TLPLevel(tlp_raw)
                except ValueError:
                    pass

        report = await generate_report(
            bundle=request.bundle,
            report_type=report_type,
            tlp=tlp,
        )
        return report.model_dump(by_alias=True)
    except Exception as exc:
        logger.exception("Report generation failed")
        raise HTTPException(
            status_code=500,
            detail="Report generation failed. Check server logs for details.",
        ) from exc


# ─── ATT&CK ──────────────────────────────────────────────────────────────────


@app.get("/api/attack/lookup")
async def attack_lookup(q: str = Query(..., description="Technique name or ID to search")) -> list[dict]:
    """
    Look up MITRE ATT&CK techniques by name or ID.

    Queries the local enterprise ATT&CK dataset by T-code or keyword.
    """
    logger.info("ATT&CK lookup query: %s", q)
    try:
        results = attack_lookup_technique(q)
        return [t.model_dump(by_alias=True) for t in results]
    except Exception as exc:
        logger.exception("ATT&CK lookup failed for query: %s", q)
        raise HTTPException(
            status_code=500,
            detail="ATT&CK lookup failed. Check server logs for details.",
        ) from exc


@app.post("/api/attack/navigator")
async def attack_navigator(request: NavigatorRequest) -> dict:
    """
    Generate an ATT&CK Navigator layer JSON from a list of techniques.

    Returns a fully compliant Navigator layer importable at
    https://mitre-attack.github.io/attack-navigator/
    """
    techniques = request.techniques
    # Derive topic from first technique or default
    topic = "CyberBRIEF Report"
    layer = generate_navigator_layer(techniques, topic)
    return layer


# ─── Export ───────────────────────────────────────────────────────────────────


@app.post("/api/export/markdown")
async def export_markdown_endpoint(report_data: dict) -> PlainTextResponse:
    """
    Export a report as formatted Markdown.

    Accepts the full report JSON and returns Markdown text with
    TLP banner, sections, footnotes, endnotes, and bibliography.
    """
    try:
        report = Report.model_validate(report_data)
        md = export_markdown(report)
        return PlainTextResponse(content=md, media_type="text/markdown")
    except Exception as exc:
        logger.exception("Markdown export failed")
        raise HTTPException(
            status_code=500,
            detail="Markdown export failed. Check server logs for details.",
        ) from exc


@app.post("/api/export/html")
async def export_html_endpoint(report_data: dict) -> PlainTextResponse:
    """
    Export a report as a self-contained HTML page.

    Accepts the full report JSON and returns HTML with inline CSS,
    dark theme, TLP banners, all sections, and print-friendly styles.
    """
    try:
        report = Report.model_validate(report_data)
        html_content = export_html(report)
        return PlainTextResponse(content=html_content, media_type="text/html")
    except Exception as exc:
        logger.exception("HTML export failed")
        raise HTTPException(
            status_code=500,
            detail="HTML export failed. Check server logs for details.",
        ) from exc


@app.post("/api/export/pdf")
async def export_pdf_endpoint(_report_data: dict) -> JSONResponse:
    """
    Export a report as PDF.

    Stub implementation -- PDF generation requires additional dependencies
    (weasyprint or similar). Returns a placeholder response.
    """
    return JSONResponse(
        status_code=501,
        content={
            "detail": "PDF export is not yet implemented. Use Markdown export and convert externally.",
            "suggestion": "pandoc -f markdown -t pdf report.md -o report.pdf",
        },
    )


# ─── Static Frontend (Production) ─────────────────────────────────────────────
#
# In production Docker builds, the React frontend is pre-built into /app/static.
# During local development, this directory won't exist and the block is skipped
# entirely (Vite dev server handles the frontend instead).

# Candidate paths: Docker container (/app/static) or local dev (../frontend/dist)
_static_candidates = [
    Path(__file__).resolve().parent / "static",        # /app/static in Docker
    Path(__file__).resolve().parent.parent / "frontend" / "dist",  # local dev
]
_static_dir: Optional[Path] = None
for _candidate in _static_candidates:
    if _candidate.is_dir() and (_candidate / "index.html").exists():
        _static_dir = _candidate
        break

if _static_dir is not None:
    logger.info("Serving frontend static files from: %s", _static_dir)

    # Mount Vite-built assets (JS/CSS/images with content hashes)
    _assets_dir = _static_dir / "assets"
    if _assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="assets")

    # SPA catch-all: any route that is not /api/* and not a static file
    # returns index.html so client-side routing works.
    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str) -> FileResponse:
        """Serve the SPA index.html for non-API, non-asset routes."""
        # Try to serve an exact static file first (favicon.ico, robots.txt, etc.)
        requested = _static_dir / full_path  # type: ignore[operator]
        if full_path and requested.is_file() and _static_dir in requested.resolve().parents:
            return FileResponse(str(requested))
        # Otherwise, return index.html for client-side routing
        return FileResponse(str(_static_dir / "index.html"))


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
