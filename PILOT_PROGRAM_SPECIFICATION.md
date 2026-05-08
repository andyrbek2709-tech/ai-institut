# AGSK Internal Pilot Program Specification

**Phase:** Post-Week 5 Validation (2026-05-09 onwards)  
**Duration:** 1-2 weeks  
**Scope:** 3-5 internal engineers, internal-only usage  
**Objective:** Validate real production usage, collect telemetry, identify gaps BEFORE public launch

---

## 1. Pilot Access Control

### Participants
- 3-5 internal engineers (pipeline, welding, corrosion disciplines)
- Internal-only: no external sharing, no data export
- Tracked usage: every action logged for analysis

### Database Schema
```sql
-- Pilot users (managed manually or via admin UI)
CREATE TABLE pilot_users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  org_id text NOT NULL,
  discipline text NOT NULL, -- pipeline|welding|corrosion
  added_at timestamptz DEFAULT now(),
  active boolean DEFAULT true
);

-- RLS: pilot_users visible only to admins
-- agsk tables: pilot_users get special role 'pilot_participant'
```

### Access Enforcement
- Check `auth.user_id IN (SELECT user_id FROM pilot_users WHERE active=true)`
- All pilot queries logged automatically
- Non-pilot users get full access post-pilot

---

## 2. Query Telemetry

### Goal
Understand what engineers ACTUALLY search for, how often, in which disciplines.

### Logged Data
```sql
CREATE TABLE agsk_query_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  org_id text NOT NULL,
  query_text text NOT NULL,
  query_tokens int,
  discipline text, -- extracted from query or manual selection
  result_count int,
  retrieval_latency_ms int,
  top_result_score float,
  timestamp timestamptz DEFAULT now(),
  session_id text -- to group related queries
);

-- Index: (user_id, timestamp), (discipline), (query_text)
-- Retention: 30 days (pilot phase)
```

### Metrics Collected
- **Query count:** Total searches per user, per discipline
- **Query patterns:** Most searched standards, versions, disciplines
- **Zero-result queries:** Searches that returned no results
- **Latency perception:** p50, p95 of retrieval time
- **Repeated searches:** Same query within 5 min = issue signal
- **Abandoned searches:** Query logged, no result clicks

---

## 3. Result Click Tracking

### Goal
Measure retrieval quality: are top results useful? Do people click on 1st result or scroll?

### Logged Data
```sql
CREATE TABLE agsk_result_clicks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_log_id uuid NOT NULL REFERENCES agsk_query_log(id),
  user_id uuid NOT NULL,
  org_id text NOT NULL,
  result_rank int, -- 1 = top result
  chunk_id text NOT NULL, -- reference to agsk_chunks
  standard_id text,
  section_title text,
  clicked_at timestamptz DEFAULT now(),
  time_to_click_ms int -- how long user spent reading before clicking
);

-- Index: (query_log_id), (standard_id), (user_id)
```

### Metrics
- **Click-through rate:** % of queries with ≥1 click
- **Top-1 CTR:** % of clicks on top result (target: >60%)
- **Scroll depth:** Average rank of clicked result
- **Engagement time:** How long before clicking (seconds)

---

## 4. Feedback Collection

### Goal
Get qualitative feedback: relevance, citation correctness, false positives.

### Logged Data
```sql
CREATE TABLE agsk_relevance_feedback (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  query_log_id uuid NOT NULL REFERENCES agsk_query_log(id),
  result_id text NOT NULL, -- chunk_id or standard_id
  feedback_type text CHECK (feedback_type IN ('relevant', 'irrelevant', 'partially_relevant')),
  citation_correct boolean, -- was the section citation accurate?
  citation_issue text, -- if false: "missing_section", "wrong_section", "outdated"
  false_positive boolean, -- is this result a false positive (unrelated)?
  correctness_confidence int, -- 1-5 scale
  comments text,
  created_at timestamptz DEFAULT now()
);

-- Index: (user_id), (query_log_id), (feedback_type), (false_positive)
```

### Feedback Buttons (UI)
- 👍 Relevant / 👎 Irrelevant (quick action)
- 🔗 Citation correct / ❌ Citation wrong (for cited chunks)
- 🚫 False positive (wrong discipline, unrelated)
- 💬 Add comment (optional)

---

## 5. Retrieval Failure Analysis

### Goal
Automatically detect and log retrieval failures: no results, low-confidence, timeouts.

### Logged Data
```sql
CREATE TABLE agsk_retrieval_failures (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  query_log_id uuid NOT NULL REFERENCES agsk_query_log(id),
  failure_type text CHECK (failure_type IN ('no_results', 'low_confidence', 'timeout', 'error')),
  query_text text NOT NULL,
  discipline text,
  top_score float, -- best score retrieved (if any)
  error_details text,
  likely_cause text, -- 'corpus_gap' | 'query_malformed' | 'service_error'
  created_at timestamptz DEFAULT now()
);

-- Index: (failure_type), (discipline), (user_id)
-- Automatically logged by search API when: result_count=0 OR top_score<0.5
```

### Automatic Detection
- **No results:** result_count = 0
- **Low confidence:** top_score < 0.5 OR no_results_but_similar_corpus_gap
- **Timeout:** response_time > 5000ms
- **Errors:** API 500s, database errors

---

## 6. Corpus Gap Analysis

### Goal
Identify missing standards, missing revisions, missing disciplines based on real queries.

### Logged Data
```sql
CREATE TABLE agsk_corpus_gaps (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  gap_type text CHECK (gap_type IN ('missing_standard', 'missing_revision', 'missing_discipline', 'missing_section')),
  standard_id text, -- e.g. "ASTM_A106"
  standard_version text, -- e.g. "2018"
  discipline text,
  query_count int DEFAULT 1, -- how many times was it searched
  first_query_date timestamptz,
  user_feedbacks text[], -- array of feedback comments
  priority text CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(standard_id, standard_version, discipline)
);

-- Populated by: analyst reviewing agsk_retrieval_failures + agsk_relevance_feedback
```

### Priority Logic
- **P0:** Searched ≥3 times, zero results
- **P1:** Searched 1-2 times, zero results OR false positive rate >20%
- **P2:** Mentioned in feedback comments
- **P3:** Single mention, lower-impact discipline

---

## 7. Production Telemetry Dashboards

### Dashboard 1: Overview (Real-time)
```
┌─────────────────────────────────────────┐
│ AGSK Pilot Program — Real-time Status    │
├─────────────────────────────────────────┤
│ Active Users: 5 | Queries: 147 | Uptime: 99.9% │
├─────────────────────────────────────────┤
│ Search Success Rate: 87% (target: ≥85%) │
│ Avg Retrieval Latency: 124ms (target: <200ms) │
│ Top-1 Click-through: 68% (target: >60%) │
├─────────────────────────────────────────┤
│ Issues: 3 corpus gaps (P0), 1 low-conf (23%) │
└─────────────────────────────────────────┘
```

### Dashboard 2: Search Patterns
```
Most Searched Standards (last 24h):
1. API_5L_2018 — 24 queries (16%)
2. ASME_B31.4_2019 — 18 queries (12%)
3. NACE_MR0175_2015 — 15 queries (10%)
4. UNKNOWN_ASTM_A36 — 8 queries (0 results)
5. UNKNOWN_ISO_9001 — 6 queries (wrong discipline)

Discipline Distribution:
- Pipeline: 89 queries (60%)
- Welding: 38 queries (26%)
- Corrosion: 20 queries (14%)
```

### Dashboard 3: Retrieval Quality
```
Retrieval Success Rate: 87%
├─ Successful (≥1 relevant click): 128 queries (87%)
├─ Zero-result: 12 queries (8%)
├─ No clicks (false positives): 7 queries (5%)

Citation Accuracy: 92%
├─ Correct citations: 89% of feedback
├─ Wrong sections: 7%
├─ Outdated versions: 4%

User Feedback Distribution:
- Relevant: 94 feedback (78%)
- Partially relevant: 18 feedback (15%)
- Irrelevant: 8 feedback (7%)
```

### Dashboard 4: Corpus Gaps
```
P0 Gaps (searched ≥3 times, 0 results):
1. ASTM_A36 (structural) — 5 queries
2. AISC_360_2016 (structural) — 4 queries
3. OSHA_1926 (safety) — 3 queries

P1 Gaps (searched 1-2x, high false-positive):
1. ISO_9001:2015 (quality, wrong discipline) — 2 queries
2. API_RP_579 (fitness_for_service, out of scope) — 1 query

Recommended Ingestion Priority:
1. ASTM_A36 (immediate)
2. AISC_360 (immediate)
3. OSHA_1926 (phase 2)
```

### Dashboard 5: Performance Metrics
```
Retrieval Latency (BM25 + Vector):
- p50: 125ms ✅
- p95: 245ms ✅
- p99: 890ms ⚠️ (investigate)

Embedding Cache Hit Rate: 94% ✅

API Error Rate: 0.2% ✅
- 3 timeouts (investigation needed)
- 1 RLS policy error (fixed)

User Satisfaction (NPS-style):
- Will recommend to colleague: 92% yes
- Would use regularly: 87% yes
- Has found useful info: 96% yes
```

---

## 8. Data Collection & Privacy

### Data Retention
- Query logs: 30 days (pilot ends, archive)
- Clicks: 30 days (aggregate into reports)
- Feedback: 90 days (permanent record for corpus decisions)
- Failures: 30 days (analyze for P0/P1 gaps)

### Privacy
- User IDs logged (org_id only, no names)
- No query text stored in feedback table (link only)
- No PII in comments field
- Internal-only: no external reporting

### Compliance
- Audit trail: who accessed which pilot data
- No data export during pilot
- Post-pilot: archive to S3 for analysis

---

## 9. Implementation Checklist

### Phase A: Infrastructure (1 day)
- [ ] Create 5 telemetry tables in Supabase (migrations 023_pilot_telemetry.sql)
- [ ] Add RLS policies (pilot_users check)
- [ ] Create SQL views for dashboards
- [ ] Test migrations locally

### Phase B: API Instrumentation (1 day)
- [ ] Add logging to `/api/agsk/search` endpoint
- [ ] Add `/api/agsk/feedback` endpoint (POST relevance feedback)
- [ ] Add `/api/agsk/failures` endpoint (auto-log retrieval failures)
- [ ] Add `/api/agsk/analytics` endpoint (dashboard data queries)
- [ ] Test with synthetic queries

### Phase C: Frontend Feedback UI (1 day)
- [ ] Add feedback buttons to SearchResults component
- [ ] Implement quick feedback: thumbs up/down
- [ ] Implement detailed feedback modal (citation correctness, false positive)
- [ ] Store clicks automatically (on result click)
- [ ] Test feedback submission

### Phase D: Dashboards (1 day)
- [ ] Create dashboard page (`/dashboard` or admin panel)
- [ ] Implement 5 dashboards (overview, search patterns, quality, gaps, performance)
- [ ] Real-time refresh (5s polling, or WebSocket)
- [ ] Export as JSON/CSV

### Phase E: Pilot Operations (1-2 weeks)
- [ ] Add 3-5 users to pilot_users table
- [ ] Communicate pilot program to participants
- [ ] Monitor dashboards daily
- [ ] Collect feedback from pilot group

### Phase F: Analysis & Reporting (1 day)
- [ ] Generate comprehensive report (corpus gaps, user feedback, recommendations)
- [ ] Prioritize corpus expansion roadmap
- [ ] Identify production issues
- [ ] Recommend changes for public launch

---

## 10. Success Criteria

### Must-Have
- [ ] Retrieval success rate ≥ 85%
- [ ] Citation accuracy ≥ 90%
- [ ] No critical bugs found
- [ ] Latency p95 < 500ms

### Should-Have
- [ ] Top-1 CTR ≥ 60%
- [ ] User satisfaction ≥ 85%
- [ ] Corpus gaps clearly identified
- [ ] Zero security issues

### Nice-to-Have
- [ ] Zero false positives
- [ ] Latency p99 < 1000ms
- [ ] All disciplines represented equally
- [ ] Pilot users suggest improvements

---

## 11. Next Phase: Public Launch

**Trigger:** Pilot results meet success criteria

**Pre-launch Checklist:**
- [ ] Ingest P0 corpus gaps
- [ ] Fix any production bugs
- [ ] Enable all users (remove pilot restriction)
- [ ] Archive pilot telemetry
- [ ] Update documentation

**Post-launch:**
- [ ] Keep telemetry running (2% sample rate after pilot)
- [ ] Monthly corpus gap analysis
- [ ] Quarterly retrieval quality reviews

---

**Created:** 2026-05-09  
**Owner:** Claude Code (Pilot Program Manager)  
**Status:** READY FOR IMPLEMENTATION
