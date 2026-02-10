# Architecture

## System Overview

CyberBRIEF is a full-stack threat intelligence platform that synthesizes raw threat data into executive-grade reports. The system separates concerns cleanly: the frontend handles user interaction and visualization, while the backend manages research orchestration, AI synthesis, and persistence.

## Tech Stack

### Frontend
- **React 18** with TypeScript for type-safe component development
- **Vite** for lightning-fast development and optimized production builds
- **Tailwind CSS** for styling with 5 theme variants
- Runs on **port 5188**

### Backend
- **FastAPI** with async/await for high-concurrency REST APIs
- **SQLite** for report and configuration persistence
- **Gemini Flash** for synthesis and structured extraction
- **Brave Search API** for free-tier research
- **Perplexity API** for standard and deep research tiers
- Runs on **port 8000**

## Data Flow

The research-to-report pipeline follows this path:

```
User Input (topic, sources, tier selection)
    |
    v
Source Processing (URLs, text, PDFs extracted)
    |
    v
Research Execution (tier-specific search)
    |
    v
Content Synthesis (Gemini Flash processing)
    |
    v
Structured Extraction (IOCs, ATT&CK, actors)
    |
    v
Report Generation (BLUF + supporting sections)
    |
    v
Export & Storage (Markdown, HTML, SQLite)
```

## Research Tiers

### Free Tier
- Search: Brave Search API (free tier limits apply)
- Synthesis: Gemini Flash
- Best for: Quick threat summaries, IOC validation, baseline analysis

### Standard Tier
- Search: Perplexity Sonar API
- Synthesis: Gemini Flash with expanded context
- Best for: Mid-depth threat research, actor profiling, tactical intelligence

### Deep Tier
- Search: Perplexity Deep Research (extended context window)
- Synthesis: Gemini Flash with full research history
- Best for: Comprehensive threat campaigns, attribution analysis, strategic intelligence

Each tier expands the research depth and synthesis context, allowing consumers to choose cost vs. completeness.

## Frontend (React)

Responsibilities:
- User input collection (topic, sources, tier selection)
- Report rendering (Markdown preview, HTML export, theme switching)
- Navigation and state management
- Theme variant selection (5 visual options)

**Key Flows:**
1. User submits research request with sources
2. Frontend sends to backend API
3. WebSocket or polling for progress updates
4. Renders completed report with interactive controls (copy, export, share)

## Backend (FastAPI)

Responsibilities:
- API endpoint routing
- Research orchestration (tier-specific logic)
- Source processing (URL fetching, text parsing, PDF extraction)
- AI synthesis via Gemini Flash
- Structured data extraction (IOCs, MITRE ATT&CK, Chicago citations)
- Report persistence to SQLite
- CORS configuration for frontend access

**Key Flows:**
1. Accept research request with validation
2. Initialize tier-specific research pipeline
3. Execute searches (Brave or Perplexity based on tier)
4. Synthesize results via Gemini Flash
5. Extract structured data (IOCs, ATT&CK techniques, threat actors)
6. Generate BLUF summary and detailed sections
7. Persist to SQLite and return report

## Database Schema (SQLite)

Simple, normalized structure:

- **reports** table: ID, topic, created_at, tier, status, content (Markdown)
- **sources** table: report_id, url/text/pdf content, processed_status
- **findings** table: report_id, ioc, type (IP/domain/hash/CVE/URL), confidence
- **mitre_mappings** table: report_id, technique_id, tactic, description

## API Endpoints (Backend)

### POST /research
Create a new research request.

**Request:**
```json
{
  "topic": "APT41 activity",
  "sources": ["https://...", "raw text...", "pdf_url"],
  "tier": "standard"
}
```

**Response:**
```json
{
  "report_id": "uuid",
  "status": "processing",
  "created_at": "2026-02-09T20:40:00Z"
}
```

### GET /research/{report_id}
Fetch a completed report.

**Response:**
```json
{
  "report_id": "uuid",
  "status": "complete",
  "content": "# BLUF\n...",
  "iocs": [...],
  "mitre_techniques": [...],
  "citations": [...]
}
```

### GET /research/{report_id}/navigator
Export MITRE ATT&CK Navigator layer (JSON).

## Environment Variables

Backend requires:
- `GEMINI_API_KEY`: Gemini Flash API key
- `BRAVE_API_KEY`: Brave Search API key (free tier)
- `PERPLEXITY_API_KEY`: Perplexity API key (standard/deep tiers)
- `CORS_ORIGINS`: Frontend URL(s) for CORS
- `DATABASE_URL`: SQLite database path

See [CONFIGURATION.md](CONFIGURATION.md) for setup instructions.

## Deployment Notes

- Backend and frontend can be deployed independently (separate ports)
- Frontend is a static SPA after build; serve via Node or static host
- Backend is stateless; can horizontally scale with shared SQLite (or upgrade to PostgreSQL)
- API key rotation and tier limits should be monitored in production
- WebSocket or Server-Sent Events recommended for long-running research operations

## Security Considerations

- API keys must never be exposed in frontend; always proxy through backend
- CORS_ORIGINS should be restricted to trusted domains in production
- SQLite suitable for dev/demo; upgrade to PostgreSQL for multi-tenant or high-volume scenarios
- Input validation on all sources (URLs, text, PDFs) before processing
- Rate limiting recommended on /research endpoint to prevent API quota exhaustion
