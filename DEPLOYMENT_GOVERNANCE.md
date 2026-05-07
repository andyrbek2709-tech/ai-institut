# EngHub — Deployment Governance

> Canonical source of truth for EngHub deployments. Updated: 2026-05-07.

## Platform: Railway (SOLE PRODUCTION PLATFORM)

| Service | Repository Root | Railway URL |
|---|---|---|
| API Server | `services/api-server/` | `https://api-server-production-8157.up.railway.app` |
| Frontend | `enghub-main/` | `https://enghub-frontend-production.up.railway.app` |
| Orchestrator | `services/orchestrator/` | internal worker, no HTTP |
| Redis | Railway plugin | internal `redis://` |
| Supabase | external | `https://inachjylaqelysiwtsux.supabase.co` |

**Vercel: PERMANENTLY DECOMMISSIONED. Never deploy there.**

---

## Pre-Deployment Checklist

```
□ git status clean (no uncommitted changes)
□ scripts/validate-architecture.sh passes (0 errors)
□ TypeScript compiles: cd services/api-server && npm run build
□ Frontend builds: cd enghub-main && npm run build
□ STATE.md updated with planned changes (new entry at top)
□ Supabase migrations ready (if schema changes)
```

## Deployment Flow

### 1. Code Changes

```bash
# Edit files locally in d:\ai-institut
# Run architecture validator
bash scripts/validate-architecture.sh

# Verify TS compile
cd services/api-server && npm run build && cd ../..
cd enghub-main && npm run build && cd ..
```

### 2. Database Migrations (if needed)

Apply via Supabase MCP or CLI **before** deploying code:
```bash
# Via Supabase MCP: apply_migration
# Name pattern: NNN_description.sql (e.g., 029_add_column.sql)
# Location: enghub-main/supabase/migrations/
```

### 3. Git Push

```bash
git add -p                          # stage specific changes
git commit -m "type(scope): what"   # conventional commits
git push origin main                # triggers Railway auto-deploy
```

### 4. Monitor Deployment

1. Go to Railway dashboard → project ENGHUB
2. Watch build logs for each changed service
3. Wait for status: `SUCCESS` (not just `BUILDING`)
4. Check health endpoints after deploy:

```bash
curl https://api-server-production-8157.up.railway.app/health
curl https://api-server-production-8157.up.railway.app/ready
curl https://api-server-production-8157.up.railway.app/diagnostics
```

### 5. Post-Deployment Smoke Test

```bash
# API health
curl https://api-server-production-8157.up.railway.app/health      # {"status":"ok"}
curl https://api-server-production-8157.up.railway.app/ready       # {"redis":"ok"}
curl https://api-server-production-8157.up.railway.app/system-status

# Frontend
curl -o /dev/null -w "%{http_code}" https://enghub-frontend-production.up.railway.app/
# Expected: 200

# Auth (manual browser test)
# 1. Open https://enghub-frontend-production.up.railway.app
# 2. Login with admin@enghub.com / EngAdmin2026!
# 3. Verify dashboard loads
# 4. Verify no console errors
```

---

## Rollback Checklist

If deployment causes regression:

```
□ Identify failing service in Railway logs
□ Check /diagnostics endpoint for degraded status
□ Railway UI → service → "Rollback" to previous deployment
□ Verify /health returns 200 after rollback
□ Document incident in STATE.md (new entry at top)
□ Fix root cause before re-deploying
```

### Emergency Rollback (Railway UI)

1. Railway dashboard → ENGHUB project
2. Select degraded service
3. Deployments tab → find last working deployment
4. Click "Redeploy" on that deployment
5. Monitor until `SUCCESS`

---

## Recovery Flow (Service Down)

1. **Check diagnostics first:** `GET /diagnostics`
2. **Redis down:** Check Railway Redis plugin status. Restart if needed.
3. **Supabase down:** Check https://status.supabase.com. API and Orchestrator degrade gracefully.
4. **Frontend 404:** Check Railway frontend service build logs. Common cause: missing `ARG` in Dockerfile.
5. **API returns HTML:** Wrong service deployed. Check `rootDirectory` in Railway service settings.

See `OPERATIONAL_RUNBOOKS.md` in memory for 12 detailed runbooks.

---

## Production Verification Flow

After any significant change:

```bash
# 1. Architecture check
bash scripts/validate-architecture.sh

# 2. API diagnostics
curl https://api-server-production-8157.up.railway.app/diagnostics | jq .

# 3. Full E2E (manual)
# Open frontend → login → create task → verify in Supabase
```

---

## Architecture Constraints (Enforced by validator)

| Rule | Status |
|---|---|
| No relative `/api/*` fetch() in frontend | ENFORCED |
| No Vercel URLs in source code | ENFORCED |
| No `VITE_API_BASE_URL` usage | ENFORCED |
| Frontend Dockerfile has `ARG REACT_APP_RAILWAY_API_URL` | ENFORCED |
| `diagnostics.ts` route exists in API server | ENFORCED |

---

## Environment Variables

### API Server (Railway service)
```
SUPABASE_URL=https://inachjylaqelysiwtsux.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
REDIS_URL=redis://...  (Railway plugin, auto-set)
NODE_ENV=production
LOG_LEVEL=info
```

### Frontend (Railway service — baked into Docker build)
```
REACT_APP_SUPABASE_URL=https://inachjylaqelysiwtsux.supabase.co
REACT_APP_SUPABASE_ANON_KEY=...
REACT_APP_RAILWAY_API_URL=https://api-server-production-8157.up.railway.app
```

> **Critical:** Frontend env vars must be set as **Build Variables** in Railway (not Runtime),
> because CRA bakes them into the static bundle at `npm run build` time.
> The `Dockerfile` must also declare them as `ARG`.

### Orchestrator (Railway service)
```
SUPABASE_URL=https://inachjylaqelysiwtsux.supabase.co
SUPABASE_SERVICE_KEY=...
REDIS_URL=redis://...
NODE_ENV=production
CONSUMER_GROUP_NAME=orchestrator-group
MAX_RETRIES=3
```
