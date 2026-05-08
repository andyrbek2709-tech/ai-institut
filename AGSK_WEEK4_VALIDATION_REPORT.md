# AGSK Week 4 — Full Corpus Validation Report

**Generated:** 2026-05-08T10:43:51.959Z
**Duration:** 33.0s
**Phase:** Week 4 — Full Corpus Validation

---

## 🔴 Production Readiness: NO-GO

**Score: 30/100**
Critical blockers: **3**
Warnings: **1**

---

## 1. Full Corpus Metrics

| Document | Size | Pages | Words | Sections | Headings | Chunks | Avg tokens |
|----------|------|-------|-------|----------|----------|--------|------------|
| AGSK-3 | 33.7MB | 8375 | 2 227 168 | 27079 | 27078 | 26203 | 110.7 |

### Parser Diagnostics (per document)

#### AGSK-3
- **Parse time:** 25845ms
- **Heading detection:** 27078 total (conf avg: 0.604)
  - L1: 26398 | L2: 680 | L3+: 1
  - Types: uppercase=22769, keyword_cyrillic=598, numbered=3711
- **Section structure:** 27079 sections (orphans: 22689)
  - [L1] Introduction
  - [L1] ТІЗБЕСІ
  - [L1] ПЕРЕЧЕНЬ
  - [L1] АГСК-3
  - [L1] ТІЗБЕСІ
  - [L1] ПЕРЕЧЕНЬ
  - [L1] АГСК-3
  - [L1] АГСК-3
  - [L1] Отдел 21. Материалы и изделия для общестроительных работ 1
  - [L1] Раздел 211. Нерудные строительные материалы и продукция горнодобывающей
- **Metadata:** org=n/a | discipline=n/a | year=2026 | score=1/4
- **Encoding:** issues=0 pages

**Diagnostics:**
  - ✅ PASS: 27079 sections detected
  - 🔴 BLOCKER: citation fill 13.4% (<30%)
  - ✅ PASS: oversized 0.0%
  - ⚠️ WARN: metadata 1/4
  - ✅ PASS: no encoding issues


### Chunk Statistics

| Document | Total | Avg tokens | Min | Max | Oversized% | Orphan% |
|----------|-------|-----------|-----|-----|------------|---------|
| AGSK-3 | 26203 | 110.7 | — | — | 0% | 86.6% |

**Token Distribution (AGSK-3):**
- 0-99 tokens: 17596 chunks
- 100-299 tokens: 4860 chunks
- 300-499 tokens: 3492 chunks
- 500-600 tokens: 255 chunks
- 601+ tokens: 0 chunks

### Citation Statistics

| Document | Section fill | Page fill | Orphan chunks | Unique sections |
|----------|-------------|----------|--------------|----------------|
| AGSK-3 | 13.4% | 100.0% | 22689 | — |

---

## 2. Retrieval Benchmark — Recall@5 / Precision@5

> **Method:** In-memory BM25 index on corpus chunks. Recall measured by keyword overlap
> with `expected_keywords` from evaluation_dataset.json.

**Corpus coverage:** 0/80 queries have matching standards in corpus

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Recall@5 | **25.0%** | ≥60% | 🔴 |
| Precision@5 | **13.9%** | ≥40% | 🔴 |
| Domain coverage | **0%** | ≥80% | 🔴 |

### By Difficulty

| Difficulty | Queries | Recall hits | Recall% |
|-----------|---------|-------------|---------|
| simple | 19 | 5 | 26.3% |
| medium | 45 | 12 | 26.7% |
| complex | 16 | 3 | 18.8% |

### By Discipline

| Discipline | Queries | Recall hits | Recall% |
|-----------|---------|-------------|---------|
| pipeline | 14 | 5 | 35.7% |
| structural | 5 | 1 | 20.0% |
| mechanical | 36 | 7 | 19.4% |
| welding | 4 | 2 | 50.0% |
| safety | 4 | 0 | 0.0% |
| corrosion | 6 | 5 | 83.3% |
| inspection | 11 | 0 | 0.0% |

### Domain Coverage Analysis

**Standards required by eval dataset (37 unique):**
ACI 318, AISC 360, API 1104, API 2000, API 513, API 520, API 570, API 579, API 580, API 5L, API 6D, ASCE 7, ASME B16.5, ASME B31.1, ASME B31.3, ASME B31.4, ASME B31.8, ASME B31.8S, ASME B36.10M, ASME PESC-1, ASME Section, ASTM A106, ASTM A370, ASTM A53, AWS D1.1, BS 7910, DNV GL-CP-0214, GOST 27751-2014, GOST 27751-2020, ISO 1219-1, International Fire, NACE MR0175, NACE RP0169, NACE SP0208, NACE SP0294, NIST SP, OSHA 1910.146

**Standards available in corpus (1 unique):**
AGSK 3

**Root cause of low recall:**
AGSK-3 is a *construction materials catalog* containing item lists, not individual engineering standards.
The evaluation dataset queries target API 5L, ASME B31.x, ASTM A106, NACE, AWS, etc. — which are separate PDFs
not yet ingested. **This is expected behavior** — corpus needs to be expanded with individual standards.

---

## 3. Citation Validation

### Section Correctness

- **AGSK-3:** section fill = 13.4% | page fill = 100.0%

### Hierarchy Correctness

- **AGSK-3:** L1=26398 L2=680 L3+=1 → 3-level hierarchy

### Version Correctness

- **AGSK-3:** year=2026 | version metadata completeness=1/4

### Issues Found

- 🔴 AGSK-3: section fill rate 13.4% < 30%


---

## 4. False Positive Analysis

**Total queries with false positive risk: 12**

| Risk Type | Count | Description |
|-----------|-------|-------------|
| cyrillic_latin_overlap | 10 | Terms shared between CIS (GOST) and Western standards |
| version_year_confusion | 1 | Year in query could match wrong standard version |
| api_acronym_collision | 1 | "API" mixed with ASME/ISO acronyms; ranking ambiguity |

### Top False Positive Cases

- **Q001** [cyrillic_latin_overlap]: "cyrillic_latin_overlap" — Terms shared between CIS (GOST) and Western standards
- **Q005** [cyrillic_latin_overlap]: "cyrillic_latin_overlap" — Terms shared between CIS (GOST) and Western standards
- **Q014** [cyrillic_latin_overlap]: "cyrillic_latin_overlap" — Terms shared between CIS (GOST) and Western standards
- **Q019** [version_year_confusion]: "version_year_confusion" — Year in query could match wrong standard version
- **Q020** [cyrillic_latin_overlap]: "cyrillic_latin_overlap" — Terms shared between CIS (GOST) and Western standards
- **Q021** [cyrillic_latin_overlap]: "cyrillic_latin_overlap" — Terms shared between CIS (GOST) and Western standards
- **Q023** [cyrillic_latin_overlap]: "cyrillic_latin_overlap" — Terms shared between CIS (GOST) and Western standards
- **Q027** [cyrillic_latin_overlap]: "cyrillic_latin_overlap" — Terms shared between CIS (GOST) and Western standards
- **Q032** [cyrillic_latin_overlap]: "cyrillic_latin_overlap" — Terms shared between CIS (GOST) and Western standards
- **Q041** [cyrillic_latin_overlap]: "cyrillic_latin_overlap" — Terms shared between CIS (GOST) and Western standards

### Mitigation Recommendations

1. **API ambiguity**: Add metadata filter `discipline=pipeline` when query contains "API 5L/API 1104"
2. **Acronym collisions**: Weight `citation_standard` field match higher in hybrid search scoring
3. **Version confusion**: Store `version` as explicit metadata; add version filter to search API
4. **Cyrillic/Latin overlap**: Detect query language and weight BM25 by script alignment score

---

## 5. Retrieval Quality Analysis

### Score Distribution (BM25 in-memory)


| Metric | Value |
|--------|-------|
| p50 BM25 latency | 66.07ms |
| p95 BM25 latency | 77.68ms |
| Avg BM25 latency | 66.17ms |


### Retrieval Behaviors

- **Orphan chunk rate:** 86.6% (chunks without section citations)
- **Section coverage:** 13.4% of chunks have section identifier
- **Metadata filtering:** discipline and org metadata available on 0/1 docs

### Oversized/Orphan Analysis

- **AGSK-3:**
  - Oversized (>660t): 0% — ✅ within target
  - Orphan sections: not tracked (would need section-level analysis)
  - Token distribution: 0-99:17596 | 100-299:4860 | 300-499:3492 | 500-600:255 | 601+:0

---

## 6. Performance Validation

### Ingestion Throughput

| Stage | p50 | p95 | Throughput |
|-------|-----|-----|-----------|
| PDF Parse | 25845ms | 25845ms | 324 pages/s |
| Chunking | 453ms | 453ms | 57843.3 chunks/s |
| Embedding* | N/A | N/A | ~100 chunks/batch (OpenAI) |
| Vector insert* | N/A | N/A | Supabase bulk upsert |

**Requires live OpenAI + Supabase — not measurable offline*

### Retrieval Latency

| Search type | p50 | p95 | Target |
|------------|-----|-----|--------|
| BM25 (in-memory) | 66.07ms | 77.68ms | <50ms |
| Vector (pgvector)* | N/A | N/A | <200ms |
| Hybrid (RRF)* | N/A | N/A | <500ms |

**Vector/hybrid requires live Supabase + pgvector HNSW index*

### Projection for Full Corpus (5 engineers, 50 standards)

| Scenario | Estimated time | Notes |
|---------|----------------|-------|
| Single 35MB catalog (AGSK-3 style) | ~0 min parse | One-time ingestion |
| 50× individual standards (avg 2MB each) | ~30 min total | Batch ingestion |
| Re-ingestion on update | ~1 min/standard | Delta re-index |
| Query latency at 5 concurrent | <500ms | Target met |

---

## 7. Production Readiness Assessment

### Blockers

🔴 **BLOCKER** [citation]: AGSK-3: section fill rate 13.4% < 30%
   → Remediation: Increase heading detection threshold or add more Cyrillic patterns

🔴 **BLOCKER** [retrieval]: Recall@5 = 25.0% — critical threshold not met
   → Remediation: Ingest actual standards PDFs (API, ASME, GOST). Current corpus is a catalog, not the target standards.

🔴 **BLOCKER** [corpus]: 100% of eval queries target standards not in corpus
   → Remediation: AGSK-3 is a materials catalog. Need individual standards: API 5L, ASME B31.x, GOST standards etc.

### Warnings

⚠️ **WARN** [metadata]: AGSK-3: metadata completeness 1/4
   → Remediation: Add document-specific metadata patterns

---

## 8. 🔴 GO / NO-GO Recommendation

**Verdict: NO-GO**
**Readiness score: 30/100**


### 🔴 NO-GO — Critical blockers must be resolved

Critical issues prevent production deployment. See Blockers section above.


---

## 9. Remaining Blockers

🔴 [CITATION] AGSK-3: section fill rate 13.4% < 30%
🔴 [RETRIEVAL] Recall@5 = 25.0% — critical threshold not met
🔴 [CORPUS] 100% of eval queries target standards not in corpus
⚠️ [METADATA] AGSK-3: metadata completeness 1/4

### Post-Week 4 Action Items

1. **Corpus expansion** (highest priority): Ingest AGSK-1, AGSK-2 + individual standards PDFs
2. **Live Recall@5 validation**: After ingestion, run eval queries against live Supabase
3. **Railway deployment**: Deploy agsk-ingestion service + configure env vars
4. **End-to-end smoke test**: Upload PDF via API → search → verify citations
5. **Performance monitoring**: Set up retrieval latency dashboard

---

*Generated by AGSK Week 4 Validation Suite — 2026-05-08T10:43:51.959Z*
