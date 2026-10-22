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

Optional server settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | HTTP listen port (set automatically by most platforms) |
| `FORWARDED_ALLOW_IPS` | empty | Peers whose `X-Forwarded-For` header is trusted. See below |
| `RATE_LIMIT_PER_HOUR` | `3` | Research requests per client per rolling hour |
| `RATE_LIMIT_PER_DAY` | `5` | Research requests per client per rolling 24 hours |

---

## Client Addresses Behind a Proxy

The research endpoints (`/api/research` and `/api/research/from-sources`) are rate
limited per client address. On every supported platform the container sits behind
the platform's reverse proxy, so the socket peer is the proxy, not the visitor.
Unless uvicorn is told to trust that proxy, every visitor lands in the same bucket
and the whole site shares one allowance.

Both Dockerfiles start uvicorn with `--proxy-headers --forwarded-allow-ips
"$FORWARDED_ALLOW_IPS"`. uvicorn only reads `X-Forwarded-For` when the socket peer
matches that list. It then walks the header from the right and uses the first
address that is not itself trusted. The default is empty, which trusts nobody:
a spoofed `X-Forwarded-For` is ignored and clients are keyed on the socket peer.
That is safe but puts everyone behind a proxy in one bucket.

**Do not set `FORWARDED_ALLOW_IPS=*`.** With `*`, uvicorn takes the leftmost
`X-Forwarded-For` entry. Railway, Render and Fly.io append to whatever header the
caller sent, so the leftmost entry is caller controlled and anyone can pick a new
bucket per request.

| Platform | Value | Notes |
|----------|-------|-------|
| Docker, exposed directly | empty | No proxy, the socket peer is the client |
| Docker behind nginx, Caddy or Traefik | the proxy's address or its Docker network CIDR | The proxy must set `X-Forwarded-For`. Find the network with `docker network inspect` |
| Fly.io | `172.16.0.0/12,<app IPv4>,<app IPv6>` | Fly Proxy connects from `172.16.x.x`, and Fly puts your app's own address last in `X-Forwarded-For`, so list the addresses from `fly ips list` too |
| Railway | `10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,100.64.0.0/10,fc00::/7` | Railway does not publish its edge range. The service is only reachable through the edge, which appends the client last, so trusting private ranges selects the real client |
| Render | same as Railway | Render appends to a caller-supplied `X-Forwarded-For`. Run the check below before relying on it |
| Cloud Run behind Firebase Hosting | empty until checked | The Firebase hop adds its own entries. Start from the Railway value and run the check below |

Set the value as a platform environment variable (Railway and Render dashboards,
`[env]` in `fly.toml`, `--set-env-vars` on Cloud Run, `-e` for Docker).

### Check it

uvicorn's access log prints the address the rate limiter uses. After deploying:

```bash
curl -s https://your-app.example/api/research -H 'content-type: application/json' \
  -d '{"topic":"test"}' -H 'X-Forwarded-For: 198.51.100.1'
```

The log line for that request must show your own public IP. If it shows the
platform's internal address, the proxy is not trusted yet and all visitors still
share a bucket. If it shows `198.51.100.1`, the setting trusts caller input: set
`FORWARDED_ALLOW_IPS` back to empty and narrow the value before trying again.

The limiter keeps at most 10,000 client addresses in memory and drops the least
recently active one when full. A client's entry is removed once its last request
is more than 24 hours old.

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
Set `FORWARDED_ALLOW_IPS` to the proxy's address so rate limits apply per visitor
(see [Client Addresses Behind a Proxy](#client-addresses-behind-a-proxy)):

```bash
docker run -e FORWARDED_ALLOW_IPS=<proxy network CIDR> -p 8000:8000 cyberbrief
```
