# AGSK RAG Integration — 30-Day Deployment Checklist

**Date:** 2026-05-08  
**Status:** Ready for Implementation  
**Total Effort:** 56 hours across 4 weeks

---

## WEEK 1: DATABASE & API (16 hours)

### Day 1-2: Schema Migrations (8 hours)

- [ ] **Migrations created**
  - [ ] `supabase/migrations/021_standards_ingestion.sql` (3 tables + RLS)
  - [ ] `supabase/migrations/022_standards_indexes.sql` (indexes + policies)

- [ ] **Local testing**
  - [ ] Install Supabase CLI: `npm install -g supabase`
  - [ ] Test migrations locally: `supabase db push`
  - [ ] Verify tables exist: `SELECT table_name FROM information_schema.tables`
  - [ ] Test RLS: `SELECT * FROM standards_ingestion` (should be empty for non-auth)

- [ ] **Production deployment**
  - [ ] Connect to prod Supabase: `supabase db push --remote`
  - [ ] Verify 3 tables created in prod
  - [ ] Verify indexes created: `SELECT * FROM pg_stat_user_indexes`
  - [ ] Verify RLS policies: `SELECT polname FROM pg_policy WHERE tablename LIKE 'standards%'`

### Day 3-5: API Endpoints (8 hours)

- [ ] **Endpoint implementation**
  - [ ] Create `services/api-server/src/routes/standards.ts`
  - [ ] POST /api/standards/search (with OpenAI embedding)
  - [ ] POST /api/standards/ingest (queue to Redis)
  - [ ] GET /api/standards/ingest/:id (poll status)
  - [ ] POST /api/standards/feedback (save feedback)
  - [ ] GET /api/standards/status (admin stats)

- [ ] **Register router in API Server**
  - [ ] Update `services/api-server/src/index.ts`
  - [ ] Import standardsRouter
  - [ ] Add `app.use('/api', standardsRouter)`

- [ ] **Environment variables**
  - [ ] Add OPENAI_API_KEY to .env (local)
  - [ ] Add STANDARDS_EMBEDDING_MODEL (local)
  - [ ] Add STANDARDS_MAX_CHUNKS_PER_JOB (local)

- [ ] **Local testing**
  - [ ] `npm run dev` in api-server
  - [ ] Test POST /api/standards/search with curl:
    ```bash
    curl -X POST http://localhost:3001/api/standards/search \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{"query": "concrete load bearing"}'
    ```
  - [ ] Verify OpenAI API call succeeds
  - [ ] Verify Supabase RPC called
  - [ ] Verify results returned

- [ ] **Error handling**
  - [ ] Test with missing query parameter
  - [ ] Test with short query (<3 chars)
  - [ ] Test with invalid JWT
  - [ ] Test with network timeout

---

## WEEK 2: ORCHESTRATOR JOBS (12 hours)

### Day 6-7: Document Parsing Handler (6 hours)

- [ ] **Create handler file**
  - [ ] `services/orchestrator/src/handlers/standards-ingest.ts`
  - [ ] Function: `handleStandardsIngestStart()`
  - [ ] Implement PDF download
  - [ ] Implement text extraction (pdfjs-dist)
  - [ ] Implement semantic chunking (3-5 sentences)
  - [ ] Queue embedding jobs to Redis

- [ ] **Install dependencies**
  - [ ] `npm install pdfjs-dist --save`
  - [ ] Verify imports work

- [ ] **Register handler**
  - [ ] Update `services/orchestrator/src/handlers/index.ts`
  - [ ] Add case: `'standards:ingest:start'`
  - [ ] Import handleStandardsIngestStart

- [ ] **Local testing**
  - [ ] Create test PDF file
  - [ ] Manually queue event to Redis: `xadd task-events * ...`
  - [ ] Run orchestrator: `npm run dev`
  - [ ] Verify:
    - [ ] standards_ingestion record marked as 'processing'
    - [ ] PDF text extracted correctly
    - [ ] Chunks created
    - [ ] Redis events queued for embedding

### Day 8-10: Embedding Worker Handler (6 hours)

- [ ] **Create handler file**
  - [ ] Add function: `handleStandardsEmbedChunk()` in same file
  - [ ] Implement OpenAI embedding API call
  - [ ] Insert vector into normative_chunks
  - [ ] Update progress counters
  - [ ] Mark as completed when all chunks done

- [ ] **Environment variables**
  - [ ] OPENAI_API_KEY (for orchestrator)
  - [ ] Verify in .env (local)

- [ ] **Local testing**
  - [ ] Manually queue standards:embed:chunk event to Redis
  - [ ] Run orchestrator
  - [ ] Verify:
    - [ ] OpenAI API called with text
    - [ ] Embedding vector returned
    - [ ] normative_chunks record inserted
    - [ ] standards_ingestion.successfully_embedded incremented
    - [ ] When all chunks done: status changed to 'completed'

- [ ] **Error handling**
  - [ ] Test with invalid OpenAI API key
  - [ ] Test with network timeout
  - [ ] Verify failures increment failed_embeddings counter
  - [ ] Verify retry logic works (exponential backoff)

---

## WEEK 3: FRONTEND & UI (16 hours)

### Day 11-12: Standards Assistant Component (8 hours)

- [ ] **Create component**
  - [ ] `enghub-main/src/components/StandardsAssistant.tsx`
  - [ ] Search UI (input + button)
  - [ ] Results display (5 most relevant)
  - [ ] Result detail view
  - [ ] Feedback buttons ("helpful", "not relevant")

- [ ] **Implement API calls**
  - [ ] POST /api/standards/search
  - [ ] POST /api/standards/feedback
  - [ ] Mock data for development

- [ ] **Local testing**
  - [ ] `npm run dev` in frontend
  - [ ] Type query in search box
  - [ ] Click "Search"
  - [ ] Results appear
  - [ ] Click result to view details
  - [ ] Click feedback button (verify console log)

- [ ] **Add to CopilotPanel**
  - [ ] Update `enghub-main/src/components/CopilotPanel.tsx`
  - [ ] Add "Standards" tab
  - [ ] Render StandardsAssistant component on tab click

- [ ] **Style & CSS**
  - [ ] Add styles to `enghub-main/src/styles.css`
  - [ ] Classes: `.standards-assistant`, `.search-section`, `.results-section`, `.result-item`, `.result-detail`, `.feedback`
  - [ ] Verify responsive on mobile

### Day 13-15: Admin UI & Polish (8 hours)

- [ ] **Admin features**
  - [ ] Document upload section (file input)
  - [ ] POST /api/standards/ingest call
  - [ ] Status polling with progress bar

- [ ] **Ingestion status display**
  - [ ] GET /api/standards/ingest/:id polling (every 2 seconds)
  - [ ] Show progress: "145/250 chunks embedded"
  - [ ] Show status badge: pending, processing, completed, failed
  - [ ] Show error message if failed

- [ ] **Admin dashboard (optional)**
  - [ ] Create `/admin/standards` page
  - [ ] GET /api/standards/status endpoint
  - [ ] Display:
    - [ ] Total documents ingested
    - [ ] Success rate %
    - [ ] Recent ingestions
    - [ ] Search volume (last 24h)

- [ ] **Error handling & UX**
  - [ ] Display error messages from API
  - [ ] Retry buttons for failed uploads
  - [ ] Loading states (spinners, disabled buttons)
  - [ ] Accessibility: ARIA labels, keyboard navigation

- [ ] **Local testing**
  - [ ] Log in as admin/gip
  - [ ] Upload test PDF
  - [ ] Watch progress bar
  - [ ] Verify search works on new document
  - [ ] Log in as engineer: verify no upload UI shown

---

## WEEK 4: TESTING & DEPLOYMENT (12 hours)

### Day 16-18: Integration Testing (6 hours)

- [ ] **End-to-end flow**
  - [ ] Upload PDF file via UI
  - [ ] Monitor orchestrator logs
  - [ ] Verify parsing: check chunk count
  - [ ] Monitor Redis job queue: `xlen task-events`
  - [ ] Wait for embedding completion
  - [ ] Verify normative_chunks populated: `SELECT COUNT(*) FROM normative_chunks`
  - [ ] Search for keywords from document
  - [ ] Verify results appear with correct similarity %

- [ ] **Load testing**
  - [ ] Upload 5 test documents (different types: regulation, standard, guideline)
  - [ ] Monitor CPU/Memory: `top` or Railway logs
  - [ ] Verify all complete successfully
  - [ ] Check average processing time per document

- [ ] **RLS validation**
  - [ ] Test as engineer user: can search, can't ingest
  - [ ] Test as admin user: can search, can ingest
  - [ ] Test as non-authenticated: should get 401
  - [ ] Verify: `SELECT COUNT(*) FROM standards_ingestion WHERE created_by != auth.uid()` returns 0 (users can only see own)

- [ ] **Cache testing**
  - [ ] Search for same query 5 times
  - [ ] Verify 2nd-5th requests faster (cache hit)
  - [ ] Check standards_search_cache table: `SELECT hits_count FROM standards_search_cache`

- [ ] **Error scenarios**
  - [ ] Upload corrupted PDF: verify graceful failure
  - [ ] Disconnect OpenAI API: verify retry logic
  - [ ] Kill orchestrator mid-processing: verify state recovery
  - [ ] Search with timeout: verify timeout handling

- [ ] **Performance benchmarks**
  - [ ] Search latency: target <1 second (with cache hit)
  - [ ] Embedding latency: ~2-5 seconds per chunk
  - [ ] Ingestion throughput: target 100+ chunks/minute
  - [ ] Document record: latencies in table

### Day 19-20: Production Deployment (6 hours)

- [ ] **Pre-deployment checklist**
  - [ ] All code committed to main branch
  - [ ] All tests passing locally
  - [ ] Migrations tested on prod schema
  - [ ] Environment variables set in Railway
  - [ ] Rollback plan documented

- [ ] **Railway deployment**
  - [ ] Deploy API Server:
    - [ ] Push to main
    - [ ] Verify Railway auto-deploys
    - [ ] Monitor: Railway → Logs
    - [ ] Check: curl https://api-server-production-8157.up.railway.app/health
    - [ ] Test endpoint: curl /api/standards/search
  
  - [ ] Deploy Orchestrator:
    - [ ] Push same commit to main
    - [ ] Railway auto-deploys
    - [ ] Monitor: Rails → Logs
    - [ ] Check: `xlen task-events` shows jobs being consumed

  - [ ] Deploy Frontend:
    - [ ] Push to enghub-main/
    - [ ] Railway auto-deploys
    - [ ] Monitor: Rails → Logs
    - [ ] Check: https://enghub-frontend-production.up.railway.app loads

- [ ] **Smoke testing in production**
  - [ ] Log in to prod: https://enghub-frontend-production.up.railway.app
  - [ ] Search for a common term in existing standards
  - [ ] Verify results (should use existing data from normative_chunks)
  - [ ] Click "Standards" tab
  - [ ] If admin: test document upload
  - [ ] Monitor logs for errors: `grep ERROR /var/log/*`

- [ ] **Monitoring & alerts**
  - [ ] Set up log aggregation: Railway → Monitoring
  - [ ] Create alerts:
    - [ ] API error rate > 5%
    - [ ] OpenAI API failures
    - [ ] PostgreSQL connections > threshold
    - [ ] Queue depth > 1000 jobs
  
  - [ ] Create dashboard:
    - [ ] Search volume (24h)
    - [ ] Embedding success rate
    - [ ] Cache hit rate
    - [ ] API latency (p50, p95, p99)

- [ ] **Documentation updated**
  - [ ] Update STATE.md with deployment summary
  - [ ] Add troubleshooting guide to RLS_GOVERNANCE_MODEL.md
  - [ ] Document new endpoints in API docs
  - [ ] Add standards tables to database diagram

- [ ] **Rollback preparation**
  - [ ] Document rollback steps:
    ```bash
    # If critical issues found:
    # 1. Revert codebase to previous commit
    # 2. Railway auto-redeploys
    # 3. Keep standards_* tables (optional cleanup later)
    # 4. Queries still work (graceful degradation)
    ```
  - [ ] Keep previous version tags in git
  - [ ] Maintain backup of databases before major changes

---

## ONGOING MONITORING (Post-Deployment)

### Daily Checks (1 hour/day for first 2 weeks)

- [ ] Check error logs in Railway: search for "standards:" errors
- [ ] Verify embedding queue depth: `XLEN task-events` < 100
- [ ] Spot check search results: manual queries
- [ ] Monitor OpenAI API costs: $0-0.50/day (expected range)
- [ ] Verify cache hit rate > 30%

### Weekly Checks

- [ ] Review analytics: search volume, feedback sentiment
- [ ] Check Supabase performance: pgvector query latency
- [ ] Review failed embeddings: `SELECT * FROM standards_ingestion WHERE status='failed'`
- [ ] Analyze feedback: which standards most helpful?

### Monthly Review

- [ ] Cost analysis: actual vs. budget
- [ ] Performance trends: latency, throughput
- [ ] User feedback: feature requests, improvements
- [ ] Plan optimizations: caching, indexing, etc.

---

## KEY METRICS TO TRACK

### Performance Metrics

```sql
-- Average search latency
SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_latency_sec
FROM standards_searches;

-- Embedding success rate (%)
SELECT 
  COUNT(*) as total_docs,
  SUM(CASE WHEN status='completed' THEN 1 END) as completed,
  ROUND(100.0 * SUM(CASE WHEN status='completed' THEN 1 END) / COUNT(*), 2) as success_rate
FROM standards_ingestion;

-- Cache hit rate (%)
SELECT 
  COUNT(*) as total_caches,
  SUM(hits_count) as total_hits,
  ROUND(100.0 * SUM(hits_count) / COUNT(*), 2) as avg_hits_per_cache
FROM standards_search_cache;

-- User feedback distribution
SELECT feedback_type, COUNT(*) FROM standards_feedback GROUP BY feedback_type;
```

### Cost Metrics

- OpenAI API: track in OpenAI dashboard
- Supabase storage: check in Supabase dashboard
- Railway compute: check in Railway dashboard

### Business Metrics

- Search volume: number of searches per day
- User adoption: unique users per day
- Feature usage: % of users searching standards
- Engagement: avg searches per session

---

## ROLLBACK PROCEDURES

### If Critical Issues Found (Within 24 Hours)

**Option 1: Code Rollback (Safest)**

```bash
# 1. Identify last good commit
git log --oneline | head -10

# 2. Revert to previous version
git revert HEAD~1

# 3. Push to main (Railway auto-deploys)
git push origin main

# 4. Verify deployment
curl https://api-server-production-8157.up.railway.app/health
```

**Option 2: Feature Flag (If existing)**

```bash
# Temporarily disable standards feature in environment
STANDARDS_ENABLED=false
# Redeploy
```

**Option 3: Database Rollback**

```bash
# If data corruption: drop new tables
-- In Supabase SQL editor:
DROP TABLE standards_search_cache;
DROP TABLE standards_feedback;
DROP TABLE standards_ingestion;

-- Old tables/functions remain unaffected
-- Queries still work (just without standards results)
```

### Post-Incident Review

- [ ] Document root cause
- [ ] Implement fix
- [ ] Add test case
- [ ] Re-deploy with fixes
- [ ] Update runbooks

---

## CONTINGENCY PLANS

### If OpenAI API Quota Exceeded

```bash
# Switch to cheaper embedding model
STANDARDS_EMBEDDING_MODEL=text-embedding-3-small  # already using this
# Or: pause ingestion until quota resets
STANDARDS_INGEST_PAUSED=true
```

### If PostgreSQL Performance Degraded

```sql
-- Check index usage
SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;

-- Recreate indexes if needed
REINDEX INDEX idx_standards_ingestion_status;
REINDEX INDEX idx_standards_search_cache_emb;
```

### If Redis Queue Backs Up

```bash
# Monitor queue depth
XLEN task-events  # should be < 100

# If > 1000: scale orchestrator workers
# In Railway: increase instance count or CPU
```

---

## SUCCESS CRITERIA (End of Week 4)

- ✅ All 3 tables created and verified in production
- ✅ All 4 API endpoints deployed and tested
- ✅ 2 orchestrator handlers working end-to-end
- ✅ Frontend component deployed and accessible
- ✅ At least 1 test document ingested and searchable
- ✅ RLS policies working correctly
- ✅ No critical errors in logs
- ✅ Search latency < 1 second (with cache)
- ✅ OpenAI API integration working
- ✅ Documentation updated

---

**Checklist Status:** Ready to Begin  
**Start Date:** 2026-05-09 (Week 1, Day 1)  
**Target Completion:** 2026-06-06 (Week 4, Day 20)  
**Estimated Total Hours:** 56 (14 hours/week)
