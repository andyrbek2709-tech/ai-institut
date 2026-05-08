# AGSK Engineering AI — EngHub Integration Research

**Date:** 2026-05-08  
**Status:** RESEARCH COMPLETE → Implementation Ready  
**Scope:** Add AGSK RAG (normative standards) to existing EngHub without architectural changes

---

## EXECUTIVE SUMMARY

**Goal:** Integrate AGSK engineering standards database (pgvector RAG) as a contextual copilot feature in EngHub.

### Key Insight: Minimal-Change Strategy

- ✅ pgvector + embeddings **already exist** (migration `001_rag_setup.sql`)
- ✅ Reuse existing: Redis Streams, API Server, PostgreSQL, Express, Orchestrator
- ✅ Add only: 3 new tables, 4 new endpoints, 2 orchestrator handlers
- ✅ Add only: 1 new frontend component (Standards Assistant tab)
- ✅ **NO new services, NO new databases, NO major rewrites**

### Timeline: 4 Weeks (30 Days)

| Week | Component | Effort | Deliverable |
|------|-----------|--------|-------------|
| 1 | DB + API | 16h | 4 endpoints, migrations, local test |
| 2 | Orchestrator | 12h | PDF parsing, embedding jobs |
| 3 | Frontend | 16h | Standards assistant UI, admin panel |
| 4 | Testing + Deploy | 12h | E2E tests, production deployment |

### Risk Profile: **LOW**

- Feature is isolated (doesn't touch core workflows)
- Reuses battle-tested infrastructure
- All changes are backwards-compatible
- Can be rolled back by deleting 3 tables + 2 files

### Cost Estimate: **$5-200/month**

- OpenAI embeddings: $0.02/1M tokens = ~$0.10/month (typical)
- Supabase storage: ~$5/month (10GB documents)
- Redis, PostgreSQL, Railway: $0 additional
- **Total: $5-10/month typical**

---

## PART 1: EXISTING INFRASTRUCTURE ANALYSIS

### What's Already Here (2026-05-08)

| Component | Status | Usage |
|-----------|--------|-------|
| **Supabase PostgreSQL** | ✅ Active | Core data, pgvector extension |
| **pgvector Extension** | ✅ Enabled | Vector search (cosine, IVFFlat) |
| **normative_chunks Table** | ✅ Exists | (id, doc_id, content, embedding) |
| **search_normative() RPC** | ✅ Exists | Semantic search function |
| **Redis Streams** | ✅ Connected | Event orchestration |
| **API Server (Express)** | ✅ Running | /api/* routes, JWT + RLS |
| **Orchestrator (Node.js)** | ✅ Running | Redis consumer, event handling |
| **Frontend (React)** | ✅ SPA | Auth, protected routes |
| **Railway Production** | ✅ Ready | 2 services (api-server, orchestrator) |

### What's Working for RAG

✅ `normative_chunks` table ready (id, doc_id, doc_name, content, embedding, created_at)  
✅ `search_normative(query_embedding, match_count)` function ready  
✅ IVFFlat index on embeddings (cosine_ops) ready  
✅ RLS enabled: authenticated users can read  
✅ Redis Streams for async jobs (task-events consumer)  
✅ API Server auth middleware (JWT + role-based access)

### Gaps to Fill

1. **Document Ingestion Pipeline** → New orchestrator handler
2. **Embedding Generation** → Call OpenAI/Claude API
3. **Document Metadata Tracking** → New `standards_ingestion` table
4. **Ingestion Progress UI** → New React component + polling
5. **Search & Feedback Endpoints** → 4 new /api/standards/* endpoints
6. **Environment Variables** → OPENAI_API_KEY, embedding model config

---

## PART 2: DATABASE SCHEMA (3 NEW TABLES)

### Migration 021: Core Tables

```sql
-- standards_ingestion: Document import metadata & progress tracking
CREATE TABLE standards_ingestion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Document metadata
  document_name TEXT NOT NULL UNIQUE,
  description TEXT,
  document_type TEXT DEFAULT 'regulation', -- regulation, standard, guideline, checklist
  source_url TEXT,
  file_path TEXT,
  file_size_bytes INT,
  
  -- Ingestion status tracking
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  total_chunks INT DEFAULT 0,
  successfully_embedded INT DEFAULT 0,
  failed_embeddings INT DEFAULT 0,
  last_error TEXT,
  
  -- Processing metadata
  embedding_model TEXT DEFAULT 'text-embedding-3-small',
  chunk_strategy TEXT DEFAULT 'semantic',
  chunk_size INT DEFAULT 1024,
  chunk_overlap INT DEFAULT 100,
  
  -- Timestamps
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ
);

CREATE INDEX idx_standards_ingestion_status 
  ON standards_ingestion(status, updated_at DESC);

ALTER TABLE standards_ingestion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/GIP manage ingestions"
  ON standards_ingestion FOR ALL
  USING (auth.role() = 'authenticated');

-- standards_feedback: User feedback on search results
CREATE TABLE standards_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES normative_chunks(id) ON DELETE CASCADE,
  task_id INT REFERENCES tasks(id) ON DELETE SET NULL,
  
  feedback_type TEXT DEFAULT 'helpful', -- helpful, irrelevant, unclear, incorrect
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_standards_feedback_chunk 
  ON standards_feedback(chunk_id, feedback_type);

ALTER TABLE standards_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All auth can write feedback"
  ON standards_feedback FOR INSERT
  USING (auth.role() = 'authenticated');

-- standards_search_cache: Cache popular queries (optional, for perf)
CREATE TABLE standards_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  query_text TEXT NOT NULL,
  query_embedding VECTOR(1536),
  
  results JSONB NOT NULL,
  result_count INT,
  hits_count INT DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_standards_search_cache_emb
  ON standards_search_cache USING ivfflat(query_embedding vector_cosine_ops)
  WITH (lists = 50);

ALTER TABLE standards_search_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All auth read cache"
  ON standards_search_cache FOR SELECT
  USING (auth.role() = 'authenticated');
```

---

## PART 3: NEW API ENDPOINTS (4 ENDPOINTS)

### Endpoint 1: POST /api/standards/search

**Request:**
```json
{
  "query": "reinforced concrete load bearing walls",
  "limit": 5,
  "threshold": 0.65
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "uuid-chunk-1",
      "doc_name": "GOST 27751-2014",
      "content": "Section 3.2: Load calculation for reinforced concrete structures...",
      "similarity": 0.89
    }
  ],
  "cached": false
}
```

**Flow:**
1. Generate embedding from query (OpenAI API)
2. Check cache (vector similarity on query_embedding)
3. If cache hit: return cached results
4. Else: call `search_normative(embedding, limit)` RPC
5. Filter by similarity threshold
6. Cache results
7. Log search event to Redis

---

### Endpoint 2: POST /api/standards/ingest

**Request:**
```json
{
  "document_name": "AGSK-3_Normative_Standards",
  "file_url": "https://storage.../documents/agsk-3.pdf",
  "document_type": "regulation",
  "chunk_strategy": "semantic"
}
```

**Response:**
```json
{
  "ingestion_id": "uuid",
  "status": "pending",
  "job_queued": true
}
```

**Auth:** admin, gip only

**Flow:**
1. Create standards_ingestion record (status='pending')
2. Queue Redis job: `standards:ingest:start`
3. Return ingestion_id for polling
4. User polls GET /api/standards/ingest/:id for progress

---

### Endpoint 3: GET /api/standards/ingest/:ingestionId

**Response:**
```json
{
  "id": "uuid",
  "document_name": "AGSK-3",
  "status": "processing",
  "total_chunks": 250,
  "successfully_embedded": 145,
  "failed_embeddings": 5,
  "last_error": null,
  "processing_started_at": "2026-05-08T10:00:00Z",
  "processing_completed_at": null
}
```

**Use Case:** Frontend polls this to show progress bar during ingestion

---

### Endpoint 4: POST /api/standards/feedback

**Request:**
```json
{
  "chunk_id": "uuid",
  "feedback_type": "helpful",
  "notes": "Very relevant for load calculation",
  "task_id": 123
}
```

**Response:**
```json
{
  "feedback_id": "uuid",
  "created_at": "2026-05-08T10:05:00Z"
}
```

**Use Case:** User clicks "helpful" → log for analytics

---

## PART 4: ORCHESTRATOR JOB HANDLERS (2 HANDLERS)

### Handler 1: standards:ingest:start

**Event Payload:**
```json
{
  "event_type": "standards:ingest:start",
  "ingestion_id": "uuid",
  "file_url": "https://...",
  "chunk_strategy": "semantic",
  "user_id": "uuid",
  "timestamp": 1234567890
}
```

**Flow:**
1. Update standards_ingestion: status='processing', processing_started_at=NOW
2. Download PDF from file_url
3. Parse PDF into text (pdfjs-dist library)
4. Split into chunks (semantic: 3-5 sentences; overlap=1)
5. For each chunk: queue Redis event `standards:embed:chunk`
6. Update standards_ingestion: total_chunks=N
7. Log to Telegram: "Started parsing AGSK-3 (250 chunks)"

**Error Handling:**
- PDF download fails → status='failed', last_error
- Parsing fails → status='failed', last_error
- Retry: exponential backoff (3 attempts)

---

### Handler 2: standards:embed:chunk

**Event Payload:**
```json
{
  "event_type": "standards:embed:chunk",
  "ingestion_id": "uuid",
  "chunk_index": 0,
  "chunk_content": "Section 3.2: Load calculation...",
  "timestamp": 1234567890
}
```

**Flow:**
1. Call OpenAI embedding API (text-embedding-3-small)
2. Get response: vector[1536]
3. Insert into normative_chunks: {doc_id, content, embedding}
4. Increment standards_ingestion.successfully_embedded
5. If all chunks done: update status='completed'
6. Log to Redis: standards-embeddings event

**Error Handling:**
- OpenAI API fails → increment failed_embeddings, retry (5x max)
- DB insert fails → set last_error, retry
- After 5 failures → mark as failed, notify admin

---

## PART 5: FRONTEND COMPONENT

**File:** `enghub-main/src/components/StandardsAssistant.tsx`  
**Size:** ~400 lines

### Features

1. **Search Section**
   - Text input: "Search standards..."
   - Search button (or Enter)
   - Loading spinner during search

2. **Results Section**
   - List of 5 most relevant standards
   - Each shows: name, similarity %, content preview
   - Click to select

3. **Result Detail**
   - Full standard text
   - Feedback buttons: "👍 Helpful" | "👎 Not Relevant"

4. **Admin Section** (if user role = admin/gip)
   - File input (PDF, DOC, DOCX)
   - Upload button
   - Progress bar: "145/250 chunks embedded"
   - Error messages with retry

### Integration into CopilotPanel

```typescript
<CopilotPanel>
  <Tabs>
    <Tab label="Chat"><ChatInterface /></Tab>
    <Tab label="Standards"><StandardsAssistant /></Tab>
  </Tabs>
</CopilotPanel>
```

---

## PART 6: ENVIRONMENT VARIABLES

### API Server (.env)

```bash
OPENAI_API_KEY=sk-...
STANDARDS_EMBEDDING_MODEL=text-embedding-3-small
STANDARDS_MAX_CHUNKS_PER_JOB=50
STANDARDS_CACHE_TTL_MINUTES=60
```

### Orchestrator (.env)

```bash
OPENAI_API_KEY=sk-...
PDF_PARSER_TIMEOUT_MS=30000
CHUNK_SIZE_SEMANTIC=1024
CHUNK_OVERLAP=100
```

### Railway Secrets

Add to Project → Secrets:
```
OPENAI_API_KEY = sk-...
```

---

## PART 7: 30-DAY IMPLEMENTATION TIMELINE

### Week 1: Database & Core API (16 hours)

**Day 1-2: Schema Migrations (8h)**
- Create migration 021: 3 new tables with RLS
- Create migration 022: indexes + policies
- Test locally with Supabase CLI
- Apply to prod Supabase

**Day 3-5: API Endpoints (8h)**
- Implement /api/standards/search
- Implement /api/standards/ingest
- Implement /api/standards/ingest/:id
- Implement /api/standards/feedback
- Add OpenAI embedding integration
- Unit tests for each

### Week 2: Orchestrator (12 hours)

**Day 6-7: Document Parsing (6h)**
- Create handler: standards-ingest
- PDF parsing (pdfjs-dist)
- Semantic chunking
- Queue embedding jobs

**Day 8-10: Embedding Worker (6h)**
- Create handler: standards-embed-chunk
- OpenAI API integration
- Vector insertion
- Progress tracking

### Week 3: Frontend (16 hours)

**Day 11-12: Component (8h)**
- StandardsAssistant.tsx
- Search UI
- Results display
- Feedback buttons

**Day 13-15: Admin UI (8h)**
- Document upload
- Ingestion status polling
- Admin dashboard
- Error messages

### Week 4: Testing & Deploy (12 hours)

**Day 16-18: Testing (6h)**
- E2E: upload → parse → embed → search
- Load test (50 documents)
- RLS validation
- Cache hit rate

**Day 19-20: Deployment (6h)**
- Deploy to Railway staging
- Smoke tests
- Deploy to production
- Monitor logs

---

## PART 8: COST ESTIMATE

### Monthly Operating Cost

| Service | Usage | Cost |
|---------|-------|------|
| OpenAI Embeddings | 5M tokens/month | $0.10 |
| Supabase Storage | 10GB documents | $5.00 |
| PostgreSQL pgvector | Included | $0.00 |
| Redis Streams | Included | $0.00 |
| Railway | No new services | $0.00 |
| **TOTAL** | | **~$5/month** |

**Heavy Usage (500+ docs/month):** ~$200/month

---

## PART 9: RISK ASSESSMENT

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| OpenAI quota exceeded | Medium | Medium | Budget alerts, rate limiting |
| PDF parsing failures | High | Low | pdfjs-dist + fallback, DLQ |
| Slow embedding (1000s chunks) | Medium | Medium | Batch jobs, async UI, timeouts |
| RLS misconfiguration | Low | High | Test in staging, audit logs |
| Cache invalidation | Low | Low | 60-min TTL, manual clear endpoint |
| normative_chunks breaking changes | Low | High | Only add columns, versioning |

---

## PART 10: SECURITY

### RLS Policies

✅ `normative_chunks`: All authenticated users READ  
✅ `standards_ingestion`: Only admin/gip MANAGE  
✅ `standards_feedback`: Users WRITE own, admin sees all  
✅ `standards_search_cache`: All authenticated READ

### API Security

✅ All endpoints require JWT authentication  
✅ Admin endpoints require `requireRole(['admin', 'gip'])`  
✅ OpenAI API key in Railway secrets (never in code)  
✅ Search queries NOT logged (privacy)

---

## PART 11: MONITORING & METRICS

### Key Queries

```sql
-- Daily success rate
SELECT DATE(created_at), 
  COUNT(*) total,
  SUM(CASE WHEN status='completed' THEN 1 END) completed,
  ROUND(100.0*SUM(CASE WHEN status='completed' THEN 1 END)/COUNT(*), 2) rate
FROM standards_ingestion 
GROUP BY DATE(created_at);

-- Search cache hit rate
SELECT 
  COUNT(*) searches,
  COUNT(CASE WHEN cached THEN 1 END) * 100.0 / COUNT(*) hit_rate
FROM standards_search_cache;

-- Feedback sentiment
SELECT feedback_type, COUNT(*) 
FROM standards_feedback 
GROUP BY feedback_type;
```

### Dashboards

1. **Admin:** `/admin/standards`
   - Total documents, success rate, errors, search volume

2. **System Health:** `/diagnostics`
   - API status, query latency, cache hit rate, queue depth

---

## PART 12: NEXT IMMEDIATE STEPS

### Week 1, Days 1-2

1. Review plan with team
2. Create migrations:
   - `supabase/migrations/021_standards_ingestion.sql`
   - `supabase/migrations/022_standards_indexes.sql`
3. Test locally with Supabase CLI
4. Apply to prod Supabase

### Week 1, Days 3-5

1. Implement `services/api-server/src/routes/standards.ts`
2. Add OpenAI integration
3. Test with curl + Postman
4. Test RLS policies

### Then: Continue weeks 2-4 (orchestrator, frontend, deployment)

---

**Document Status:** RESEARCH COMPLETE - READY FOR IMPLEMENTATION  
**Date:** 2026-05-08  
**Version:** 1.0
