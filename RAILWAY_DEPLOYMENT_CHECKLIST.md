# RAILWAY DEPLOYMENT CHECKLIST

**Quick Reference for Fixing & Deploying the System**

---

## 🔴 ISSUE #1: API Server Returns HTML (CRITICAL)

**Current:** `https://api-server-production-8157.up.railway.app/` returns React HTML  
**Root cause:** Wrong Docker image deployed  

### Fix (5 minutes)

Go to **Railway Dashboard** → **ENGHUB project**:

```
1. Find service: "api-server-production-8157"
2. Delete it OR update settings:
   - GitHub Repo: andyrbek2709-tech/ai-institut
   - Branch: main
   - Root Directory: services/api-server/
   - Dockerfile: services/api-server/Dockerfile

3. Add Environment Variables:
   - REDIS_URL (auto-assigned by Railway)
   - SUPABASE_URL: https://jbdljdwlfimvmqybzynv.supabase.co
   - SUPABASE_ANON_KEY: (copy from Supabase dashboard → Settings → API)
   - SUPABASE_SERVICE_KEY: (copy from Supabase dashboard → Settings → API)
   - NODE_ENV: production
   - PORT: 3000

4. Deploy → Wait for "Running" status

5. Verify:
   curl https://{new-api-url}/ 
   → Should return: {"name": "EngHub API Server", "status": "running", ...}
   
   curl https://{new-api-url}/health
   → Should return: {"status": "ok", ...}
   
   curl https://{new-api-url}/ready
   → Should return: {"status": "ready", "redis": "ok", ...}
```

⏰ **Time:** ~3-5 minutes (Docker build + health checks)

---

## 📦 ISSUE #2: Frontend Not Deployed

**Current:** No Railway service  
**Expected:** `https://enghub-frontend-xxxxx.up.railway.app/`

### Deploy (10 minutes)

Go to **Railway Dashboard** → **ENGHUB project** → **New Service**:

```
1. "Deploy from GitHub"

2. Connect repo:
   - Repo: andyrbek2709-tech/ai-institut
   - Branch: main

3. Configure:
   - Service name: enghub-frontend
   - Root Directory: enghub-main/
   - Framework: (auto-detect Docker)

4. Add Environment Variables:
   - REACT_APP_SUPABASE_URL: https://jbdljdwlfimvmqybzynv.supabase.co
   - REACT_APP_SUPABASE_ANON_KEY: (copy from Supabase → Settings → API)
   - REACT_APP_RAILWAY_API_URL: https://{your-new-api-server-url}
   
   Example: https://enghub-api-server-xxxxx.up.railway.app

5. Deploy → Wait for "Running" status

6. Verify:
   https://{frontend-url}/
   → Should load React app (HTML with <div id="root">)
   
   Open F12 (Developer Tools) → Console
   → Should see no errors (no 404 on api endpoints)
```

⏰ **Time:** ~5-10 minutes (Docker build + serve startup)

---

## 🎯 ISSUE #3: Orchestrator Not Deployed (Optional but Recommended)

**Current:** No Railway service  
**Purpose:** Background event processor (task approvals, auto-unblock, deadline escalations)

### Deploy (10 minutes)

Go to **Railway Dashboard** → **ENGHUB project** → **New Service**:

```
1. "Deploy from GitHub"

2. Connect repo:
   - Repo: andyrbek2709-tech/ai-institut
   - Branch: main

3. Configure:
   - Service name: enghub-orchestrator
   - Root Directory: services/orchestrator/

4. Add Environment Variables:
   - REDIS_URL (auto-assigned)
   - SUPABASE_URL: https://jbdljdwlfimvmqybzynv.supabase.co
   - SUPABASE_SERVICE_KEY: (copy from Supabase → Settings → API)
   - LOG_LEVEL: info
   - CONSUMER_GROUP_NAME: orchestrator-v1

5. Deploy → Wait for "Running" status

6. Verify in Logs:
   Should see: "Waiting for events on stream: task-events"
```

⏰ **Time:** ~5-10 minutes (Nixpacks build + startup)

---

## ✅ VERIFICATION CHECKLIST (After All Deployed)

### Step 1: Frontend Login (3 minutes)

```
1. Go to https://{frontend-url}/
2. Login with:
   - Email: admin@enghub.com  OR  skorokhod.a@nipicer.kz
   - Password: 123456  OR  (admin's original password)
3. Expected: Dashboard loads, can see "Tasks" tab
4. Check console (F12): No errors
```

### Step 2: API Connectivity (3 minutes)

```
1. Open browser console (F12)
2. Run this command:
   fetch('https://{api-server-url}/api/metrics/summary')
     .then(r => r.json())
     .then(d => console.log('✅ API works:', d))
     .catch(e => console.error('❌ Error:', e))
     
3. Expected: See metrics data (not HTML error)
```

### Step 3: Task Creation E2E (5 minutes)

```
1. In frontend, go to project
2. Click "+ New Task"
3. Fill form → Submit
4. Expected: Task appears in list
5. Check Network tab (F12 → Network):
   - Request to {api-server-url}/api/tasks/{projectId}
   - Response: 200 OK (JSON, not HTML)
```

### Step 4: Task Approval (if Orchestrator deployed)

```
1. Create task as Engineer role
2. Submit for review
3. Login as Lead (pravdukhin.a@nipicer.kz / 123456)
4. Approve task in review tab
5. Expected: Task status changes to approved in database
6. Check Orchestrator logs: "Processing event: task.approved"
```

---

## 📊 EXPECTED OUTCOMES

After completing checklist:

| Component | Status | URL |
|-----------|--------|-----|
| Frontend | ✅ Running | `https://enghub-frontend-xxxxx.up.railway.app/` |
| API Server | ✅ Running | `https://enghub-api-server-xxxxx.up.railway.app/` |
| Orchestrator | ✅ Running (logs only) | Internal service |
| Database | ✅ Ready | `jbdljdwlfimvmqybzynv.supabase.co` |
| Redis | ✅ Connected | Railway plugin |

**System operational:** Users can login, create tasks, submit for review, approve, system auto-processes.

---

## ⏱️ TOTAL TIME ESTIMATE

| Task | Time |
|------|------|
| Fix API Server | 5 min |
| Deploy Frontend | 10 min |
| Deploy Orchestrator | 10 min |
| E2E Testing | 10 min |
| **TOTAL** | **~35 minutes** |

---

## 🚨 CRITICAL NOTES

1. **Vercel is GONE** — do not reference it, all compute on Railway
2. **Environment variables** — must match between services
3. **SUPABASE_URL must be:** `https://jbdljdwlfimvmqybzynv.supabase.co` (EngHub project)
4. **API Server URL** — update Frontend env var when creating new API service
5. **Redis connection** — Railway auto-assigns REDIS_URL, no need to configure manually

---

## 🔗 REFERENCE LINKS

- Supabase Dashboard: https://app.supabase.com/project/jbdljdwlfimvmqybzynv
- GitHub Repo: https://github.com/andyrbek2709-tech/ai-institut
- Full Report: `RAILWAY_ONLY_DEPLOYMENT_REPORT.md` (this directory)

---

**Created:** 2026-05-06 23:00 UTC  
**Status:** Ready for execution
