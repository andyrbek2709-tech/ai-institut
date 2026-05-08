# AGSK Frontend Auth System Fix — Browser Validation Test Plan

**Commit:** 5dfa815 fix(agsk): Frontend Auth System Repair — Critical 401 Unauthorized Bug Fixed
**Date:** 2026-05-09 23:50 UTC
**Environment:** Production (Railway)

## Critical Bug Fixed

**Root Cause:** fetch() calls missing Authorization headers in:
- CopilotPanel.tsx (/api/orchestrator)
- DrawingsPanel.tsx (/api/orchestrator analyze_drawing)
- MeetingsPanel.tsx (/api/transcribe)

**Solution:** Added Bearer token injection to all fetch headers

---

## Test Execution Plan

### PHASE 1: LOGIN FLOW (5 min)

**Objective:** Verify login button sends request and succeeds

**Steps:**
1. Open https://enghub-frontend-production.up.railway.app
2. You should see EngHub login page (if not logged in)
3. Enter credentials:
   - Email: `admin@enghub.com` (or any valid test user)
   - Password: (use correct password)
4. Click "Войти →" button
5. Observe:
   - ✅ Button should NOT be stuck/disabled
   - ✅ Request should be sent (check DevTools Network tab)
   - ✅ Should redirect to dashboard
   - ✅ No error messages

**Expected Result:** ✅ Login succeeds, dashboard loads

---

### PHASE 2: SESSION PERSISTENCE (3 min)

**Objective:** Verify session survives F5 refresh

**Steps:**
1. After successful login, you should be on dashboard
2. Open DevTools Console (F12 → Console tab)
3. Press F5 (refresh page)
4. Observe:
   - ✅ Page should NOT show login screen
   - ✅ Should remain on dashboard
   - ✅ userEmail should persist in localStorage (check: localStorage.enghub_email)
   - ✅ Token should be in Supabase session (check: localStorage.enghub-anon-auth)

**Expected Result:** ✅ Session persists, no relogin required

---

### PHASE 3: NO INFINITE 401 LOOP (2 min)

**Objective:** Verify no infinite 401 refresh loop

**Steps:**
1. Keep dashboard open
2. Open DevTools Network tab (F12 → Network)
3. Look for any 401 responses
4. Observe:
   - ✅ No repeated 401 errors
   - ✅ API responses should be 200/201/204 (success)
   - ✅ If 401 occurs, should be ONE-TIME, followed by refresh, then success

**Expected Result:** ✅ No infinite loop, requests succeed

---

### PHASE 4: RETRIEVAL QUERIES (Russian) (5 min)

**Objective:** Verify retrieval system works with authorization

**Steps:**
1. Navigate to "Standards Retrieval" (if available in UI, or check for retrieval endpoint)
2. Try Russian query: "Расчет железобетонных конструкций"
3. Click "Search" button
4. Observe DevTools Network tab:
   - ✅ POST /api/agsk/search should be 200 (not 401)
   - ✅ Authorization header should be present: `Authorization: Bearer [TOKEN]`
   - ✅ Response should contain search results

**Expected Result:** ✅ Retrieval queries return results (not 401)

---

### PHASE 5: COPILOT AI PANEL (3 min)

**Objective:** Verify CopilotPanel requests have authorization

**Steps:**
1. Navigate to CopilotPanel (if visible in UI)
2. Try any query: "Риски проекта" or "Анализ задач"
3. Send message
4. Observe DevTools Network tab:
   - ✅ POST /api/orchestrator should be 200 (not 401)
   - ✅ Authorization header should be present: `Authorization: Bearer [TOKEN]`
   - ✅ Response should contain AI message

**Expected Result:** ✅ CopilotPanel requests authorized

---

### PHASE 6: DRAWING ANALYSIS (if available)

**Objective:** Verify DrawingsPanel analyze_drawing request authorized

**Steps:**
1. Go to Чертежи (Drawings) tab
2. Try to analyze a drawing (if feature available)
3. Upload or select an image file
4. Observe DevTools Network tab:
   - ✅ POST /api/orchestrator (action: analyze_drawing) should be 200 (not 401)
   - ✅ Authorization header should be present

**Expected Result:** ✅ Drawing analysis request authorized

---

## Success Criteria (ALL must pass)

| Test | Expected | Status |
|------|----------|--------|
| Login button sends request | ✅ Request sent, redirect to dashboard | |
| Session persists after F5 | ✅ Remain logged in, no relogin | |
| No infinite 401 loop | ✅ No repeated 401 errors | |
| Retrieval query (Russian) | ✅ Returns results (200, not 401) | |
| Authorization header present | ✅ All /api/* requests have Bearer token | |
| CopilotPanel works | ✅ Requests succeed (not 401) | |
| DrawingsPanel analysis (if available) | ✅ Requests succeed (not 401) | |

---

## Troubleshooting

**If login button doesn't respond:**
- Check if handleLogin is firing (DevTools → Sources → breakpoint on handleLogin)
- Verify signIn() returns access_token (CopilotPanel.tsx line 23)
- Check browser console for errors

**If session is lost on F5:**
- Check localStorage: should have `enghub-anon-auth` (Supabase session) and `enghub_email`
- Verify App.tsx useEffect is calling getSession() on mount
- Check DevTools → Application → LocalStorage

**If 401 loop occurs:**
- Check that token is being retrieved: search console for `[TRACE] getAccessToken: TOKEN_RETRIEVED`
- Verify http.ts apiFetch() is getting fresh token (not stale)
- Check that refresh token logic is not retrying infinitely

**If retrieval returns 401:**
- Check Authorization header is present in Network tab
- Verify token is valid (not expired, not empty)
- Check /api/agsk/search endpoint on API server is working

---

## After Tests Pass

1. ✅ Update STATE.md: mark test phase as complete
2. ✅ Verify no infinite 401 loops in production
3. ✅ Mark AGSK AUTH FIX as READY FOR PILOT
4. ✅ Proceed with AGSK Pilot Program operations

---

## Notes

- All auth is managed by Supabase JS Client (`enghub-anon-auth` localStorage key)
- Token auto-refresh happens ~5 min before expiry (autoRefreshToken: true)
- No manual token management — let Supabase JS client handle it
- All /api/* requests should use apiFetch() or manually add Authorization header
