# AUTH LIFECYCLE FLOW

**EngHub — Auth State Machine**
**Date:** 2026-05-08

---

## States

```
BOOTING → CHECKING_SESSION → LOGGED_OUT | LOGGED_IN → (auto-refresh loop) → LOGGED_OUT
```

### BOOTING
- App renders with `authReady = false`, `token = null`
- UI shows "Загрузка..." spinner
- `sb.auth.getSession()` runs

### CHECKING_SESSION
- `getSession()` reads from Supabase JS internal storage (`enghub-anon-auth`)
- If session found → transitions to LOGGED_IN
- If no session → transitions to LOGGED_OUT
- `authReady = true` in both cases (prevents login flash)

### LOGGED_IN
- `token` = current JWT access token
- `userEmail` = authenticated email
- `onAuthStateChange` subscription is active
- Supabase JS auto-refresh runs in background (every ~50 min for a 60-min JWT)

### AUTO-REFRESH (within LOGGED_IN)
- Supabase JS fires `onAuthStateChange(SIGNED_IN, newSession)` with refreshed token
- `setToken(newSession.access_token)` → React state updated
- All subsequent API calls use fresh token
- User sees nothing — seamless

### LOGGED_OUT
- `token = null`
- `authReady = true`
- LoginPage rendered

---

## Token Flow per Request

```
Component calls get(path) / apiPost(path)
        │
        ▼
freshToken() / getAccessToken()
        │
        ▼
getSupabaseAnonClient().auth.getSession()
        │
   session.access_token  ←── Supabase JS (auto-refreshed, never stale)
        │
        ▼
HTTP request with Authorization: Bearer <token>
        │
   200 OK → return data
   401 → refreshSession() → retry once → success or throw
```

---

## onAuthStateChange Events

| Event | Trigger | App Response |
|-------|---------|-------------|
| `SIGNED_IN` | Login or token refresh | `setToken(access_token)`, `setUserEmail(email)` |
| `TOKEN_REFRESHED` | Auto-refresh by Supabase JS | `setToken(new_access_token)` |
| `SIGNED_OUT` | `signOut()` called | `setToken(null)`, `setUserEmail('')` |
| `USER_UPDATED` | Password change | Token refreshed automatically |

---

## Session Persistence Across Reloads

1. Supabase JS stores session in `localStorage['enghub-anon-auth']`
2. On page reload: `getSession()` reads from storage → hydrates token state
3. If JWT not expired: works immediately, no login required
4. If JWT expired: Supabase attempts refresh → success → LOGGED_IN; failure → LOGGED_OUT
5. `authReady` flag prevents showing login page before check completes
