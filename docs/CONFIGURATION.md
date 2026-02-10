# Configuration

## Environment Variables

CyberBRIEF requires several API keys and configuration options. Set these before running the backend.

### Required: AI & Search APIs

**GEMINI_API_KEY**
- Obtains the Gemini Flash API key for report synthesis
- Get it: https://ai.google.dev/
- Used for: BLUF summaries, IOC extraction, MITRE ATT&CK mapping

**BRAVE_API_KEY**
- Brave Search API key for free-tier research
- Get it: https://api.search.brave.com/
- Used in: Free research tier
- Note: Free tier has rate limits; monitor usage

**PERPLEXITY_API_KEY**
- Perplexity API key for standard and deep research tiers
- Get it: https://www.perplexity.ai/hub/developer
- Used in: Standard (Sonar) and Deep research tiers
- Note: Different API keys may be needed for different tiers; use single key for simplicity

### Required: CORS & Frontend

**CORS_ORIGINS**
- Comma-separated list of allowed frontend origins
- Example: `http://localhost:5188,https://intelligence.example.com`
- Used by: FastAPI CORS middleware
- Dev default: `http://localhost:5188`
- Prod: Must include your actual frontend domain

### Optional: Database

**DATABASE_URL**
- SQLite database file path
- Default: `./reports.db` (relative to backend working directory)
- Example: `/data/cyberbrief_reports.db` or `sqlite:///./reports.db`
- Note: In production, consider PostgreSQL for scalability

## Setup Instructions

### 1. Get API Keys

**Gemini API:**
1. Visit https://ai.google.dev/
2. Click "Get API Key"
3. Create a new project (or use existing)
4. Copy your API key

**Brave Search API:**
1. Visit https://api.search.brave.com/
2. Sign up for a free account
3. Navigate to credentials/API keys
4. Copy your search API key

**Perplexity API:**
1. Visit https://www.perplexity.ai/hub/developer
2. Sign up or log in
3. Generate an API key
4. Copy the key (note any tier restrictions)

### 2. Configure Backend

Create a `.env` file in the `backend/` directory:

```bash
cd backend
touch .env
```

Edit `.env` with your keys:

```
GEMINI_API_KEY=your_gemini_key_here
BRAVE_API_KEY=your_brave_key_here
PERPLEXITY_API_KEY=your_perplexity_key_here
CORS_ORIGINS=http://localhost:5188
DATABASE_URL=sqlite:///./reports.db
```

### 3. Load Environment Variables

**Option A: Auto-load via `.env` (Recommended)**
FastAPI and Python Dotenv will automatically load `.env` when you run the backend.

**Option B: Export to Shell**
```bash
export GEMINI_API_KEY=your_key
export BRAVE_API_KEY=your_key
export PERPLEXITY_API_KEY=your_key
export CORS_ORIGINS=http://localhost:5188
```

**Option C: Docker**
Pass env vars when running container:
```bash
docker run \
  -e GEMINI_API_KEY=your_key \
  -e BRAVE_API_KEY=your_key \
  -e PERPLEXITY_API_KEY=your_key \
  -e CORS_ORIGINS=http://localhost:5188 \
  cyberbrief-backend
```

## Port Configuration

### Frontend (React + Vite)

**Default:** `http://localhost:5188`

Change in `frontend/vite.config.ts`:
```typescript
export default defineConfig({
  server: {
    port: 5188,
    host: '0.0.0.0'
  }
})
```

Or via command line:
```bash
npm run dev -- --port 5189
```

### Backend (FastAPI)

**Default:** `http://localhost:8000`

Change in `backend/main.py` or via Uvicorn flag:
```bash
uvicorn main:app --host 0.0.0.0 --port 8001
```

If you change ports, update `CORS_ORIGINS` to match your frontend URL.

## Development vs. Production

### Development
```
GEMINI_API_KEY=your_dev_key
BRAVE_API_KEY=your_dev_key
PERPLEXITY_API_KEY=your_dev_key
CORS_ORIGINS=http://localhost:5188
DATABASE_URL=sqlite:///./dev_reports.db
```

### Production
```
GEMINI_API_KEY=your_prod_key (use a separate key if possible)
BRAVE_API_KEY=your_prod_key
PERPLEXITY_API_KEY=your_prod_key
CORS_ORIGINS=https://intelligence.example.com
DATABASE_URL=postgresql://user:pass@db-host/cyberbrief
```

Production recommendations:
- Use environment-specific API keys
- Switch to PostgreSQL for multi-instance deployments
- Enable HTTPS for all connections
- Restrict CORS_ORIGINS to exact domain
- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
- Monitor API quota usage and rate limits

## Troubleshooting

### CORS Errors
- **Symptom:** Browser console shows "Access to XMLHttpRequest blocked by CORS policy"
- **Fix:** Ensure `CORS_ORIGINS` matches your frontend URL exactly (including protocol and port)
- **Example:** If frontend is `http://192.168.1.100:5188`, use `CORS_ORIGINS=http://192.168.1.100:5188`

### API Key Errors
- **Symptom:** "Invalid API key" when running research
- **Fix:** Verify keys in `.env` are correct and active on their respective platforms
- **Debug:** Backend logs will show which API failed

### Database Errors
- **Symptom:** "Cannot create table in read-only database"
- **Fix:** Ensure backend has write permissions to the database directory
- **Example:** `chmod 755 /path/to/db/directory`

### Port Already in Use
- **Symptom:** "Address already in use" on startup
- **Fix:** Find and kill the existing process or use a different port
- **Linux/Mac:** `lsof -i :5188` then `kill -9 <PID>`
- **Windows:** `netstat -ano | findstr :5188` then `taskkill /PID <PID> /F`

## API Rate Limits

Monitor these to avoid hitting tier limits:

- **Brave Search:** Free tier has standard limits; check dashboard
- **Perplexity:** Standard and Deep tiers have different rate limits; monitor usage
- **Gemini Flash:** Check quota in Google AI Studio

Recommendation: Add monitoring/logging to `backend/main.py` to track API calls per tier.
