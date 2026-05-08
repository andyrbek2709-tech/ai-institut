# AGSK Engineering AI Platform — Production Evaluation Dataset

**Status:** PRE-IMPLEMENTATION VALIDATION PHASE  
**Date:** 2026-05-08  
**Purpose:** Benchmark retrieval quality, citation accuracy, and relevance before deployment  
**Timeline:** Use for Week 3-4 (production readiness checks)

---

## 📋 DATASET OVERVIEW

This dataset contains **80 realistic engineering queries** organized by discipline and complexity level. Each query has:
- Expected standards (ISO, ASME, GOST, API, etc.)
- Expected sections (with hierarchy)
- Expected citations (exact location in standards)
- Expected keywords (for BM25 matching)
- Expected discipline (structural, pipeline, electrical, etc.)
- Confidence score (how confident we are in the ground truth)

### Dataset Statistics

| Metric | Value |
|--------|-------|
| Total Queries | 80 |
| Disciplines | 7 (pipeline, structural, mechanical, electrical, geotechnical, fire safety, inspection) |
| Difficulty Levels | 3 (simple=30%, medium=50%, complex=20%) |
| Standards Covered | 20+ (API, ASME, ISO, GOST, EN, etc.) |
| Total Expected Citations | 150+ |
| Ambiguous Queries (edge cases) | 8 |
| Version Conflict Queries | 5 |

---

## 🎯 EVALUATION CRITERIA

### 1. Retrieval Quality (Primary Metric)

**Success Criteria:**
- **Recall@5:** ≥ 0.85 (can find 85% of relevant documents in top 5)
- **Precision@5:** ≥ 0.80 (80% of top 5 results are actually relevant)
- **nDCG@5:** ≥ 0.82 (top results ranked correctly)

**Measurement:**
```python
# For each query:
retrieved = search(query, top_k=5)
relevant = gold_dataset[query]["expected_standards"]

recall@5 = |retrieved ∩ relevant| / |relevant|
precision@5 = |retrieved ∩ relevant| / 5
```

### 2. Citation Accuracy

**Success Criteria:**
- **Citation Precision:** ≥ 0.90 (90% of cited sections actually exist in standard)
- **Citation-Query Alignment:** ≥ 0.85 (cited section answers user query)
- **False Citation Rate:** ≤ 0.05 (≤5% of results cite wrong sections)

**Measurement:**
```python
# For each citation in result:
cited_section = result["citation"]["section"]
cited_document = result["citation"]["document"]

# Verify section exists
verify_section_exists(cited_document, cited_section)

# Verify content matches query intent
similarity = semantic_similarity(query, cited_content)
```

### 3. Latency Performance

**Success Criteria:**
- **p50 latency:** ≤ 200ms
- **p95 latency:** ≤ 500ms
- **p99 latency:** ≤ 1000ms

**Measurement:**
```
Time from query submission to results returned
Include: embedding generation, BM25 search, vector search, RRF fusion
Exclude: frontend rendering, network latency to client
```

### 4. RAGAS Evaluation Metrics

**Faithfulness** (≥ 0.85 required)
- Is response grounded in retrieved documents?
- Does citation actually support the claim?
- No hallucinations or invented information

**Answer Relevance** (≥ 0.80 required)
- Does response answer the user's question?
- Semantic similarity between query and response

**Context Relevance** (≥ 0.75 required)
- Is retrieved context useful for answering?
- Proportion of context that supports the response

**Context Recall** (≥ 0.70 required)
- Does context contain all necessary information?
- Can user answer question from retrieved chunks?

---

## 📊 DATASET STRUCTURE

Each query entry contains:

```json
{
  "query_id": "Q001",
  "query_text": "What are the minimum wall thickness requirements for API 5L Grade X52 pipeline at 1000 psi pressure?",
  "difficulty": "medium",
  "discipline": "pipeline",
  "topics": ["API 5L", "pressure", "wall thickness", "design"],
  "expected_standards": [
    {
      "standard": "API 5L",
      "version": "2018",
      "sections": ["4.2.1", "4.2.2", "7.1"],
      "relevance_score": 0.95,
      "reason": "Defines pressure/wall thickness tables"
    },
    {
      "standard": "ASME B31.8",
      "version": "2020",
      "sections": ["823.1", "823.3"],
      "relevance_score": 0.75,
      "reason": "Provides design guidelines for onshore pipeline"
    }
  ],
  "expected_keywords": [
    "wall thickness", "API 5L", "Grade X52", "pressure",
    "design", "1000 psi", "seamless", "specification"
  ],
  "expected_citations": [
    {
      "document": "API 5L 2018",
      "section": "7.1 - Pressure Testing",
      "excerpt_keywords": ["wall thickness", "minimum"],
      "citation_type": "normative"
    }
  ],
  "ground_truth_answer": "API 5L Table 1 specifies minimum wall thickness for Grade X52 at 1000 psi based on diameter and grade. Refer to Section 7.1 for calculation methodology.",
  "confidence": 0.92,
  "notes": "Common design question, should retrieve API 5L first"
}
```

---

## 🔍 QUERY CATEGORIES

### Category 1: Normative Reference Lookups (Simple, 24 queries)

User needs to find a specific requirement or table from a standard.

**Example 1:** "What is the allowable stress for ASTM A106 Grade B steel at 400°F?"
- Expected: ASME B31.4, Section 403, Table 1
- Difficulty: Simple
- Keywords: allowable stress, A106, Grade B, temperature

**Example 2:** "What does ISO 1219-1 say about hydraulic pressure symbols?"
- Expected: ISO 1219-1, Section 4.2
- Difficulty: Simple
- Keywords: hydraulic symbols, ISO 1219, pressure

**Example 3:** "Minimum concrete cover for rebars exposed to seawater per ACI 318?"
- Expected: ACI 318, Chapter 20, Table 20.6.1
- Difficulty: Simple
- Keywords: concrete cover, ACI, seawater, durability

### Category 2: Design & Calculation Guidance (Medium, 40 queries)

User needs to understand how to apply a standard in design.

**Example 1:** "How do I calculate the combined stress check for a pressure vessel according to ASME Section VIII Division 1?"
- Expected: ASME VIII-1, Section 3, UG-23 (Von Mises)
- Difficulty: Medium
- Keywords: stress, pressure vessel, combined stress, ASME

**Example 2:** "What is the proper procedure for field welding API 5L X-grade pipeline with pre-heat requirements?"
- Expected: API 5L, Section 8; AWS D1.1
- Difficulty: Medium
- Keywords: field welding, X-grade, pre-heat, procedure

**Example 3:** "Seismic design: how to calculate base shear for a steel frame per AISC 360?"
- Expected: AISC 360, Chapter E; ASCE 7
- Difficulty: Medium
- Keywords: seismic, base shear, steel frame, design

### Category 3: Inspection & Repair Standards (Medium, 16 queries)

User needs to verify compliance or repair procedures.

**Example 1:** "What are the acceptance criteria for ultrasonic testing of welds per ASME Section V?"
- Expected: ASME V, Article 4 (UT); ASME BPVC
- Difficulty: Medium
- Keywords: ultrasonic testing, UT, acceptance criteria, weld

**Example 2:** "Can I use epoxy coating repair for a corroded carbon steel pipe per NACE MR0175?"
- Expected: NACE MR0175, Section 5; corrosion mitigation
- Difficulty: Medium
- Keywords: epoxy coating, corrosion, NACE, repair

### Category 4: Compliance & Safety (Medium, 12 queries)

User needs to ensure project meets regulatory requirements.

**Example 1:** "What fire protection rating is required for a pipeline in a residential area per IFC?"
- Expected: IFC (International Fire Code), Chapter 12
- Difficulty: Medium
- Keywords: fire protection, residential, IFC, safety

**Example 2:** "OSHA requirements for confined space entry during pipeline inspection?"
- Expected: OSHA 1910.146, ASME PESC-1
- Difficulty: Medium
- Keywords: confined space, OSHA, pipeline, inspection

### Category 5: Ambiguous & Multi-Standard Queries (Complex, 8 queries)

User query could match multiple standards; system must return most relevant.

**Example 1:** "What pressure can a DN 150 carbon steel pipe handle?"
- Ambiguous: Pressure depends on wall thickness, grade, material, and service
- Expected Standards: API 5L, ASME B31.4, ISO 1128, grade-dependent tables
- Difficulty: Complex
- Challenge: Return most applicable standard for context; cite pressure tables

**Example 2:** "How thick should concrete be for a pipeline crossing?"
- Ambiguous: Thickness depends on soil type, pipeline pressure, and traffic load
- Expected Standards: ASME B31.4, local soil codes, ACI 318
- Difficulty: Complex
- Challenge: Need multi-standard synthesis

---

## 🗂️ DISCIPLINE BREAKDOWN

### Pipeline Engineering (30 queries)
- API 5L, 5CT (casing/tubing)
- ASME B31.4 (liquid), B31.8 (gas)
- ISO 1128, ISO 13849
- Corrosion, cathodic protection (NACE)

### Structural Engineering (15 queries)
- AISC 360, ASTM standards
- ACI 318 (concrete), PCI
- Seismic (ASCE 7)
- Steel connection design

### Mechanical/Pressure Systems (15 queries)
- ASME Section VIII (vessels)
- API 570, 579 (inspection, fitness for service)
- ISO 1219 (hydraulics)
- Valve standards

### Electrical & Safety (10 queries)
- NFPA 70 (NEC)
- IEC standards
- Hazardous area classification
- Grounding & bonding

### Welding & Fabrication (5 queries)
- AWS D1.1, D1.3
- ASME Section IX
- Weld inspection criteria

### Corrosion & Material Selection (5 queries)
- NACE MR0175, MR0103
- Corrosion control standards
- Material compatibility

---

## 📈 DIFFICULTY LEVELS

### Level 1: Simple (30% of dataset, 24 queries)
- Direct lookups (table, value, requirement)
- Single standard, often one section
- <30 seconds to answer manually
- Example: "What is yield strength of A36 steel?"

**Retrieval targets:** High recall on specific standard + section

### Level 2: Medium (50% of dataset, 40 queries)
- Apply standard to situation
- May need 2-3 standards
- Cross-reference between sections
- Example: "How to size a pressure relief valve per API 2000?"

**Retrieval targets:** Correct standards ranked high + relevant sections

### Level 3: Complex (20% of dataset, 16 queries)
- Multi-document synthesis
- Contextual interpretation
- Trade-offs between standards
- Example: "Is concrete or steel casing better for subsea pipeline?"

**Retrieval targets:** All relevant standards in top 5 + proper weighting

---

## 🔴 EDGE CASES & REGRESSION TESTS (8 queries)

These queries test for common failure modes:

1. **Temporal Ambiguity:**
   - Query: "What does GOST 27751 say about load calculations?"
   - Issue: Multiple versions (2011, 2014, 2020) exist
   - Test: System correctly filters by version OR shows all versions

2. **Acronym Overloading:**
   - Query: "What is API 5L?"
   - Issue: Could refer to standard document itself (correct) or companies using it (incorrect)
   - Test: First result is actual API 5L standard

3. **False Positives (BM25):**
   - Query: "Pressure drop in pipes"
   - Issue: BM25 matches "pressure" + "drop" separately; may return pressure testing standards (irrelevant)
   - Test: Vector search corrects and returns fluid dynamics sections

4. **Section Numbering Variations:**
   - Query: "ASME B31.8 Section 800"
   - Issue: Standards use different numbering: Chapter 8 vs. 800 vs. 8.1
   - Test: System returns equivalent sections regardless of notation

5. **Units & Conversions:**
   - Query: "What is maximum stress in MPa for X52 Grade steel?"
   - Issue: API 5L tables use psi; user wants SI units
   - Test: Returns correct API table; user can convert (or system converts)

6. **Obsolete Standards:**
   - Query: "What does ANSI B4.1 say?"
   - Issue: Superseded by newer standards (ASME Y14.4)
   - Test: System notes supersession and suggests current standard

7. **Cross-Domain Query:**
   - Query: "Fire safety for underwater pipelines"
   - Issue: Combines pipeline (ASME B31.8) + fire (NFPA) + subsea (DNV)
   - Test: Returns relevant sections from multiple standards

8. **Vague Requirements:**
   - Query: "What makes a good weld?"
   - Issue: Subjective; depends on application
   - Test: Returns acceptance criteria from AWS D1.1 + application-specific standards

---

## 📝 EVALUATION WORKFLOW (Week 3-4)

### Phase 1: Baseline Measurement (Day 15)

```bash
# Before optimization
for query in evaluation_dataset:
    results = search(query)
    
    # Measure retrieval quality
    recall = compute_recall(results, query.expected_standards)
    precision = compute_precision(results, query.expected_standards)
    
    # Measure citation accuracy
    citations_valid = verify_citations(results)
    
    # Measure latency
    latency = measure_response_time(results)
    
    # Log results
    log_baseline(query_id, recall, precision, citations_valid, latency)

# Report: baseline_metrics.json
# {
#   "avg_recall@5": 0.78,
#   "avg_precision@5": 0.75,
#   "citation_accuracy": 0.82,
#   "p95_latency_ms": 520
# }
```

### Phase 2: Optimization (Days 15-18)

If baseline metrics below targets:
- Adjust chunk size (600 tokens tested, but may need 500 or 700)
- Improve metadata (add discipline tags, better section hierarchy)
- Fine-tune RRF weights (BM25 vs. vector ratio)
- Consider re-embedding with different model

### Phase 3: Final Validation (Days 19-20)

```bash
# Run full RAGAS evaluation
for query in evaluation_dataset:
    retrieved = search(query)
    response = generate_response(query, retrieved)  # Using LLM if applicable
    
    # RAGAS metrics
    faithfulness = evaluate_faithfulness(response, retrieved)
    answer_relevance = evaluate_answer_relevance(query, response)
    context_relevance = evaluate_context_relevance(query, retrieved)
    context_recall = evaluate_context_recall(query, retrieved)
    
    if faithfulness < 0.85:
        log_failure(query_id, "faithfulness too low")
    
    log_ragas(query_id, faithfulness, answer_relevance, context_relevance, context_recall)

# Report: ragas_metrics.json
# {
#   "avg_faithfulness": 0.87,
#   "avg_answer_relevance": 0.82,
#   "avg_context_relevance": 0.79,
#   "avg_context_recall": 0.74,
#   "failures": 3
# }
```

### Phase 4: Production Readiness (Day 20)

**Go/No-Go Criteria:**

| Metric | Target | Required? |
|--------|--------|-----------|
| Recall@5 | ≥ 0.85 | ✅ YES |
| Precision@5 | ≥ 0.80 | ✅ YES |
| RAGAS Faithfulness | ≥ 0.85 | ✅ YES |
| Citation Accuracy | ≥ 0.90 | ✅ YES |
| p95 Latency | ≤ 500ms | ⚠️ WARN (up to 1s acceptable) |

**Decision Rules:**
- All ✅ metrics met → **PROCEED TO PRODUCTION**
- Any ✅ metric failed → **PAUSE, INVESTIGATE, OPTIMIZE**
- ⚠️ metrics slightly over → **OK, MONITOR IN PRODUCTION**

---

## 🛠️ AUTOMATED TEST SUITE

### Smoke Tests (Daily)
Run on every deployment to catch regressions:
```
1. Query Q001 → Should find API 5L
2. Query Q015 → Should find ASME B31.4
3. Query Q050 → Should return <500ms
4. Citation check → No invalid references
```

### Regression Tests (Weekly)
Run full dataset, compare to baseline:
```
If avg_recall drops >5% → alert
If avg_precision drops >5% → alert
If citation_accuracy drops >3% → alert
If p95_latency exceeds 600ms → alert
```

### Stress Tests (Monthly)
```
Run 1000 concurrent queries
Measure: throughput, latency under load, error rate
Expected: <2% error rate, latency SLA maintained
```

---

## 📄 DOCUMENTATION FOR DATASET

### For QA/Testing Team:
- evaluation_dataset.json — All 80 queries with ground truth
- test_runner.py — Execute tests, generate reports
- evaluation_config.yaml — Thresholds, sample sizes

### For Engineers:
- AGSK_EVALUATION_DATASET.md (this file) — Full documentation
- README_EVALUATION.md — How to run tests locally

### For Deployment:
- acceptance_criteria.md — Go/no-go decision tree
- failure_analysis.md — Template for investigating poor results

---

## 🚀 NEXT STEPS

**Immediate (Before 2026-05-13):**
1. ✅ Review this dataset with team
2. ✅ Verify expected standards & sections are accurate
3. ✅ Create evaluation_dataset.json (detailed queries)
4. ✅ Set up test runner (Python script)

**Week 1-2 (During Implementation):**
- Create evaluation infrastructure (logging, metrics collection)
- Test retrieval locally as you build

**Week 3 (Before Production):**
- Run baseline evaluation
- Optimize if metrics below targets
- Final RAGAS validation

**Week 4 (Deployment):**
- Execute final smoke tests
- Deploy with monitoring
- Track metrics in production

---

**Created:** 2026-05-08  
**For Implementation Phase:** 2026-05-13 to 2026-06-06  
**Status:** ✅ READY FOR USE  
**Maintainer:** Claude Code (Implementation phase)
