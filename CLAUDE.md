# CLAUDE.md

## Project
- **Name:** CyberBRIEF
- **Stack:** React 18, TypeScript, Vite, Zustand, FastAPI, Python 3.11
- **Root:** This directory
- **Deploy:** Railway (project: compassionate-rejoicing)

## Architecture
- Frontend: `frontend/` (React 18 + TypeScript + Vite + Zustand)
- Backend: `backend/` (FastAPI + Python 3.11)
- Docs: `docs/` (BLUF style guide, citation style, deployment)

## Build & Test
```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8000

# Build frontend
cd frontend && npx vite build
```

## Key Files
- `frontend/src/App.tsx` - React entry with router
- `backend/app.py` - FastAPI entry point (or main.py)
- `BLUF_STYLE_GUIDE.md` - Writing style for briefings
- `CITATION_STYLE.md` - Source citation format
- `DEPLOYMENT.md` - Deploy instructions
- `railway.json` - Railway config

## Gotchas
- **Use `npx vite build`** (not `tsc && vite build`). TypeScript compiler fails but Vite builds fine.
- **Zustand for state** (unlike other projects which use custom stores).
- **BLUF format:** Bottom Line Up Front. Briefings lead with the conclusion, then supporting details.

## Style Guide
- Dark theme, cybersecurity aesthetic
- BLUF writing style for all generated content
- Citations follow CITATION_STYLE.md format

## DO NOT
- Run `tsc` standalone (it fails, use `npx vite build` directly)
- Change the BLUF writing format (it's the core product identity)

> Global rules (git, formatting, memory handoff) live in ~/.claude/CLAUDE.md and apply automatically.
