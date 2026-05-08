# NORMALIZATION LINEAGE MODEL
## Traceable нормализация с полной аудиторией

**Статус:** 🟦 ARCHITECTURE DESIGN  
**Дата:** 2026-05-10  
**Версия:** 1.0  
**Ссылка:** CANONICAL_NORMALIZATION_ARCHITECTURE.md → STAGE 6

---

## 🎯 НАЗНАЧЕНИЕ

Обеспечить **complete audit trail** для каждой нормализации, что позволяет:
- Отследить source → canonical transformation
- Записать, какое normalization rule применено
- Зафиксировать reviewer override (если было ручное изменение)
- Сохранить version трека нормализации standard
- Обеспечить immutability after lock (audit-safe)

**Принцип:** Каждый шаг нормализации записывается, traceable и immutable.

---

## 1️⃣ NORMALIZATION LINEAGE SCHEMA

```sql
-- Main lineage tracking table
CREATE TABLE normalization_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference to ground truth block
  block_id UUID NOT NULL REFERENCES ground_truth_blocks(id),
  
  -- Normalization stage (1-6)
  normalization_stage INTEGER NOT NULL,
    -- 1: FORMULA_NORMALIZATION
    -- 2: UNIT_NORMALIZATION
    -- 3: SYMBOL_NORMALIZATION
    -- 4: TABLE_NORMALIZATION
    -- 5: REVIEWER_VALIDATION
    -- 6: ARBITRATION (if conflict)
  
  -- Source and canonical forms
  source_representation TEXT NOT NULL,
    -- Original extracted form (from OCR, specialist review, etc.)
  
  normalized_representation TEXT NOT NULL,
    -- Canonical form after normalization
  
  -- Which rule was applied
  normalization_rule_id UUID NOT NULL REFERENCES normalization_rules(id),
    -- Reference to FORMULA_NORMALIZATION_STANDARD.md rules
    -- Example: "formula_rule_A1" (multiplication symbols)
  
  normalization_version VARCHAR(10) NOT NULL,
    -- Version of normalization standard applied
    -- Example: "1.0.0" (FORMULA_NORMALIZATION_STANDARD v1.0)
  
  -- Reviewer information
  reviewer_id UUID NOT NULL REFERENCES users(id),
    -- Who performed the normalization (or who approved it)
  
  reviewer_notes TEXT,
    -- Optional notes from reviewer
  
  -- Manual override tracking
  reviewer_override BOOLEAN DEFAULT FALSE,
    -- TRUE if reviewer manually changed canonical form
    -- (e.g., formula is non-standard but correct)
  
  override_reason TEXT,
    -- Why reviewer overrode automatic normalization
    -- Example: "Formula uses non-standard notation per ISO 123"
  
  -- Arbitration (if disagreement)
  arbitration_decision_id UUID REFERENCES arbitration_decisions(id),
    -- NULL if no arbitration needed
    -- Reference to arbitration table if conflict
  
  -- Timestamps (immutable)
  created_at TIMESTAMP DEFAULT NOW(),
  locked_at TIMESTAMP,
    -- Set when lineage becomes immutable
    -- NULL while still editable
  
  -- Immutability flag
  is_locked BOOLEAN DEFAULT FALSE,
    -- TRUE means this lineage entry cannot be changed
  
  CONSTRAINT immutable_locked CHECK (
    (is_locked = FALSE AND locked_at IS NULL) OR
    (is_locked = TRUE AND locked_at IS NOT NULL)
  )
);

-- Normalization rules registry (metadata)
CREATE TABLE normalization_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  standard VARCHAR(50) NOT NULL,
    -- "FORMULA", "UNIT", "SYMBOL", "TABLE"
  
  rule_code VARCHAR(50) NOT NULL,
    -- "formula_rule_A1", "unit_rule_Loc1", etc.
  
  rule_name TEXT NOT NULL,
    -- Human-readable name
  
  rule_description TEXT NOT NULL,
    -- Full rule description from standard
  
  standard_version VARCHAR(10) NOT NULL,
    -- Version of standard this rule belongs to
  
  input_pattern TEXT,
    -- Regex or pattern this rule matches
  
  output_pattern TEXT,
    -- What the canonical form should be
  
  context_required BOOLEAN DEFAULT FALSE,
    -- TRUE if rule requires contextual interpretation
  
  confidence_score DECIMAL(3,2),
    -- How confident is this rule (0-1)
    -- 1.0 = deterministic
    -- 0.8 = usually works, context-dependent
  
  examples TEXT ARRAY,
    -- Examples: ['input1→output1', 'input2→output2']
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Arbitration decisions (for conflicts)
CREATE TABLE arbitration_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  block_id UUID NOT NULL REFERENCES ground_truth_blocks(id),
  
  conflict_type VARCHAR(50) NOT NULL,
    -- "reviewer_disagreement", "ambiguous_symbol", "unit_collision", etc.
  
  option_a TEXT NOT NULL,
    -- First canonical candidate
  
  option_b TEXT NOT NULL,
    -- Second canonical candidate (or more)
  
  chosen_option TEXT NOT NULL,
    -- Which option was selected
  
  arbitration_reason TEXT NOT NULL,
    -- Why this option was chosen
  
  arbitrator_id UUID NOT NULL REFERENCES users(id),
    -- Who made the decision
  
  resolved_at TIMESTAMP DEFAULT NOW(),
  
  is_locked BOOLEAN DEFAULT FALSE
);
```

---

## 2️⃣ NORMALIZATION LINEAGE EXAMPLES

### Example 1: Formula Normalization (No Conflict)

**Source:** K = G·a²/(π·t³) (OCR extraction)

**Lineage trace:**

```
Block ID: block_xyz
Source representation: K = G·a²/(π·t³)

Normalization Stage 1: FORMULA_NORMALIZATION
├─ Rule: formula_rule_A1 (multiplication symbols)
│  Input: G·a² (middle dot)
│  Output: G×a² (multiplication sign)
│
├─ Rule: formula_rule_D1 (whitespace normalization)
│  Input: K = G×a²/(π×t³)
│  Output: K = G×a²/(π×t³) (already normalized)
│
├─ Rule: formula_rule_E1 (superscripts)
│  Input: a², t³ (already superscript Unicode)
│  Output: a², t³ (no change needed)
│
└─ Normalized representation: K = G×a²/(π×t³)

Normalization Stage 2: UNIT_NORMALIZATION
├─ No units present (formula only)
└─ Output: K = G×a²/(π×t³)

Normalization Stage 3: SYMBOL_NORMALIZATION
├─ Rule: symbol_rule_Greek1 (Greek symbols)
│  Check: π (pi) is Greek → canonical π (Unicode U+03C0)
│  Check: G (Latin) is variable → keep
│  Check: a, t (Latin) are variables → keep
└─ Output: K = G×a²/(π×t³)

Normalization Stage 4: TABLE_NORMALIZATION
├─ Not a table
└─ Skipped

Normalization Stage 5: REVIEWER_VALIDATION
├─ Reviewer: alice@enghub.io
├─ Validation: ✅ Formula correct, notation standard
├─ Override: NO
└─ Confidence: 1.0 (deterministic)

Normalization Stage 6: ARBITRATION
├─ No conflict detected
└─ Skipped

FINAL CANONICAL FORM: K = G×a²/(π×t³)
LOCKED: YES (2026-05-10 14:30)
IMMUTABLE: YES
LINEAGE TRACE: Complete, audit-safe
```

**Lineage table entries:**

```
Row 1:
  id: line_001
  block_id: block_xyz
  normalization_stage: 1
  source_representation: K = G·a²/(π·t³)
  normalized_representation: K = G×a²/(π×t³)
  normalization_rule_id: rule_A1
  normalization_version: 1.0.0
  reviewer_id: alice_id
  reviewer_override: FALSE
  arbitration_decision_id: NULL
  created_at: 2026-05-10 14:25
  locked_at: 2026-05-10 14:30
  is_locked: TRUE

Row 2:
  id: line_002
  block_id: block_xyz
  normalization_stage: 5
  source_representation: K = G×a²/(π×t³)
  normalized_representation: K = G×a²/(π×t³)
  normalization_rule_id: rule_reviewer_standard
  normalization_version: 1.0.0
  reviewer_id: alice_id
  reviewer_notes: "Formula correct, standard notation"
  reviewer_override: FALSE
  arbitration_decision_id: NULL
  created_at: 2026-05-10 14:28
  locked_at: 2026-05-10 14:30
  is_locked: TRUE
```

---

### Example 2: Unit Normalization (With Ambiguity)

**Source:** 250 Мпа (Russian OCR, ambiguous prefix)

**Lineage trace:**

```
Block ID: block_stress_001
Source representation: 250 Мпа

Normalization Stage 2: UNIT_NORMALIZATION
├─ Input: Мпа (Cyrillic, ambiguous M vs m)
├─ Rule: unit_rule_Loc1 (locale normalization)
│  │ Cyrillic М (mega) vs m (milli) → ambiguous
│  │ Context: material stress → likely MPa (megapascal)
│  └─ Output: 250 MPa (assuming mega)
│
├─ Rule: unit_rule_Pref1 (SI prefix canonicalization)
│  │ М → M (Cyrillic → canonical Latin)
│  └─ Output: 250 MPa
│
└─ Ambiguity detected: is it mPa (millipascal) or MPa (megapascal)?
   → Flag for reviewer decision

Normalization Stage 5: REVIEWER_VALIDATION
├─ Reviewer: bob@enghub.io
├─ Decision: "Material stress context → MPa (megapascal) is correct"
│           "0.25 millipascals would be unphysical for material"
├─ Canonical form: 250 MPa
├─ Confidence: 0.95
└─ No override needed (decision follows standard logic)

Normalization Stage 6: ARBITRATION
├─ No conflict with other reviewers
└─ Skipped

FINAL CANONICAL FORM: 250 MPa
LOCKED: YES
REASONING: Context-based (material stress domain)
RESIDUAL RISK: mPa vs MPa confusion documented (see confusion matrix)
```

**Lineage table entries:**

```
Row 1:
  id: line_003
  block_id: block_stress_001
  normalization_stage: 2
  source_representation: 250 Мпа
  normalized_representation: 250 MPa [AMBIGUOUS]
  normalization_rule_id: rule_unit_Loc1
  normalization_version: 1.0.0
  reviewer_id: system
  reviewer_notes: "Ambiguity detected: mPa vs MPa. Flagged for review."
  reviewer_override: FALSE
  arbitration_decision_id: NULL
  created_at: 2026-05-10 14:35
  locked_at: NULL  ← NOT YET LOCKED (ambiguous)
  is_locked: FALSE

Row 2:
  id: line_004
  block_id: block_stress_001
  normalization_stage: 5
  source_representation: 250 MPa [AMBIGUOUS]
  normalized_representation: 250 MPa
  normalization_rule_id: rule_reviewer_ambiguity_resolution
  normalization_version: 1.0.0
  reviewer_id: bob_id
  reviewer_notes: "Material stress context indicates MPa (megapascal). mPa (millipascal) is unphysical."
  reviewer_override: FALSE
  arbitration_decision_id: NULL
  created_at: 2026-05-10 14:40
  locked_at: 2026-05-10 14:42
  is_locked: TRUE
```

---

### Example 3: Symbol Normalization (With Reviewer Disagreement)

**Source:** Stress σ = F/A (but is σ Greek sigma or Cyrillic С?)

**Lineage trace:**

```
Block ID: block_symbol_001
Source representation: σ = F/A (uncertain if Greek or Cyrillic)

Normalization Stage 3: SYMBOL_NORMALIZATION
├─ Rule: symbol_rule_Greek1 (Greek symbol detection)
│  │ Check: σ character code
│  │ Option A: U+03C3 (Greek sigma) ← standard engineering
│  │ Option B: U+0421 (Cyrillic С) ← text
│  └─ Assume: Greek sigma (formula context)
│
└─ Normalized (assumed): σ = F/A (Greek sigma)

Normalization Stage 5: REVIEWER_VALIDATION
├─ Reviewer 1 (alice): "σ is Greek sigma (standard stress symbol)" → ✓
├─ Reviewer 2 (bob): "σ could be Cyrillic С (in Russian text context)" → ❌
├─ Reviewer 3 (charlie): "Formula syntax + engineering domain → Greek sigma" → ✓
│
└─ DISAGREEMENT DETECTED (bob vs. alice+charlie)

Normalization Stage 6: ARBITRATION
├─ Arbitrator: diana@enghub.io
├─ Analysis: "Source document is engineering spec (Russian), formula notation.
│            Engineering domain uses Greek symbols for stress."
├─ Decision: Greek sigma (U+03C3) is canonical
├─ Reasoning: Domain convention + formula syntax > text language
└─ Resolved: σ = F/A (Greek sigma U+03C3)

FINAL CANONICAL FORM: σ = F/A
LOCKED: YES
CONFIDENCE: 0.92 (required arbitration, but resolved)
LINEAGE: 4 entries (symbol stage, 3 reviewers, arbitration)
```

**Lineage table entries:**

```
Row 1:
  id: line_005
  block_id: block_symbol_001
  normalization_stage: 3
  source_representation: [σ character - uncertain]
  normalized_representation: σ (U+03C3 Greek sigma)
  normalization_rule_id: rule_symbol_Greek1
  normalization_version: 1.0.0
  reviewer_id: system
  reviewer_override: FALSE
  arbitration_decision_id: NULL
  created_at: 2026-05-10 15:00
  locked_at: NULL  ← AMBIGUOUS
  is_locked: FALSE

Row 2 (Reviewer 1):
  id: line_006
  block_id: block_symbol_001
  normalization_stage: 5
  source_representation: σ (uncertain)
  normalized_representation: σ (U+03C3 Greek sigma) ✓
  normalization_rule_id: rule_reviewer_symbol_confirmation
  normalization_version: 1.0.0
  reviewer_id: alice_id
  reviewer_notes: "Greek sigma is standard for stress symbol"
  reviewer_override: FALSE
  arbitration_decision_id: NULL
  created_at: 2026-05-10 15:05
  locked_at: NULL
  is_locked: FALSE

Row 3 (Reviewer 2 - Disagreement):
  id: line_007
  block_id: block_symbol_001
  normalization_stage: 5
  source_representation: σ (uncertain)
  normalized_representation: С (U+0421 Cyrillic C) ❌
  normalization_rule_id: rule_reviewer_symbol_disagreement
  normalization_version: 1.0.0
  reviewer_id: bob_id
  reviewer_notes: "Cyrillic С (in Russian document context)"
  reviewer_override: FALSE
  arbitration_decision_id: arb_001
  created_at: 2026-05-10 15:10
  locked_at: NULL  ← CONFLICT
  is_locked: FALSE

Row 4 (Arbitration Resolution):
  id: line_008
  block_id: block_symbol_001
  normalization_stage: 6
  source_representation: [σ uncertain, С disputed]
  normalized_representation: σ (U+03C3 Greek sigma)
  normalization_rule_id: rule_arbitration_symbol_resolution
  normalization_version: 1.0.0
  reviewer_id: diana_id
  reviewer_notes: "Domain + syntax → Greek. Arbitration decision: Greek sigma."
  reviewer_override: FALSE
  arbitration_decision_id: arb_001
  created_at: 2026-05-10 15:15
  locked_at: 2026-05-10 15:20
  is_locked: TRUE
```

---

## 3️⃣ NORMALIZATION LINEAGE STATE MACHINE

```
     ┌─────────────────────────────────┐
     │ EXTRACTED (from specialist)     │
     │ source_representation set       │
     └────────────┬────────────────────┘
                  │
     ┌────────────▼────────────────────────┐
     │ STAGE 1-4 NORMALIZATION             │
     │ (formula/unit/symbol/table)         │
     │ normalized_representation set       │
     │ reviewer_override: check if needed  │
     └────────────┬────────────────────────┘
                  │
          ┌───────▼────────┐
          │ Ambiguous?     │
          └───┬────────┬───┘
              │        │
         NO  │        │ YES
             │        │
      ┌──────▼──┐  ┌──▼──────────────────────┐
      │ Stage 5 │  │ AMBIGUITY FLAG + REVIEW │
      │ REVIEWER│  │ is_locked: FALSE        │
      │VALIDATION  │ locked_at: NULL         │
      └──────┬──┘  └──┬─────────────────────┘
             │        │
             │     ┌──▼──────────────┐
             │     │ Reviewer input  │
             │     │ (consensus or   │
             │     │  conflict)      │
             │     └──┬─────────────┘
             │        │
             │   ┌────▼─────────────┐
             │   │ Consensus?       │
             │   └─┬──────────────┬─┘
             │     │              │
             │ NO  │              │ YES
             │     │              │
             │  ┌──▼──────────────▼──┐
             │  │ STAGE 6            │
             │  │ ARBITRATION        │
             │  │ arbitration_decision_id set
             │  └──┬─────────────────┘
             │     │
             └─────┼──────────────┐
                   │              │
          ┌────────▼──────────────▼──┐
          │ LOCKED STATE             │
          │ is_locked: TRUE          │
          │ locked_at: TIMESTAMP     │
          │ IMMUTABLE                │
          │ (audit-safe)             │
          └──────────────────────────┘
```

---

## 4️⃣ NORMALIZATION LINEAGE IMMUTABILITY

### Rule L1: Locking Protocol

Once normalized and reviewed, lineage entry is locked:

```sql
-- Lock normalization after approval
UPDATE normalization_lineage
SET is_locked = TRUE,
    locked_at = NOW()
WHERE id = 'line_001' AND is_locked = FALSE;

-- Prevent modification of locked entries
CREATE CONSTRAINT locked_immutable
CHECK (is_locked = FALSE OR locked_at <= NOW());

-- Prevent deletion of locked entries
CREATE CONSTRAINT no_delete_locked
BEFORE DELETE ON normalization_lineage
FOR EACH ROW
WHEN (OLD.is_locked = TRUE)
RAISE EXCEPTION 'Cannot delete locked lineage entry';
```

### Rule L2: Audit Trail Preservation

All lineage entries are preserved, including superseded versions:

```
If normalization is corrected (e.g., unit mPa → MPa after review):

Entry 1 (LOCKED):
  source: "250 mPa"
  normalized: "250 mPa" [WRONG]
  locked_at: 2026-05-10 14:30
  status: SUPERSEDED (marked in corrections table)

Entry 2 (NEW, LOCKED):
  source: "250 mPa" [CORRECTED]
  normalized: "250 MPa" [CORRECT]
  locked_at: 2026-05-10 15:00
  correction_id: corr_001 [references Entry 1]
```

---

## 5️⃣ CORRECTION MANAGEMENT

```sql
-- Corrections table (links old → new normalization)
CREATE TABLE normalization_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  superseded_lineage_id UUID NOT NULL REFERENCES normalization_lineage(id),
    -- The old (wrong) normalization entry
  
  corrected_lineage_id UUID NOT NULL REFERENCES normalization_lineage(id),
    -- The new (correct) normalization entry
  
  correction_reason TEXT NOT NULL,
    -- Why the correction was made
  
  corrected_by UUID NOT NULL REFERENCES users(id),
    -- Who authorized the correction
  
  corrected_at TIMESTAMP DEFAULT NOW(),
  
  is_locked BOOLEAN DEFAULT FALSE
    -- Correction itself is immutable
);
```

**Example:**

```
Correction record:
  superseded_lineage_id: line_003 (250 Мпа → 250 MPa [WRONG])
  corrected_lineage_id: line_009 (250 mPa → 250 MPa [CORRECT])
  correction_reason: "mPa vs MPa ambiguity: context review showed megapascal is correct"
  corrected_by: diana_id
  corrected_at: 2026-05-10 15:25
  is_locked: TRUE
```

---

## 6️⃣ NORMALIZATION LINEAGE AUDIT REPORT

### Report Type 1: Completeness Check

```
Report: Normalization Lineage Completeness
Block ID: block_xyz
Status: ✅ COMPLETE

Coverage:
  ✅ Stage 1 (Formula): normalized
  ✅ Stage 2 (Unit): N/A (no units)
  ✅ Stage 3 (Symbol): normalized
  ✅ Stage 4 (Table): N/A (not table)
  ✅ Stage 5 (Reviewer): validated
  ✅ Stage 6 (Arbitration): N/A (no conflict)

Lineage entries: 2
  - Stage 1: K = G·a² → K = G×a²
  - Stage 5: Reviewer alice confirmed ✓

Locked: YES (2026-05-10 14:30)
Immutable: YES
Audit-safe: YES
```

### Report Type 2: Normalization Standards Compliance

```
Report: Standards Compliance
Block ID: block_stress_001

Normalization Standard Used:
  ✅ FORMULA_NORMALIZATION_STANDARD v1.0
  ✅ UNIT_NORMALIZATION_STANDARD v1.0
  ✅ SYMBOL_NORMALIZATION_STANDARD v1.0
  ✅ TABLE_NORMALIZATION_STANDARD v1.0

Rules Applied:
  ✅ formula_rule_A1 (multiplication symbols)
  ✅ unit_rule_Loc1 (locale normalization)
  ✅ unit_rule_Pref1 (SI prefix)
  ✅ symbol_rule_Greek1 (Greek symbols)

Ambiguities Flagged: 1
  - mPa vs MPa: RESOLVED by reviewer

Reviewer Overrides: 0
Arbitration Decisions: 0

Compliance: 100%
```

---

## 7️⃣ LINEAGE QUERY EXAMPLES

### Query 1: Get All Normalizations for a Block

```sql
SELECT * FROM normalization_lineage
WHERE block_id = 'block_xyz'
ORDER BY created_at ASC;
```

### Query 2: Get Ambiguous Normalizations Awaiting Resolution

```sql
SELECT * FROM normalization_lineage
WHERE is_locked = FALSE
  AND arbitration_decision_id IS NULL
  AND reviewer_override = FALSE
ORDER BY created_at ASC;
```

### Query 3: Get Lineage with Reviewer Overrides

```sql
SELECT * FROM normalization_lineage
WHERE reviewer_override = TRUE
ORDER BY created_at DESC;
```

### Query 4: Get Correction History for a Block

```sql
SELECT l1.source_representation as old_form,
       l1.normalized_representation as wrong_norm,
       l2.normalized_representation as correct_norm,
       c.correction_reason,
       c.corrected_at
FROM normalization_corrections c
JOIN normalization_lineage l1 ON c.superseded_lineage_id = l1.id
JOIN normalization_lineage l2 ON c.corrected_lineage_id = l2.id
WHERE l1.block_id = 'block_xyz'
ORDER BY c.corrected_at DESC;
```

---

## 8️⃣ VERSIONING AND UPDATES

**Version 1.0 (2026-05-10):**
- Normalization lineage schema
- 6-stage normalization tracking
- Immutability and audit trail
- Correction management
- Arbitration integration
- Lineage state machine
- Query examples

**Future enhancements:**
- Lineage visualization (timeline, dependency graph)
- Automated compliance reporting
- Normalization analytics (which rules are used, conflict rates)
- Batch lineage operations (apply rule to multiple blocks)

---

## 📝 ПРИМЕЧАНИЯ

1. **Immutability:** Once locked, lineage cannot be changed (audit-safe, regulatory-compliant).
2. **Traceability:** Every normalization step is recorded, with rule, reviewer, timestamp.
3. **Ambiguity handling:** Ambiguous normalizations remain unlocked until resolved by reviewer/arbitration.
4. **Correction tracking:** All corrections are linked to original entries (historical preservation).
5. **Audit compliance:** Lineage provides complete chain of custody for ground truth.

---

**Следующий документ:** REVIEWER_NORMALIZATION_CONTRACT.md (mandatory normalization rules for reviewers)
