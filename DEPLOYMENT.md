# CyberBRIEF -- Deployment Guide

CyberBRIEF is a fully client-side BYOK (Bring Your Own Key) application. All API keys are
stored in the browser's localStorage and sent per-request. The server has no secrets and
needs no database. This makes deployment straightforward.

## Quick Reference

| Platform | Cost | One-liner |
|----------|------|-----------|
| Railway | $5/mo hobby plan | `railway up` |
| Render | Free tier available | Connect GitHub repo |
| Fly.io | Free tier (3 shared VMs) | `fly launch` |
| Firebase + Cloud Run | Google free tier | See below |

---

## Railway (Recommended)

The easiest path. Railway auto-detects the Dockerfile and handles everything.

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

Railway reads `railway.json` automatically. The health check at `/api/health` is
pre-configured. Custom domains are available on the Hobby plan ($5/mo).

**Timeout note:** Railway supports up to 5 minutes of request timeout by default.
For Deep Research tier requests (up to 6 min), you may need to contact Railway
support to increase the request timeout limit on your project.

---

## Render

```bash
# Option A: Connect GitHub repo in Render dashboard
# Option B: Use the Blueprint
```

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New** > **Blueprint**
3. Connect your GitHub repo
4. Render reads `render.yaml` and creates the service

The free tier works fine for personal use. Paid tiers ($7/mo) remove the cold-start
spin-down delay and support custom domains.

**Timeout note:** Free tier has a 30-second request timeout. Deep Research tier
requires at least the Starter plan for longer timeouts (up to 5 min).

---

## Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Launch (reads fly.toml)
fly auth login
fly launch

# Deploy updates
fly deploy
```

The `fly.toml` config sets auto-stop to spin down idle machines (saves money).
Machines restart automatically on the next request.

**Custom domain:**
```bash
fly certs create yourdomain.com
# Then add the CNAME record shown in your DNS provider
```

---

## Firebase Hosting + Cloud Run

This approach serves the frontend from Firebase CDN and proxies `/api/**` requests
to a Cloud Run backend container. Good if you are already in the Google ecosystem.

### Prerequisites

```bash
npm install -g firebase-tools
gcloud auth login
```

### Deploy backend to Cloud Run

```bash
# Build and push the backend container
gcloud builds submit --tag gcr.io/YOUR_PROJECT/cyberbrief-api -f Dockerfile.cloudrun .

# Deploy to Cloud Run (set 7-min timeout for Deep Research)
gcloud run deploy cyberbrief-api \
  --image gcr.io/YOUR_PROJECT/cyberbrief-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --timeout 420 \
  --memory 256Mi
```

### Build and deploy frontend

```bash
cd frontend
npm ci && npm run build
cd ..

firebase login
firebase init hosting  # Select your project, set public dir to frontend/dist
firebase deploy
```

The `firebase.json` config rewrites `/api/**` to the Cloud Run service and serves
`index.html` for all other routes (SPA routing).

---

## Environment Variables

**None required.** CyberBRIEF uses a BYOK model. Users configure their own API keys
(OpenAI, Perplexity, Brave Search, Gemini) in the Settings page. Keys are stored
in the browser and sent with each request.

The only environment variable the server uses:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | HTTP listen port (set automatically by most platforms) |

---

## Timeout Configuration

The Deep Research tier can take 2-6 minutes per request. Make sure your platform
supports long-running HTTP requests:

| Platform | Default Timeout | How to Increase |
|----------|----------------|-----------------|
| Railway | 5 min | Contact support for longer |
| Render Free | 30 sec | Upgrade to Starter ($7/mo) |
| Render Starter+ | 5 min | Dashboard settings |
| Fly.io | 5 min | Sufficient for most cases |
| Cloud Run | Configurable | `--timeout 420` flag |

---

## Custom Domain Setup

All platforms support custom domains. General steps:

1. Add the domain in your platform's dashboard
2. Create a CNAME record pointing to the platform's provided hostname
3. Wait for SSL certificate provisioning (usually automatic, 5-15 min)

---

## Docker (Self-Hosted)

```bash
# Build
docker build -t cyberbrief .

# Run
docker run -p 8000:8000 cyberbrief

# Or with a custom port
docker run -e PORT=3000 -p 3000:3000 cyberbrief
```

For reverse proxy setups (nginx, Caddy, Traefik), point the proxy to the container
port and set appropriate upstream timeouts (at least 7 minutes for Deep Research).
