# Ground Truth Release Gate

> **Corpus Approval Criteria for OCR Pilot**
>
> *Pilot cannot use unverified ground truth. This document defines the rigorous criteria for approving the entire validation corpus before calibration & operational testing.*

**Version:** 1.0  
**Date:** 2026-05-10  
**Status:** 🔴 **CRITICAL DECISION GATE**  
**Implements:** GROUND_TRUTH_GOVERNANCE.md — LAYER 8 (Release Gate)

---

## Executive Summary

**Pilot ground truth corpus is BLOCKED from use until:**

```
✅ 70% of blocks: VERIFIED confidence
✅ 20% of blocks: REVIEWED confidence
✅ <10% of blocks: PROBABLE + AMBIGUOUS (acceptable)
✅ 100% of formulas: symbolic validation + unit normalization complete
✅ 100% of tables: structural validation + alignment verification complete
✅ 100% of multilingual: character set disambiguation complete
✅ 100% of numeric: unit standardization + precision documentation complete
✅ 0 unresolved arbitrations (all disagreements resolved)
✅ 100% complete lineage (every block traceable to source)
✅ 100% audit trail compliance (immutable records)
```

---

## Core Principle

**Trusted ground truth is FOUNDATION of OCR validation.**

Pilot corpus serves as:
- 🔴 **Calibration reference** — confidence calibration depends on truth accuracy
- 🔴 **Failure detection** — OCR errors measured against truth
- 🔴 **Release gate input** — determines if pilot passes/fails

**If ground truth is unstable, the entire pilot is invalid.**

---

## Release Gate Criteria

### CRITERION 1: Confidence Distribution

```
REQUIREMENT:
  ├─ VERIFIED confidence: ≥ 70% of blocks (gold standard)
  ├─ REVIEWED confidence: ≥ 20% of blocks (acceptable)
  ├─ PROBABLE confidence: ≤ 9% of blocks (marginal)
  └─ AMBIGUOUS confidence: ≤ 1% of blocks (extremely rare)

RATIONALE:
  ├─ VERIFIED blocks (≥70%): calibration foundation
  │   If <70% VERIFIED, calibration is based on weak data
  │   Risk: confidence metrics become unreliable
  │
  ├─ REVIEWED blocks (≥20%): complementary data
  │   Acceptable secondary source for calibration
  │   Risk: some minor ambiguity, but documented
  │
  ├─ PROBABLE blocks (≤9%): marginal, rarely used
  │   Acceptable if ambiguity minor and documented
  │   Risk: should not be used for critical calibration
  │
  └─ AMBIGUOUS blocks (≤1%): should be near-zero
      These are blockers (cannot be used)
      If >1%: indicates corpus quality issue → GATE FAILS

GATE DECISION:
  ├─ IF distribution meets criteria: ✅ PASS (proceed to next criterion)
  └─ IF distribution fails: 🔴 FAIL (corpus review required, return to labeling phase)

EXAMPLE (PASSING):
  ├─ VERIFIED: 725 blocks (72.5%)
  ├─ REVIEWED: 225 blocks (22.5%)
  ├─ PROBABLE: 40 blocks (4%)
  ├─ AMBIGUOUS: 10 blocks (1%)
  └─ Total: 1000 blocks
  │
  Result: ✅ PASS (meets all distribution thresholds)

EXAMPLE (FAILING):
  ├─ VERIFIED: 600 blocks (60%) ← below 70% threshold
  ├─ REVIEWED: 250 blocks (25%)
  ├─ PROBABLE: 100 blocks (10%)
  ├─ AMBIGUOUS: 50 blocks (5%) ← exceeds 1% threshold
  └─ Total: 1000 blocks
  │
  Result: 🔴 FAIL (VERIFIED too low, AMBIGUOUS too high)
```

---

### CRITERION 2: Formula Validation Completeness

```
REQUIREMENT:
  ✅ 100% of formula blocks: symbolic validation complete
  ✅ 100% of formula blocks: subscripts/superscripts verified
  ✅ 100% of formula blocks: operators normalized
  ✅ 100% of formula blocks: units tracked through formula
  ✅ 100% of formula blocks: notation standardized (× vs ·, / vs ÷, etc.)
  ✅ All Greek/Cyrillic symbols: character set verified (σ not Σ not 6)
  ✅ All unit notation: standardized (MPa, not mpa or MP2)

VALIDATION CHECKLIST (per formula block):
  [ ] Symbols: all Greek, Latin, Cyrillic correctly identified
  [ ] Subscripts/Superscripts: position, character accuracy verified
  [ ] Operators: correct semantics, precedence validated
  [ ] Units: dimensional analysis passes (result units correct)
  [ ] Notation: consistent (multiplication uses ×, division uses /)
  [ ] Semantic: formula matches published standard (if exists)
  [ ] Confidence: assigned (VERIFIED, REVIEWED, or PROBABLE)

FORMULA COUNT REQUIREMENTS:
  ├─ Formulas ≥ 50-100 in pilot corpus (representative sample)
  ├─ Categories:
  │   ├─ Material property formulas (σ, τ, K) ≥ 15 blocks
  │   ├─ Transcendental formulas (e^x, sqrt, trigonometric) ≥ 10 blocks
  │   ├─ Multi-line formulas (quadratic, compound) ≥ 10 blocks
  │   └─ Empirical/fitted formulas ≥ 15 blocks
  │
  └─ Distribution target:
      ├─ VERIFIED: ≥80% of formula blocks (higher bar for formulas)
      ├─ REVIEWED: ≥18% of formula blocks
      └─ PROBABLE: ≤2% of formula blocks

GATE DECISION:
  ├─ IF all formulas complete & distribution met: ✅ PASS
  └─ IF any formula incomplete or distribution fails: 🔴 FAIL

EXAMPLE (PASSING):
  ├─ Formula blocks: 95 total
  ├─ VERIFIED: 78 (82%) ✓
  ├─ REVIEWED: 16 (17%) ✓
  ├─ PROBABLE: 1 (1%) ✓
  ├─ All symbols validated (σ vs Σ resolved, subscripts verified)
  ├─ All units balanced (dimensional analysis 100% pass)
  ├─ Notation standardized (× normalized, / consistent)
  └─ Result: ✅ PASS
```

---

### CRITERION 3: Table Validation Completeness

```
REQUIREMENT:
  ✅ 100% of table blocks: structural layout verified (rows, columns, merged cells)
  ✅ 100% of table blocks: header extraction complete (names, units, hierarchy)
  ✅ 100% of table blocks: cell values validated (type, precision, range)
  ✅ 100% of table blocks: alignment verified (no row/column drift)
  ✅ All merged cells: boundaries correct, inheritance validated
  ✅ All units notation: standardized per column
  ✅ All empty cells: handled correctly (NULL vs zero vs N/A)

TABLE VALIDATION CHECKLIST (per table block):
  [ ] Structure: row count, column count, merged cells correct
  [ ] Headers: names extracted, units present, notation standardized
  [ ] Cell content: type correct (numeric vs text), precision consistent
  [ ] Cell accuracy: values within expected range, no transpositions
  [ ] Alignment: rows not drifted, columns not shifted
  [ ] Empty cells: intentional (not OCR misses)
  [ ] Confidence: assigned (VERIFIED, REVIEWED, or PROBABLE)

TABLE COUNT REQUIREMENTS:
  ├─ Tables ≥ 30-50 in pilot corpus (representative sample)
  ├─ Categories:
  │   ├─ Simple rectangular tables ≥ 10 blocks
  │   ├─ Hierarchical header tables ≥ 8 blocks
  │   ├─ Complex matrices (dense numeric) ≥ 10 blocks
  │   ├─ Multi-column unit tables ≥ 8 blocks
  │   └─ Known-hard tables (low-quality scans) ≥ 6 blocks
  │
  └─ Distribution target:
      ├─ VERIFIED: ≥75% of table blocks (stringent for complex tables)
      ├─ REVIEWED: ≥20% of table blocks
      └─ PROBABLE: ≤5% of table blocks (tables harder to extract)

GATE DECISION:
  ├─ IF all tables complete & distribution met: ✅ PASS
  └─ IF any table incomplete or distribution fails: 🔴 FAIL

EXAMPLE (PASSING):
  ├─ Table blocks: 40 total
  ├─ VERIFIED: 31 (78%) ✓
  ├─ REVIEWED: 8 (20%) ✓
  ├─ PROBABLE: 1 (2%) ✓
  ├─ All structures validated (merged cells correct, alignment verified)
  ├─ All headers complete (units standardized, hierarchies mapped)
  ├─ All cell values accurate (no drifts, no transpositions)
  └─ Result: ✅ PASS
```

---

### CRITERION 4: Multilingual Content Validation

```
REQUIREMENT (if multilingual blocks present):
  ✅ 100% of multilingual blocks: character set disambiguation complete
  ✅ All Latin-Cyrillic confusion resolved (Latin "c" vs Cyrillic "с")
  ✅ All Greek-Latin confusion resolved (Latin "o" vs Greek "ο")
  ✅ All mixed-language context validated (English + Russian in same cell)
  ✅ All unit notation standardized (kPa vs кПа, both understood)

MULTILINGUAL VALIDATION CHECKLIST:
  [ ] Character encoding: correct (Unicode, no mojibake)
  [ ] Cyrillic characters: distinct from Latin lookalikes (е/e, с/c, о/o)
  [ ] Greek characters: distinct from Latin (φ vs ø, π vs n)
  [ ] Mixed language: terminology consistent across languages
  [ ] Unit notation: standardized (metric convention applied uniformly)
  [ ] Confidence: assigned (VERIFIED, REVIEWED, or PROBABLE)

MULTILINGUAL COUNT REQUIREMENTS:
  ├─ IF multilingual blocks ≥ 10:
  │   ├─ VERIFIED: ≥80% of multilingual blocks
  │   ├─ REVIEWED: ≥18% of multilingual blocks
  │   └─ PROBABLE: ≤2% of multilingual blocks
  │
  └─ IF multilingual blocks < 10:
      └─ All must be ≥REVIEWED confidence (no PROBABLE accepted for small sample)

GATE DECISION:
  ├─ IF multilingual validation complete (if applicable): ✅ PASS
  └─ IF multilingual blocks exist but incomplete: 🔴 FAIL
```

---

### CRITERION 5: Numeric Value Validation

```
REQUIREMENT:
  ✅ All numeric blocks: precision documented (decimals, significant figures)
  ✅ All numeric blocks: units standardized (MPa, not mpa or Mpa)
  ✅ All numeric blocks: value range verified (physically reasonable)
  ✅ All precision loss/inflation: detected and justified

NUMERIC VALIDATION CHECKLIST:
  [ ] Decimal count: consistent per column (0, 1, or 2 decimals)
  [ ] Significant figures: appropriate for measurement/calculation context
  [ ] Units: standardized notation (uppercase M in MPa, lowercase Pa)
  [ ] Range: values within engineering sensibility (not 999999 for pressure)
  [ ] Notation: consistent (4.5 vs 4.50 — one style per context)
  [ ] Confidence: assigned per precision level

NUMERIC COUNT REQUIREMENTS:
  ├─ Numeric blocks in formulas: ≥ 20 (from formula validation)
  ├─ Numeric blocks in tables: ≥ 50 (from table validation)
  ├─ Precision documentation: 100% complete
  │   ├─ Expected precision per column/block type documented
  │   ├─ Any precision deviations justified
  │   └─ No "unusual" values without explanation
  │
  └─ Distribution (for standalone numeric blocks):
      ├─ VERIFIED: ≥75% (values clearly readable from source)
      ├─ REVIEWED: ≥20% (minor precision ambiguity resolved)
      └─ PROBABLE: ≤5% (precision truly ambiguous from source)

GATE DECISION:
  ├─ IF all numeric validation complete: ✅ PASS
  └─ IF any numeric value lacks precision documentation: 🔴 FAIL
```

---

### CRITERION 6: Arbitration Completion

```
REQUIREMENT:
  ✅ 0 unresolved arbitrations (all disagreements settled)
  ✅ All arbitration decisions documented in lineage
  ✅ All arbitration reasoning traceable to authoritative source (standard, paper, expert decision)

ARBITRATION STATUS:
  ├─ Count reviewer disagreements:
  │   ├─ Total disagreements encountered
  │   ├─ Disagreements resolved: 100%
  │   └─ Disagreements unresolved: 0 (or gate fails)
  │
  ├─ Disagreement categories:
  │   ├─ Semantic (different values): must be arbitrated
  │   ├─ Notational (same value, different notation): resolvable by normalization
  │   └─ Precision (rounding): resolvable by documentation
  │
  └─ Resolution authority:
      ├─ Standard reference: use official published value
      ├─ Expert arbitration: senior technical decision
      ├─ Escalation to source: contact standards body if needed
      └─ Document resolution: immutable record in lineage

GATE DECISION:
  ├─ IF all disagreements resolved: ✅ PASS
  └─ IF any disagreements unresolved: 🔴 FAIL (return to arbitration phase)

EXAMPLE (PASSING):
  ├─ Total disagreements encountered: 7
  ├─ Resolved via standard reference: 3 (ISO 6943-2 cross-check)
  ├─ Resolved via expert arbitration: 3 (senior engineer decision)
  ├─ Resolved via escalation: 1 (contacted standards body for clarification)
  ├─ Unresolved: 0 ✓
  └─ Result: ✅ PASS

EXAMPLE (FAILING):
  ├─ Total disagreements encountered: 7
  ├─ Resolved: 6
  ├─ Unresolved: 1 (symbol identity still ambiguous: σ vs Σ vs 6, cannot decide)
  └─ Result: 🔴 FAIL (must resolve before gate passes)
```

---

### CRITERION 7: Lineage Completeness & Audit Trail

```
REQUIREMENT:
  ✅ 100% of blocks: lineage chain complete (extraction → review → lock)
  ✅ All lineage entries: immutable (no backdating, no edits after lock)
  ✅ All actors: identified (name, role, timestamp)
  ✅ All decisions: documented (reasoning, confidence scores)
  ✅ All corrections: tracked (if any, with full audit trail)

LINEAGE AUDIT CHECKLIST (per block):
  [ ] Extraction: extractor identified, timestamp recorded, notes documented
  [ ] Specialist review: specialist identified (if formula/table), decision recorded
  [ ] Reviewer tier 1: reviewer identified, confidence score, notes
  [ ] Reviewer tier 2: reviewer identified (if triggered), agreement/disagreement
  [ ] Reviewer tier 3: specialist reviewer identified, confidence, consensus
  [ ] Arbitration: arbitrator identified (if disagreement), decision reasoning
  [ ] Lock: locked_at timestamp, confidence_level assigned
  [ ] No post-lock edits: lineage frozen, immutable

COVERAGE METRICS:
  ├─ Blocks with complete lineage: 100%
  ├─ Lineage entries with timestamps: 100%
  ├─ Actor identification completeness: 100% (name, role, id)
  ├─ Decision documentation: 100% (reasoning, confidence)
  └─ Audit trail integrity: 100% (no gaps, no inconsistencies)

GATE DECISION:
  ├─ IF lineage 100% complete & immutable: ✅ PASS
  └─ IF any lineage gaps or post-lock edits found: 🔴 FAIL

AUDIT VERIFICATION PROCESS:
  ├─ Spot-check 10% of blocks (random sample)
  │   ├─ Verify: all lineage entries present
  │   ├─ Verify: timestamps are chronological
  │   ├─ Verify: decision reasoning makes sense
  │   └─ Verify: no post-lock modifications
  │
  └─ If spot-check 100% passes: ✅ PASS
```

---

### CRITERION 8: Documentation & Traceability

```
REQUIREMENT:
  ✅ All ground truth corpus: documented (corpus_manifest.csv)
  ✅ All blocks: traceable to source document
  ✅ All ambiguities: documented in lineage
  ✅ All special values: explained in annotations
  ✅ Release gate checklist: completed & signed

DOCUMENTATION REQUIREMENTS:
  ├─ Corpus manifest:
  │   ├─ Block ID, source document, page number, block location
  │   ├─ Block type (formula, table, numeric, text)
  │   ├─ Ground truth value, confidence level, reviewer count
  │   ├─ Any ambiguities or notes
  │   └─ Locked_at timestamp
  │
  ├─ Source document catalog:
  │   ├─ Document name, version, publication date
  │   ├─ Digitization method (scanned vs native PDF)
  │   ├─ Scan quality (DPI, contrast, artifacts)
  │   └─ Number of blocks extracted from each source
  │
  ├─ Reviewer roster:
  │   ├─ Reviewer ID, name, role, discipline
  │   ├─ Number of blocks reviewed per reviewer
  │   ├─ Consistency metrics (inter-rater agreement %)
  │   └─ Specialist assignments (mechanical, thermal, electrical, etc.)
  │
  └─ Quality metrics:
      ├─ Confidence distribution (% VERIFIED, REVIEWED, PROBABLE, AMBIGUOUS)
      ├─ Disagreement rate (% of blocks with reviewer disagreement)
      ├─ Arbitration rate (% requiring arbitration)
      ├─ Correction rate (if any corrections post-lock)
      └─ Lineage completeness (% blocks with full audit trail)

GATE DECISION:
  ├─ IF all documentation complete & metrics calculated: ✅ PASS
  └─ IF any documentation gaps: 🔴 FAIL
```

---

## Release Gate Approval Workflow

```
STEP 1: Corpus Labeling & Review (COMPLETED)
  ├─ Extract all blocks (formulas, tables, numeric, text, multilingual)
  ├─ Obtain multi-reviewer validation (tier 1, 2, 3)
  ├─ Resolve disagreements via arbitration
  └─ Lock all ground truth blocks with confidence levels

STEP 2: Gate Criterion Evaluation (PENDING)
  ├─ CRITERION 1: Confidence distribution ← CHECK
  ├─ CRITERION 2: Formula validation ← CHECK
  ├─ CRITERION 3: Table validation ← CHECK
  ├─ CRITERION 4: Multilingual validation ← CHECK
  ├─ CRITERION 5: Numeric validation ← CHECK
  ├─ CRITERION 6: Arbitration completion ← CHECK
  ├─ CRITERION 7: Lineage completeness ← CHECK
  └─ CRITERION 8: Documentation & traceability ← CHECK

STEP 3: Gate Decision (BLOCKING)
  ├─ ALL criteria PASS: → ✅ APPROVE (corpus ready for pilot)
  ├─ ANY criterion FAIL: → 🔴 BLOCK (return to labeling/review phase)
  └─ Status: CORPUS APPROVED / CORPUS REJECTED

STEP 4: Approval Sign-Off (REQUIRED)
  ├─ Required signatories:
  │   ├─ OCR Project Lead (responsibility for pilot success)
  │   ├─ Data Quality Lead (responsibility for ground truth integrity)
  │   ├─ Technical Lead (responsibility for technical correctness)
  │   └─ Operations Lead (responsibility for deployment)
  │
  ├─ Sign-off statement:
  │   "I attest that ground truth corpus meets all 8 criteria and is safe for pilot use."
  │
  └─ Timestamp & signature (immutable record)

STEP 5: Pilot Initialization (IF APPROVED)
  ├─ Deploy corpus to pilot environment
  ├─ Initialize OCR confidence calibration (using VERIFIED corpus blocks)
  ├─ Begin operational testing (Stage 2 onwards)
  └─ Monitor for truth-based errors (comparison against ground truth)
```

---

## Non-Approval Path (If Gate Fails)

```
FAILURE SCENARIO: One or more criteria fail

ANALYSIS & REMEDIATION:
  ├─ Identify which criteria failed (e.g., CRITERION 2: Formula validation incomplete)
  ├─ Root cause analysis: what needs improvement?
  │   Example: "30 formula blocks have unresolved symbol ambiguities"
  │
  ├─ Remediation plan:
  │   ├─ Return problematic blocks to review phase
  │   ├─ Assign specialist review (if domain-specific)
  │   ├─ Re-run multi-reviewer validation for disputed blocks
  │   ├─ Escalate arbitration for remaining disagreements
  │   └─ Re-evaluate criteria (1-2 weeks, typically)
  │
  └─ Re-submission:
      ├─ Updated corpus (with corrected blocks)
      ├─ Updated documentation & metrics
      ├─ Re-run all 8 criteria
      └─ Return to Gate Decision step (STEP 3)

ITERATION LIMIT:
  ├─ Expect 1-2 iterations before approval
  ├─ IF >3 iterations required: escalate to project leadership
  │   └─ Possible redesign of corpus scope (reduce size, change focus)
  └─ Timeline: 2-4 weeks total (with iterations)
```

---

## Summary

**Release Gate ensures:**
- ✅ Trusted ground truth corpus (70%+ VERIFIED confidence)
- ✅ Complete specialized validation (formulas, tables, multilingual, numeric)
- ✅ Resolved disagreements (0 unresolved arbitrations)
- ✅ Complete lineage & audit trail (100% traceable)
- ✅ Rigorous documentation (all metrics calculated)
- ✅ Final approval (multiple signatories)

**Without this gate:**
- ❌ Calibration would be based on weak/unstable truth
- ❌ Confidence metrics would be unreliable
- ❌ Pilot results would be invalid
- ❌ Release gate for full OCR would be unsafe

**With this gate:**
- ✅ Pilot calibration is trustworthy
- ✅ Confidence metrics are reliable
- ✅ Pilot results are valid
- ✅ Full OCR release is safe

---

## Next Steps

Once gate is approved:
1. **Stage 2 begins:** Deploy corpus to pilot, start operational testing
2. **Calibration:** Use VERIFIED corpus blocks to calibrate OCR confidence model
3. **Failure detection:** Compare OCR output against ground truth, categorize errors
4. **Confidence validation:** Verify confidence scores match actual error rates
5. **Pilot gates 3-8:** Execute remaining pilot stages (confidence validation, review workflow, failure collection, calibration drift, governance review, release decision)
