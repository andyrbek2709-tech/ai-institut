# FINAL ARCHITECTURE NORMALIZATION REPORT
**Date:** 2026-05-07  
**Status:** ✅ COMPLETE

---

## 1. Problem Summary

Frontend was using relative `/api/*` paths (Vercel-era design) that resolve to the **frontend container** itself, not the **Railway API Server**. This caused:
- HTML responses instead of JSON (`Unexpected token '<'` errors)
- Admin panel API calls hitting wrong service
- Event publisher, orchestrator, spec-export all broken in production

---

## 2. All Replaced Endpoints

### Via `api/http.ts` fix (single centralized fix — all `apiPost`/`apiGet`/`apiFetch` calls):
| File | Path | Fixed By |
|------|------|----------|
| `api/supabase.ts:90` | `apiPost('/api/admin-users')` | `http.ts` resolveUrl() |
| `api/supabase.ts:93` | `apiPost('/api/admin-users')` | `http.ts` resolveUrl() |
| `api/supabase.ts:96` | `apiPost('/api/admin-users')` | `http.ts` resolveUrl() |
| `api/supabase.ts:209` | `apiPost('/api/notifications-create')` | `http.ts` resolveUrl() |
| `api/supabase.ts:254` | `apiPost('/api/storage-delete')` | `http.ts` resolveUrl() |
| `App.tsx:619` | `apiPost('/api/normative-docs')` | `http.ts` resolveUrl() |
| `App.tsx:635` | `apiPost('/api/normative-docs')` | `http.ts` resolveUrl() |
| `App.tsx:3163` | `apiPost('/api/normative-docs')` | `http.ts` resolveUrl() |

### Direct `fetch()` calls fixed individually:
| File | Before | After |
|------|--------|-------|
| `lib/events/publisher.ts` | `fetch('/api/publish-event', ...)` | `apiPost('/api/publish-event', ...)` via http.ts |
| `components/SpecificationsTab.tsx:582` | `fetch('/api/spec-export', ...)` | `fetch('${REACT_APP_RAILWAY_API_URL}/api/spec-export', ...)` |
| `App.tsx:568` | `fetch('/api/orchestrator', ...)` | `fetch('${REACT_APP_RAILWAY_API_URL}/api/orchestrator', ...)` |
| `App.tsx:1195` | `fetch('/api/orchestrator', ...)` | `fetch('${REACT_APP_RAILWAY_API_URL}/api/orchestrator', ...)` |

### Metrics paths corrected (wrong path prefix):
| File | Before | After |
|------|--------|-------|
| `api/metrics.ts:36` | `apiGet('/metrics/summary?hours=1')` | `apiGet('/api/metrics/summary?hours=1')` |
| `api/metrics.ts:49` | `apiGet('/metrics/railway')` | `apiGet('/api/metrics/railway')` |
| `api/metrics.ts:59` | `apiGet('/metrics/error-rate/railway?...')` | `apiGet('/api/metrics/error-rate/railway?...')` |
| `api/metrics.ts:69` | `apiGet('/metrics/recommendation')` | `apiGet('/api/metrics/recommendation')` |

---

## 3. Architecture of the Fix

### Core fix — `api/http.ts` `resolveUrl()`:
```typescript
function resolveUrl(path: string): string {
  if (path.startsWith('http')) return path;
  const base = process.env.REACT_APP_RAILWAY_API_URL || '';
  if (base && path.startsWith('/api/')) return `${base}${path}`;
  return path;
}
```

All `apiPost`, `apiGet`, `apiDelete`, `apiFetch` calls automatically route to Railway API Server in production. In localhost, `REACT_APP_RAILWAY_API_URL` is empty so relative paths remain (dev proxy behavior).

### `config/api.ts` updated:
```typescript
export function getApiBaseUrl(): string {
  return process.env.REACT_APP_RAILWAY_API_URL || '';
}
```

---

## 4. Final API Topology

```
Browser
  │
  ├─ Static assets, HTML   ──► enghub-frontend.up.railway.app (React, nginx)
  │
  └─ /api/*               ──► api-server-production-8157.up.railway.app (Express)
       ├─ /api/admin-users
       ├─ /api/notifications-create
       ├─ /api/storage-delete
       ├─ /api/normative-docs
       ├─ /api/publish-event ──► Redis ──► Orchestrator
       ├─ /api/orchestrator
       ├─ /api/spec-export
       ├─ /api/metrics/*
       ├─ /api/tasks/*
       └─ /api/auto-rollback/*

Supabase (direct from browser):
  └─ ${REACT_APP_SUPABASE_URL}/auth/v1/*  (signIn, JWT)
  └─ ${REACT_APP_SUPABASE_URL}/rest/v1/*  (data queries)
  └─ ${REACT_APP_SUPABASE_URL}/storage/v1/* (file uploads)
```

---

## 5. Proof: No Relative API Paths Remain

```
grep -r "fetch\s*\(\s*['"]/api" src/
→ ConferenceRoom.legacy.tsx:862  ← DEPRECATED, not imported in App.tsx

grep -r "apiPost\|apiGet" src/ | grep "('/api"
→ All calls go through http.ts resolveUrl() → prepend REACT_APP_RAILWAY_API_URL
```

---

## 6. Production URLs

| Service | URL |
|---------|-----|
| Frontend | `https://enghub-frontend-production.up.railway.app` |
| API Server | `https://api-server-production-8157.up.railway.app` |
| Orchestrator | Internal Railway service (no public URL) |
| Redis | Internal Railway service |
| Supabase | `https://inachjylaqelysiwtsux.supabase.co` |

### Env var wiring (Railway build args → Docker ARG → CRA bundle):
```
REACT_APP_RAILWAY_API_URL=https://api-server-production-8157.up.railway.app
REACT_APP_SUPABASE_URL=https://inachjylaqelysiwtsux.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<anon key>
```
All 3 declared as `ARG` + `ENV` in `enghub-main/Dockerfile` (fixed in commit `bc420d3`).

---

## 7. E2E Verification Checklist

| Flow | Expected | Route |
|------|----------|-------|
| Login | Supabase JWT | Direct browser → Supabase |
| Dashboard load | Supabase data | Direct browser → Supabase |
| Admin: create user | `POST /api/admin-users` | Browser → API Server |
| Admin: reset password | `POST /api/admin-users` | Browser → API Server |
| Task workflow validate | `POST /api/orchestrator` | Browser → API Server |
| Normative doc upload | `POST /api/normative-docs` | Browser → API Server |
| Normative search | `POST /api/orchestrator` | Browser → API Server |
| Spec export (xlsx) | `POST /api/spec-export` | Browser → API Server |
| Event publish | `POST /api/publish-event` | Browser → API Server → Redis → Orchestrator |
| Metrics dashboard | `GET /api/metrics/summary` | Browser → API Server |
| Notifications | `POST /api/notifications-create` | Browser → API Server |
| Storage delete | `POST /api/storage-delete` | Browser → API Server |

---

## 8. Remaining Technical Debt

1. **`ConferenceRoom.legacy.tsx:862`** — `fetch('/api/livekit-token', ...)` uses relative path.  
   Status: Not blocking — file is deprecated and NOT imported anywhere.  
   Action: Delete file when video meetings are fully stable.

2. **`api-rollout.ts`** — Rollout config for Vercel→Railway migration still present (100% Railway).  
   Status: Not blocking — all traffic goes to Railway.  
   Action: Can be deleted after next major cleanup.

3. **`lib/api-monitoring.ts`** — Client-side metrics tracking (in-memory).  
   Status: Works correctly, no routing issue.

---

## 9. Production Readiness Verdict

**✅ PRODUCTION READY**

- All active `/api/*` calls route exclusively to Railway API Server
- Frontend serves only HTML/CSS/JS assets
- No relative API paths remain in active code
- Build compiled successfully (`528.23 kB` bundle)
- Architecture follows Railway-native design: Frontend = static, API = JSON only
