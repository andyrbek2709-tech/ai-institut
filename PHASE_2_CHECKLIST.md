# Phase 2: Core Endpoints Checklist

**Goal:** Migrate task management endpoints and admin operations to get orchestrator integration working.

**Estimated time:** 2-3 days  
**Priority:** HIGH — Needed for full orchestrator functionality

## Prerequisites ✅

Before starting Phase 2:
- [ ] Read `/services/api-server/IMPLEMENTATION_STATUS.md` (current state)
- [ ] Read `/services/api-server/DEVELOPMENT_GUIDE.md` (how to add endpoints)
- [ ] Read `/services/api-server/MIGRATION_PLAN.md` (overall strategy)

## Phase 2.1: Local Setup (30 min)

```bash
cd services/api-server
npm install
npm run build
npm run typecheck  # Should pass
docker-compose up
```

Test that everything works:
```bash
# In another terminal
curl http://localhost:3000/health
curl http://localhost:3000/ready

# Test publish-event
curl -X POST http://localhost:3000/api/publish-event \
  -H "Content-Type: application/json" \
  -d '{"event_type": "task.created", "task_id": "123"}'
```

- [ ] Health check returns 200
- [ ] Ready check returns 200 with redis: "ok"
- [ ] publish-event works and shows success

## Phase 2.2: Endpoint 1 — Create Task (4-6h)

**File:** `enghub-main/api/tasks.js` (if exists) or use api-contract spec

**What to migrate:**
- `POST /api/tasks` — Create task with validation

**Steps:**
1. Create `src/routes/tasks.ts` (see DEVELOPMENT_GUIDE.md example)
2. Create `src/services/taskService.ts` with `createTask()` method
3. Implement:
   - Input validation (title, project_id, assignee_id)
   - Supabase insert with RLS
   - Publish `task.created` event to Redis
   - Return created task (id, status, etc.)
4. Register route in `src/index.ts`

**Testing:**
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test task",
    "project_id": "proj_123",
    "assignee_id": "user_456"
  }'
```

- [ ] Returns 201 with task object
- [ ] Event appears in Redis: `docker exec ... redis-cli XRANGE task-events - +`
- [ ] Task appears in Supabase

**File to check:** `/infra/api-contract.md` (Task entity definition, POST /tasks spec)

## Phase 2.3: Endpoint 2 — Update Task Status (3-4h)

**File:** `enghub-main/api/tasks.js` or API contract

**What to migrate:**
- `PATCH /api/tasks/:id` — Update task status (triggers state machine)

**Steps:**
1. Add method to `src/services/taskService.ts`: `updateTaskStatus()`
2. Implement:
   - Fetch current task
   - Validate status transition (use state machine rules from orchestrator)
   - Update in Supabase
   - Publish appropriate event (task.submitted_for_review, task.approved, etc.)
   - Increment counters if needed (rework_count, etc.)
3. Add route in `src/routes/tasks.ts`

**Testing:**
```bash
# Create task first, then update it
curl -X PATCH http://localhost:3000/api/tasks/task_id_here \
  -H "Content-Type: application/json" \
  -d '{"status": "review_lead"}'
```

- [ ] Returns 200 with updated task
- [ ] Event published to Redis (task.submitted_for_review or similar)
- [ ] Status validation works (can't skip states)
- [ ] Orchestrator processes the event

**File to check:** `/core/system-orchestrator.md` (state transitions)

## Phase 2.4: Endpoint 3 — List Tasks with Filters (2-3h)

**File:** `enghub-main/api/tasks.js` (if exists)

**What to migrate:**
- `GET /api/tasks` — List tasks with filtering, pagination

**Steps:**
1. Add method to `src/services/taskService.ts`: `listTasks()`
2. Implement:
   - Supabase query with filters (status, assignee_id, project_id, etc.)
   - Pagination (offset/limit)
   - Sorting (created_at, deadline, status, etc.)
   - RLS enforcement (only return tasks user has access to)
3. Add route in `src/routes/tasks.ts`

**Testing:**
```bash
curl 'http://localhost:3000/api/tasks?project_id=proj_123&status=created&limit=20'
```

- [ ] Returns array of tasks
- [ ] Filters work correctly
- [ ] Pagination works
- [ ] RLS enforced (user only sees their tasks)

## Phase 2.5: Endpoint 4 — Admin User Management (5-7h)

**File:** `enghub-main/api/admin-users.js`

**What to migrate:**
- `POST /api/admin-users` with actions: create, reset_password, update_role

**Steps:**
1. Create `src/routes/admin.ts`
2. Create `src/services/adminService.ts` with methods:
   - `createUser()` — Create auth user + app_users profile
   - `resetPassword()` — Change user password via Supabase Auth Admin API
   - `updateUserRole()` — Update role + sync metadata
3. Implement:
   - Auth check (require admin role)
   - Validation of inputs
   - Supabase Auth admin operations
   - Error handling (email unique, password strength, etc.)
4. Register in `src/index.ts`

**Testing:**
```bash
# Create user (requires auth token)
curl -X POST http://localhost:3000/api/admin-users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "email": "test@example.com",
    "password": "Test123456",
    "full_name": "Test User",
    "role": "engineer"
  }'
```

- [ ] Create user works
- [ ] Reset password works
- [ ] Update role works
- [ ] Only admin can call (auth check)
- [ ] Error handling for invalid inputs

**File to check:** `enghub-main/api/admin-users.js` (full implementation)

## Phase 2.6: Storage Endpoints (2-3h)

**Files:** `enghub-main/api/storage-sign-url.js`, `storage-delete.js`

**What to migrate:**
- `POST /api/storage-sign-url` — Generate signed upload URL
- `DELETE /api/storage/:file_id` — Delete file

**Steps:**
1. Create `src/routes/storage.ts`
2. Create `src/services/storageService.ts`:
   - `getSignedUploadUrl()` — Return URL for frontend uploads
   - `deleteFile()` — Delete from Supabase Storage
3. Add routes

**Testing:**
```bash
curl -X POST http://localhost:3000/api/storage-sign-url \
  -H "Content-Type: application/json" \
  -d '{"bucket": "task-attachments", "file_name": "test.pdf"}'
```

- [ ] Returns signed URL (starts with https://...)
- [ ] URL works for actual upload
- [ ] Delete removes file from storage

**File to check:** `enghub-main/api/storage-sign-url.js`

## Phase 2.7: Integration Testing (4h)

Once all endpoints are migrated, test the full flow:

```
1. Create task (POST /api/tasks)
2. Upload file (POST /api/storage-sign-url + frontend upload)
3. Attach file (PATCH /api/tasks/:id with attachment_id)
4. Submit for review (PATCH /api/tasks/:id with status=review_lead)
   → Event published to Redis
5. Orchestrator processes event
   → Notifies lead
   → Updates database
6. List tasks (GET /api/tasks) — should see updated status
```

- [ ] End-to-end flow works
- [ ] Events reach Orchestrator
- [ ] Database updates correctly
- [ ] No data loss
- [ ] Error handling works

## Phase 2.8: Code Review & Cleanup (2h)

- [ ] All TypeScript types are correct (`npm run typecheck`)
- [ ] No console.log (use logger instead)
- [ ] Error messages are user-friendly (no stack traces)
- [ ] Logging is comprehensive (important operations logged)
- [ ] Code follows patterns from DEVELOPMENT_GUIDE.md
- [ ] No duplicate code

```bash
npm run typecheck
npm run lint
npm run build
```

## Phase 2.9: Prepare for Deployment (1h)

- [ ] All env vars documented in `.env.example`
- [ ] Health checks still work
- [ ] Docker image builds successfully
- [ ] railway.json is correct

```bash
docker build -t api-server .
docker run -p 3000:3000 \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  api-server
curl http://localhost:3000/health
```

## Success Criteria ✅

At the end of Phase 2, you should have:

- [ ] 6 endpoints fully migrated (tasks CRUD + admin + storage)
- [ ] All endpoints tested locally
- [ ] Event publishing working (→ Orchestrator processes them)
- [ ] Zero breaking changes to frontend
- [ ] Comprehensive logging in all code
- [ ] All TypeScript errors fixed
- [ ] Documentation updated with endpoint examples

## Timeline

| Task | Duration | Status |
|------|----------|--------|
| 2.1 Local setup | 30 min | ⏳ |
| 2.2 Create task | 4-6h | ⏳ |
| 2.3 Update task | 3-4h | ⏳ |
| 2.4 List tasks | 2-3h | ⏳ |
| 2.5 Admin users | 5-7h | ⏳ |
| 2.6 Storage | 2-3h | ⏳ |
| 2.7 Integration test | 4h | ⏳ |
| 2.8 Code review | 2h | ⏳ |
| 2.9 Deployment prep | 1h | ⏳ |
| **Total** | **24-32h** | **~3 days** |

## Files to Reference

- **API Spec:** `/infra/api-contract.md` (1600+ lines, all endpoint defs)
- **System Arch:** `/core/system-orchestrator.md` (state machine, events)
- **Dev Guide:** `/services/api-server/DEVELOPMENT_GUIDE.md` (patterns)
- **Migration Plan:** `/services/api-server/MIGRATION_PLAN.md` (full roadmap)
- **Current Source:** `/enghub-main/api/*.js` (what to migrate from)

## Questions?

If stuck:
1. Check DEVELOPMENT_GUIDE.md "Common Patterns" section
2. Look at existing endpoint: `src/routes/publish-event.ts`
3. Check error logs: `docker-compose logs api-server`
4. Debug in Redis: `docker exec ... redis-cli`

## Next Phase (Phase 3)

After Phase 2 is complete and tested:
- Notifications endpoints (notifications-create, telegram)
- Activity log endpoint
- Weekly digest endpoint

And Phase 4:
- Advanced endpoints (orchestrator AI, spec export, etc.)
- WebSocket implementation for real-time updates
- Deployment to Railway + frontend migration

---

**Let's build this! 🚀**
