# AUTH FAILURE RECOVERY

**EngHub — Auth Failure Modes & Recovery**
**Date:** 2026-05-08

---

## Failure Mode 1: 401 on API Request

**Symptoms:** Admin action fails, console shows 401 / "Invalid token"

**Cause (pre-fix):** Stale `enghub_token` in localStorage used as auth header.

**Recovery (post-fix):**
1. `apiFetch()` receives 401
2. Calls `sb.auth.refreshSession()` automatically
3. Retries the request with fresh token
4. If refresh fails → error propagates; Admin panel catches it and shows "Сессия истекла"

**Manual recovery:** Re-login. `handleLogout()` → clean session, login page shown.

---

## Failure Mode 2: Session Expired After Long Idle

**Symptoms (pre-fix):** Admin page loads but all writes fail after ~1 hour.

**Why it's fixed:** `autoRefreshToken: true` in Supabase JS client. JWT refreshes ~5 min before expiry. `onAuthStateChange` keeps `token` state current. App never holds a stale token.

**Verification:** Open Diagnostics tab → "Токен истекает" shows time remaining + "Авто-обновление включено".

---

## Failure Mode 3: Page Reload Shows Login Briefly

**Symptoms (pre-fix):** Page reload flashes login screen before loading.

**Why it's fixed:** `authReady` state prevents rendering `<LoginPage>` until `getSession()` resolves. `getSession()` is near-instant (reads from local storage).

---

## Failure Mode 4: Multiple Auth Systems Conflict

**Symptoms (pre-fix):** `signIn()` created session in Supabase JS but `handleLogin()` also wrote to `enghub_token`. Two systems drifted.

**Why it's fixed:** `enghub_token` eliminated entirely. Only Supabase JS session exists. One system. No drift.

---

## Diagnostics Panel (AdminPanel → Диагностика tab)

Shows:
- ✅/❌ Supabase JS session present
- ✅/❌ Session valid
- ✅/❌ API Server reachable
- Token expiry time + minutes remaining
- Auto-refresh status

**How to access:** Login as admin → Admin Panel → Диагностика tab.

---

## Recovery Runbook

| Symptom | Action |
|---------|--------|
| "Invalid token" on any action | Check Diagnostics. If session invalid → logout + re-login. |
| Login page appears after reload | Wait for `authReady` check (< 1 second). If persists → `localStorage.clear()` + reload. |
| Admin actions fail persistently | Open DevTools → Application → localStorage → check `enghub-anon-auth` key exists. If missing → re-login. |
| "Сессия истекла. Войдите снова" message | Normal — session expired and auto-refresh failed. Re-login. |

---

## Architecture Invariants

These must always be true:
1. `localStorage.enghub_token` is NEVER written or read
2. `getSupabaseAnonClient()` is called from ONE place: `supabaseClient.ts`
3. `autoRefreshToken: true` must never be set to `false`
4. `persistSession: true` must never be set to `false`
5. `signIn()` in `supabase.ts` must use `supabase.auth.signInWithPassword()` (not raw fetch)
