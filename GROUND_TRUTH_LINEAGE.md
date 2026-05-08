# Ground Truth Lineage & Audit Architecture

> **Complete Traceability for Ground Truth Creation, Review, and Correction**
>
> *Every decision, every correction, every arbitration is recorded immutably. Audit-safe truth management for regulatory compliance.*

**Version:** 1.0  
**Date:** 2026-05-10  
**Status:** 🟡 **CRITICAL LINEAGE SYSTEM**  
**Implements:** GROUND_TRUTH_GOVERNANCE.md — LAYER 7 (Lineage & Audit)

---

## Executive Summary

Ground truth lineage provides **complete audit trail** for every ground truth value:

```
Source Document
  ↓ [document metadata]
Manual Extraction (initial candidate)
  ↓ [extractor, timestamp, notes]
Specialist Review (if formula/table)
  ↓ [specialist, timestamp, recommendations]
Reviewer Validation (Tier 1, 2, 3)
  ├─ Reviewer-A [confidence, notes]
  ├─ Reviewer-B [agreement/disagreement]
  └─ Reviewer-C specialist [consensus]
  ↓
Disagreement Resolution / Arbitration (if needed)
  ├─ Arbitrator [reasoning, final decision]
  └─ Escalation (if required)
  ↓
Truth Locked [confidence level assigned]
  ├─ Lineage frozen
  ├─ Audit entry immutable
  └─ Ready for use
  ↓
Corrections (future)
  ├─ Evidence [what error found, source reference]
  ├─ New arbitration [if semantic change]
  └─ Truth versioned [previous maintained, new effective]
```

---

## Core Principle

**Lineage is IMMUTABLE after truth is locked.**

Once ground truth value is assigned confidence level and used in calibration:
- ✅ All prior decisions are permanently recorded
- ✅ Any change requires new arbitration (tracked separately)
- ✅ Historical versions maintained for audit trail
- ✅ Regulatory traceability: who decided what, when, why

---

## Ground Truth Lineage Schema

### Complete Lineage Record

```sql
TABLE ground_truth_blocks (
  block_id UUID PRIMARY KEY,
  
  -- Source Document Metadata
  source_document_id UUID,
  source_name VARCHAR (e.g., "IEC-60038-v2_Scanned_Standard"),
  source_version VARCHAR (e.g., "v2.1"),
  source_type ENUM ('standard', 'datasheet', 'paper', 'other'),
  source_quality VARCHAR ('high_dpi_scan', 'native_pdf', 'degraded', etc.),
  
  -- Block Identification
  page_number INT,
  block_position VARCHAR (e.g., "page_3_center_table_5_row_2"),
  block_type ENUM ('formula', 'numeric_value', 'table', 'text', etc.),
  
  -- Ground Truth Value
  truth_value TEXT (e.g., "σ = F/A" or "370" or "K = (G × a²) / (π × t³)"),
  truth_type ENUM ('formula', 'table', 'numeric', 'text'),
  units_if_numeric VARCHAR (e.g., "MPa", "°C"),
  confidence_level ENUM ('VERIFIED', 'REVIEWED', 'PROBABLE', 'AMBIGUOUS'),
  
  -- Lineage Chain (append-only)
  extraction_id UUID,
  specialist_review_id UUID (nullable),
  reviewer_tier1_id UUID,
  reviewer_tier2_id UUID (nullable),
  reviewer_tier3_id UUID (nullable),
  arbitration_id UUID (nullable),
  
  -- Status & Metadata
  status ENUM ('PENDING_REVIEW', 'LOCKED', 'CORRECTED'),
  locked_at TIMESTAMP,
  correction_reason VARCHAR (nullable, if status='CORRECTED'),
  
  CONSTRAINT status_consistency CHECK (
    (status='LOCKED' AND locked_at IS NOT NULL) OR
    (status!='LOCKED' AND locked_at IS NULL)
  )
);

TABLE ground_truth_lineage_chain (
  id UUID PRIMARY KEY,
  ground_truth_id UUID FOREIGN KEY,
  
  -- Step Sequence
  step_number INT (1, 2, 3, ... for audit trail ordering),
  step_type ENUM ('extraction', 'specialist_review', 'reviewer_validation', 'arbitration'),
  
  -- Actor & Timestamp
  actor_id UUID,
  actor_name VARCHAR,
  actor_role ENUM ('extractor', 'specialist', 'reviewer', 'arbitrator'),
  timestamp TIMESTAMP,
  
  -- Step Content
  input_value TEXT (what was received),
  output_value TEXT (what was decided/confirmed),
  confidence_score FLOAT [0.0-1.0],
  decision_notes TEXT (reasoning),
  
  -- Outcome
  outcome ENUM ('ACCEPTED', 'REJECTED', 'CHALLENGED', 'ESCALATED'),
  
  UNIQUE(ground_truth_id, step_number),
  INDEX(actor_id, timestamp) FOR audit queries
);

TABLE ground_truth_corrections (
  id UUID PRIMARY KEY,
  ground_truth_id UUID FOREIGN KEY,
  correction_number INT (1, 2, 3, ... if multiple corrections),
  
  -- What Was Wrong
  error_description TEXT,
  evidence_source VARCHAR (e.g., "official_errata_ISO-1234", "user_feedback"),
  
  -- New Decision
  new_truth_value TEXT,
  new_confidence_level ENUM ('VERIFIED', 'REVIEWED', 'PROBABLE', 'AMBIGUOUS'),
  arbitration_required BOOLEAN,
  
  -- Audit Trail
  reported_by_id UUID,
  reported_at TIMESTAMP,
  arbitrator_id UUID (nullable),
  arbitrated_at TIMESTAMP (nullable),
  approved_at TIMESTAMP,
  
  -- Versions
  supersedes_version INT (which prior version this replaces),
  
  INDEX(ground_truth_id, reported_at) FOR correction queries
);
```

---

## Lineage Stages

### STAGE 1: Manual Extraction

```
INPUT: Source document (PDF, scanned standard, datasheet)

EXTRACTION PROCESS:
  ├─ Step 1: Document metadata captured
  │   ├─ Document name, version, publication date
  │   ├─ Scan quality (DPI, contrast, color depth)
  │   ├─ Digitization method (scanned vs native PDF)
  │   └─ Source integrity assessment
  │
  ├─ Step 2: Block identification
  │   ├─ Page number, location on page
  │   ├─ Block context (formula in section X, table Y, etc.)
  │   └─ Visual properties (font size, emphasis, location)
  │
  ├─ Step 3: Manual extraction (NOT OCR)
  │   ├─ Expert reads source document
  │   ├─ Records: content, components, units, symbols
  │   ├─ Documents ambiguities encountered
  │   ├─ Notes: "could be σ or 6", "unit unclear", etc.
  │   └─ Confidence assessment (preliminary): PROBABLE
  │
  └─ Step 4: Lineage recording
      ├─ Extractor: name, ID, discipline
      ├─ Extraction timestamp
      ├─ Extracted value (ground truth candidate)
      ├─ Ambiguity notes (for specialist review)
      ├─ Confidence: PROBABLE (initial, will be upgraded)
      └─ Status: PENDING_REVIEW

LINEAGE ENTRY (Stage 1):
  step_type: 'extraction'
  actor_role: 'extractor'
  input_value: [source image]
  output_value: "σ = F/A" (candidate truth)
  confidence_score: 0.75 (preliminary)
  decision_notes: "Clear formula, standard notation, minor ambiguity in subscript"
  outcome: 'ACCEPTED' (candidate created, ready for specialist review)
```

### STAGE 2: Specialist Review (If Formula/Table)

```
TRIGGER: Block type is formula, table, complex numeric, or multilingual

SPECIALIST PROCESS:
  ├─ Step 1: Assignment
  │   ├─ Route to appropriate specialist (mechanical engineer, table layout specialist)
  │   └─ Provide: source image, extractor notes, any ambiguities flagged
  │
  ├─ Step 2: Specialist validation
  │   ├─ For formulas: check symbolic correctness, unit balance, notation
  │   ├─ For tables: verify structure, merged cells, alignment
  │   ├─ For multilingual: validate character set, notation
  │   ├─ Cross-reference with standards (if applicable)
  │   └─ Propose refinements if needed
  │
  ├─ Step 3: Decision
  │   ├─ ACCEPT: extraction is correct, confidence boost
  │   ├─ REQUEST_CLARIFICATION: need more info from extractor
  │   ├─ RECOMMEND_CORRECTION: specific improvement proposed
  │   └─ ESCALATE: too complex, requires arbitration
  │
  └─ Step 4: Lineage recording
      ├─ Specialist: name, ID, discipline
      ├─ Review timestamp
      ├─ Input: extractor's candidate value
      ├─ Output: specialist's recommendation
      ├─ Confidence boost: 0.75 → 0.90 (if recommendation accepted)
      ├─ Decision notes: reasoning for recommendation
      └─ Status: PENDING_REVIEWER_VALIDATION (ready for multi-reviewer stage)

LINEAGE ENTRY (Stage 2):
  step_type: 'specialist_review'
  actor_role: 'specialist'
  actor_name: 'Mechanical Engineer (Advanced Stress Analysis)'
  input_value: "σ = F/A [from extraction]"
  output_value: "σ = F/A [verified symbolic, units balanced]"
  confidence_score: 0.90 (boosted from 0.75)
  decision_notes: "Standard von Mises formula variant, symbolic notation correct, dimensional analysis passes, matches ISO 14405 standard"
  outcome: 'ACCEPTED'
```

### STAGE 3: Multi-Reviewer Validation

```
REVIEWER TIER 1: Initial review

PROCESS:
  ├─ Reviewer receives: source image + extractor notes + specialist recommendation (if any)
  ├─ Task: Validate extraction independently
  ├─ Input: "σ = F/A" (specialist-reviewed candidate)
  ├─ Decision: AGREE / CHALLENGE / QUERY
  │
  └─ Lineage entry:
      step_type: 'reviewer_validation'
      actor_role: 'reviewer'
      actor_name: 'Engineer-1'
      step_number: 3 (reviewer tier 1)
      input_value: "σ = F/A"
      output_value: "σ = F/A ✓ confirmed"
      confidence_score: 0.95 (reviewer confidence)
      decision_notes: "Symbol clear, operator correct, standard formula"
      outcome: 'ACCEPTED'

REVIEWER TIER 2: Secondary validation (if disagreement or low confidence)

PROCESS:
  ├─ Trigger: Tier 1 confidence < 0.90 OR first reviewer confidence level PROBABLE
  ├─ Reviewer receives: source image (blinded to Tier 1 decision to avoid anchoring)
  ├─ Task: Independent validation
  ├─ Decision: AGREE / DISAGREE / AMBIGUOUS
  │
  └─ Lineage entry:
      step_type: 'reviewer_validation'
      actor_role: 'reviewer'
      actor_name: 'Engineer-2'
      step_number: 4 (reviewer tier 2)
      input_value: "σ = F/A"
      output_value: "σ = F/A ✓ confirmed"
      confidence_score: 0.92
      decision_notes: "Agreement signal: symbol clear, consistent with Tier 1 assessment"
      outcome: 'ACCEPTED'

REVIEWER TIER 3: Specialist consensus (for formulas/tables/multilingual)

PROCESS:
  ├─ Trigger: Formula, complex table, or multilingual block
  ├─ Reviewer: domain specialist (mechanical engineer, linguist, etc.)
  ├─ Task: Specialized validation (symbolic equivalence, unit normalization, character set)
  ├─ Decision: VERIFIED / REVIEWED / PROBABLE
  │
  └─ Lineage entry:
      step_type: 'reviewer_validation'
      actor_role: 'specialist_reviewer'
      actor_name: 'Mechanical Engineer Specialist'
      step_number: 5 (reviewer tier 3)
      input_value: "σ = F/A"
      output_value: "σ = F/A [VERIFIED]"
      confidence_score: 1.0 (specialist consensus)
      decision_notes: "Symbolic correctness confirmed, units balanced, standard formula, ready for VERIFIED confidence"
      outcome: 'ACCEPTED'
```

### STAGE 4: Disagreement Resolution & Arbitration

```
TRIGGER: Reviewers DISAGREE on value

ARBITRATION PROCESS:
  ├─ Step 1: Disagreement flagged
  │   ├─ Reviewer-A says: σ (sigma)
  │   ├─ Reviewer-B says: Σ (capital sigma)
  │   ├─ Reviewer-C says: 6 (digit six)
  │   └─ Status: DISAGREEMENT_UNRESOLVED
  │
  ├─ Step 2: Arbitration dossier prepared
  │   ├─ All proposed values with confidence levels
  │   ├─ Source image (highlighted)
  │   ├─ Context (surrounding text, formula)
  │   ├─ Reviewer rationales (why each chose their value)
  │   └─ Literature reference (if applicable)
  │
  ├─ Step 3: Senior arbitrator assigned
  │   ├─ Role: Senior technical lead (e.g., Principal Mechanical Engineer)
  │   ├─ Expertise: domain-specific (formula structure, symbol recognition)
  │   └─ Authority: final decision on disputed value
  │
  ├─ Step 4: Arbitration decision
  │   ├─ Option A: Choose single value (e.g., "σ" is correct)
  │   │   └─ Reasoning: physics context, symbol distinctness, visual evidence
  │   ├─ Option B: Accept range (if semantically valid)
  │   │   └─ Example: "4.3-4.8 MPa acceptable"
  │   └─ Option C: Mark AMBIGUOUS (if unresolvable)
  │       └─ Action: source lookup required, or document revisit needed
  │
  ├─ Step 5: Escalation (if still unresolved)
  │   ├─ Contact standards body, paper author, or original source
  │   ├─ Request official clarification or errata
  │   └─ Use official source to resolve disagreement
  │
  └─ Step 6: Lineage recording
      step_type: 'arbitration'
      actor_role: 'arbitrator'
      actor_name: 'Principal Mechanical Engineer'
      input_values: ["σ [Reviewer-A, 0.85]", "Σ [Reviewer-B, 0.70]", "6 [Reviewer-C, 0.65]"]
      output_value: "σ" (decided value)
      confidence_score: 1.0 (arbitrator authority)
      decision_notes: "Symbol σ (sigma, lowercase) chosen. Reasoning: (1) physics context requires stress variable, not summation operator; (2) symbol clearly lowercase in source; (3) Reviewer-C's '6' inconsistent with formula semantics. Alternative '6' rejected due to operator conflict."
      outcome: 'ACCEPTED'
      resolution: 'VERIFIED' (arbitrator consensus = VERIFIED confidence)

ARBITRATION RECORD (in corrections table):
  error_description: "Reviewer disagreement: symbol identification (σ vs Σ vs 6)"
  evidence_source: "multi_reviewer_consensus"
  new_truth_value: "σ"
  new_confidence_level: 'VERIFIED'
  arbitrator_decision: "σ (lowercase sigma) is correct based on formula semantics and physics context"
  arbitrated_at: 2026-05-10 14:45
```

### STAGE 5: Truth Locked

```
LOCK PROCESS:
  ├─ Prerequisite: All review stages complete (or arbitration resolved)
  ├─ Confidence level: assigned (VERIFIED, REVIEWED, PROBABLE, or AMBIGUOUS)
  ├─ Status change: PENDING_REVIEW → LOCKED
  ├─ Timestamp: locked_at = current time
  ├─ All lineage entries: FROZEN (immutable)
  └─ Ready: for use in pilot calibration

LOCKED GROUND TRUTH ENTRY:
  ground_truth_id: gtb_001_page_3_formula_stress
  truth_value: "σ = F/A"
  confidence_level: 'VERIFIED'
  status: 'LOCKED'
  locked_at: 2026-05-10 15:00
  
  Lineage chain (immutable):
    Step 1: Extraction [Engineer-X, 0.75, PROBABLE]
    Step 2: Specialist Review [MechanicalEngineer-Y, 0.90, REVIEWED]
    Step 3: Reviewer Tier 1 [Engineer-1, 0.95, ACCEPTED]
    Step 4: Reviewer Tier 2 [Engineer-2, 0.92, ACCEPTED]
    Step 5: Reviewer Tier 3 [Specialist-Z, 1.0, VERIFIED]
    [No arbitration needed — reviewers agreed]
  
  Final confidence: VERIFIED
  → Safe for pilot calibration
```

### STAGE 6: Corrections (If Needed)

```
TRIGGER: Error discovered in locked truth

CORRECTION PROCESS:
  ├─ Step 1: Error reported
  │   ├─ Reporter: name, ID, role
  │   ├─ Timestamp: when error discovered
  │   ├─ Evidence: what error was found (e.g., "official errata says formula is σ = F/(A·1.5)")
  │   ├─ Source: where evidence came from (standards body, user report, retesting)
  │   └─ Status: CORRECTION_REQUESTED
  │
  ├─ Step 2: Correction decision
  │   ├─ IF semantic change (different value):
  │   │   ├─ Requires: new arbitration
  │   │   ├─ Arbitrator reviews: evidence, prior lineage, new reasoning
  │   │   └─ Decision: APPROVE_CORRECTION or REJECT (keep original)
  │   │
  │   └─ IF clarification only (same value, improved confidence):
  │       ├─ Confidence boost: PROBABLE → REVIEWED or REVIEWED → VERIFIED
  │       └─ Lineage: add clarification entry
  │
  ├─ Step 3: If approved, new version created
  │   ├─ New truth_value (e.g., "σ_corrected = F/(A·1.5)")
  │   ├─ New confidence_level (e.g., VERIFIED)
  │   ├─ Supersedes version: reference to prior version
  │   ├─ Effective_at: timestamp when correction takes effect
  │   └─ Prior version: maintained for historical audit trail
  │
  └─ Step 4: Lineage recording
      [Lineage continues from prior LOCKED state]
      + New correction entry in ground_truth_corrections table
      ├─ Error description: "Official errata ISO-14405-2024 amends formula"
      ├─ Evidence source: "ISO-14405-2024-errata-001"
      ├─ New value: "σ = F/(A·1.5)" [correction applied]
      ├─ New confidence: 'VERIFIED' [based on official source]
      ├─ Arbitration: approved @ 2026-05-15 10:30
      └─ Status: CORRECTED (new version effective, prior maintained for audit)

HISTORICAL LINEAGE (for audit):
  Version 1 (original, retired):
    value: "σ = F/A"
    confidence: VERIFIED
    effective: 2026-05-10 to 2026-05-15
    lineage: [extraction, specialist, reviewers, arbitration]
  
  Version 2 (current):
    value: "σ = F/(A·1.5)"
    confidence: VERIFIED
    effective: 2026-05-15 onwards
    lineage: [v1 + correction entry + new arbitration]
    notes: "Corrected per ISO-14405-2024-errata-001"
```

---

## Audit Trail Examples

### Example 1: Formula Truth with No Disagreement

```
BLOCK: IEC-60038 Standard, Page 3, Formula in Section 2.1

SOURCE: scanned PDF, high quality (300 DPI)

LINEAGE CHAIN (immutable):
═════════════════════════════════════════════════════════════════

STEP 1: EXTRACTION
────────────────────────────────────────────────────────────────
Extractor: Engineer-X
Timestamp: 2026-05-10 10:00
Input: [source image of formula]
Output: "K = G·a²/(π·t³)"
Confidence: 0.75 (PROBABLE)
Notes: "Standard stiffness formula, all symbols clear, minor notation variant (· vs ×)"
Status: PENDING_SPECIALIST_REVIEW

STEP 2: SPECIALIST REVIEW
────────────────────────────────────────────────────────────────
Specialist: Dr. Materials-Engineer
Timestamp: 2026-05-10 10:30
Input: "K = G·a²/(π·t³)"
Output: "K = G·a²/(π·t³) [VERIFIED_SEMANTIC]"
Confidence boost: 0.75 → 0.92
Notes: "Stiffness formula verified. Symbols: G (shear modulus), a (dimension), π (pi), t (thickness). Unit analysis: [Pa·m²]/[m³] = [Pa/m] ✓ correct. Notation normalized: · → × for consistency."
Status: PENDING_REVIEWER_VALIDATION

STEP 3: REVIEWER TIER 1
────────────────────────────────────────────────────────────────
Reviewer: Engineer-1
Timestamp: 2026-05-10 11:00
Input: "K = G·a²/(π·t³)"
Output: "K = (G × a²) / (π × t³) ✓ CONFIRMED"
Confidence: 0.94
Notes: "Symbol clear, formula structure correct, standard notation. Consistent with stiffness calculations in mechanics literature."
Outcome: ACCEPTED (agreement signal)

STEP 4: REVIEWER TIER 2
────────────────────────────────────────────────────────────────
Reviewer: Engineer-2
Timestamp: 2026-05-10 11:45
Input: "K = G·a²/(π·t³)" [blinded decision]
Output: "K = (G × a²) / (π × t³) ✓ CONFIRMED"
Confidence: 0.91
Notes: "Independent confirmation. Symbol σ/sigma clear from context, not confused with Σ (capital). Formula makes physical sense."
Outcome: ACCEPTED (agreement signal)

STEP 5: REVIEWER TIER 3 (SPECIALIST)
────────────────────────────────────────────────────────────────
Reviewer: Dr. Mechanical-Engineer (Advanced)
Timestamp: 2026-05-10 13:00
Input: "K = G·a²/(π·t³)"
Output: "K = (G × a²) / (π × t³) [VERIFIED_FINAL]"
Confidence: 1.0
Notes: "All reviewers agree unanimously. Symbol verification complete (G, a, t are standard mechanical engineering variables; π is well-known constant; no Cyrillic/Latin confusion). Unit analysis balances to [pressure/length] = stiffness per unit length. Formula matches canonical form in ISO/GOST standards. Ready for VERIFIED confidence."
Outcome: ACCEPTED (specialist consensus)

FINAL STATUS:
────────────────────────────────────────────────────────────────
Ground truth value: "K = (G × a²) / (π × t³)"
Confidence level: VERIFIED
Status: LOCKED @ 2026-05-10 14:00
Lineage: [extraction (0.75) → specialist (0.92) → reviewer-1 (0.94) → reviewer-2 (0.91) → specialist-reviewer (1.0)]
Audit trail: COMPLETE & IMMUTABLE
Use: APPROVED for pilot calibration
```

### Example 2: Table with Disagreement & Arbitration

```
BLOCK: Material Properties Table, ISO 6943-2

SOURCE: scanned standard, medium quality (200 DPI)

LINEAGE CHAIN (immutable):
═════════════════════════════════════════════════════════════════

[STEPS 1-2: Extraction & Specialist Review — similar to Example 1, no issues]

STEP 3: REVIEWER TIER 1
────────────────────────────────────────────────────────────────
Reviewer: Engineer-1
Timestamp: 2026-05-11 10:00
Input: [table image]
Output: Extracted table with row count=5, col count=6, structure confirmed
        Cell(row=3, col=2) = "276" [Aluminum 6061, @ 100°C]
Confidence: 0.88
Notes: "Table structure clear. Cell value slightly ambiguous from scan (276 or 278?), but 276 more likely from context."
Outcome: ACCEPTED (low confidence flag)

STEP 4: REVIEWER TIER 2
────────────────────────────────────────────────────────────────
Reviewer: Engineer-2
Timestamp: 2026-05-11 11:30
Input: [table image, blinded to Tier 1 decision]
Output: Extracted Cell(row=3, col=2) = "278" [Aluminum, different value!]
Confidence: 0.85
Notes: "Cell value appears to be 278, not 276. Scan is ambiguous (7 vs 6 in ones place?). This is lower confidence judgment."
Outcome: CHALLENGED (disagreement signal)

DISAGREEMENT DETECTED:
────────────────────────────────────────────────────────────────
Reviewer-1: "276"
Reviewer-2: "278"
Difference: ±2 (significant in engineering contexts — pressure tolerance)
Status: DISAGREEMENT_FLAGGED → ARBITRATION REQUIRED

ARBITRATION PROCESS:
────────────────────────────────────────────────────────────────
Arbitrator: Dr. Materials-Specialist + Dr. Quality-Assurance
Timestamp: 2026-05-11 13:00
Input dossier:
  ├─ Source image [highlighted cell]
  ├─ Reviewer-1 decision: 276 (confidence 0.88)
  ├─ Reviewer-2 decision: 278 (confidence 0.85)
  ├─ Context: Aluminum 6061 yield strength @ 100°C should be ~250-280 MPa (both are possible)
  ├─ Literature reference: ISO 6943-2 technical report shows 276 MPa in Table A2
  └─ Reasoning for each: [as documented above]

Arbitration reasoning:
  ├─ Visual analysis: source image shows "27_" where _ is ambiguous (6 or 8?)
  ├─ Dimensional analysis: both 276 and 278 are physically reasonable
  ├─ Standard reference: ISO 6943-2 Table A2 lists "276 MPa" for this cell
  ├─ Disambiguation: cross-reference with official standard resolves ambiguity
  └─ Decision: 276 MPa (matches published standard reference)

Output: "Cell(row=3, col=2) = 276 [final decision]"
Confidence: 1.0 (based on standard reference)
Decision notes: "Ambiguous scan (276 vs 278). Arbitration based on ISO 6943-2 Table A2 which explicitly lists 276 MPa. This resolves disagreement decisively."
Outcome: ACCEPTED (arbitration resolved)

FINAL STATUS:
────────────────────────────────────────────────────────────────
Ground truth cell value: "276" [Aluminum 6061, @ 100°C]
Confidence level: VERIFIED (via official standard cross-reference)
Status: LOCKED @ 2026-05-11 14:30
Lineage: [extraction → reviewer-1 (0.88) → reviewer-2 (0.85, disagreement) → arbitration (1.0, standard-based)]
Audit trail: COMPLETE, includes disagreement resolution
Use: APPROVED for pilot calibration
```

---

## Summary

**Lineage system ensures:**
- ✅ Complete audit trail (every decision recorded)
- ✅ Immutability after lock (no backdating changes)
- ✅ Regulatory compliance (traceability for compliance audits)
- ✅ Correction management (versions maintained, prior states preserved)
- ✅ Dispute resolution (arbitration fully documented)
- ✅ Actor accountability (who decided what, when)
- ✅ Reproducibility (same process produces same truth)

**Critical:** Lineage is the **evidence** that ground truth is trustworthy.

**Next:** GROUND_TRUTH_RELEASE_GATE.md for corpus approval criteria before pilot use.
