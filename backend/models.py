"""Pydantic models mirroring the frontend TypeScript types."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ─── Enums ────────────────────────────────────────────────────────────────────


class ResearchTier(str, Enum):
    FREE = "FREE"
    STANDARD = "STANDARD"
    DEEP = "DEEP"


class TLPLevel(str, Enum):
    CLEAR = "TLP:CLEAR"
    GREEN = "TLP:GREEN"
    AMBER = "TLP:AMBER"
    AMBER_STRICT = "TLP:AMBER+STRICT"
    RED = "TLP:RED"


class ConfidenceLevel(str, Enum):
    LOW = "Low"
    MODERATE = "Moderate"
    HIGH = "High"


class IOCType(str, Enum):
    IPV4 = "ipv4"
    IPV6 = "ipv6"
    DOMAIN = "domain"
    URL = "url"
    MD5 = "md5"
    SHA1 = "sha1"
    SHA256 = "sha256"
    CVE = "cve"


# ─── IOC ──────────────────────────────────────────────────────────────────────


class IOC(BaseModel):
    type: IOCType
    value: str
    context: Optional[str] = None
    sources: list[str] = Field(default_factory=list)


# ─── ATT&CK ──────────────────────────────────────────────────────────────────


class Evidence(BaseModel):
    quote: str
    source: str


class AttackTechnique(BaseModel):
    technique_id: str = Field(alias="techniqueId")
    name: str
    tactic: str
    description: str
    evidence: list[Evidence] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


# ─── Threat Actor ─────────────────────────────────────────────────────────────


class ThreatActorProfile(BaseModel):
    name: str
    aliases: list[str] = Field(default_factory=list)
    attribution: str
    first_seen: Optional[str] = Field(None, alias="firstSeen")
    last_active: Optional[str] = Field(None, alias="lastActive")
    tooling: list[str] = Field(default_factory=list)
    notes: Optional[str] = None

    model_config = {"populate_by_name": True}


# ─── Report ───────────────────────────────────────────────────────────────────


class ReportSection(BaseModel):
    id: str
    title: str
    content: str
    citations: list[str] = Field(default_factory=list)


class ReportSource(BaseModel):
    title: str
    url: str
    accessed_at: str = Field(alias="accessedAt")
    snippet: Optional[str] = None

    model_config = {"populate_by_name": True}


class ConfidenceAssessment(BaseModel):
    finding: str
    confidence: ConfidenceLevel
    rationale: str


class Report(BaseModel):
    id: str
    topic: str
    created_at: str = Field(alias="createdAt")
    tier: ResearchTier
    tlp: TLPLevel
    bluf: str
    threat_actor: ThreatActorProfile = Field(alias="threatActor")
    sections: list[ReportSection] = Field(default_factory=list)
    iocs: list[IOC] = Field(default_factory=list)
    attack_mapping: list[AttackTechnique] = Field(alias="attackMapping", default_factory=list)
    sources: list[ReportSource] = Field(default_factory=list)
    footnotes: list[str] = Field(default_factory=list)
    bibliography: list[str] = Field(default_factory=list)
    confidence_assessments: list[ConfidenceAssessment] = Field(
        alias="confidenceAssessments", default_factory=list
    )

    model_config = {"populate_by_name": True}


# ─── Search / Research ────────────────────────────────────────────────────────


class SearchResult(BaseModel):
    title: str
    url: str
    snippet: str
    published_date: Optional[str] = Field(None, alias="publishedDate")

    model_config = {"populate_by_name": True}


class ResearchMetadata(BaseModel):
    search_duration_ms: int = Field(alias="searchDurationMs", default=0)
    synthesis_duration_ms: int = Field(alias="synthesisDurationMs", default=0)
    total_duration_ms: int = Field(alias="totalDurationMs", default=0)
    search_provider: str = Field(alias="searchProvider", default="brave")
    synthesis_model: str = Field(alias="synthesisModel", default="gemini-2.0-flash")

    model_config = {"populate_by_name": True}


class ResearchBundle(BaseModel):
    topic: str
    tier: ResearchTier
    search_results: list[SearchResult] = Field(alias="searchResults", default_factory=list)
    synthesized_content: str = Field(alias="synthesizedContent", default="")
    extracted_iocs: list[IOC] = Field(alias="extractedIOCs", default_factory=list)
    suggested_techniques: list[AttackTechnique] = Field(
        alias="suggestedTechniques", default_factory=list
    )
    sources: list[ReportSource] = Field(default_factory=list)
    metadata: ResearchMetadata = Field(default_factory=ResearchMetadata)

    model_config = {"populate_by_name": True}


# ─── API Request / Response ──────────────────────────────────────────────────


class ApiKeys(BaseModel):
    perplexity: Optional[str] = None
    openai: Optional[str] = None
    anthropic: Optional[str] = None
    gemini: Optional[str] = None
    brave: Optional[str] = None


class ResearchRequest(BaseModel):
    topic: str
    tier: ResearchTier = ResearchTier.FREE
    api_keys: Optional[ApiKeys] = None


class ReportGenerateRequest(BaseModel):
    bundle: ResearchBundle
    settings: Optional[dict] = None


class NavigatorRequest(BaseModel):
    techniques: list[AttackTechnique]


class SourceInput(BaseModel):
    """A single source for the from-sources research endpoint."""
    type: str = "url"  # "url", "text", or "pdf"
    value: str  # URL string, raw text, or base64-encoded PDF
    label: Optional[str] = None  # optional display name


class SourceResearchRequest(BaseModel):
    """Request body for /api/research/from-sources."""
    topic: str
    sources: list[SourceInput]
    api_keys: Optional[ApiKeys] = None


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.1.0"
