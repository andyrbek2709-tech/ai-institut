# Architecture Purge Report — Vercel Decommission

**Date:** 2026-05-07  
**Commit:** d6b4df3  
**Status:** ✅ COMPLETE

---

## Summary

Vercel has been permanently decommissioned from the EngHub project.
Railway is now the sole deployment platform for all services.

---

## What Was Found

### Operational (active code with Vercel dependency)

| File | Vercel Reference | Risk |
|------|-----------------|------|
| `services/api-server/src/middleware/cors.ts` | `enghub-three.vercel.app` in CORS whitelist | API rejected frontend requests if hosted on Railway |
| `enghub-main/src/App.tsx:860` | Hardcoded `enghub-three.vercel.app/api/orchestrator` | localhost dev routed to dead Vercel URL |
| `enghub-main/src/lib/api-monitoring.ts` | `provider: 'vercel' \| 'railway'` type + Vercel metrics class | Dead monitoring code tracking non-existent provider |
| `enghub-main/src/api/metrics.ts` | `getProviderMetrics('vercel')`, `DashboardData.vercel[]` | API calls to `/metrics/vercel` (dead endpoint) |
| `enghub-main/package.json` | `"vercel-build": "react-scripts build"` | Unnecessary Vercel build hook |
| `enghub-main/vercel.json` | Full Vercel deployment config | Actively used by Vercel deploy (now deleted) |
| `enghub-main/supabase/migrations/024_api_metrics.sql` | `CHECK (provider IN ('vercel', 'railway'))` | DB allows 'vercel' in api_metrics |
| `enghub-main/supabase/migrations/025_feature_flags.sql` | `vercel_metrics` feature flag + sticky_routing constraint | DB tracks Vercel traffic routing |

### Legacy docs (not deleted — historical record only)

- `STATE.md` — multiple entries with Vercel status (kept as history)
- `AUTH_ROUTING_INCIDENT_REPORT.md`, `FINAL_PRODUCTION_REPORT.md`, etc. — historical reports

---

## What Was Eliminated

### Code Changes (commit d6b4df3)

1. **`enghub-main/vercel.json`** — DELETED
   - Was: full Vercel SPA routing + cache-control config
   - Now: does not exist

2. **`services/api-server/src/middleware/cors.ts`**
   - Was: `ALLOWED_ORIGINS` included `https://enghub-three.vercel.app`
   - Now: Railway + localhost only

3. **`enghub-main/src/App.tsx`**
   - Was: `window.location.hostname === 'localhost' ? 'https://enghub-three.vercel.app/api/orchestrator' : '/api/orchestrator'`
   - Now: `` `${process.env.REACT_APP_RAILWAY_API_URL || ''}/api/orchestrator` ``

4. **`enghub-main/src/lib/api-monitoring.ts`**
   - Was: `provider: 'vercel' | 'railway'`, dual-provider class, `getComparison()` Vercel vs Railway
   - Now: single Railway provider, simplified monitoring

5. **`enghub-main/src/api/metrics.ts`**
   - Was: `DashboardData.vercel[]`, `getProviderMetrics('vercel')`, `getErrorRate('vercel')`
   - Now: `DashboardData.railway[]` only, `getRailwayMetrics()`, `getErrorRate()`

6. **`enghub-main/package.json`**
   - Was: `"vercel-build": "react-scripts build"`
   - Now: removed

7. **`enghub-main/supabase/migrations/027_remove_vercel.sql`** — NEW MIGRATION
   - Drops `api_metrics.provider CHECK ('vercel', 'railway')` → `CHECK ('railway')`
   - Drops `sticky_routing_sessions.selected_provider CHECK ('vercel', 'railway')` → `CHECK ('railway')`
   - Deletes `vercel_metrics` feature flag row
   - Sets `api_railway_rollout` to 100%
   - Deletes any remaining vercel rows from api_metrics and sticky_routing_sessions

### Documentation Changes

8. **`CLAUDE.md`**
   - Removed: `Прод: https://enghub-three.vercel.app`
   - Removed: `Vercel: project enghub, team...`
   - Added: Rule 8 — VERCEL DECOMMISSIONED
   - Fixed: Supabase project ID corrected to `inachjylaqelysiwtsux`
   - Updated: Layout table — Railway URLs only

9. **`STATE.md`** — new entry at top documenting purge

### Memory Files

10. **`VERCEL_STATUS.md`** — NEW — canonical "never use Vercel" rule
11. **`AGENT_START_HERE.md`** — Rule 5 added: VERCEL IS DECOMMISSIONED
12. **`current_architecture.md`** — system diagram redrawn: Railway only, Vercel removed
13. **`MEMORY.md`** — new section "Decommissioned Platforms" with link to VERCEL_STATUS.md

---

## Railway API Fix (same session)

In addition to the Vercel purge, the Railway API server misconfiguration was fixed:

- **Problem:** Railway service `ENGHUB` had `rootDirectory: null` → built from repo root → root `package.json` runs `cd enghub-main && npm start` → React frontend started instead of Express API
- **Fix:** `serviceInstanceUpdate` mutation → `rootDirectory: "services/api-server"`
- **Status:** New deployment triggered (monitoring)

---

## Remaining Vercel Artifacts (non-operational)

These files still have Vercel mentions but are **legacy historical documents** — no operational impact:

| File | Nature | Action |
|------|--------|--------|
| `enghub-frontend/` directory | Entire duplicate legacy frontend directory (was supposed to be deleted earlier) | Low priority — delete in future cleanup |
| `enghub-frontend/vercel.json` | Legacy config in unused directory | Will be removed with enghub-frontend/ cleanup |
| Various `*.md` reports | Historical documentation | Keep as-is (historical record) |
| `.gitignore` entries `.vercel` | Harmless ignore pattern | Leave as-is |

---

## Proof: No Operational Vercel Dependency

```
grep -r "vercel.app" enghub-main/src/    → 0 results ✅
grep -r "vercel" enghub-main/src/        → 0 operational results ✅
grep -r "vercel" services/api-server/src/ → 0 results ✅
cat enghub-main/vercel.json              → file not found ✅
cat CLAUDE.md | grep -i vercel           → only decommission rule ✅
```

---

## Final Topology

| Service | Platform | Status |
|---------|----------|--------|
| API Server | Railway (ENGHUB project) | 🟡 Deploying (rootDirectory fixed) |
| Frontend | Railway (to be created) | 🔴 Pending |
| Orchestrator | Railway (to be created) | 🔴 Pending |
| Database | Supabase `inachjylaqelysiwtsux` | ✅ Healthy |
| Redis | Railway plugin | ✅ Online |
| **Vercel** | **DECOMMISSIONED** | **🚫 Gone** |

---

## Next Steps

1. Wait for API server Railway deploy to complete → verify `/health` returns JSON
2. Create Railway frontend service (root: `enghub-main/`)
3. Create Railway orchestrator service (root: `services/orchestrator/`)
4. Apply migration 027 to Supabase (`inachjylaqelysiwtsux`)
5. Full E2E smoke test
