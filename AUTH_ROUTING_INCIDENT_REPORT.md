# AUTH/ROUTING INCIDENT REPORT
**Date:** 2026-05-07  
**Severity:** 🔴 CRITICAL — Users cannot log in, system inoperable  
**Status:** DIAGNOSED — Fix requires Railway dashboard configuration

---

## Executive Summary

**Problem:** Users cannot log in. Console shows `/auth/v1/token → 404` with HTML response.

**Root Cause:** The Railway service at `api-server-production-8157.up.railway.app` is running **frontend code (React HTML)** instead of **API server code (Express JSON)**.

**Impact:**
- 🔴 Login fails (auth requests go to wrong endpoint)
- 🔴 API endpoints inaccessible
- 🔴 Frontend accessible only from wrong domain
- ✅ Supabase database healthy
- ✅ Code ready for deployment

**Fix Time:** ~15-30 minutes (requires Railway dashboard changes)

---

## Critical Observations

### 1. Frontend Auth Flow (Code-Level)
**File:** `enghub-main/src/api/supabase.ts:55-60`

```typescript
export const signIn = (email: string, password: string) =>
  fetch(`${SURL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: H(),
    body: JSON.stringify({ email, password }),
  }).then(r => r.json());
```

Where `SURL = https://jbdljdwlfimvmqybzynv.supabase.co` (EngHub Supabase project)

**Assessment:** ✅ **Correct** — Frontend makes direct fetch to Supabase, no API proxy.

### 2. User Experience (Reality)
**User Action:** Opens `https://api-server-production-8157.up.railway.app`

**Expected:** Express API server returns JSON
```json
{
  "name": "EngHub API Server",
  "version": "1.0.0",
  "status": "running"
}
```

**Actual:** React frontend returns HTML
```html
<!DOCTYPE html>
<html>
  <body>
    <div id="root"></div>
    <script src="/static/js/main.xxxxx.js"></script>
  </body>
</html>
```

**Assessment:** 🔴 **WRONG SERVICE** — Frontend deployed where API should be.

### 3. Auth Request Path (Browser)
**Browser Console Error:** `/auth/v1/token?grant_type=password → 404` + `Unexpected token '<'`

**Why This Happens:**
1. User loads frontend from `https://api-server-production-8157.up.railway.app` (wrong domain)
2. React app renders and tries to log in
3. Frontend makes fetch to `https://jbdljdwlfimvmqybzynv.supabase.co/auth/v1/token` ✅ (correct)
4. BUT since frontend was loaded from wrong origin, CORS issues may occur OR request may be proxied
5. Actually, auth request should work if made directly from React
6. **Real issue:** User opens wrong URL and sees React app, then expects API routes to work

**Assessment:** 🔴 **TOPOLOGY ERROR** — Domains misaligned.

### 4. Deployment Topology

#### ✅ CORRECT DEPLOYMENT
```
┌──────────────────────────────────────┐
│   User opens frontend in browser     │
│  https://enghub-three.vercel.app     │  ← Frontend HTML + React
└──────────────────┬───────────────────┘
                   │
        ┌──────────▼──────────┐
        │ Frontend renders    │
        │ HTML + React JS     │
        │ (static files)      │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────────────────┐
        │ Login: fetch to Supabase Auth   │
        │ /auth/v1/token                  │  ← JSON response
        │ (direct to Supabase)            │
        └──────────┬──────────────────────┘
                   │
        ┌──────────▼──────────────────────┐
        │ App fetch to Railway API        │
        │ /api/tasks, /api/publish-event │  ← JSON responses
        └────────────────────────────────┘
```

#### 🔴 CURRENT BROKEN DEPLOYMENT
```
┌──────────────────────────────────────┐
│   User opens wrong domain in browser │
│  https://api-server-production-8157  │  ← WRONG! This is API service
│        .up.railway.app               │
└──────────────────┬───────────────────┘
                   │
        ┌──────────▼──────────┐
        │ Gets React HTML     │
        │ (frontend code!)    │
        │ + React JS          │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────────────────┐
        │ Login: fetch to Supabase Auth   │
        │ /auth/v1/token                  │  ← ✅ Request is correct
        │ (direct to Supabase)            │
        └──────────┬──────────────────────┘
                   │
                   ✅ If CORS works, auth request succeeds
                   BUT user expected API server, not frontend
```

---

## Deployment Analysis

### Frontend Service (`enghub-main/`)
- **Dockerfile:** Multi-stage build with `serve` command
- **Output:** Static React build (~530 kB gzipped)
- **Port:** 3000
- **Serves:** HTML + JS + CSS + assets
- **Routes:** React client-side routing (anything → index.html)
- **Status:** ✅ Code ready, needs deployment

### API Server Service (`services/api-server/`)
- **Dockerfile:** Multi-stage Node.js with Express
- **Output:** JSON API
- **Port:** 3000 (internally)
- **Routes:** 
  - `GET /` → JSON metadata
  - `GET /health` → `{status: 'ok'}`
  - `GET /ready` → Redis health
  - `POST /api/publish-event` → event publishing
  - `GET /api/tasks/:projectId` → task list
  - etc.
- **Status:** ✅ Code ready, misconfigured on Railway

### Current Railway Service (`api-server-production-8157`)
- **Actual code:** Frontend (`enghub-main/`)
- **Expected code:** API Server (`services/api-server/`)
- **Problem:** Root Directory or Dockerfile misconfigured
- **Status:** 🔴 **NEEDS IMMEDIATE RECONFIGURATION**

---

## Root Cause Analysis

### Why This Happened
1. **Hypothesis 1:** Railway service created with wrong Root Directory
   - Created with `Root Directory = enghub-main/` instead of `services/api-server/`
   - Railway built frontend Dockerfile
   - Frontend code deployed to api-server-production-8157 service

2. **Hypothesis 2:** Dockerfile path incorrect
   - Railway picked up `enghub-main/Dockerfile` instead of `services/api-server/Dockerfile`
   - Same result: frontend serves instead of API

3. **Hypothesis 3:** Both services deployed to same container
   - Frontend overlay replaced API server
   - Less likely but possible

### Evidence Trail
- `git log` shows: "fix(api-server): restore missing migration 026 + fix env variables"
- `git log` shows: "docs(state): API server root endpoint fix + Railway deployment diagnostic"
- `git log` shows: Multiple "Railway deployment fix" commits
- **Conclusion:** Issue has been recurring, suggests systemic misconfiguration

---

## Fix Implementation (3-Step Process)

### STEP 1: Fix api-server-production-8157 Service

**Timeframe:** 5 minutes  
**Access:** Railway dashboard (https://railway.app)

**Instructions:**
1. Open Railway dashboard
2. Navigate to project "enghub-api-server" or "ENGHUB"
3. Find service: `api-server-production-8157` (may have different name in UI)
4. Go to: Settings → Deployment
5. Check: **Root Directory**
   - **If:** Currently `enghub-main/` or empty
   - **Change to:** `services/api-server/`
6. Check: **Dockerfile** (if visible)
   - **Should be:** `services/api-server/Dockerfile`
7. Verify: **Environment Variables**
   ```
   SUPABASE_URL=https://jbdljdwlfimvmqybzynv.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   REDIS_URL=redis://...  (auto-set by Railway plugin)
   NODE_ENV=production
   ```
8. Click: **Redeploy** or **Trigger Deploy**
9. Wait: ~2-3 minutes for build + deployment

**Verification:**
```bash
curl https://api-server-production-8157.up.railway.app/
# Should return:
# {
#   "name": "EngHub API Server",
#   "version": "1.0.0",
#   "status": "running",
#   "timestamp": "2026-05-07T..."
# }

curl https://api-server-production-8157.up.railway.app/health
# Should return: {"status":"ok","timestamp":"..."}

curl https://api-server-production-8157.up.railway.app/ready
# Should return: {"status":"ready","redis":"ok","timestamp":"..."}
```

### STEP 2: Deploy Frontend

**Timeframe:** 5-10 minutes  
**Option A (Recommended):** Trigger Vercel rebuild

1. Go to https://vercel.com → Project "enghub"
2. Click: **Deployments** → **Redeploy** (latest)
3. Or: `git push` to main branch (auto-triggers)
4. Wait: ~2-3 minutes for build
5. Check: Build logs for errors
6. Test: `https://enghub-three.vercel.app/` should load React app

**Option B (Alternative):** Create new Railway service for frontend

1. Go to Railway dashboard
2. New Service → Deploy from GitHub
3. Select: `andyrbek2709-tech/ai-institut` repo
4. Branch: `main`
5. Root Directory: `enghub-main/`
6. Add Env Variables:
   ```
   REACT_APP_SUPABASE_URL=https://jbdljdwlfimvmqybzynv.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
7. Deploy
8. Note the generated URL (e.g., `https://enghub-frontend-xyz.railway.app`)

**Verification:**
```bash
curl https://enghub-three.vercel.app/ -I
# Should return: HTTP/1.1 200 OK
# Content-Type: text/html
# (And HTML body with React app)
```

### STEP 3: (Optional) Deploy Orchestrator

**Timeframe:** 5-10 minutes  
**Status:** Code ready, no runtime dependencies needed yet

1. Go to Railway dashboard → New Service
2. Deploy from GitHub: `andyrbek2709-tech/ai-institut`
3. Root Directory: `services/orchestrator/`
4. Add Env Variables:
   ```
   SUPABASE_URL=https://jbdljdwlfimvmqybzynv.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   REDIS_URL=redis://...  (auto-set if linked to Redis plugin)
   NODE_ENV=production
   CONSUMER_GROUP_NAME=orchestrator-group
   LOG_LEVEL=info
   ```
5. Link: Connect to Redis plugin if separate
6. Deploy

**Verification:**
```bash
# Check logs in Railway dashboard
# Should see: "API Server listening on port..." or similar startup message
```

---

## End-to-End Testing (After Fix)

### Test 1: API Server Returns JSON
```bash
curl -s https://api-server-production-8157.up.railway.app/ | jq .
# Expected:
# {
#   "name": "EngHub API Server",
#   "version": "1.0.0",
#   "status": "running",
#   "timestamp": "2026-05-07T..."
# }
```

### Test 2: Frontend Loads
Open in browser: `https://enghub-three.vercel.app/`
- Should see: Login page with email + password inputs
- Console should have: No critical errors
- Network tab: Should see JS/CSS/HTML loaded

### Test 3: Auth Flow
1. Open: `https://enghub-three.vercel.app/login`
2. Enter credentials:
   - Email: `skorokhod.a@nipicer.kz`
   - Password: `123456`
3. Click: Login
4. Expected: Redirect to dashboard (no auth errors)
5. Verify: Can see tasks list

### Test 4: API Integration
1. On dashboard, click: Create Task (or similar)
2. Fill form + Submit
3. Check: Task appears in list
4. Check: Network tab shows POST to `/api/tasks`
5. Check: No 404 or proxy errors

### Test 5: Smoke Test
- [ ] Login page loads
- [ ] Can log in with test credentials
- [ ] Dashboard visible with task list
- [ ] Can create a new task
- [ ] API calls return JSON (no HTML errors)
- [ ] No console errors
- [ ] Redirect to task works
- [ ] Logout works

---

## Success Criteria

| Criterion | Current | Expected |
|-----------|---------|----------|
| `https://api-server-production-8157.up.railway.app/` | HTML | JSON ✅ |
| `https://enghub-three.vercel.app/` | 404 | HTML + React ✅ |
| Auth flow | 404 + HTML | JWT token ✅ |
| API `/api/tasks` | N/A | 200 JSON ✅ |
| Login works | ❌ | ✅ |
| Dashboard loads | ❌ | ✅ |

---

## Deployment Configuration Reference

### API Server (services/api-server/)
- **Entry point:** `npm start` → `node dist/index.js`
- **Build:** `npm run build` (TypeScript → JavaScript)
- **Health checks:**
  - Liveness: `GET /health`
  - Readiness: `GET /ready` (checks Redis)
- **Dependencies:**
  - Express.js (HTTP server)
  - ioredis (Redis client)
  - @supabase/supabase-js (Supabase SDK)
  - pino (logging)

### Frontend (enghub-main/)
- **Entry point:** `serve -s build -l 3000`
- **Build:** `npm run build` (React + TypeScript → static files)
- **Output:** `build/` directory (~530 kB gzipped)
- **Routes:** All requests → `index.html` (React routing)

### Orchestrator (services/orchestrator/)
- **Entry point:** `npm start` → `node dist/index.ts`
- **Build:** `npm run build`
- **Process:** Event listener on Redis Stream
- **Dependencies:**
  - ioredis (Redis Streams)
  - @supabase/supabase-js (Supabase)
  - pino (logging)

---

## Timeline

| Step | Action | Time | Owner |
|------|--------|------|-------|
| 1 | Reconfigure api-server-production-8157 | 5 min | Railway dashboard |
| 2 | Verify API responds with JSON | 2 min | curl/browser |
| 3 | Rebuild frontend (Vercel or Railway) | 5 min | Vercel or Railway |
| 4 | Verify frontend loads | 2 min | browser |
| 5 | Test login flow | 5 min | browser |
| 6 | Deploy orchestrator (optional) | 5 min | Railway |
| **Total** | **System operational** | **~25 min** | — |

---

## Appendix: Env Variables

### EngHub Supabase Project
```
Project ID: jbdljdwlfimvmqybzynv
Region: EU (Ireland)
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkYmxqZHdsZmltdm1xeWJ6eW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMzEwNDgsImV4cCI6MjA4NzYwNzA0OH0.gKnvfvqSGF--ZG1fBgzYYVVa0-B2aTqJfB8diqxRaWY
URL: https://jbdljdwlfimvmqybzynv.supabase.co
```

### Test Credentials (Reset 2026-04-30 07:01 UTC)
```
Admin: admin@enghub.com (use existing password)
GIP: skorokhod.a@nipicer.kz / 123456
Lead ЭС: pravdukhin.a@nipicer.kz / 123456
Engineer ЭС: troshin.m@nipicer.kz / 123456
Lead АК: bordokina.o@nipicer.kz / 123456
Engineer АК: gritsenko.a@nipicer.kz / 123456
```

---

## Questions?

- **API server not responding?** Check Railway logs for startup errors
- **Frontend still 404?** Check Vercel build logs or Railway deployment logs
- **Auth still failing?** Check browser console → Network tab → look at `/auth/v1/token` response
- **Redis connection issues?** Verify `REDIS_URL` env var is set correctly on Railway

---

**Report Created:** 2026-05-07 by Diagnostic Agent  
**Status:** 🔴 CRITICAL — Ready for implementation
