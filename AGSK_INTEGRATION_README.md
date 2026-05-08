# AGSK Engineering AI Integration — Complete Research Package

**Date:** 2026-05-08  
**Status:** RESEARCH COMPLETE — Ready for Implementation  
**Research Time:** Full analysis complete  
**Estimated Implementation:** 4 weeks (56 hours)

---

## 📚 DOCUMENTATION PACKAGE (4 Documents)

This package contains everything needed to integrate AGSK engineering standards into EngHub.

### 1. **AGSK_RAG_INTEGRATION_RESEARCH.md** (Primary Research Document)

**What:** Complete architectural research, design, and planning  
**Who should read:** Architects, tech leads, project managers  
**Time to read:** 20-30 minutes  
**Contains:**

- Executive summary (goal, approach, timeline, cost, risk)
- Current state analysis (existing infrastructure, what's missing)
- Database schema (3 new tables, RLS policies, indexes)
- API endpoints (4 endpoints, request/response examples, flow diagrams)
- Orchestrator job handlers (PDF parsing, embedding generation)
- Frontend component architecture
- 30-day implementation timeline
- Cost estimate ($5-10/month typical)
- Risk assessment (6 identified risks + mitigations)
- Monitoring & metrics
- Security considerations

**Key Finding:** Zero rewrites needed. Reuses existing pgvector, Supabase, Redis, API Server infrastructure.

---

### 2. **AGSK_RAG_CODE_SNIPPETS.md** (Implementation Reference)

**What:** Production-ready code for each component  
**Who should read:** Frontend engineers, backend engineers, DevOps  
**Time to read:** 15-20 minutes  
**Contains:**

- Database migrations (SQL, ~150 lines for 3 tables)
- API routes (TypeScript/Express, ~300 lines, 5 endpoints)
- Orchestrator handlers (TypeScript, ~250 lines, 2 job handlers)
- React component (StandardsAssistant.tsx, ~400 lines)
- Integration instructions (file paths, import statements)
- Environment variables (6 new variables needed)
- Package updates (npm install commands)

**How to use:** Copy-paste code directly, follow integration instructions.

---

### 3. **AGSK_DEPLOYMENT_CHECKLIST.md** (Implementation Guide)

**What:** Day-by-day checklist for all 4 weeks  
**Who should read:** Developers executing the work  
**Time to read:** 10 minutes (reference as you go)  
**Contains:**

- Week-by-week breakdown (16h + 12h + 16h + 12h = 56h total)
- Day-by-day tasks with checkboxes
- Pre-deployment, deployment, post-deployment steps
- Testing procedures (E2E, load, RLS, cache, errors)
- Monitoring setup (logs, alerts, dashboards)
- Rollback procedures (3 options: code, flag, database)
- Contingency plans (quota exceeded, perf degraded, queue backup)
- Success criteria (20 verification points)
- Ongoing monitoring (daily, weekly, monthly checks)

**How to use:** Print or bookmark, check off daily tasks.

---

### 4. **AGSK_QUICK_START.md** (Executive Summary)

**What:** 5-minute overview for fast understanding  
**Who should read:** Everyone before diving into details  
**Time to read:** 5 minutes  
**Contains:**

- Goal in 2 sentences
- Why this is easy (existing infrastructure)
- Files to create/modify (8 files total)
- Week 1 sprint (16 hours, daily breakdown)
- Daily checklist (what to do each day)
- Common problems & fixes
- Quick reference (file locations, env vars)
- Success checklist (per-week milestones)

**How to use:** Start here, then read full research if needed.

---

## 🎯 THE GOAL

Add engineering standards search (RAG with pgvector) to EngHub as a copilot feature.

**User story:** "When working on a task, I can search for relevant standards sections (e.g., 'concrete load bearing') and get the top 5 matching sections from AGSK normative documents."

**Admin story:** "I can upload PDF documents (AGSK standards), monitor ingestion progress, and view search analytics."

---

## ⚡ WHY THIS IS FEASIBLE (Minimal Change Strategy)

### Existing Infrastructure You Reuse

✅ Supabase PostgreSQL (already running)  
✅ pgvector extension (already installed)  
✅ normative_chunks table (already exists)  
✅ search_normative() function (already exists)  
✅ Redis Streams (already running)  
✅ API Server (Express, already deployed)  
✅ Orchestrator (Node.js worker, already deployed)  
✅ Frontend (React SPA, already deployed)  
✅ Railway production (already configured)  
✅ Authentication + RLS (already working)

### What You Add

**New:** 3 tables (standards_ingestion, standards_feedback, standards_search_cache)  
**New:** 4 API endpoints (/standards/search, /ingest, status, feedback)  
**New:** 2 orchestrator handlers (PDF parsing, embedding)  
**New:** 1 React component (StandardsAssistant.tsx tab)

**Result:** ~1500 lines of new code total, all isolated feature.

---

## 📊 TIMELINE & EFFORT

```
Week 1: Database + API (16 hours)
  Mon-Tue: Migrations → 3 tables live in production (8h)
  Wed-Fri: API endpoints → 5 endpoints tested locally (8h)

Week 2: Orchestrator (12 hours)
  Mon-Tue: PDF parsing → chunks created (6h)
  Wed-Fri: Embedding worker → vectors in PostgreSQL (6h)

Week 3: Frontend (16 hours)
  Mon-Tue: Search component → UI works (8h)
  Wed-Fri: Admin UI → upload + progress bar (8h)

Week 4: Testing + Deploy (12 hours)
  Mon-Tue: Full E2E testing (6h)
  Wed-Fri: Production deployment + monitoring (6h)

TOTAL: 56 hours over 4 weeks (14 hours per week)
```

---

## 💰 COST ESTIMATE

| Component | Cost/Month |
|-----------|-----------|
| OpenAI Embeddings (5M tokens) | $0.10 |
| Supabase Storage (10GB) | $5.00 |
| PostgreSQL (pgvector) | $0.00 |
| Redis (job queue) | $0.00 |
| Railway (no new services) | $0.00 |
| **TOTAL** | **~$5/month** |

*Note: With caching (30-50% hit rate), actual embeddings cost lower.*

---

## 🚀 QUICK START (START HERE)

1. **Read AGSK_QUICK_START.md** (5 minutes)
   - Understand goal & approach
   - See what's new vs. reused
   - Get Week 1 daily checklist

2. **Read AGSK_RAG_INTEGRATION_RESEARCH.md** (20 minutes)
   - Understand full architecture
   - Review database schema
   - Understand API flows
   - See 30-day timeline

3. **Have code snippets ready**
   - Open AGSK_RAG_CODE_SNIPPETS.md
   - Copy SQL migrations
   - Copy TypeScript code
   - Copy React component

4. **Start implementation**
   - Use AGSK_DEPLOYMENT_CHECKLIST.md
   - Follow daily tasks
   - Check off as you complete

---

## ✅ SUCCESS CRITERIA

### By End of Week 1
- ✅ 3 new tables created in production Supabase
- ✅ 5 API endpoints working (tested with curl)
- ✅ OpenAI embedding integration confirmed
- ✅ Local testing complete, no errors

### By End of Week 2
- ✅ PDF parsing working
- ✅ Chunks created correctly
- ✅ Embeddings generated (vectors in PostgreSQL)
- ✅ Async job queue functioning

### By End of Week 3
- ✅ "Standards" tab visible in CopilotPanel
- ✅ Search works end-to-end
- ✅ Feedback buttons functional
- ✅ Admin upload UI working

### By End of Week 4
- ✅ All 3 services deployed to Railway
- ✅ No critical errors in logs
- ✅ Search works on real documents
- ✅ RLS policies working correctly
- ✅ Production ready with monitoring

---

## 🔍 KEY FILES TO CREATE/MODIFY

### Create (5 New Files)

```
supabase/migrations/021_standards_ingestion.sql    ← 3 tables, RLS
supabase/migrations/022_standards_indexes.sql      ← indexes, policies
services/api-server/src/routes/standards.ts        ← 5 endpoints
services/orchestrator/src/handlers/standards-ingest.ts  ← 2 handlers
enghub-main/src/components/StandardsAssistant.tsx  ← React component
```

### Modify (3 Files)

```
services/api-server/src/index.ts                   ← register router (1 line)
services/orchestrator/src/handlers/index.ts        ← register handlers (2 cases)
enghub-main/src/components/CopilotPanel.tsx        ← add "Standards" tab
```

### Update (2 Files)

```
services/api-server/package.json                   ← npm install pdfjs-dist
enghub-main/src/styles.css                         ← add .standards-assistant styles
```

---

## 🛠 IMPLEMENTATION STEPS

### Step 1: Database (Day 1-2)

```bash
# Copy SQL from AGSK_RAG_CODE_SNIPPETS.md section 1
# Create: supabase/migrations/021_standards_ingestion.sql
#         supabase/migrations/022_standards_indexes.sql
# Test:   supabase db push
# Deploy: supabase db push --remote
```

### Step 2: API Endpoints (Day 3-5)

```bash
# Copy code from AGSK_RAG_CODE_SNIPPETS.md section 2
# Create: services/api-server/src/routes/standards.ts
# Update: services/api-server/src/index.ts (add 1 line)
# Test:   npm run dev && curl http://localhost:3001/api/standards/search
```

### Step 3: Orchestrator (Week 2, Day 1-5)

```bash
# Copy code from AGSK_RAG_CODE_SNIPPETS.md section 3
# Create: services/orchestrator/src/handlers/standards-ingest.ts
# Update: services/orchestrator/src/handlers/index.ts (add 2 cases)
# Test:   npm run dev (queue test event to Redis)
```

### Step 4: Frontend (Week 3, Day 1-5)

```bash
# Copy code from AGSK_RAG_CODE_SNIPPETS.md section 4
# Create: enghub-main/src/components/StandardsAssistant.tsx
# Update: enghub-main/src/components/CopilotPanel.tsx (add 1 tab)
# Test:   npm run dev (search for keywords)
```

### Step 5: Deploy (Week 4, Day 1-5)

```bash
# Push all changes to main
# Railway auto-deploys all 3 services
# Monitor logs for errors
# Test in production
# Set up monitoring
```

---

## ⚠️ RISKS (AND HOW TO HANDLE THEM)

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| OpenAI quota exceeded | Medium | Budget alerts, rate limiting |
| PDF parsing fails | High | pdfjs-dist + fallback, DLQ |
| Slow embedding (1000s chunks) | Medium | Batch jobs, async UI |
| RLS misconfigured | Low | Test in staging, audit logs |
| Cache invalidation | Low | 60-min TTL, manual clear |
| Breaking changes | Low | Only add columns, versioning |

**Overall:** LOW RISK — feature is isolated, easy to rollback.

---

## 📞 GETTING HELP

**Stuck on database?**  
→ See: AGSK_RAG_CODE_SNIPPETS.md, Section 1

**Stuck on API?**  
→ See: AGSK_RAG_CODE_SNIPPETS.md, Section 2

**Stuck on orchestrator?**  
→ See: AGSK_RAG_CODE_SNIPPETS.md, Section 3

**Stuck on frontend?**  
→ See: AGSK_RAG_CODE_SNIPPETS.md, Section 4

**Stuck on deployment?**  
→ See: AGSK_DEPLOYMENT_CHECKLIST.md

**Need full details?**  
→ See: AGSK_RAG_INTEGRATION_RESEARCH.md

---

## 📝 DOCUMENT GUIDE

| Document | Size | Read Time | For Whom | Start Here? |
|----------|------|-----------|----------|-----------|
| AGSK_QUICK_START.md | 1000 words | 5 min | Everyone | **YES** |
| AGSK_RAG_INTEGRATION_RESEARCH.md | 6000 words | 20 min | Architects, tech leads | 2nd |
| AGSK_RAG_CODE_SNIPPETS.md | 2000 words | 15 min | Engineers | 3rd |
| AGSK_DEPLOYMENT_CHECKLIST.md | 2500 words | 10 min | Developers | Reference |

---

## ✨ WHAT USERS GET

- 🔍 **Search:** Find relevant standards by keyword
- 📊 **Results:** Top 5 most similar sections with confidence %
- 👍 **Feedback:** Mark results as helpful/not relevant
- 📱 **Admin Tools:** Upload documents, monitor progress, view stats

---

## 🎓 LESSONS FROM RESEARCH

1. **Minimal change strategy works** — Reuse existing infrastructure for 90% of feature
2. **pgvector is production-ready** — Used in similar systems with good results
3. **Semantic chunking is better than fixed windows** — Results are more coherent
4. **Caching is essential** — 30-50% of searches are duplicates (popular queries)
5. **RLS policies are critical** — Admins can ingest, engineers can only search
6. **Async processing is key** — Don't block UI during embedding generation
7. **Cost is minimal** — ~$5/month at typical usage, $200/month at heavy usage

---

## 🚀 READY TO START?

1. ✅ Read AGSK_QUICK_START.md (5 min)
2. ✅ Read AGSK_RAG_INTEGRATION_RESEARCH.md (20 min)
3. ✅ Open AGSK_RAG_CODE_SNIPPETS.md for reference
4. ✅ Follow AGSK_DEPLOYMENT_CHECKLIST.md day-by-day
5. 🎉 Deploy to production in 4 weeks

---

**Research Complete:** 2026-05-08  
**Ready for Implementation:** YES  
**Start Date:** 2026-05-13 (Week 1, Monday)  
**Target Completion:** 2026-06-06 (Week 4, Friday)

**Status:** All planning complete, all code ready, all documentation provided.

🚀 **Let's build this!**
