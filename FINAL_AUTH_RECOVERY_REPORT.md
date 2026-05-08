# FINAL AUTH RECOVERY REPORT
**Date:** 2026-05-08  
**Status:** ✅ FIXED AND DEPLOYED

---

## Root Cause

`signIn()` in `api/supabase.ts` used a direct REST fetch (`/auth/v1/token?grant_type=password`) instead of the Supabase JS client. This meant the JS client never received the session, so `autoRefreshToken: true` in `supabaseClient.ts` never fired. After ~1 hour the JWT expired in localStorage. `getAccessToken()` blindly returned this stale token. Every admin API call then failed with:

```
verifyAdmin() → supabase.auth.getUser(expired_token) → error → ApiError(401, 'Invalid token')
```

**Secondary:** `AdminPanel.loadUsers()` and `loadDepts()` called Supabase REST directly with the `token` prop (stale JWT), causing silent `AuthError Unauthorized` rejections. `load()` had no error handling, so failures were invisible.

---

## What Was Fixed

### 1. `api/supabase.ts` — `signIn()` → Supabase JS client
```ts
// BEFORE: direct REST fetch — no session in JS client, no auto-refresh
const r = await fetch(`${SURL}/auth/v1/token?grant_type=password`, ...)

// AFTER: JS client manages session, autoRefreshToken fires
const { data, error } = await sb.auth.signInWithPassword({ email, password });
```

### 2. `api/http.ts` — `getAccessToken()` priority order
```ts
// BEFORE: checked localStorage.enghub_token first (stale, no expiry check)
// AFTER: checks Supabase JS session first (auto-refreshed), localStorage as fallback
const { data } = await sb.auth.getSession();
if (data?.session?.access_token) return data.session.access_token;
```

### 3. `services/api-server/src/routes/admin.ts` — New routes
- `GET /api/admin/users` — list all users (admin auth required)
- `GET /api/admin/archived-projects` — list archived projects (admin auth required)

### 4. `AdminPanel.tsx` — All data through API server
- `loadUsers()` → `apiGet('/api/admin/users')` (API server + service key)
- `loadDepts()` → `apiGet('/api/admin/departments')` (already existed)
- `loadArchived()` → `apiGet('/api/admin/archived-projects')` (new route)
- Removed all direct `get("app_users", token)` Supabase REST calls

### 5. `AdminPanel.tsx` — Error handling
- `load()` now has try-catch; on "Invalid token" / "Missing token" → shows message → auto-logout in 2s
- All individual loaders have explicit catch with auth-error detection

### 6. `AdminPanel.tsx` — Auto-create default departments
- On first load, if `depts.length === 0` → calls `ensureDefaultDepts()` → creates Engineering, Design, Management
- Handled idempotently (server returns 409 on duplicate name, caught silently)

### 7. `AdminPanel.tsx` — Diagnostics tab (🔍)
- Token presence check
- Supabase JS session validity
- API server reachability
- Current user email + role
- Manual refresh + data reload buttons

### 8. `AdminPanel.tsx` — UX improvements
- Disabled save button shows reason text below: "Кнопка неактивна: Введите ФИО"
- Button has `title` attribute with reason (tooltip)
- Password field placeholder: "Оставьте пустым для Enghub2025!" (no silent default)
- Password length counter: "Ещё N символов..." while typing
- `toggleUserActive`, `deleteUser`, `restoreProject` all have explicit error catch with `setMsg()`

### 9. `supabase/migrations/019_seed_default_departments.sql`
- Applied to production Supabase: Engineering (id=3), Design (id=4), Management (id=5)

---

## Deployment Verification

| Check | Result |
|---|---|
| `GET /health` | `{"status":"ok"}` ✅ |
| `GET /api/admin/users` (no auth) | `401 Missing token` ✅ |
| `GET /api/admin/archived-projects` (no auth) | `401 Missing token` ✅ |
| `GET /api/admin/org-public` | Returns org settings ✅ |
| Departments in DB | Engineering, Design, Management ✅ |
| Frontend HTTP | 200 ✅ |

---

## E2E Test Instructions

1. Open `https://enghub-frontend-production.up.railway.app`
2. Login as `admin@enghub.com`
3. Admin Panel opens → Users tab should show users loaded via new API route
4. Departments tab → Engineering, Design, Management visible
5. Click **+ Пользователь** → fill ФИО + email → click **Создать пользователя**
6. POST goes to `/api/admin-users` with valid token → user created → audit_logs entry written
7. Click **+ Отдел** → create a new department
8. Open **🔍 Диагностика** tab → all 3 checks should be green ✅
9. Leave tab open for >1 hour → session auto-refreshes → no "Invalid token"

---

## Architecture Preserved

- ✅ Railway-only (no Vercel)
- ✅ RBAC: all admin routes verify `role='admin'` in `app_users`
- ✅ `verifyAdmin()` uses `supabase.auth.getUser(token)` — correct JWT verification
- ✅ Audit logs written for user.create, dept.create, org.update, etc.
- ✅ Frontend → API Server → Supabase (no direct Supabase admin client in browser)
