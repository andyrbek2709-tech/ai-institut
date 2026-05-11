# Ground Truth Governance Architecture

> **Foundation of OCR Validation Integrity**
>
> *Without trusted validation truth, OCR metrics are meaningless. This architecture establishes trusted ground truth systems for OCR pilot.*

**Version:** 1.0  
**Date:** 2026-05-10  
**Status:** 🔴 **CRITICAL FOUNDATION — IN PROGRESS**  
**Implements:** OCR Pilot — Stage 2 (Ground Truth Foundation)

---

## Executive Summary

OCR validation quality **entirely depends** on ground truth correctness:

```
Ground Truth Instability →
  ├─ Calibration becomes invalid
  ├─ Confidence metrics become misleading
  ├─ Reviewer corrections become unreliable
  └─ Release gate becomes unsafe
```

**This system establishes:**
- ✅ Formal ground truth model (formulas, tables, numbers, symbols, multilingual, units)
- ✅ Truth confidence levels (VERIFIED, REVIEWED, PROBABLE, AMBIGUOUS)
- ✅ Multi-reviewer validation workflow
- ✅ Disagreement resolution & arbitration
- ✅ Formula/table truth specialization
- ✅ Complete lineage & audit trail
- ✅ Release gate for corpus approval

---

## Core Principle

**NOT all ground truth is equally trusted.**

Ground truth itself can be:
- **VERIFIED** — multiple independent reviewers agree, formula checked symbolically, units normalized
- **REVIEWED** — single expert review, minor ambiguity resolved
- **PROBABLE** — single review, reasonable interpretation, some ambiguity remains
- **AMBIGUOUS** — reasonable multiple interpretations exist, documented

---

## Ground Truth Governance: 7-Layer Model

```
LAYER 1: Ground Truth Model
  └─ What qualifies as ground truth (formulas, tables, numbers, symbols, units, annotations, layout)

LAYER 2: Truth Confidence Levels
  └─ VERIFIED, REVIEWED, PROBABLE, AMBIGUOUS classifications

LAYER 3: Source Truth Establishment
  └─ How to create initial ground truth from source documents

LAYER 4: Multi-Reviewer Validation
  └─ How multiple reviewers validate truth independently

LAYER 5: Disagreement Resolution
  └─ How to resolve reviewer disagreement + escalation

LAYER 6: Specialized Truth Validation
  ├─ Formula Truth Validation (symbolic equivalence, subscripts, units)
  ├─ Table Truth Validation (merged cells, headers, structural layout)
  └─ Numeric Truth Validation (precision, units, notation)

LAYER 7: Truth Lineage & Audit
  └─ Complete chain: source → reviewers → corrections → arbitration → versioning

LAYER 8: Release Gate
  └─ Corpus approval criteria before pilot use
```

---

## LAYER 1: Ground Truth Model

### What is Ground Truth?

Ground truth = **authoritative correct value** for a block extracted from source document.

### Ground Truth Types

```
TYPE 1: Text Content
  Example: "The coefficient of thermal expansion is:"
  Confidence: REVIEWED (standard terminology)

TYPE 2: Numeric Values
  Example: 4.5 MPa (pressure)
           -273.15 °C (temperature)
           1e-6 A (current)
  Components:
    - Mantissa: 4.5 (numeric + decimal)
    - Unit: MPa (engineering units)
    - Sign: implicit positive

TYPE 3: Formulas
  Example: σ = F/A
          ξ_i = sqrt(1 - β_i^2)
          K = G * a^2 / (π * t^3)
  Components:
    - Symbols (Latin, Cyrillic, Greek)
    - Operators (+, -, ×, ÷, =, ≈)
    - Subscripts/Superscripts
    - Units of result

TYPE 4: Tables
  - Cell values (numbers, text, formulas)
  - Structural layout (merged cells, headers)
  - Row/column alignment
  - Units per column

TYPE 5: Engineering Symbols
  - Cyrillic variables: σ, τ, ρ, μ, ν
  - Greek letters: α, β, γ, δ, Ω, Π
  - Operators: ≤, ≥, ≠, ≈, ∞, ∑, ∏, ∫
  - Notation: subscript_i, superscript^n

TYPE 6: Multilingual Content
  - English + Russian mixed in same block
  - Character set: Latin + Cyrillic + Greek + Math symbols
  - Units in different notations (кПа vs kPa)

TYPE 7: Structural Annotations
  - Table headers (hierarchical)
  - Figure captions
  - Footnotes / references
  - Layout properties (centered, bold, font size)
```

### What Ground Truth DOES NOT Include

❌ **Visual properties** (font, color, layout position) — lineage tracks separately  
❌ **OCR confidence scores** — ground truth is definitive, not probabilistic  
❌ **Extracted raw text** — ground truth is corrected/validated value  

---

## LAYER 2: Truth Confidence Levels

### Classification System

```
VERIFIED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Criteria:
    ✅ Multiple independent reviewers agree (≥2)
    ✅ No reasonable interpretation ambiguity
    ✅ Formula checked symbolically
    ✅ Units normalized and standardized
    ✅ Specialist review (for domain-specific content)
  
  Example: "Pressure = 4.5 MPa"
  Reviewers: [Engineer-A, Engineer-B, Mechanical-Specialist] → ALL agree on value AND units
  Status: PRODUCTION-READY for calibration & release

REVIEWED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Criteria:
    ✅ Single expert review completed
    ✅ Ambiguity minor and documented
    ✅ Reasonable interpretation exists
    ✅ Escalation not required
  
  Example: "Temperature = -273.15 °C"
  Reviewer: [Thermodynamics-Specialist] → Confidence 0.95, no ambiguity
  Status: USABLE for most workflows, monitor for edge cases

PROBABLE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Criteria:
    ⚠️ Single review, reasonable interpretation
    ⚠️ Some minor ambiguity exists
    ⚠️ Alternative interpretation documented but not preferred
    ⚠️ Requires escalation if used in critical calculations
  
  Example: "Coefficient = 0.85" (documented: could be 0.80 or 0.90 from image quality)
  Reviewer: [Engineer-C] → Confidence 0.80, minor ambiguity acceptable
  Status: REQUIRES escalation for regulatory workflows

AMBIGUOUS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Criteria:
    ❌ Multiple reasonable interpretations exist
    ❌ Reviewers disagree on value
    ❌ Source document unclear (scan quality, cropping, etc.)
    ❌ Cannot resolve without additional context
  
  Example: "Pressure = 4.5 or 4.3 MPa" (scan ambiguous, no agreement)
  Status: BLOCKED from use; requires document rescan or source lookup
```

---

## LAYER 3: Source Truth Establishment

### Process

```
Step 1: Source Document Selection
  ├─ Select original source (PDF, scanned standard, printed document)
  ├─ Document metadata (source name, version, publication date)
  ├─ Digitization method (scanned vs. native PDF)
  └─ Quality assessment (DPI, contrast, color, artifacts)

Step 2: Manual Extraction (Ground Truth Reference)
  ├─ Expert extracts by visual inspection (NOT OCR)
  ├─ Capture: formulas, numbers, tables, text, units
  ├─ Document ambiguities encountered
  ├─ Record extraction time + confidence
  └─ Create REFERENCE value

Step 3: Truth Annotation
  ├─ Label extracted value with confidence level (PROBABLE)
  ├─ Document any ambiguities
  ├─ Mark components requiring specialist review
  └─ Track alternative interpretations

Step 4: Specialist Review (Formulas/Tables)
  ├─ For formulas: check subscripts, superscripts, units, symbolic equivalence
  ├─ For tables: verify structure, merged cells, alignment
  ├─ Cross-reference with standards/literature
  └─ Update confidence level

Step 5: Multi-Reviewer Validation (See LAYER 4)
  └─ Independent reviewers validate reference value

Step 6: Consensus & Arbitration (See LAYER 5)
  └─ Resolve disagreement if reviewers conflict

Step 7: Final Truth Lock
  ├─ Confidence level assigned (VERIFIED, REVIEWED, PROBABLE)
  ├─ Lineage recorded
  ├─ Audit log created
  └─ Truth frozen until correction required
```

---

## LAYER 4: Multi-Reviewer Validation Workflow

### Validation Tiers

```
TIER 1: Single Reviewer (Initial)
  ├─ Reviewer sees: source image + reference extraction
  ├─ Task: Validate or correct reference value
  ├─ Output: REVIEWED or PROBABLE confidence
  └─ Time: 15 min per block

TIER 2: Secondary Review (Disagreement Detection)
  ├─ Trigger: If first review differs from reference OR if initial confidence < 0.90
  ├─ Reviewer sees: reference + first review (blinded to avoid anchoring)
  ├─ Task: Independent validation
  ├─ Output: Agreement or disagreement signal
  └─ Time: 10 min per block

TIER 3: Specialist Review (Domain-Specific)
  ├─ Trigger: For formulas, tables, units, multilingual, technical symbols
  ├─ Reviewer: Domain specialist (mechanical engineer, thermodynamics expert, etc.)
  ├─ Task: Validate symbolic correctness, unit normalization, notation
  ├─ Output: VERIFIED confidence if passed
  └─ Time: 20 min per block

TIER 4: Arbitration (Disagreement Resolution)
  ├─ Trigger: Reviewers disagree on value
  ├─ Process: See LAYER 5
  └─ Output: VERIFIED or AMBIGUOUS final status
```

### Validation Assignment Logic

```
IF block type = FORMULA:
  ├─ TIER 1: Engineering Reviewer (general)
  ├─ TIER 2: Second Engineering Reviewer
  └─ TIER 3: Mechanical Engineer (for symbolic validation)

ELSE IF block type = TABLE:
  ├─ TIER 1: Engineering Reviewer
  ├─ TIER 2: Table Specialist (layout, alignment)
  └─ TIER 3: Domain specialist (if units/technical terms)

ELSE IF block type = NUMERIC:
  ├─ TIER 1: Engineering Reviewer
  ├─ TIER 2: Quality assurance (if value unusual)
  └─ TIER 3: None (unless in formula/table context)

ELSE IF block type = MULTILINGUAL:
  ├─ TIER 1: Engineering Reviewer (reading comprehension)
  ├─ TIER 2: Language specialist (character set, encoding)
  └─ TIER 3: Technical translator (if abbreviations/symbols)

ELSE: DEFAULT
  ├─ TIER 1: Any trained reviewer
  └─ TIER 2: Optional (if low confidence)
```

---

## LAYER 5: Disagreement Resolution & Arbitration

### Disagreement Detection

```
Step 1: Compare Results
  ├─ Reviewer-A says: σ = F/A
  ├─ Reviewer-B says: σ = F / A (extra spaces)
  ├─ Reviewer-C says: τ = F/A (different symbol)
  └─ Analyst logs: 2 agree on value, 1 differs on symbol

Step 2: Categorize Disagreement Type
  ├─ SEMANTIC: Different values (4.5 vs 4.3) ← CRITICAL
  ├─ NOTATIONAL: Same value, different notation (F/A vs F ÷ A) ← OK if normalized
  ├─ SYMBOLIC: Different symbol (σ vs τ) ← CRITICAL
  └─ PRECISION: Different rounding (4.5 vs 4.50) ← OK if documented
```

### Resolution Workflow

```
CASE 1: Notational Disagreement (Non-Critical)
  ├─ Step 1: Normalize to canonical form
  │   └─ F/A (slashed), F ÷ A (÷ symbol), F:A (ratio) → all normalize to "F/A"
  ├─ Step 2: Document variation
  │   └─ Note: "Seen as F/A, F ÷ A, F:A in literature — normalized to F/A"
  └─ Step 3: Status = REVIEWED (multiple formats accepted)

CASE 2: Precision Disagreement (Non-Critical)
  ├─ Step 1: Determine significant figures
  │   └─ Source shows 4.5 or 4.50 — determine from context
  ├─ Step 2: Document precision standard
  │   └─ "Source precision: 2 significant figures → 4.5 MPa"
  └─ Step 3: Status = REVIEWED

CASE 3: Semantic Disagreement (CRITICAL — Requires Arbitration)
  ├─ Step 1: Log all proposed values
  │   ├─ Reviewer-A: 4.5 MPa
  │   ├─ Reviewer-B: 4.3 MPa
  │   ├─ Reviewer-C: 4.8 MPa
  │   └─ Confidence levels: [0.85, 0.80, 0.90]
  │
  ├─ Step 2: ARBITRATION REQUIRED (See ARBITRATION section below)
  │
  └─ Step 3: Assign to senior technical arbitrator

CASE 4: Symbolic Disagreement (CRITICAL)
  ├─ Step 1: Verify character set
  │   ├─ Could be: σ (sigma) vs Σ (capital sigma) vs 6 (digit six)?
  │   └─ Cross-check with context (variable vs operator)
  │
  ├─ Step 2: ARBITRATION REQUIRED
  │
  └─ Step 3: May require character encoding specialist
```

### Arbitration Process

```
Trigger: Semantic disagreement with >0.10 value difference or symbolic conflict

ARBITRATION WORKFLOW:
═══════════════════════════════════════════════════════════════════

STEP 1: Prepare Arbitration Dossier
  ├─ Proposed values: [4.5 MPa, 4.3 MPa, 4.8 MPa]
  ├─ Reviewer confidence: [0.85, 0.80, 0.90]
  ├─ Source image: cropped/highlighted region
  ├─ Context: surrounding text, units, formula where value appears
  ├─ Literature reference: if available (standard, datasheet, paper)
  ├─ Domain: mechanical engineering (pressure measurement)
  └─ Complexity: HIGH (±0.3 MPa spread, high stakes if used in design)

STEP 2: Senior Technical Arbitration
  └─ Assigned to: Senior mechanical engineer + materials specialist
     Task: 
     ├─ Review all proposed values + confidence rationale
     ├─ Consult standards (ISO, GOST, IEC) if relevant
     ├─ Determine physically/technically reasonable range
     ├─ Propose single "best" interpretation
     └─ Document reasoning for final choice

STEP 3: Decision Options
  ├─ OPTION A: Choose single value (e.g., 4.5 MPa preferred)
  │   └─ Confidence: VERIFIED (if arbitrator consensus)
  │
  ├─ OPTION B: Accept range if context allows (e.g., "4.3-4.8 MPa")
  │   └─ Confidence: REVIEWED (value range, not exact)
  │
  └─ OPTION C: Mark AMBIGUOUS (cannot resolve without source lookup)
      └─ Status: Blocked from use; flag for document rescanning

STEP 4: Escalation (If Still Unresolved)
  ├─ Contact original document source (standards body, author, publisher)
  ├─ Request clarification (official errata, corrigenda, contact author)
  ├─ Use official source to settle disagreement
  └─ Update ground truth with official reference

STEP 5: Record Arbitration Decision
  ├─ Arbitrator: Name, discipline, date, time
  ├─ Decision: Final chosen value + rationale
  ├─ Alternatives: All proposed values + why rejected
  ├─ Confidence: VERIFIED or REVIEWED based on consensus strength
  └─ Audit log: Immutable record of decision process

STEP 6: Truth Locked
  ├─ Value frozen
  ├─ Lineage recorded
  ├─ Further correction requires new arbitration
  └─ Used in pilot calibration
```

---

## LAYER 6: Specialized Truth Validation

### Formula Truth Validation

**See: FORMULA_TRUTH_VALIDATION.md**

Key points:
- Symbolic equivalence checked (σ vs Σ vs 6)
- Subscripts/superscripts validated
- Units verified
- Notation normalized
- Greek/Cyrillic distinctly confirmed

### Table Truth Validation

**See: TABLE_TRUTH_VALIDATION.md**

Key points:
- Structural layout mapped (merged cells, headers)
- Cell values validated per column
- Alignment verified
- Units per column normalized
- Hierarchical headers traced

### Numeric Truth Validation

Validated as part of Formula/Table truth.

---

## LAYER 7: Ground Truth Lineage & Audit

**See: GROUND_TRUTH_LINEAGE.md**

Complete chain:
```
Source Document
  ↓ [document metadata + quality assessment]
Initial Manual Extraction (PROBABLE)
  ↓ [extraction timestamp + extractor ID]
Specialist Review (if formula/table)
  ↓ [specialist review + recommendations]
Multi-Reviewer Validation (Tier 1, 2, 3)
  ├─ Reviewer-A: [confidence + notes]
  ├─ Reviewer-B: [confidence + notes]
  └─ Reviewer-C: [confidence + notes]
  ↓
Disagreement Resolution / Arbitration (if needed)
  ├─ Arbitrator decision: [reasoning + final value]
  └─ Status: VERIFIED or REVIEWED or AMBIGUOUS
  ↓
Truth Locked
  ├─ Confidence level assigned
  ├─ Lineage frozen
  ├─ Audit entry created
  └─ Ready for use in pilot
  ↓
(Correction if discovered)
  ├─ Correction request + evidence
  ├─ New arbitration (if semantic change)
  └─ Truth versioned (previous maintained as historical)
```

---

## LAYER 8: Release Gate

**See: GROUND_TRUTH_RELEASE_GATE.md**

Pilot corpus can be used for calibration ONLY if:

```
✅ VERIFIED confidence ≥ 70% of blocks
✅ REVIEWED confidence ≥ 20% of blocks
✅ PROBABLE + AMBIGUOUS < 10% (acceptable)
✅ ALL formulas: symbolic validation complete + units normalized
✅ ALL tables: structural layout + cell values validated
✅ ALL multilingual: character set disambiguation complete
✅ ALL numeric: units standardized + precision documented
✅ Arbitration log: 0 unresolved disagreements
✅ Audit trail: 100% complete + no gaps
✅ Lineage verification: all blocks traceable to source
```

---

## Implementation Priority

```
WEEK 1:
  ├─ ✅ LAYER 1: Ground Truth Model (this document)
  ├─ ✅ LAYER 2: Truth Confidence Levels (this document)
  └─ 🟡 LAYER 3: Source Truth Establishment (start pilot corpus assembly)

WEEK 2:
  ├─ 🟡 LAYER 4: Multi-Reviewer Validation (assign pilot reviewers)
  ├─ 🟡 LAYER 5: Disagreement Resolution (establish arbitration process)
  └─ 🟡 LAYER 6: Specialized Validation (formula + table specialists)

WEEK 3:
  ├─ 🟡 LAYER 7: Lineage & Audit (implement tracking system)
  └─ 🟡 LAYER 8: Release Gate (define approval criteria)

WEEK 4:
  └─ Pilot corpus approval → Stage 2 ready
```

---

## Summary

Ground truth governance is the **foundation** of OCR validation integrity. Without trusted truth:
- ❌ Calibration is invalid
- ❌ Confidence metrics are misleading
- ❌ Release gate is unsafe

**This system establishes:**
- ✅ Formal model for what ground truth is
- ✅ Classification system for truth confidence
- ✅ Multi-stage validation with specialization
- ✅ Disagreement resolution & arbitration
- ✅ Complete lineage & audit trail
- ✅ Release criteria for corpus

**Next:** Implement FORMULA_TRUTH_VALIDATION.md + TABLE_TRUTH_VALIDATION.md + pilot corpus assembly.

---

## 📎 Связанные документы

- Lineage: [`GROUND_TRUTH_LINEAGE.md`](./GROUND_TRUTH_LINEAGE.md), [`EXTRACTION_LINEAGE_ARCHITECTURE.md`](./EXTRACTION_LINEAGE_ARCHITECTURE.md), [`NORMALIZATION_LINEAGE_MODEL.md`](./NORMALIZATION_LINEAGE_MODEL.md)
- Release gate: [`GROUND_TRUTH_RELEASE_GATE.md`](./GROUND_TRUTH_RELEASE_GATE.md), [`OPERATIONAL_READINESS_GATE.md`](./OPERATIONAL_READINESS_GATE.md)
- Truth validation: [`FORMULA_TRUTH_VALIDATION.md`](./FORMULA_TRUTH_VALIDATION.md), [`TABLE_TRUTH_VALIDATION.md`](./TABLE_TRUTH_VALIDATION.md)
- Трассируемость: [`TRACEABILITY_REPORT.md`](./TRACEABILITY_REPORT.md), [`TRACEABILITY_CONSISTENCY_REVIEW.md`](./TRACEABILITY_CONSISTENCY_REVIEW.md)
- Forensic: [`FORENSIC_AUDIT_REPORT.md`](./FORENSIC_AUDIT_REPORT.md), [`FORENSIC_AUDIT_COMPLETION.md`](./FORENSIC_AUDIT_COMPLETION.md)
- Detereminism: [`DETERMINISM_CORE_REPORT.md`](./DETERMINISM_CORE_REPORT.md), [`FINAL_DETERMINISM_VERDICT.md`](./FINAL_DETERMINISM_VERDICT.md)
- Hub: [`PROJECT_MAP.md`](./PROJECT_MAP.md)
