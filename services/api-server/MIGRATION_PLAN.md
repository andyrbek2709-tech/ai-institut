# API Server Migration Plan

**Goal:** Move all Vercel serverless functions to a unified Node.js Express backend on Railway.

## Current State (2026-05-05)

**Vercel Functions** (in `/enghub-main/api/`):
- `publish-event.js` ✅ Already migrated to `/services/api-server/src/routes/publish-event.ts`
- 16 remaining endpoints to migrate

## Endpoints to Migrate

### Phase 1: Core Event Publishing ✅ DONE
- **publish-event** (already moved)

### Phase 2: Task Management (HIGH PRIORITY)
Needed for orchestrator integration:

| Endpoint | Dependencies | Complexity | Notes |
|----------|---|---|---|
| POST /api/tasks | Supabase (app_users, projects, tasks) | Medium | Task creation with validation |
| PATCH /api/tasks/:id | Supabase, Redis events | Medium | Status changes trigger events |
| GET /api/tasks | Supabase RLS | Low | Task filtering + pagination |

**Files to migrate:**
- Create: `src/routes/tasks.ts`
- Create: `src/services/taskService.ts`

### Phase 3: User & Admin Operations (MEDIUM PRIORITY)
Required for admin panel:

| Endpoint | Dependencies | Complexity | Notes |
|----------|---|---|---|
| admin-users | Supabase Auth Admin API | High | Create, reset password, update role |
| admin | RLS policies, user metadata | Medium | Admin-only operations |

**Files to migrate:**
- Create: `src/routes/admin.ts`
- Create: `src/services/adminService.ts`

### Phase 4: File Management (MEDIUM PRIORITY)
Support for uploads/downloads:

| Endpoint | Dependencies | Complexity | Notes |
|----------|---|---|---|
| storage-sign-url | Supabase Storage | Low | Generate signed URLs for uploads |
| storage-delete | Supabase Storage | Low | Delete files from storage |

**Files to migrate:**
- Create: `src/routes/storage.ts`
- Create: `src/services/storageService.ts`

### Phase 5: Notifications & Communication (MEDIUM PRIORITY)
For task notifications:

| Endpoint | Dependencies | Complexity | Notes |
|----------|---|---|---|
| notifications-create | Supabase, Telegram | Low | Create in-app + email notifications |
| telegram | Telegram Bot API | Low | Send Telegram messages |

**Files to migrate:**
- Create: `src/routes/notifications.ts`
- Create: `src/services/notificationService.ts`

### Phase 6: Advanced Features (LOW PRIORITY)
Can be migrated after core functionality works:

| Endpoint | Dependencies | Complexity | Notes |
|----------|---|---|---|
| orchestrator | OpenAI, Anthropic, Supabase | Very High | AI Copilot (700+ lines, complex logic) |
| activity-log | Supabase | Low | Query activity history |
| weekly-digest | Supabase, Email | Medium | Generate + send digests |
| spec-export | Supabase, docx library | Medium | Export specifications to Word |
| catalog-parse | External parsing | Medium | Parse normative documents |
| normative-docs | Supabase | Low | Query normative database |
| meeting-token | LiveKit SDK | Low | Generate video meeting tokens |
| transcribe | OpenAI Whisper | Medium | Audio transcription |

**Files to migrate:**
- Create: `src/routes/advanced.ts`
- Create: `src/services/orchestratorService.ts`
- Create: `src/services/exportService.ts`
- etc.

## Migration Strategy

### Step 1: Set up build + run locally
```bash
cd services/api-server
npm install
npm run build
docker-compose up
```

### Step 2: Migrate by phase
Each phase:
1. Create route file (`src/routes/*)
2. Create service file (`src/services/*`)
3. Register route in `src/index.ts`
4. Test locally with curl/Postman
5. Test with frontend (if applicable)

### Step 3: Verify integration
- [ ] API endpoints work locally
- [ ] Events publish to Redis
- [ ] Orchestrator processes events
- [ ] Database updates happen correctly
- [ ] Errors are handled gracefully

### Step 4: Deploy to Railway
1. Push to Git
2. Railway auto-deploys
3. Verify with health checks
4. Switch frontend API calls

## Testing Checklist

For each endpoint:
- [ ] Happy path works
- [ ] Error handling (missing params, unauthorized, etc.)
- [ ] Logging is clear
- [ ] Performance is acceptable (<200ms typical)
- [ ] No breaking changes to frontend

## Frontend Update Checklist

Once API server is deployed:
1. [ ] Update API URLs from Vercel to Railway
2. [ ] Test each feature that uses API
3. [ ] Monitor errors in Sentry
4. [ ] Keep Vercel as fallback initially
5. [ ] Once stable, fully migrate

## Timeline Estimate

| Phase | Endpoints | Est. Time | Effort |
|-------|-----------|-----------|--------|
| 1 | publish-event | ✅ Done | - |
| 2 | tasks (3) | 2-4h | Medium |
| 3 | admin-users, admin (2) | 3-5h | High |
| 4 | storage (2) | 1-2h | Low |
| 5 | notifications (2) | 2-3h | Low |
| 6 | Advanced (7) | 8-12h | High |
| **Total** | **17** | **16-26h** | - |

**Recommended approach:**
- Sprint 1: Phases 1-4 (core + admin) — ~10-15h
- Sprint 2: Phases 5-6 (notifications + advanced) — ~10-15h

## Rollback Plan

If issues arise:
1. Vercel functions remain untouched
2. Frontend still has `/api/*` routes pointing to Vercel
3. Gradual cutover: route-by-route
4. Keep feature flags for API endpoint selection

## Notes

- All endpoints **must** be TypeScript for type safety
- Reuse logic from Vercel functions, don't rewrite
- Add comprehensive logging
- Test with Redis consumer (Orchestrator)
- Document any breaking changes
