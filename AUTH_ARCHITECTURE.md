# AUTH ARCHITECTURE

**EngHub — Normalized Auth Architecture**
**Date:** 2026-05-08
**Status:** CANONICAL

---

## Single Source of Truth

**One auth authority: Supabase JS Client (`@supabase/supabase-js`)**

Configured in `enghub-main/src/api/supabaseClient.ts`:
```ts
createClient(SURL, ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,        // ← core: JWT refreshes automatically
    storageKey: 'enghub-anon-auth',
  },
})
```

The Supabase JS client stores the session in `localStorage['enghub-anon-auth']` and auto-refreshes the JWT ~5 minutes before expiry. No other auth storage exists.

---

## Auth Flow

### Login
1. `LoginPage.tsx` → `signIn(email, password)` in `supabase.ts`
2. `signIn()` calls `supabase.auth.signInWithPassword()` → Supabase JS stores session
3. `onAuthStateChange` fires → `App.tsx` updates `token` state
4. `handleLogin` in `App.tsx` navigates to dashboard

### Session Hydration (page reload)
1. `App.tsx` `useEffect` calls `sb.auth.getSession()` on mount
2. If session exists (stored in `enghub-anon-auth`): sets `token` + `userEmail`, marks `authReady`
3. If no session: `authReady = true`, `token = null` → login page shown

### Token Auto-Refresh
- Supabase JS client automatically refreshes the session ~5 min before expiry
- `onAuthStateChange` fires with refreshed session → `setToken(session.access_token)` → React state stays current
- All API calls in `App.tsx` use the current `token!` state (always fresh)

### Logout
1. `handleLogout()` in `App.tsx`:
   - Immediately clears `token` + `userEmail` state (instant UI response)
   - Calls `getSupabaseAnonClient().auth.signOut()` (async, fire-and-forget)
   - Clears UI preferences from localStorage
2. `onAuthStateChange` fires with `null` session (redundant but safe)

---

## Module Responsibilities

| File | Responsibility |
|------|---------------|
| `src/api/supabaseClient.ts` | Single Supabase JS client instance. `autoRefreshToken: true`. |
| `src/auth/AuthManager.ts` | Centralized auth lifecycle: `getToken()`, `subscribe()`, `signOut()`, `initialize()`. Available for future use by non-component code. |
| `src/api/http.ts` | `apiFetch()`: fetches fresh token from Supabase JS session. 401 → refresh → retry once. No localStorage reads. |
| `src/api/supabase.ts` | Supabase REST helpers. `get/post/patch/del` auto-fetch token when none provided via `freshToken()`. |
| `src/App.tsx` | Auth state: `token` + `authReady`. Initialized from session; kept fresh via `onAuthStateChange`. `handleLogin/handleLogout` are simple. |

---

## What Was Removed

| Removed | Why |
|---------|-----|
| `localStorage.enghub_token` reads | Stale after JWT expiry (1hr). Root cause of "Invalid token". |
| `localStorage.enghub_token` writes | No longer needed — Supabase JS manages session. |
| `http.ts` localStorage fallback | Fell back to expired token when Supabase session unavailable. |
| Manual token params in `CopilotPanel.tsx` | `get/post/patch` auto-fetch now. |
| `getSupabaseAdminClient` import in `App.tsx` | Was alias for anon client anyway; renamed to `getSupabaseAnonClient` for clarity. |

---

## Security Properties

- No JWT ever stored in `enghub_token` key (eliminated)
- Supabase JS manages session in `enghub-anon-auth` (scoped, auto-cleaned on signOut)
- Admin operations go through API server (service key) — not direct Supabase REST with user JWT
- RLS enforced at DB level — anon client respects row-level security
