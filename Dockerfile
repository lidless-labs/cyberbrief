# ============================================================================
# CyberBRIEF -- Multi-stage Dockerfile
# Builds React frontend, then serves everything via FastAPI + uvicorn
# ============================================================================

# --- Stage 1: Build frontend ---
FROM node:20-alpine AS frontend-build

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Production runtime ---
FROM python:3.12-slim AS runtime

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./

# Copy built frontend into /app/static
COPY --from=frontend-build /build/dist /app/static

# Expose port (Railway/Render/Fly.io set PORT env var)
ENV PORT=8000

# Long timeouts for Deep Research tier (up to 6 min per request)
# --timeout-keep-alive keeps idle connections open between proxy hops
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT} --timeout-keep-alive 400"]
