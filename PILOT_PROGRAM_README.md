# AGSK Internal Pilot Program — Setup & Operations Guide

**Start Date:** 2026-05-09  
**Duration:** 1-2 weeks  
**Participants:** 3-5 internal engineers (pipeline, welding, corrosion)  
**Objective:** Validate real usage, collect telemetry, identify corpus gaps before public launch

---

## 🚀 Quick Start

### Phase A: Supabase Migrations (5 min)

```bash
cd d:\ai-institut

# Apply migration 023 (telemetry tables)
npx supabase migration up --project-id inachjylaqelysiwtsux

# Verify tables created
supabase db pull  # Check local schema
```

**Verification:**
```sql
-- Supabase SQL Editor
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'agsk_%' OR table_name = 'pilot_users';

-- Should show:
-- pilot_users
-- agsk_query_log
-- agsk_result_clicks
-- agsk_relevance_feedback
-- agsk_retrieval_failures
-- agsk_corpus_gaps
```

### Phase B: API Deployment (10 min)

```bash
cd services/api-server

# Install new dependencies
npm install

# Test telemetry endpoints locally
npm run dev

# Test endpoints in another terminal:
curl -X POST http://localhost:3000/api/telemetry/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{
    "query_text": "API 5L 2018",
    "result_count": 5,
    "retrieval_latency_ms": 125,
    "discipline": "pipeline",
    "top_result_score": 0.92
  }'
```

### Phase C: Add Pilot Users

```bash
# Connect to Supabase
supabase --project-id inachjylaqelysiwtsux

# SQL: Add pilot users (replace with real user IDs from auth.users)
INSERT INTO pilot_users (user_id, org_id, discipline, notes) VALUES
('uuid-user-1', 'org-acme', 'pipeline', 'Engineer A'),
('uuid-user-2', 'org-acme', 'welding', 'Engineer B'),
('uuid-user-3', 'org-acme', 'corrosion', 'Engineer C');

-- Verify
SELECT user_id, discipline, active FROM pilot_users;
```

### Phase D: Communicate to Pilots

**Email template:**

```
Subject: You're invited to AGSK Internal Pilot Program!

Hi [Name],

We're launching a 1-2 week internal pilot of AGSK (Engineering Standards Knowledge System).
Your role: Use the system normally, give feedback.

What to do:
1. Search for standards as usual (API 5L, ASME B31.x, NACE, etc.)
2. Rate results (👍 relevant / 👎 not relevant)
3. Report false positives or citation errors
4. Note missing standards

What we're measuring:
- Search quality (are results useful?)
- Citation accuracy (are references correct?)
- Missing standards (what should we add?)

Timeline: [Date] to [Date]
Questions? Ping us on Slack.

Thanks!
```

---

## 📊 Monitoring & Dashboards

### Dashboard Access
```
Admin Panel → Telemetry → Dashboard

Or direct API:
GET /api/telemetry/dashboard
```

### Dashboard 1: Real-time Overview
```
Active Users: X
Queries (last 24h): Y
Success Rate: Z%

Issues to Watch:
- No-result queries (suggest corpus gaps)
- Low-confidence results (top_score < 0.5)
- Timeout errors
```

### Dashboard 2: Most Searched Standards
```
1. API 5L 2018 — 24 queries
2. ASME B31.4 — 18 queries
3. NACE MR0175 — 15 queries
4. UNKNOWN_ASTM_A36 — 8 queries (0 results!)
```

### Dashboard 3: Corpus Gaps
```
P0 Gaps (searched ≥3x, 0 results):
- ASTM A36 (structural)
- AISC 360 (structural)

P1 Gaps (false positives):
- ISO 9001 (wrong discipline)
- API RP 579 (out of scope)
```

---

## 🔧 API Reference

### 1. Log a Search Query
```bash
POST /api/telemetry/query

{
  "query_text": "API 5L 2018",
  "query_tokens": 3,
  "discipline": "pipeline",
  "result_count": 5,
  "retrieval_latency_ms": 125,
  "top_result_score": 0.92,
  "top_result_standard_id": "API_5L_2018",
  "session_id": "sess-abc123"
}

Response:
{
  "success": true,
  "query_log_id": "uuid",
  "is_pilot": true
}
```

### 2. Log a Result Click
```bash
POST /api/telemetry/click

{
  "query_log_id": "uuid",
  "result_rank": 1,
  "chunk_id": "chunk-id",
  "standard_id": "API_5L_2018",
  "section_title": "Chapter 2: Design Criteria",
  "time_to_click_ms": 1200
}
```

### 3. Submit Feedback
```bash
POST /api/telemetry/feedback

{
  "query_log_id": "uuid",
  "result_id": "chunk-id",
  "feedback_type": "relevant",  # relevant | irrelevant | partially_relevant
  "citation_correct": true,
  "citation_issue": null,  # if false: missing_section | wrong_section | outdated
  "false_positive": false,
  "correctness_confidence": 5,
  "comments": "Great result, very helpful"
}
```

### 4. Log a Failure (auto-called)
```bash
POST /api/telemetry/failure

{
  "query_log_id": "uuid",
  "failure_type": "no_results",  # no_results | low_confidence | timeout | error
  "query_text": "ASTM A36",
  "discipline": "structural",
  "top_score": null,
  "error_details": null,
  "likely_cause": "corpus_gap"
}
```

### 5. Get Dashboard Data (Admin)
```bash
GET /api/telemetry/dashboard

Response:
{
  "summary": {
    "total_queries": 147,
    "unique_users": 5,
    "zero_result_rate": 0.08,
    "p50_latency": 125,
    "p95_latency": 450
  },
  "top_standards": [...],
  "discipline_distribution": [...],
  "feedback": [...],
  "corpus_gaps": [...],
  "click_through_rate": {
    "overall_ctr": 0.87,
    "top1_ctr": 0.68
  }
}
```

---

## 📝 Frontend Integration

### Search Results Component
```typescript
// After search returns results
const onSearch = async (query: string) => {
  const start = Date.now();
  const results = await search(query);
  const latency = Date.now() - start;

  // Log query
  await fetch('/api/telemetry/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query_text: query,
      result_count: results.length,
      retrieval_latency_ms: latency,
      top_result_score: results[0]?.score,
      session_id: SESSION_ID,
    }),
  });
  // Handle result: Store query_log_id for clicks/feedback
};

// On result click
const onResultClick = async (resultRank, chunk, queryLogId) => {
  await fetch('/api/telemetry/click', {
    method: 'POST',
    body: JSON.stringify({
      query_log_id: queryLogId,
      result_rank: resultRank,
      chunk_id: chunk.id,
      standard_id: chunk.metadata.standard_id,
      time_to_click_ms: Date.now() - searchTime,
    }),
  });
};

// Feedback buttons (👍 / 👎 / 🔗 / 🚫)
<button onClick={() => submitFeedback('relevant')}>👍 Relevant</button>
<button onClick={() => submitFeedback('irrelevant')}>👎 Irrelevant</button>
<button onClick={showDetailedFeedback}>More options...</button>
```

---

## 🎯 Pilot Success Checklist

### Week 1: Setup & Monitoring
- [ ] Migrations deployed to Railway
- [ ] API endpoints tested locally + on Railway
- [ ] 3-5 pilot users added
- [ ] Frontend feedback UI implemented
- [ ] Dashboard live + accessible
- [ ] Pilot group notified + trained

### Week 2: Operations & Analysis
- [ ] Daily dashboard review (issues?)
- [ ] Monitor failures (no-results, errors)
- [ ] Collect user feedback (1:1 if needed)
- [ ] Identify P0/P1 corpus gaps
- [ ] Document unexpected behaviors
- [ ] Measure success criteria
  - [ ] Retrieval success rate ≥ 85%
  - [ ] Citation accuracy ≥ 90%
  - [ ] Top-1 CTR ≥ 60%
  - [ ] User satisfaction ≥ 85%

### Post-Pilot
- [ ] Generate comprehensive report
- [ ] Prioritize corpus expansion (P0/P1 standards)
- [ ] Fix any production bugs
- [ ] Decide: Go / No-Go for public launch
- [ ] Update AGSK roadmap

---

## 🚨 Troubleshooting

### Migrations won't apply
```bash
# Check migration status
supabase migration list

# Check for conflicts
supabase db pull
# Resolve conflicts, re-run
supabase migration up
```

### Telemetry endpoints return 401
```bash
# Make sure request has valid JWT
curl -H "Authorization: Bearer <JWT>" http://localhost:3000/api/telemetry/dashboard
```

### Dashboard returns empty data
```sql
-- Check if queries were logged
SELECT COUNT(*) FROM agsk_query_log;

-- Check if pilot user is marked active
SELECT * FROM pilot_users WHERE active = true;

-- Check RLS policies
SELECT * FROM agsk_query_log WHERE user_id = 'test-user';
```

### False positives in results
```sql
-- Check false_positive feedback
SELECT COUNT(*) as fp_count FROM agsk_relevance_feedback 
WHERE false_positive = true;

-- These should be investigated
```

---

## 📞 Support

**Issues?** Check PILOT_PROGRAM_SPECIFICATION.md for detailed architecture.

**Questions?** Refer to AGSK_WEEK5_STANDARDS_CORPUS_REPORT.md for corpus details.

**Bugs?** Update IMPLEMENTATION_LOG.md with blocker status.

---

**Pilot Program Owner:** Claude Code  
**Last Updated:** 2026-05-09  
**Next Review:** 2026-05-16 (Week 1 checkpoint)
