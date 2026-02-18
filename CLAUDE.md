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
- No em dashes. Ever.
- BLUF writing style for all generated content
- Citations follow CITATION_STYLE.md format

## DO NOT
- Run `tsc` standalone (it fails, use `npx vite build` directly)
- Change the BLUF writing format (it's the core product identity)

## Git Rules
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- Never add Co-Authored-By lines or mention AI in commits
- No em dashes in commit messages

---

## OpenClaw Sync Protocol

An AI assistant (clawdbot) runs in OpenClaw and manages this workspace. It reads memory files on every session start. Follow this protocol so it stays in the loop about your changes.

### After completing a task, append to:
`~/.openclaw/workspace/memory/YYYY-MM-DD.md`

Use today's date. Create the file if it doesn't exist.

### Format:
```markdown
## Claude Code Session - [HH:MM AM/PM EST]
**Project:** CyberBRIEF
**Branch:** [branch name]

### What changed
- [Bullet list of features/fixes/refactors]
- [Files added/modified/deleted]

### Decisions made
- [Any architectural choices, tradeoffs, library picks]

### Issues / TODO
- [Anything incomplete, broken, or needing follow-up]

### Git
- [Commit hashes or "pushed to main" / "on branch X"]
```

### Rules:
1. Always write the summary. Even for small changes.
2. Be specific about files.
3. Note decisions and why.
4. Don't edit MEMORY.md (clawdbot's long-term memory).
5. Don't edit other memory/ files. Only append to today's date file.
6. Commit and push your work.
