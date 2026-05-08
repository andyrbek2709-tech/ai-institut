# Controlled OCR Pilot Architecture

> **Operational Validation Before Full OCR Rollout**
>
> *Objective: Test OCR assumptions on a representative pilot corpus before production deployment.*

**Status:** 🟡 **PILOT DESIGN PHASE — STAGE 1 ACTIVE**

**Date:** 2026-05-09  
**Phase:** OCR Architecture Design → Controlled Pilot  
**Scope:** Representative pilot corpus (NOT large-scale), sandboxed pipeline, operational validation

---

## Executive Summary

The OCR architecture design is **governance-ready, calibration-ready, audit-ready**. However, architectural design ≠ operational readiness. This pilot validates:

- ✅ **Confidence behavior** — real confidence scores on representative documents
- ✅ **Review workflows** — reviewer workload, SLA realism, correction frequency
- ✅ **Failure modes** — actual OCR failures collected and categorized
- ✅ **Calibration stability** — confidence calibration on real data
- ✅ **Governance execution** — review assignment, escalation, auditability work operationally

**Pilot Outcome:** → **APPROVE** (proceed to full OCR) OR **BLOCK** (redesign required)

---

## Pilot Architecture: 8-Stage Pipeline

```
┌────────────────────────────────────────────────────────────┐
│ STAGE 1: Pilot Corpus Design                              │
│ ├─ scanned standards (representative)                     │
│ ├─ engineering formulas (multiline, subscripts)           │
│ ├─ engineering tables (3-5 tables, varying complexity)    │
│ ├─ low-quality scans (degraded, rotated, multilingual)   │
│ ├─ failure exemplars (known hard cases)                   │
│ └─ size: ~50-100 documents (NOT production scale)        │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ STAGE 2: Pilot OCR Pipeline (Sandboxed)                   │
│ ├─ Document preprocessing (deterministic, v1.0)           │
│ ├─ OCR extraction (confidence scoring per-block)          │
│ ├─ Confidence classification (HIGH/MEDIUM/LOW/VERY_LOW)   │
│ ├─ Human review routing (mandatory for LOW/VERY_LOW)      │
│ ├─ Correction lineage tracking (append-only)              │
│ ├─ Audit recording (governance compliance)                │
│ └─ isolation: pilot-only database, non-production         │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ STAGE 3: Confidence Validation                            │
│ ├─ Formula confidence (multiline, subscripts, units)      │
│ ├─ Numeric confidence (decimals, minus signs, units)      │
│ ├─ Table confidence (alignment, borders, values)          │
│ ├─ Multilingual confidence (Cyrillic, Latin, mixed)       │
│ ├─ Low-quality scan confidence (degraded, rotated)        │
│ └─ deliverable: confidence distribution report            │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ STAGE 4: Review Workflow Validation                       │
│ ├─ reviewer workload (blocks/hour, correction rate)       │
│ ├─ SLA realism (24-hour review target)                    │
│ ├─ correction frequency (errors per 100 blocks)           │
│ ├─ escalation frequency (escalated blocks)                │
│ ├─ correction lineage quality (audit trail completeness)  │
│ └─ deliverable: workflow metrics report                   │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ STAGE 5: Failure Collection & Categorization              │
│ ├─ formula corruption (missing operators, wrong subscripts)│
│ ├─ unit corruption (unit loss, unit transposition)        │
│ ├─ decimal corruption (missing/extra decimal points)      │
│ ├─ minus sign corruption (sign flip, missing sign)        │
│ ├─ table misalignment (row/column drift, missing cells)   │
│ ├─ Cyrillic/Latin confusion (character substitution)      │
│ ├─ preprocessing artifacts (image corruption)             │
│ └─ deliverable: failure taxonomy + examples               │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ STAGE 6: Calibration Drift Analysis                       │
│ ├─ confidence overconfidence (high score, low correctness) │
│ ├─ confidence underconfidence (low score, high correctness)│
│ ├─ formula confidence inflation (formulas overscored)      │
│ ├─ numeric confidence instability (0.95 → 0.50)           │
│ └─ deliverable: calibration report + threshold adjustment │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ STAGE 7: Pilot Governance Review                          │
│ ├─ review assignment (routing logic works)                │
│ ├─ escalation workflow (works end-to-end)                 │
│ ├─ correction auditability (every change logged)          │
│ ├─ operator accountability (user attribution complete)    │
│ ├─ lineage integrity (no data loss, no gaps)              │
│ └─ deliverable: governance validation report              │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ STAGE 8: Pilot Release Gate                               │
│ ├─ confidence stability acceptable? (calibration good)    │
│ ├─ review workflow scalable? (SLA achievable)             │
│ ├─ failure rate acceptable? (categorized + mitigated)     │
│ ├─ governance working? (all requirements verified)        │
│ ├─ residual risks acceptable? (mitigations documented)    │
│ └─ decision: APPROVE OCR → proceed to implementation      │
│             or BLOCK OCR → redesign + re-pilot            │
└────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Pilot Corpus Design

### Objective
Create a **representative, controlled pilot dataset** that validates OCR assumptions without requiring large-scale corpus.

### Corpus Composition

#### Category 1: Scanned Standards (15-20 documents)
- **Purpose:** Baseline OCR performance on typical engineering documentation
- **Content:** Representative standards from AGSK (engineering, industrial)
- **Format:** PDF scans (200-300 DPI)
- **Metrics:** page count, text density, complexity

**Examples:**
- ISO standard extract (50-100 pages typical)
- Industrial engineering standard (formulas, tables)
- Process documentation (mixed text/tables/figures)

**Validation Metrics:**
- OCR accuracy (character-level, block-level)
- Confidence distribution
- Failure rate by block type

---

#### Category 2: Engineering Formulas (10-15 documents)
- **Purpose:** Validate formula extraction (critical for AGSK)
- **Content:** Multiline formulas, subscripts, superscripts, unit expressions
- **Format:** PDF scans + reference (canonical formulas)
- **Metrics:** formula accuracy, subscript/superscript handling

**Examples:**
- Stress calculation formulas (multiline, complex subscripts)
- Unit conversions (dimensional analysis)
- Statistical formulas (Cyrillic variable names)

**Validation Metrics:**
- Formula recognition rate
- Subscript/superscript accuracy
- Unit corruption rate (unit loss, transposition)

---

#### Category 3: Engineering Tables (5-10 documents)
- **Purpose:** Validate table extraction (high value for AGSK)
- **Content:** 3-5 tables per document, varying complexity
- **Format:** PDF scans (border tables, gridded tables, sparse tables)
- **Metrics:** table recognition, cell accuracy, alignment

**Examples:**
- Material property tables (rows: materials, columns: properties)
- Lookup tables (sparse, variable-length rows)
- Cross-reference tables (multiple columns, headers)

**Validation Metrics:**
- Table recognition rate
- Row/column alignment accuracy
- Cell value accuracy (numeric + text)

---

#### Category 4: Low-Quality Scans (8-12 documents)
- **Purpose:** Validate confidence degradation under adverse conditions
- **Content:** Intentionally degraded scans (rotated, low DPI, shadows)
- **Format:** PDF scans (100 DPI, rotated, ink shadows)
- **Metrics:** preprocessing effectiveness, confidence response

**Examples:**
- Rotated pages (45°, 90°, partial rotation)
- Low-resolution scans (100 DPI, compressed)
- High-contrast shadows (lighting artifacts)
- Partial page scans (cropped edges)

**Validation Metrics:**
- Preprocessing success rate
- Confidence under degradation
- Failure mode distribution

---

#### Category 5: Multilingual Documents (5-8 documents)
- **Purpose:** Validate Cyrillic/Latin handling (AGSK is Russian-English)
- **Content:** Mixed Cyrillic/Latin text, variable encoding
- **Format:** PDF scans (native + scanned)
- **Metrics:** language detection, character confusion, encoding stability

**Examples:**
- Russian standards (Cyrillic text, Latin formula variables)
- Mixed Russian/English tables (column headers, data)
- Variable names (Cyrillic + Latin, subscripts)

**Validation Metrics:**
- Language detection accuracy
- Cyrillic/Latin confusion rate
- Encoding stability (UTF-8 preservation)

---

#### Category 6: Known Failure Cases (3-5 documents)
- **Purpose:** Validate error detection and correction workflow
- **Content:** Documents known to fail (from architecture design analysis)
- **Format:** Curated failure exemplars
- **Metrics:** failure detection, recovery, correction time

**Examples:**
- Pages with formula/table fusion (ambiguous regions)
- Ultra-low-quality scans (near-illegible)
- Complex Cyrillic subscripts (historical documents)

**Validation Metrics:**
- Confidence on failure cases (should be LOW/VERY_LOW)
- Reviewer correction rate
- Correction time (SLA adherence)

---

### Pilot Corpus Specifications

| Attribute | Value |
|-----------|-------|
| **Total Documents** | 50-100 |
| **Total Pages** | 500-1,000 |
| **Total Blocks** (para + formula + table) | 2,000-3,000 |
| **Scanned Standards** | 15-20 (60-70% of corpus) |
| **Engineering Formulas** | 10-15 (20-30% for focus) |
| **Tables** | 5-10 (15-25% for focus) |
| **Low-Quality** | 8-12 (20-25% for stress) |
| **Multilingual** | 5-8 (15-20% for robustness) |
| **Known Failures** | 3-5 (5% for recovery) |
| **Format** | PDF (PDF/A compliance optional) |
| **Resolution** | 150-300 DPI (representative) |

**Rationale:**
- **Size:** Small enough to complete pilot in 2-3 weeks; large enough to surface real issues
- **Mix:** Balanced across categories (standards, formulas, tables, stress cases)
- **Quality:** Representative of production documents (not cherry-picked)

---

## Stage 2: Pilot OCR Pipeline (Sandboxed)

### Pipeline Architecture

```
Document Input
  │
  ├─→ [Page Extraction] (PDF → images, deterministic)
  │
  ├─→ [Preprocessing] (image → enhanced, v1.0 deterministic)
  │   ├─ resize (target: 2400x3200 @ 72 PPI)
  │   ├─ grayscale (8-bit)
  │   ├─ denoise (bilateral filter)
  │   ├─ contrast normalization (CLAHE)
  │   └─ skew correction (angle detection + rotation)
  │
  ├─→ [Layout Detection] (image → regions, deterministic)
  │   ├─ region type classification (text, formula, table)
  │   ├─ region bounds (x, y, width, height)
  │   └─ reading order (top-to-bottom, left-to-right)
  │
  ├─→ [OCR Extraction] (region → text + confidence, probabilistic)
  │   ├─ Tesseract v5.x (engine version locked)
  │   ├─ text output (UTF-8, per-block)
  │   └─ confidence (0.0-1.0, per-block)
  │
  ├─→ [Confidence Scoring] (block data → confidence class, deterministic)
  │   ├─ confidence value (0.70-1.0)
  │   ├─ confidence class (HIGH ≥0.95, MEDIUM 0.85-0.94, LOW 0.70-0.84, VERY_LOW <0.70)
  │   ├─ confidence flags (formula, numeric, table, multilingual)
  │   └─ review_required (TRUE if confidence < 0.85)
  │
  ├─→ [Review Routing] (block → reviewer queue, deterministic)
  │   ├─ HIGH confidence → stored, no review
  │   ├─ MEDIUM confidence → logged, optional review
  │   ├─ LOW/VERY_LOW confidence → mandatory review queue
  │   └─ escalation queue (if review_required exceeded SLA)
  │
  ├─→ [Human Review] (block + correction, asynchronous)
  │   ├─ reviewer assignment (round-robin)
  │   ├─ decision (accept/reject/correct)
  │   ├─ correction lineage (correction_id, reviewer_id, timestamp)
  │   └─ SLA tracking (24 hours per block)
  │
  ├─→ [Correction Recording] (correction → immutable log, deterministic)
  │   ├─ ocr_corrections table (append-only)
  │   ├─ original_text, corrected_text, confidence_before, confidence_after
  │   ├─ reviewer_id, timestamp, reason
  │   └─ correction_hash (content hash for audit)
  │
  └─→ [Audit Recording] (event → immutable audit, deterministic)
      ├─ ocr_runs (document, timestamp, result)
      ├─ ocr_confidence_evolution (block, confidence transitions)
      └─ governance compliance (who, what, when, why)

Final Output:
  ✅ Text output (validated OR original with low-confidence flag)
  ✅ Confidence scores (per-block)
  ✅ Lineage (extraction_hash NOT affected)
  ✅ Audit trail (immutable, complete)
```

### Implementation Notes

**Sandboxing:**
- Separate pilot database schema (pilot_ocr_runs, pilot_ocr_blocks, pilot_ocr_corrections)
- No writes to production PDF extraction data
- Pilot results marked with `pilot_run_id` for traceability

**Determinism Verification:**
- Preprocessing: commit hash, version, reproducibility tests
- Confidence scoring: unit tests on fixed test blocks
- OCR extraction: engine version lock, seed randomization disabled

**SLA Targets:**
- Review assignment: < 1 hour
- Reviewer workload: 5-10 blocks/hour (tuning during pilot)
- Correction time: < 24 hours per block
- Escalation time: < 1 hour if SLA violated

---

## Pilot Artifacts

| Stage | Artifact | Deliverable |
|-------|----------|-------------|
| **1** | Pilot Corpus Design | OCR_PILOT_CORPUS.md |
| **2** | Pilot OCR Pipeline | OCR_PILOT_PIPELINE_CONFIG.md |
| **3** | Confidence Validation | OCR_PILOT_CONFIDENCE_RESULTS.md |
| **4** | Review Workflow | OCR_PILOT_REVIEW_RESULTS.md |
| **5** | Failure Collection | OCR_PILOT_FAILURE_ANALYSIS.md |
| **6** | Calibration Analysis | OCR_PILOT_CALIBRATION_RESULTS.md |
| **7** | Governance Review | OCR_PILOT_GOVERNANCE_REVIEW.md |
| **8** | Release Gate | OCR_PILOT_RELEASE_REVIEW.md |

---

## Expected Outcomes

### Success Criteria (APPROVE → Full OCR)
- ✅ Confidence calibration stable (no major overconfidence/underconfidence)
- ✅ Review workflow SLA met (24 hours per block achievable)
- ✅ Failure rate acceptable (< 5% of blocks require correction)
- ✅ Governance working (100% auditability, no data loss)
- ✅ Residual risks acceptable (mitigated, documented)

### Failure Criteria (BLOCK → Redesign)
- ❌ Confidence severely miscalibrated (> 20% false positives)
- ❌ Review workflow unscalable (> 2 hours/block)
- ❌ Failure rate unacceptable (> 15% correction rate)
- ❌ Governance gaps (audit trail incomplete, lineage loss)
- ❌ Critical risk unmitigated (e.g., determinism leakage)

### Likely Outcomes
- **APPROVE (60% expected):** Minor tuning needed, governance validated
- **REVISE (30% expected):** Confidence thresholds adjusted, review SLA relaxed
- **BLOCK (10% expected):** Critical assumption violated, redesign required

---

## Pilot Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Stage 1-2** | 3-5 days | Corpus + pipeline ready |
| **Stage 3-5** | 5-7 days | Confidence + failures collected |
| **Stage 6-7** | 3-5 days | Calibration + governance reviewed |
| **Stage 8** | 1-2 days | Release gate decision |
| **Total** | **14-21 days** | Full pilot complete |

---

## Next Steps

1. **STAGE 1 (NOW):** Design pilot corpus → OCR_PILOT_CORPUS.md
2. **STAGE 2:** Set up sandboxed pipeline → OCR_PILOT_PIPELINE_CONFIG.md
3. **STAGE 3-8:** Execute pilot → deliver all stage artifacts
4. **GATE:** Release gate review → APPROVE or BLOCK OCR

---

## Related Documents

- **OCR_ARCHITECTURE_HARDENING.md** — Base architecture (isolation, audit, confidence)
- **OCR_CONFIDENCE_MODEL.md** — Confidence scoring algorithms (formulas, tables, numeric)
- **OCR_LINEAGE_ARCHITECTURE.md** — Lineage system (parallel tracks, audit)
- **OCR_DETERMINISM_BOUNDARY.md** — Determinism contract (preprocessing, review, gate)
- **PDF_IMPLEMENTATION_REVIEW_SUMMARY.md** — PDF Phase 2 (deterministic extraction, proven)

---

**Status:** 🟡 STAGE 1 IN PROGRESS  
**Next Milestone:** OCR_PILOT_CORPUS.md (corpus specification complete)
