# OCR Pilot Quick Start

> **TL;DR: Controlled OCR Pilot Architecture — STAGE 1 Design Complete**

---

## What Just Happened

✅ **OCR Pilot Architecture approved and designed (8 stages, 2-3 weeks)**

After OCR architecture hardening review was completed (5 design docs, determinism contract locked), the next critical step is **operational validation**. Architecture design ≠ operational readiness.

**This pilot tests real assumptions:**
- Does OCR confidence calibrate properly? (no overconfidence/underconfidence)
- Can reviewers handle the workload? (SLA achievable?)
- What are real failure modes? (formula corruption? table misalignment? encoding?)
- Does governance work operationally? (auditability? no data loss?)

**Pilot Outcome:** → **APPROVE** (full OCR implementation) OR **REVISE** (tune + retest) OR **BLOCK** (redesign)

---

## What's Delivered (Stage 1)

### 3 New Documents

1. **OCR_PILOT_ARCHITECTURE.md** (Main overview)
   - 8-stage pipeline visualization
   - Corpus composition (50-100 docs, 2,000-3,000 blocks)
   - Expected outcomes (success/failure criteria)

2. **OCR_PILOT_CORPUS.md** (Detailed specification)
   - 6 corpus categories:
     - Scanned Standards (15-20 docs, 60% baseline)
     - Formulas (10-15 docs, 20% subscripts/Cyrillic)
     - Tables (5-10 docs, 15% alignment testing)
     - Low-Quality (8-12 docs, 20% degradation stress)
     - Multilingual (5-8 docs, 15% Cyrillic/Latin)
     - Known Failures (3-5 docs, 5% error detection)
   - Validation methods for each category
   - Success criteria (formula 95%, table 90%, etc.)

3. **OCR_PILOT_ROADMAP.md** (Execution plan)
   - 8-stage breakdown (with Owner, Duration, DoD)
   - Timeline: 14-21 days (May 9 → June 7)
   - Stage 1: corpus design (3-5 days)
   - Stage 2: pipeline implementation (5-7 days)
   - Stages 3-7: validation (3-5 days each, parallel)
   - Stage 8: release gate decision (1-2 days)

### Updated STATE.md
- New entry: 2026-05-09 OCR_PILOT_ARCHITECTURE phase initiated
- Clear status, deliverables, next steps

---

## The 8-Stage Pilot

```
┌─────────────────────────────────────┐
│ STAGE 1: Corpus Design ✅          │
│ (Specification complete)            │
├─────────────────────────────────────┤
│ STAGE 2: Sandboxed Pipeline 🟡     │
│ (Implementation pending)            │
├─────────────────────────────────────┤
│ STAGE 3: Confidence Validation 🟡  │
│ (Real scores on representative docs)│
├─────────────────────────────────────┤
│ STAGE 4: Review Workflow 🟡        │
│ (SLA testing, workload validation) │
├─────────────────────────────────────┤
│ STAGE 5: Failure Collection 🟡     │
│ (Categorize, root cause, frequency) │
├─────────────────────────────────────┤
│ STAGE 6: Calibration Drift 🟡      │
│ (Confidence accuracy vs. reality)   │
├─────────────────────────────────────┤
│ STAGE 7: Governance Review 🟡      │
│ (Auditability, accountability test) │
├─────────────────────────────────────┤
│ STAGE 8: Release Gate 🟡           │
│ → APPROVE / REVISE / BLOCK         │
└─────────────────────────────────────┘
```

---

## Key Metrics (Release Gate Decision)

### APPROVE If:
- ✅ Confidence Brier score < 0.05 (well-calibrated)
- ✅ Review SLA met (24 hours per block, <10 blocks/hour)
- ✅ Failure rate < 10% (acceptable correction rate)
- ✅ Governance 100% working (auditability, no data loss)
- ✅ Residual risks mitigated (documented)

### BLOCK If:
- ❌ Confidence Brier > 0.20 (severe miscalibration)
- ❌ Review > 2 hours/block average (unscalable)
- ❌ Failure rate > 15% (unacceptable)
- ❌ Governance gaps (audit trail incomplete)
- ❌ Critical risk unmitigated

---

## Why Pilot Before Full Implementation?

### Architectural Design ≠ Operational Readiness

**Architecture Design says:**
- ✅ Isolation: OCR separate from deterministic extraction
- ✅ Confidence: HIGH/MEDIUM/LOW/VERY_LOW thresholds
- ✅ Review: mandatory for LOW/VERY_LOW
- ✅ Governance: immutable audit trail

**But operational reality might say:**
- ❌ Confidence thresholds wrong (too many FALSE POSITIVES)
- ❌ Reviewer workload unrealistic (> 2 hours/block)
- ❌ Formula extraction broken (> 10% corruption)
- ❌ Governance slow (audit backend bottlenecked)

**Pilot finds the gap.**

---

## Corpus Design Rationale

**50-100 documents = "Goldilocks" size**
- ✅ Large enough (2,000+ blocks) to surface real issues
- ✅ Small enough (2-3 weeks) to complete pilot in reasonable time
- ✅ Representative mix (standards, formulas, tables, stress cases)
- ❌ Not too small (10 docs → miss edge cases)
- ❌ Not too large (1,000 docs → can't iterate fast)

**6 categories = Coverage without overhead**
- Standards (baseline) — what's typical performance?
- Formulas (focus) — highest value, highest complexity
- Tables (focus) — high value, ambiguous regions
- Low-quality (stress) — how resilient is pipeline?
- Multilingual (realism) — Cyrillic/Latin confusion?
- Failures (trap) — can system catch errors?

---

## Next Immediate Steps (Stage 2)

### For Corpus Assembly (3-5 days):
1. **List AGSK standards** (which ones to include?)
2. **Acquire documents** (source PDFs, scan if needed)
3. **Create references** (canonical text, canonical tables, canonical formulas)
4. **Prepare degraded versions** (rotate pages, resample to 100 DPI, add artifacts)
5. **Create manifest** (OCR_PILOT_CORPUS_MANIFEST.md — document list, sources, known failures)

### For Pipeline Implementation (5-7 days):
1. **Database schema** (pilot_ocr_runs, pilot_ocr_blocks, pilot_ocr_corrections, audit_log)
2. **Preprocessing** (deterministic v1.0, reproducibility tests)
3. **OCR engine** (Tesseract v5.x, version-locked)
4. **Confidence scoring** (HIGH/MEDIUM/LOW/VERY_LOW)
5. **Review routing** (LOW/VERY_LOW → mandatory review queue)
6. **Correction lineage** (immutable append-only)
7. **End-to-end test** (dry run on test documents)

### Parallel (Once pipeline ready):
- Stages 3-7 can run in parallel (confidence, workflow, failures, calibration, governance)
- Real data flowing through by May 21-24

---

## Critical Constraints

### ❌ DO NOT:
- Start full OCR implementation yet (wait for gate decision)
- Use production data (pilot corpus is controlled)
- Mix pilot + production data (separate databases)
- Skip governance review (Stage 7 is mandatory)

### ✅ DO:
- Iterate on pipeline (bugs are expected)
- Collect real failure data (that's the point)
- Test all 6 corpus categories (don't skip hard cases)
- Document every decision (for gate review)

---

## Timeline

```
May 9:   🟡 STAGE 1 Specification complete (now)
May 14:  🟡 STAGE 1 Corpus assembled + manifest
May 21:  🟡 STAGE 2 Pipeline operational
May 28:  🟡 STAGES 3-5 Data collected (confidence, workflow, failures)
June 2:  🟡 STAGES 6-7 Analysis complete (calibration, governance)
June 7:  🟡 STAGE 8 Release gate decision (APPROVE/REVISE/BLOCK)
```

---

## Related Architecture Documents

All 5 OCR architecture docs already locked + ready:
- **OCR_ARCHITECTURE_HARDENING.md** — Isolation, audit, confidence design
- **OCR_AUDIT_ARCHITECTURE.md** — 7 audit queries, compliance tables
- **OCR_CONFIDENCE_MODEL.md** — Scoring algorithms, thresholds
- **OCR_LINEAGE_ARCHITECTURE.md** — Parallel lineage, 5 queries
- **OCR_DETERMINISM_BOUNDARY.md** — Preprocessing, review workflow, contract

Pilot validates these designs operationally.

---

## Expected Outcome

**After 2-3 weeks:**

You'll have a **clear decision:**

```
✅ APPROVE:
   • Confidence calibration stable (Brier < 0.05)
   • Workflow SLA achieved (24 hours per block)
   • Failures acceptable (< 10% correction rate)
   • Governance validated (100% auditability)
   → Proceed to Phase 4 (full implementation, ~4-6 weeks)

🔄 REVISE:
   • Minor issues found (tune thresholds, add reviewers)
   • Re-run Stages 3-8 with adjustments
   → Back to gate in 1-2 weeks

🛑 BLOCK:
   • Architectural assumption violated
   • e.g., Confidence unrecoverable, Review unscalable
   → Redesign required (2-4 weeks) → re-pilot
```

Most likely: **APPROVE or REVISE** (80% + 15% probability)  
Risk: **BLOCK** (5% probability, if critical failure discovered)

---

## You Are Here

```
┌──────────────────────────────────────────────────────────┐
│ OCR ARCHITECTURE HARDENING REVIEW                       │
│ ✅ DESIGN COMPLETE (5 docs, determinism contract)      │
└──────────────────────────────────────────────┬───────────┘
                                               │
                                               ▼
┌──────────────────────────────────────────────────────────┐
│ CONTROLLED OCR PILOT ARCHITECTURE                       │
│ 🟡 STAGE 1 SPECIFICATIONS COMPLETE ← YOU ARE HERE      │
│ 🟡 STAGE 2-8 PENDING                                    │
│ 📅 Timeline: 14-21 days (May 9 → June 7)              │
└──────────────────────────────────────────┬───────────────┘
                                           │
                                           ▼
                                   ┌─────────────────┐
                                   │ RELEASE GATE    │
                                   │ APPROVE/REVISE  │
                                   │ OR BLOCK        │
                                   └────────┬────────┘
                                            │
                         ┌──────────────────┼──────────────────┐
                         │                  │                  │
                         ▼                  ▼                  ▼
                    ✅ APPROVE         🔄 REVISE          🛑 BLOCK
                    Phase 4 next       Tune + re-test      Redesign
                    (~4-6 weeks)       (~1-2 weeks)        (~2-4 weeks)
```

---

**Status:** 🟡 **STAGE 1 COMPLETE, STAGE 2 PENDING**  
**Next Milestone:** Stage 1 Corpus assembled by May 14  
**Gate Review:** June 7, 2026

