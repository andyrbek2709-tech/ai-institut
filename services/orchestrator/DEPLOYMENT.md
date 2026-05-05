# Orchestrator Service — Production Deployment Guide

## Overview

This guide walks through deploying the Orchestrator Service to production using:
- **Railway** for hosting
- **Upstash** for managed Redis
- **Supabase** for PostgreSQL database

---

## ✅ Prerequisites

1. **Upstash Account** (https://upstash.com)
2. **Railway Account** (https://railway.app)
3. **GitHub Repository Access** (https://github.com/andyrbek2709-tech/ai-institut)
4. **Supabase Credentials** (from STATE.md or .env.production)

---

## 🟢 Step 1: Create Upstash Redis Instance

### Via Upstash Dashboard

1. Go to https://console.upstash.com
2. Click **"Create Database"** → **"Redis"**
3. Configure:
   - **Name:** `enghub-orchestrator`
   - **Region:** Select closest to your users (e.g., EU, US)
   - **Type:** `Serverless` (auto-scale, cheaper)
   - **Database Type:** `Pro` (encryption in transit, required for production)
4. Click **"Create"**

### Get Connection String

1. After creation, click the database name
2. Copy **REST API URL** format: `rediss://default:xxxx@xxxx.upstash.io:xxxxx`
   - Note: must use `rediss://` (SSL/TLS)
3. Save as `REDIS_URL` for next steps

---

## 🟢 Step 2: Prepare Environment Variables

Create a `.env.production` file in `services/orchestrator/`:

```bash
# From Upstash dashboard
REDIS_URL=rediss://default:xxxxx@xxxxx.upstash.io:xxxxx

# From Supabase (STATE.md)
SUPABASE_URL=https://jbdljdwlfimvmqybzynv.supabase.co
SUPABASE_SERVICE_KEY=eyJh...xxxxx

# Orchestrator config
LOG_LEVEL=info
MAX_RETRIES=3
RETRY_DELAY_MS=1000
CONSUMER_GROUP_NAME=orchestrator-group

# Optional: Telegram notifications
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

⚠️ **DO NOT commit this file.** It's in `.gitignore` automatically.

---

## 🟢 Step 3: Configure Railway Project

### Option A: Via Railway Dashboard (Recommended for First Deploy)

1. Go to https://railway.app/dashboard
2. Click **"New Project"** → **"Deploy from GitHub"**
3. Select repository: `andyrbek2709-tech/ai-institut`
4. Select branch: `main`
5. Configure root directory: `services/orchestrator`
6. Railway auto-detects `railway.json` and `Dockerfile`

### Option B: Via Railway CLI (Faster)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link project
cd services/orchestrator
railway link  # Select or create project

# Deploy
railway up
```

### Set Environment Variables in Railway

1. Go to Railway dashboard → Your project
2. Click **"Environment"** (top right)
3. Select **"production"** environment
4. Click **"Add Variable"** for each:
   - `REDIS_URL` = (from Upstash)
   - `SUPABASE_URL` = (from Supabase)
   - `SUPABASE_SERVICE_KEY` = (from Supabase)
   - `LOG_LEVEL` = `info`
   - `MAX_RETRIES` = `3`
   - `RETRY_DELAY_MS` = `1000`
   - `CONSUMER_GROUP_NAME` = `orchestrator-group`

---

## 🟢 Step 4: Verify Deployment

### Check Railway Logs

```bash
railway logs orchestrator --environment production --tail
```

Expected logs on startup:
```
[INFO] Orchestrator Service starting...
[INFO] Redis connected: rediss://...
[INFO] Supabase authenticated
[INFO] Consumer group 'orchestrator-group' initialized
[INFO] Listening for events on 'task-events' stream
```

### Test with Redis CLI

From any terminal with `redis-cli`:

```bash
# Connect to Upstash
redis-cli -u rediss://default:xxxxx@xxxxx.upstash.io:xxxxx

# Check stream length (should grow as events are published from API)
XLEN task-events

# Monitor events in real-time
XREAD COUNT 10 STREAMS task-events 0

# Check consumer group
XINFO GROUPS task-events
```

### Test API Integration

The API already publishes events. Verify by:

1. Go to https://enghub-three.vercel.app
2. Create a new task
3. In Railway logs, you should see:
   ```
   [INFO] Processing event: task.created
   ```
4. Check database:
   ```sql
   SELECT * FROM tasks ORDER BY created_at DESC LIMIT 1;
   SELECT * FROM task_history WHERE task_id = 'xxx' ORDER BY created_at DESC;
   ```

---

## 🟢 Step 5: Automatic Deployments

The workflow `.github/workflows/deploy-orchestrator.yml` automatically:
- Deploys on every `main` branch push to `services/orchestrator/`
- Requires **GitHub secret:** `RAILWAY_TOKEN`

### Setup CI/CD Deployment Token

1. Go to Railway dashboard → **Account Settings** → **Tokens**
2. Click **"Create Token"**
3. Copy token value
4. Go to GitHub repository → **Settings** → **Secrets and variables** → **Actions**
5. Add secret: **Name:** `RAILWAY_TOKEN`, **Value:** (paste token)
6. Future pushes to `main` will auto-deploy

---

## ⚠️ Monitoring & Alerts

### Check Health Status

```bash
# Via Railway dashboard: Status should be "Running" (green)

# Via logs
railway logs orchestrator --tail -n 50
```

### Common Issues

| Issue | Solution |
|-------|----------|
| `REDIS_URL not set` | Check Railway environment variables in dashboard |
| `Connection refused: localhost:6379` | Verify `REDIS_URL` uses `rediss://` (with SSL) |
| `task-events stream not found` | Normal on first run; will be created on first event publish |
| `Consumer group already exists` | Safe to ignore; idempotent on restart |
| `Supabase: invalid API key` | Verify `SUPABASE_SERVICE_KEY` from Supabase dashboard |

### View Recent Logs

```bash
# Last 100 lines
railway logs orchestrator --tail -n 100

# Follow live logs
railway logs orchestrator --follow

# Filter by error level
railway logs orchestrator --grep ERROR
```

### Restart Service

```bash
railway redeploy orchestrator
```

---

## 🔒 Security Checklist

- [ ] `REDIS_URL` uses `rediss://` (SSL/TLS encrypted)
- [ ] `SUPABASE_SERVICE_KEY` is never committed (in `.env.production`, not in git)
- [ ] Railway environment variables are set (not in code)
- [ ] Upstash database is in "Pro" tier (encryption in transit)
- [ ] GitHub `RAILWAY_TOKEN` is configured as a secret (not visible in logs)
- [ ] Logs don't expose sensitive data (check `LOG_LEVEL=info`, not `debug`)

---

## 📊 Performance Tuning

### Upstash Redis

- **Current tier:** Serverless (auto-scale)
- **Upgrade to Pro:** if you expect >10k events/hour
- **TLS overhead:** ~1-2ms per operation (acceptable)

### Orchestrator Service

- **Replicas:** Currently 1. For redundancy, scale to 2+ in Railway dashboard.
- **Max retries:** Default 3, backoff 1s → 2s → 4s (total ~7s before failure)
- **Batch size:** XREADGROUP default 1, increase in `src/redis/stream.ts` if bottleneck

---

## 📈 Next Steps

1. ✅ Set environment variables (Step 3)
2. ✅ Deploy to Railway (Step 4)
3. ✅ Verify logs (Step 5)
4. ✅ Test API integration (create task → check logs)
5. ✅ Setup auto-deployment token (Step 6)
6. Monitor for 24 hours: check error rates, latency, memory usage
7. If stable, celebrate 🎉

---

## 📞 Support

If deployment fails:

1. **Check Railway logs:** `railway logs orchestrator --tail`
2. **Verify environment variables** in Railway dashboard
3. **Test Redis connection:**
   ```bash
   redis-cli -u $REDIS_URL ping
   # Should respond: PONG
   ```
4. **Test Supabase connection:**
   ```sql
   SELECT * FROM tasks LIMIT 1;
   ```
5. Create GitHub issue with error logs

---

**Version:** 1.0.0  
**Last updated:** 2026-05-05  
**Maintainer:** Andrey (andyrbek2709@gmail.com)
