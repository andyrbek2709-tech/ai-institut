# PRODUCTION RECOVERY — FINAL REPORT
**Date:** 2026-05-07  
**Duration:** ~09:00–09:53 UTC (53 minutes)  
**Outcome:** ✅ All 3 Railway services restored to full operation

---

## Final Production State

| Service | URL | Status | Deployment |
|---|---|---|---|
| API Server | https://api-server-production-8157.up.railway.app | ✅ RUNNING | `2e038d3b` |
| Frontend | https://enghub-frontend-production.up.railway.app | ✅ RUNNING | `04d7eaed` |
| Orchestrator | (background worker) | ✅ RUNNING | `a993ddbb` |
| Redis | railway.internal | ✅ CONNECTED | managed |

**Smoke test (09:53 UTC):**
- `GET /health` → `{"status":"ok"}`
- `GET /ready` → `{"status":"ready","redis":"ok"}`
- `GET /api/metrics/summary` → `{"error_rate":0,"avg_latency":62}`
- Frontend → HTTP 200
- Orchestrator logs: "Redis connected → Consumer group created → Orchestrator service started"

---

## Root Causes and Fixes

### 1. Railway `rootDirectory` + `railway up` conflict
**Symptom:** Build log: `Error: Failed to read app source directory - No such file or directory`  
**Root cause:** `railway up` from a service subdirectory uploads files without their path prefix. Railway then tries to navigate to `rootDirectory` within the upload → not found.  
**Fix:** Always run `railway up` from repo root.

### 2. `railway.json` builder values must be UPPERCASE
**Symptom:** `Failed to parse your service config. Error: build.builder: Invalid input`  
**Root cause:** `"builder": "nixpacks"` and `"builder": "docker"` are invalid.  
**Fix:** Use `"NIXPACKS"` and `"DOCKERFILE"`.

### 3. Orchestrator healthcheckPath on HTTP-less background worker
**Symptom:** Deployment fails immediately (1 second).  
**Root cause:** `services/orchestrator/railway.json` had `healthcheckPath: "/health"` but the orchestrator has no HTTP server.  
**Fix:** Removed `healthcheckPath` from orchestrator railway.json.

### 4. Orchestrator Dockerfile HEALTHCHECK to localhost Redis
**Symptom:** Container health never passes.  
**Root cause:** `HEALTHCHECK CMD node -e "require('net').createConnection({port:6379,host:'localhost'}...)"` — Redis is not localhost.  
**Fix:** Removed HEALTHCHECK from orchestrator Dockerfile entirely.

### 5. `enghub-main` npm lock file out of sync
**Symptom:** `npm ci` fails: `Missing: yaml@2.8.4 from lock file`  
**Fix:** Added `yaml@^2.8.4` to package.json, regenerated package-lock.json.

### 6. Missing `rework_count` column in Supabase `tasks` table
**Symptom:** `ApiError: column tasks.rework_count does not exist` → Node.js crash  
**Fix:** Supabase migration `add_rework_count_to_tasks`: `ALTER TABLE tasks ADD COLUMN rework_count integer NOT NULL DEFAULT 0`

### 7. Express 4 async error handling: `throw err` → process crash
**Symptom:** Unhandled promise rejection → Node.js 22 fatal exit  
**Root cause:** Express 4 route handlers with `throw err` in async functions don't trigger the error middleware.  
**Fix:** All route handlers in `tasks.ts`, `publish-event.ts`, `metrics.ts` changed to `next(err)`.

### 8. ioredis unhandled 'error' event crash
**Symptom:** Orchestrator exits immediately: `Fatal error`, `error: {}`  
**Root cause:** `new Redis(url)` starts connection immediately. If connection fails before error listener is registered → unhandled 'error' event → Node crash.  
**Fix:** Added `lazyConnect: true` (defers connection) + `this.redis.on('error', ...)` listener in constructor.

### 9. Frontend serve hardcoded port 3000 vs Railway PORT=8080
**Symptom:** Railway healthcheck fails: `service unavailable` (serve listens on 3000, Railway checks 8080)  
**Fix:** `enghub-main/Dockerfile` CMD changed from `["serve","-s","build","-l","3000"]` to `sh -c "serve -s build -l ${PORT:-3000}"`.

### 10. Supabase `createClient()` requires WebSocket (Node.js 20 lacks native WS)
**Symptom:** Orchestrator crashes in 30ms with empty error `{}` — "Node.js 20 detected without native WebSocket support"  
**Root cause:** `@supabase/supabase-js` initializes a `RealtimeClient` in the `createClient()` constructor. `RealtimeClient` checks for `globalThis.WebSocket` which doesn't exist in Node.js 20.  
**Fix:** `services/orchestrator/Dockerfile`: `FROM node:20-alpine` → `FROM node:22-alpine` (Node.js 22 has native WebSocket).

---

## Architecture Verified

```
[User Browser]
      ↓ HTTPS
[Railway: enghub-frontend (React SPA)]
      ↓ API calls
[Railway: ENGHUB (Express API Server)]
      ↓ Redis Streams     ↓ Supabase
[Railway: enghub-orchestrator]   [Supabase: inachjylaqelysiwtsux]
      ↓
[Railway: Redis (internal)]
```

---

## Credentials
- Admin: `admin@enghub.com` / `EngAdmin2026!`
- See `INITIAL_ADMIN_ACCESS.md`
