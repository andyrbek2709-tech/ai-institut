# Phase 2 Architecture: Gradual API Migration

Система плавной миграции endpoints с Vercel Functions на Railway Node.js API.

## 🎯 Цель

Перенести API endpoints с Vercel на Railway **без падения системы**, используя постепенное переключение.

```
Phase 1: Foundation ✅
  ├─ Express app + Redis + Config
  ├─ Health/Ready checks
  └─ First endpoint (publish-event)

Phase 2: Proxy Layer + Frontend Routing ✅
  ├─ Supabase REST proxy
  ├─ Generic proxy endpoint
  ├─ Typed endpoints (tasks CRUD)
  └─ Frontend API provider config

Phase 3: Remaining Endpoints ⏳
  ├─ drawings, reviews, revisions
  ├─ transmittals, dependencies
  └─ admin operations

Phase 4: Full Migration ⏳
  ├─ Deploy on Railway
  ├─ Load testing
  └─ Gradual cutover (10% → 50% → 100%)
```

## 🏗️ System Architecture

### Current (Vercel-only)
```
Frontend (React)
  └─ fetch to Supabase REST API (direct)
     └─ fetch to /api/* (Vercel Functions)
```

### Phase 2 (Dual API)
```
Frontend (React)
  ├─ apiFetch() with API config
  ├─ Provider: Vercel (production default)
  └─ Provider: Railway (development/testing)
       ↓
API Server (Express on Railway)
  ├─ GET /api/tasks/:projectId (typed endpoint)
  ├─ POST /api/tasks (with event publishing)
  ├─ PATCH /api/tasks/:id (with event publishing)
  ├─ POST /api/proxy (generic Supabase proxy)
  └─ POST /api/publish-event (Redis events)
       ↓
Supabase + Redis + Orchestrator Service
```

## 🔄 Request Flow (Phase 2)

### Example: Create Task

```
1. Frontend: POST /api/tasks
   ├─ API Provider config: Railway
   ├─ Resolves to: http://localhost:3001/api/tasks
   ├─ Includes: Authorization: Bearer <JWT>
   └─ Body: { project_id, name, status, ... }

2. Railway API Server: routes/tasks.ts
   ├─ POST /api/tasks handler
   ├─ Validates: project_id, name required
   ├─ Calls: createRecord('tasks', data, token)
   │  └─ Proxy → Supabase REST: POST /rest/v1/tasks
   ├─ Gets: created task object
   ├─ Publishes: task.created event to Redis
   │  └─ XADD task-events '*' event_type task.created ...
   └─ Response: 201 { id, project_id, name, ... }

3. Orchestrator Service (listening on Redis)
   ├─ Reads: task.created event
   ├─ Processes: task_created handler
   ├─ Updates: task status, notifications, history
   └─ Done: task is ready for assignment
```

## 📦 API Server Structure

```
services/api-server/
├── src/
│   ├── index.ts                    # Express app entry
│   ├── config/
│   │   ├── environment.ts          # ENV validation
│   │   ├── redis.ts                # Redis client + healthcheck
│   │   └── supabase.ts             # Supabase URL/key config
│   ├── middleware/
│   │   ├── auth.ts                 # JWT verification + RBAC
│   │   ├── cors.ts                 # CORS headers
│   │   └── errorHandler.ts         # Error response standardization
│   ├── routes/
│   │   ├── publish-event.ts        # POST /api/publish-event (old endpoint)
│   │   ├── proxy.ts                # POST /api/proxy (generic Supabase proxy)
│   │   └── tasks.ts                # GET/POST/PATCH /api/tasks* (typed endpoints)
│   ├── services/
│   │   ├── supabase-proxy.ts       # Supabase REST API wrapper
│   │   └── (other services here)
│   └── utils/
│       ├── logger.ts               # Pino logging
│       └── errors.ts               # Custom error classes
├── Dockerfile                      # Alpine Linux, production-ready
├── docker-compose.yml              # Local dev: API + Redis
└── railway.json                    # Railway deployment config
```

## 🔌 Frontend Integration

### API Config (src/config/api.ts)

```typescript
getApiProvider()           // → 'vercel' | 'railway'
setApiProvider(provider)   // localStorage-based override
getApiBaseUrl()            // → '' (Vercel) | 'http://localhost:3001' (Railway)
```

### HTTP Wrapper (src/api/http.ts)

```typescript
apiFetch(path, opts)
  ├─ Resolves API provider
  ├─ Resolves URL: Railway → prepend baseUrl, Vercel → relative
  ├─ Gets JWT token from localStorage
  ├─ Calls fetch(url, { ...opts, headers: { Authorization: ... } })
  └─ Returns JSON | text
```

### Usage

```typescript
// Old (direct Supabase)
const tasks = await get('tasks?project_id=eq.1', token);

// New (API Server, same signature)
const tasks = await get('tasks?project_id=eq.1', token);
// Resolves to: Railway:3001/tasks?... or Vercel:/api/tasks?...
```

## 🚦 Routing Decision Tree

### Request to /api/tasks

```
apiFetch('/api/tasks')
  ├─ localStorage has 'API_PROVIDER'? → yes
  │  └─ use that (Vercel or Railway)
  │
  ├─ No, check window.location.hostname
  │  ├─ localhost? → Railway (dev default)
  │  └─ production? → Vercel (prod default)
  │
  ├─ Resolve URL
  │  ├─ Railway: http://localhost:3001/api/tasks
  │  └─ Vercel: /api/tasks (relative)
  │
  └─ Fetch with JWT + CORS headers
```

## 🔐 Security

### Authentication
- JWT tokens in Authorization header
- Tokens stored in localStorage (enghub_token)
- All endpoints require valid token

### Authorization (RBAC)
- Middleware checks token payload: `{ role, user_id, dept_id }`
- Routes validate user permissions
- Example: `PATCH /api/tasks` requires engineer or lead role

### CORS
- Allow origin: production frontend + localhost:3000 (dev)
- Allow methods: GET, POST, PATCH, DELETE
- Allow headers: Authorization, Content-Type
- Credentials: false (JWT-based, not cookie-based)

## 📊 Monitoring & Debugging

### Logs
```bash
# API Server
docker logs -f api-server

# Redis
docker exec -it redis redis-cli
XLEN task-events
XRANGE task-events - +
```

### Health Checks
```bash
curl http://localhost:3001/health    # OK → { status: ok }
curl http://localhost:3001/ready     # OK → { status: ready, redis: ok }
```

### Frontend DevTools
```javascript
// Check current API provider
localStorage.getItem('API_PROVIDER')

// Switch providers
localStorage.setItem('API_PROVIDER', 'railway')
location.reload()
```

## 🎯 Migration Strategy

### Iteration 1: Verify Phase 2 locally ✅
- Start API Server + Redis locally
- Test tasks endpoints via Postman/curl
- Test frontend switching (localStorage)
- Verify event publishing to Redis

### Iteration 2: Deploy to Railway 🔄
- Set SUPABASE_URL, SUPABASE_ANON_KEY in Railway env
- Set REDIS_URL from Upstash
- Deploy: git push → GitHub Actions → Railway
- Health checks: monitoring via Railway dashboard

### Iteration 3: Gradual frontend cutover
- Monitor error rates
- 10% of traffic → Railway (feature flag or canary)
- Verify: no 5xx errors, latency acceptable
- 50% → if metrics OK
- 100% → if still OK, remove Vercel fallback

### Iteration 4: Add remaining endpoints
- drawings, reviews, revisions, transmittals
- dependencies, admin operations
- Same pattern: create route, proxy to Supabase, publish events

## ❌ What NOT to do

1. **Don't migrate all endpoints at once** → risk of system-wide outage
2. **Don't remove Vercel while migrating** → need fallback
3. **Don't ignore event publishing** → orchestrator won't process tasks
4. **Don't skip CORS headers** → frontend will get cross-origin errors
5. **Don't forget to test auth** → will break on production

## ✅ Checklist for Phase 2

- [ ] API Server starts without errors
- [ ] GET /health returns 200
- [ ] GET /ready returns 200 + redis: ok
- [ ] POST /api/tasks creates task in Supabase
- [ ] Event published to Redis (XLEN task-events > 0)
- [ ] Frontend switches API provider via localStorage
- [ ] Frontend requests go to correct API (check Network tab)
- [ ] No CORS errors in console
- [ ] No 401 errors (auth working)
- [ ] STATE.md updated

## 📚 Related Docs

- Architecture: `/core/system-orchestrator.md`
- API Contract: `/infra/api-contract.md`
- Testing: `PHASE_2_TESTING.md`
- State: `STATE.md`

---

**Status: Phase 2 Ready for Testing**

Next: deploy to Railway + add remaining endpoints.
