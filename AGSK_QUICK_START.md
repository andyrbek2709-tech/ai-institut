# AGSK RAG Integration — QUICK START GUIDE

**For:** Developers starting Week 1  
**Read time:** 5 minutes  
**Full details:** See AGSK_RAG_INTEGRATION_RESEARCH.md

---

## THE GOAL IN 2 SENTENCES

Add an engineering standards search feature (RAG with pgvector) to EngHub's CopilotPanel. Users search "concrete load bearing" and get relevant sections from AGSK normative documents.

---

## WHY THIS IS EASY (Minimal Change)

- ✅ pgvector already installed (migration 001_rag_setup.sql)
- ✅ normative_chunks table already exists
- ✅ search_normative() function already exists
- ✅ Redis Streams already running
- ✅ API Server + Orchestrator already deployed
- ✅ Authentication/RLS already working

**New:** Only 3 tables + 4 endpoints + 2 job handlers + 1 React component

---

## FILES TO CREATE/MODIFY

### CREATE (5 new files)

```
supabase/migrations/021_standards_ingestion.sql    ← 3 new tables
supabase/migrations/022_standards_indexes.sql      ← indexes + RLS
services/api-server/src/routes/standards.ts        ← 5 endpoints
services/orchestrator/src/handlers/standards-ingest.ts  ← 2 handlers
enghub-main/src/components/StandardsAssistant.tsx  ← React component
```

### MODIFY (3 files)

```
services/api-server/src/index.ts                   ← add 1 line: register router
services/orchestrator/src/handlers/index.ts        ← add 2 cases: event types
enghub-main/src/components/CopilotPanel.tsx        ← add 1 tab: "Standards"
```

### UPDATE (2 files)

```
services/api-server/package.json                   ← add pdfjs-dist
enghub-main/src/styles.css                         ← add .standards-assistant styles
```

---

## WEEK 1 SPRINT (Mon-Fri, 16 hours)

### Mon-Tue (8 hours) — Database

1. Copy migration SQL from AGSK_RAG_CODE_SNIPPETS.md
2. Test locally: `supabase db push`
3. Deploy to prod: `supabase db push --remote`
4. Verify: `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'standards%'`

**Status:** 3 tables live in prod ✅

### Wed-Fri (8 hours) — API

1. Create services/api-server/src/routes/standards.ts (copy from code snippets)
2. Update services/api-server/src/index.ts (1 line: `app.use('/api', standardsRouter)`)
3. Add env vars: OPENAI_API_KEY
4. Test locally:
   ```bash
   npm run dev
   curl -X POST http://localhost:3001/api/standards/search \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"query": "concrete"}'
   ```

**Status:** 4 endpoints live, tested locally ✅

---

## WEEK 2 SPRINT (Mon-Fri, 12 hours)

### Mon-Tue (6 hours) — PDF Parsing

1. Create services/orchestrator/src/handlers/standards-ingest.ts
2. Update services/orchestrator/src/handlers/index.ts (add event case)
3. npm install pdfjs-dist
4. Test:
   ```bash
   # Queue test event to Redis
   redis-cli XADD task-events "*" event_type standards:ingest:start ...
   npm run dev  # Run orchestrator
   # Verify: SELECT * FROM standards_ingestion WHERE status='processing'
   ```

**Status:** PDF parsing working, chunks created ✅

### Wed-Fri (6 hours) — Embedding Worker

1. Add handleStandardsEmbedChunk() to same file
2. Implement OpenAI embedding API call
3. Test:
   ```bash
   # Queue test event to Redis
   redis-cli XADD task-events "*" event_type standards:embed:chunk ...
   npm run dev  # Run orchestrator
   # Verify: SELECT COUNT(*) FROM normative_chunks (should increase)
   ```

**Status:** Full pipeline working: PDF → chunks → embeddings → search ✅

---

## WEEK 3 SPRINT (Mon-Fri, 16 hours)

### Mon-Tue (8 hours) — React Component

1. Create enghub-main/src/components/StandardsAssistant.tsx (copy from code snippets)
2. npm run dev in frontend
3. Test search manually (should call /api/standards/search)
4. Test feedback buttons (should call /api/standards/feedback)

**Status:** Search works end-to-end, feedback logs ✅

### Wed-Fri (8 hours) — Polish & Admin UI

1. Update enghub-main/src/components/CopilotPanel.tsx
   - Add "Standards" tab
   - Render StandardsAssistant
2. Add file upload UI (if admin)
3. Add ingestion status polling
4. Test RLS: search as engineer (can't ingest), search as admin (can)

**Status:** Full frontend live, admin can upload documents ✅

---

## WEEK 4 SPRINT (Mon-Fri, 12 hours)

### Mon-Tue (6 hours) — Testing

1. Upload test PDF via UI
2. Watch progress bar: 250 chunks → 250 embeddings
3. Search for keywords from document → should find them
4. Test cache hit rate (search 5x same query)
5. Test RLS (engineer can't ingest, can search)

**Status:** All features verified working ✅

### Wed-Fri (6 hours) — Deploy & Monitor

1. Push all changes to main
2. Railway auto-deploys all 3 services
3. Test in production:
   - Search for a keyword
   - Check /api/health
   - Check logs for errors
4. Monitor for 24 hours
5. Celebrate! 🎉

**Status:** LIVE IN PRODUCTION ✅

---

## DAILY CHECKLIST (Week 1)

**Monday**
- [ ] Clone repo / open project
- [ ] Read AGSK_RAG_INTEGRATION_RESEARCH.md (15 min)
- [ ] Read this file (5 min)
- [ ] Create migration 021 file
- [ ] Start database testing locally

**Tuesday**
- [ ] Complete migration testing
- [ ] Deploy to prod Supabase
- [ ] Verify tables exist
- [ ] Create API routes file
- [ ] Start copy-paste of endpoint code

**Wednesday**
- [ ] Complete all 5 endpoint implementations
- [ ] Test with curl/Postman
- [ ] Add OPENAI_API_KEY env var (local)
- [ ] Test /api/standards/search locally

**Thursday**
- [ ] Register router in API Server index.ts
- [ ] Build & verify: `npm run build`
- [ ] Test endpoints again
- [ ] Document any bugs found

**Friday**
- [ ] Code review with team
- [ ] Handle feedback/fixes
- [ ] Prepare for Week 2
- [ ] Push Week 1 code to git

---

## WHAT COULD GO WRONG (& Fixes)

| Problem | Fix |
|---------|-----|
| "OpenAI API key invalid" | Set OPENAI_API_KEY in .env (get from OpenAI account) |
| "normative_chunks table not found" | Run migration 001_rag_setup.sql first if not done |
| "search_normative function not found" | Run migration 001_rag_setup.sql (it creates the function) |
| "CORS error on frontend" | Verify REACT_APP_RAILWAY_API_URL env var set correctly |
| "PDF parsing fails" | Use test PDF first (not corrupted); pdfjs-dist may need setup |
| "Embeddings are slow" | OpenAI API calls are ~2-5 sec each; this is normal; batch helps |
| "Cache not working" | Check standards_search_cache table; verify INSERT succeeds |

---

## QUICK REFERENCE: KEY FILES

| What | File | Lines |
|------|------|-------|
| API routes | services/api-server/src/routes/standards.ts | ~300 |
| Orchestrator handlers | services/orchestrator/src/handlers/standards-ingest.ts | ~250 |
| React component | enghub-main/src/components/StandardsAssistant.tsx | ~400 |
| DB schema | supabase/migrations/021_standards_ingestion.sql | ~150 |
| Integration pts | services/api-server/src/index.ts | 1 line |
| Integration pts | services/orchestrator/src/handlers/index.ts | 2 cases |
| Integration pts | enghub-main/src/components/CopilotPanel.tsx | 1 tab |

---

## ENVIRONMENT VARIABLES NEEDED

### Local Development

```bash
# API Server .env
OPENAI_API_KEY=sk-...
STANDARDS_EMBEDDING_MODEL=text-embedding-3-small
STANDARDS_MAX_CHUNKS_PER_JOB=50

# Orchestrator .env
OPENAI_API_KEY=sk-...
PDF_PARSER_TIMEOUT_MS=30000
CHUNK_SIZE_SEMANTIC=1024
```

### Railway Production

1. Go to Railway project "ENGHUB"
2. API Server service → Variables → add OPENAI_API_KEY
3. Orchestrator service → Variables → add OPENAI_API_KEY

---

## SUCCESS CHECKLIST

**End of Week 1:** Database & API done
- [ ] 3 new tables exist in prod
- [ ] 5 endpoints working locally
- [ ] Can POST /api/standards/search with curl
- [ ] Get results back (or error message)

**End of Week 2:** Orchestrator done
- [ ] Can queue ingest job
- [ ] PDF parses correctly
- [ ] Chunks created
- [ ] Embeddings generated

**End of Week 3:** Frontend done
- [ ] "Standards" tab visible in CopilotPanel
- [ ] Search works (calls /api/standards/search)
- [ ] Results display
- [ ] Admin can upload documents

**End of Week 4:** Live in production
- [ ] All 3 services deployed
- [ ] No errors in logs
- [ ] Search works for real documents
- [ ] RLS working (engineers can't ingest)

---

## GETTING HELP

### If Stuck on Database
→ See: AGSK_RAG_CODE_SNIPPETS.md, section 1

### If Stuck on API
→ See: AGSK_RAG_CODE_SNIPPETS.md, section 2

### If Stuck on Orchestrator
→ See: AGSK_RAG_CODE_SNIPPETS.md, section 3

### If Stuck on Frontend
→ See: AGSK_RAG_CODE_SNIPPETS.md, section 4

### If Deployment Fails
→ See: AGSK_DEPLOYMENT_CHECKLIST.md, Rollback section

### Full Details on Anything
→ See: AGSK_RAG_INTEGRATION_RESEARCH.md

---

**READY TO START?** Open AGSK_RAG_CODE_SNIPPETS.md and start with section 1 (migrations).

**Questions?** Check the "QUICK REFERENCE" section above.

Good luck! 🚀
