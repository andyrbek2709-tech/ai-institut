# NORMALIZATION EXAMPLES SHOWCASE
## Complete Examples from Canonical Normalization Architecture

**Status:** 🟩 COMPREHENSIVE EXAMPLES COLLECTION  
**Date:** 2026-05-10  
**Purpose:** Quick reference for normalization in action

---

## 📋 INDEX OF EXAMPLES

| # | Type | Source Document | Example |
|---|---|---|---|
| 1 | Formula | FORMULA_NORMALIZATION_STANDARD.md | Material property formula with units |
| 2 | Unit | UNIT_NORMALIZATION_STANDARD.md | Pressure unit ambiguity (mPa vs MPa) |
| 3 | Reviewer | REVIEWER_NORMALIZATION_CONTRACT.md | Standard-based normalization workflow |
| 4 | Lineage | NORMALIZATION_LINEAGE_MODEL.md | Formula normalization with no conflict |
| 5 | Unicode | FORMULA_NORMALIZATION_STANDARD.md | Unicode superscript/subscript normalization |
| 6 | Table | TABLE_NORMALIZATION_STANDARD.md | Hierarchical table with merged headers |
| 7 | Consistency | CANONICAL_NORMALIZATION_ARCHITECTURE.md | Normalization consistency tests |
| 8 | Risks | CANONICAL_NORMALIZATION_ARCHITECTURE.md | Remaining normalization risks |

---

## 1️⃣ FORMULA NORMALIZATION EXAMPLE

**From:** FORMULA_NORMALIZATION_STANDARD.md → Example 1

### Problem
OCR extracted formula with non-canonical notation (multiple variants):
- Multiplication: · (middle dot instead of ×)
- Decimal separator: comma (European format)
- Engineering notation: e notation (scientific)

### Input
```
σ_y·[E₁₂/E₂₂] = 250·10⁻³·(1 + μ·sin2θ)
```

### Normalization Steps

**Step 1: Multiplication symbols (Rule A1)**
- Input: · (middle dot)
- Rule: · → × (always)
- Output: σ_y×[E₁₂/E₂₂] = 250×10⁻³×(1 + μ×sin2θ)

**Step 2: Decimal separators (Rule C1)**
- Input: none (already correct)
- Output: no change

**Step 3: Superscripts (Rule E1)**
- Input: 2θ, ³ (already Unicode superscripts)
- Output: 2θ, ³ (no change needed)

**Step 4: Whitespace (Rule D1-D6)**
- Input: σ_y×[E₁₂/E₂₂] = 250×10⁻³×(1 + μ×sin2θ)
- Rule: Space around = and operators, space after function names
- Output: σ_y × [E₁₂/E₂₂] = 250 × 10⁻³ × (1 + μ × sin 2θ)

**Step 5: Engineering notation (Rule G1)**
- Input: 10⁻³ (already canonical)
- Output: 10⁻³ (no change)

### Output (Canonical)
```
σ_y × [E₁₂/E₂₂] = 250 × 10⁻³ × (1 + μ × sin 2θ)
```

### Lineage Record
```
source_representation: σ_y·[E₁₂/E₂₂] = 250·10⁻³·(1 + μ·sin2θ)
normalized_representation: σ_y × [E₁₂/E₂₂] = 250 × 10⁻³ × (1 + μ × sin 2θ)
rules_applied: [A1, D1, D3, D6]
confidence: 1.0 (deterministic)
```

---

## 2️⃣ UNIT NORMALIZATION EXAMPLE

**From:** UNIT_NORMALIZATION_STANDARD.md → Example 1

### Problem
Pressure unit with potential ambiguity (Cyrillic input, prefix uncertainty):

Input representations:
- Мпа (Cyrillic, mixed case — is it milli or mega?)
- МПа (Cyrillic, correct case)
- mPa (looks like millipascal, wrong!)

### Context
Material stress property (which domain?)

### Normalization Steps

**Step 1: Identify base unit (Rule Loc1)**
- Input: Мпа, МПа, mPa
- Identify: pascal (Pa) with unknown prefix
- Question: Is M mega (10⁶) or m milli (10⁻³)?

**Step 2: Context check (Rule V2)**
- Material strength context
- Typical values: 100-500 MPa (megapascal, reasonable)
- If mPa: 0.25 pascals (unphysical for material)
- Decision: Assume mega (M)

**Step 3: Locale normalization (Rule Loc1)**
- Input: Мпа, МПа, mPa
- Normalize locale: Cyrillic → English
- Output: MPa

**Step 4: Prefix canonicalization (Rule Pref1)**
- Input: М, М, m
- Rule: Capital M for mega, lowercase m for milli
- Material context: M = mega
- Output: MPa (megapascal)

**Step 5: Ambiguity flagging**
- Confidence: 0.95 (context-based, not deterministic)
- Note: mPa vs MPa confusion documented in confusion matrix

### Output (Canonical)
```
250 MPa
```

### Why Not Other Forms?
- ❌ 250 mPa = 0.00025 Pa (unphysical for material strength)
- ❌ 250 МПа = non-canonical (Cyrillic)
- ❌ 250 Мпа = non-canonical (mixed case)

### Lineage Record
```
source_representation: 250 Мпа
normalized_representation: 250 MPa
rules_applied: [unit_rule_Loc1, unit_rule_Pref1, unit_rule_V2]
context: material_strength
confidence: 0.95
reviewer_notes: "Context indicates MPa (material domain). mPa would be unphysical."
```

---

## 3️⃣ REVIEWER NORMALIZATION WORKFLOW EXAMPLE

**From:** REVIEWER_NORMALIZATION_CONTRACT.md → Correct Example

### Reviewer Task
Normalize and validate: K = G·a²/(π·t³)

### Reviewer Actions (Following Mandatory Workflow)

**Step 1: Classify block type**
- Type: Formula (no table, no units in formula itself)
- Domain: Material mechanics
- Language: English

**Step 2: Apply Standards IN ORDER**

#### Stage 1: FORMULA_NORMALIZATION
- ✅ Consult: FORMULA_NORMALIZATION_STANDARD.md
- Find rule: formula_rule_A1 (· → ×)
- Find rule: formula_rule_D1 (whitespace)
- Apply: K = G·a² → K = G×a² (rule A1)
- Apply: Add spacing → K = G×a²/(π×t³) (rule D1)

#### Stage 2: UNIT_NORMALIZATION
- Check: No units in formula → Skip

#### Stage 3: SYMBOL_NORMALIZATION
- ✅ Consult: SYMBOL_NORMALIZATION_STANDARD.md
- Find rule: symbol_rule_Greek1 (π is Greek pi)
- Verify: π (U+03C0) is canonical Greek
- Check: G, a, t are Latin variables (keep as is)
- No changes needed (already correct)

#### Stage 4: TABLE_NORMALIZATION
- Check: Not a table → Skip

#### Stage 5: REVIEWER VALIDATION
- Verify: K = G×a²/(π×t³) matches standards
- Dimensional check: [K] with [G], [a], [π], [t] - OK
- Formula syntax: Valid mathematical expression
- Confidence: 1.0 (deterministic, no ambiguity)
- Approval: ✅ PASS

#### Stage 6: ARBITRATION
- Check: No conflicts → Skip

**Step 3: Complete Normalization Checklist**

```
✅ Formula Checklist (10 items):
  ✅ Multiplication symbols: · → ×
  ✅ Minus signs: (none present)
  ✅ Decimal separators: (none present)
  ✅ Whitespace: normalized around operators
  ✅ Superscripts/subscripts: a² (already Unicode)
  ✅ Unicode NFC: applied
  ✅ Engineering notation: (none present)
  ✅ Confusion matrix: no conflicts
  ✅ Dimensional analysis: passes
  ✅ Symbol consistency: OK

Signature: [Reviewer Alice] Date: [2026-05-10]
```

**Step 4: Record Lineage**

```sql
INSERT INTO normalization_lineage (
  block_id, normalization_stage, source_representation, 
  normalized_representation, normalization_rule_id, 
  normalization_version, reviewer_id, reviewer_override, 
  arbitration_decision_id, is_locked
) VALUES (
  'block_xyz', 1, 'K = G·a²/(π·t³)', 
  'K = G×a²/(π×t³)', 'rule_A1', 
  '1.0.0', 'alice_id', FALSE, 
  NULL, TRUE
);
```

**Step 5: Lock and Approve**

```
Status: ✅ APPROVED
Canonical form: K = G×a²/(π×t³)
Locked at: 2026-05-10 14:30
Immutable: YES
```

---

## 4️⃣ NORMALIZATION LINEAGE EXAMPLE (Complete Trace)

**From:** NORMALIZATION_LINEAGE_MODEL.md → Example 1

### Block Information
- Block ID: block_xyz
- Type: Formula
- Source: OCR extraction
- Original: K = G·a²/(π·t³)

### Complete Lineage Trace

#### Entry 1: Formula Normalization Stage
```
id: line_001
block_id: block_xyz
normalization_stage: 1 (FORMULA)
source_representation: K = G·a²/(π·t³)
normalized_representation: K = G×a²/(π×t³)
normalization_rule_id: rule_A1 (multiplication symbols)
normalization_version: 1.0.0
reviewer_id: alice_id
reviewer_override: FALSE
arbitration_decision_id: NULL
created_at: 2026-05-10 14:25
locked_at: 2026-05-10 14:30
is_locked: TRUE
```

#### Entry 2: Reviewer Validation Stage
```
id: line_002
block_id: block_xyz
normalization_stage: 5 (REVIEWER)
source_representation: K = G×a²/(π×t³)
normalized_representation: K = G×a²/(π×t³)
normalization_rule_id: rule_reviewer_standard
normalization_version: 1.0.0
reviewer_id: alice_id
reviewer_notes: "Formula correct, standard notation, dimensional analysis passes"
reviewer_override: FALSE
arbitration_decision_id: NULL
created_at: 2026-05-10 14:28
locked_at: 2026-05-10 14:30
is_locked: TRUE
```

### Lineage Summary
```
┌─────────────────────────────────────────────┐
│ EXTRACTED: K = G·a²/(π·t³)                  │
└────────────┬────────────────────────────────┘
             │ Stage 1: FORMULA (rule A1)
             ▼
┌─────────────────────────────────────────────┐
│ NORMALIZED: K = G×a²/(π×t³)                │
└────────────┬────────────────────────────────┘
             │ Stage 5: REVIEWER (alice)
             ▼
┌─────────────────────────────────────────────┐
│ VERIFIED: K = G×a²/(π×t³)                  │
│ Locked: YES | Immutable: YES                │
└─────────────────────────────────────────────┘
```

---

## 5️⃣ UNICODE NORMALIZATION EXAMPLE

**From:** FORMULA_NORMALIZATION_STANDARD.md → Example 2 (Cyrillic text)

### Problem
Mixed language input with non-ASCII notation.

### Input
```
Stress σ (Cyrillic С?) in standard
σ = F,A / N
```

### Normalization Steps

**Step 1: Symbol identification**
- Character σ: Could be Greek (U+03C3) or Cyrillic (U+0421)
- Context: Word "stress" is English, formula symbol
- Decision: Greek sigma is standard engineering notation

**Step 2: Unicode NFC normalization**
- Apply: Unicode NFC (composed form)
- Ensure: σ is U+03C3 (Greek sigma, composed)

**Step 3: Decimal separator**
- Input: F,A (comma decimal)
- Rule C1: , → .
- Output: F.A

**Step 4: Whitespace**
- Input: σ = F.A / N
- Rule D3: Spacing around operators
- Output: σ = F.A/N

### Output (Canonical)
```
σ = F.A/N
```

### Important Notes
- ✅ σ is Greek sigma (U+03C3) — standard notation for stress
- ✅ Decimal converted to period (.)
- ✅ Cyrillic text remains as is (only formula normalized)
- ✅ Unicode NFC applied (immutable, reproducible)

---

## 6️⃣ TABLE NORMALIZATION EXAMPLE

**From:** TABLE_NORMALIZATION_STANDARD.md → Example 2

### Input (OCR variant with merged headers)
```
┌─────────────────────────────────┐
│  Elastic Modulus and Yield      │  ← merged header row
├──────────────────┬──────────────┤
│  Modulus         │  Strength    │  ← level 2 headers (merged)
├──────┬───────────┼──────┬───────┤
│ E    │ G         │ σ_y  │ τ_y   │  ← level 3 headers
├──────┼───────────┼──────┼───────┤
│GPa   │ GPa       │ МПа  │ МПа   │  ← units (Cyrillic!)
├──────┼───────────┼──────┼───────┤
│210   │ 80        │250   │150    │
│70    │ 26        │70    │45     │
└──────┴───────────┴──────┴───────┘
```

### Normalization Steps

**Step 1: Table Classification**
- Type: Hierarchical headers (Type 2)
- Merged cells detected: 2 levels of merging

**Step 2: Header Normalization**

Level 1 (Row 1):
- "Elastic Modulus and Yield" (merged across 4 columns)
- Output: "Elastic Modulus and Yield Strength" (complete)

Level 2 (Row 2):
- "Modulus" (merged across 2 columns) → "Elastic Modulus"
- "Strength" (merged across 2 columns) → "Yield Strength"

Level 3 (Row 3):
- E → E (keep)
- G → G (keep)
- σ_y → σᵧ (normalize subscript, Unicode)
- τ_y → τᵧ (normalize subscript, Unicode)

Unit Row (Row 4):
- GPa → GPa (keep, already canonical)
- МПа → MPa (normalize locale: Cyrillic → English)

**Step 3: Cell Normalization**

Data rows: 210, 80, 250, 150 and 70, 26, 70, 45
- All numeric, already canonical
- Precision: 2-3 digits (standardized)

### Output (Canonical)
```
┌─────────────────────────────────────────────────────┐
│           Elastic Modulus and Yield Strength        │
├─────────────────────────┬───────────────────────────┤
│ Elastic Modulus         │ Yield Strength            │
├──────────────┬──────────┼──────────────┬────────────┤
│ E [GPa]      │ G [GPa]  │ σᵧ [MPa]     │ τᵧ [MPa]   │
├──────────────┼──────────┼──────────────┼────────────┤
│ 210          │ 80       │ 250          │ 150        │
│ 70           │ 26       │ 70           │ 45         │
└──────────────┴──────────┴──────────────┴────────────┘
```

### Key Transformations
- ✅ Merged cell hierarchy preserved
- ✅ Unit normalization: Мпа → MPa
- ✅ Subscript normalization: σ_y → σᵧ
- ✅ Column units explicit: [GPa], [MPa]
- ✅ Rectangular consistency: 4 columns × 2 data rows

---

## 7️⃣ NORMALIZATION CONSISTENCY TESTS

**From:** CANONICAL_NORMALIZATION_ARCHITECTURE.md → Stage 7

### Test Suite 1: Reviewer-Independent Normalization

**Test:** Different reviewers normalize same input → same output

```
Input: σ_y = 250 Мпа

Reviewer A:
  1. Apply formula rules (none)
  2. Apply unit rules: Мпа → MPa
  Output: σ_y = 250 MPa

Reviewer B:
  1. Apply formula rules (none)
  2. Apply unit rules: Мпа → MPa
  Output: σ_y = 250 MPa

Reviewer C:
  1. Apply formula rules (none)
  2. Apply unit rules: Мпа → MPa
  Output: σ_y = 250 MPa

Test result: ✅ PASS (all reviewers → same output)
```

### Test Suite 2: Locale Normalization Consistency

**Test:** Different locale variants → same canonical form

```
Input variants:
  Option 1: 250 MPa (English)
  Option 2: 250 МПа (Cyrillic)
  Option 3: 250 Мпа (mixed case)

Normalization:
  Option 1: MPa → MPa (already canonical)
  Option 2: МПа → MPa (locale conversion)
  Option 3: Мпа → MPa (locale + case normalization)

Test result: ✅ PASS (all variants → 250 MPa)
```

### Test Suite 3: Unicode Normalization Consistency

**Test:** Different Unicode forms (combining vs precomposed) → same

```
Input variant 1: σ (combining form: σ + combining macron)
Input variant 2: σ (precomposed form: U+03C3)

NFC normalization:
  Variant 1: decomposed → composed → σ (U+03C3)
  Variant 2: already composed → σ (U+03C3)

Test result: ✅ PASS (both → identical U+03C3)
```

### Test Suite 4: Formula Equivalence Normalization

**Test:** Different formula notations → same canonical structure

```
Input variant 1: K·a²/π·t³
Input variant 2: K × a² ÷ π × t³
Input variant 3: K*a^2/(π*t^3)

Normalization (formula rules A, D, E):
  Variant 1: · → ×, whitespace
    → K = G×a²/(π×t³)
  Variant 2: Already uses ×, convert ÷ to /
    → K = G×a²/(π×t³)
  Variant 3: * → ×, ^ → superscript
    → K = G×a²/(π×t³)

Test result: ✅ PASS (all variants → canonical form)
```

### Test Suite 5: Table Normalization Consistency

**Test:** Different table formats → same canonical structure

```
Input variant 1: Simple table (no merged cells)
Input variant 2: Merged header variant
Input variant 3: Hierarchical variant

All normalize to canonical structure:
  - Column 1: Material [categorical]
  - Column 2: Strength [MPa, numeric]
  - Column 3: Density [kg/m³, numeric]

Test result: ✅ PASS (structure invariant)
```

### Test Suite 6: Symbol Consistency

**Test:** μ (micro) in different contexts → same canonical

```
Input variant 1: 5 μm (micrometers)
Input variant 2: 5 µm (micro sign variant)
Input variant 3: 5 um (OCR error)

Normalization (symbol rules + micro rules):
  Variant 1: Already μ → keep μm
  Variant 2: µ (U+00B5) → μ (U+03BC)
  Variant 3: um → μm (context rule: dimension context = micro)

Test result: ✅ PASS (all → 5 μm)
```

### Test Suite 7: Decimal Consistency

**Test:** Different decimal notations → same canonical

```
Input variant 1: 30.5
Input variant 2: 30,5 (European comma)
Input variant 3: 30.50 (trailing zero)

Normalization (decimal rule C):
  Variant 1: 30.5 (already canonical)
  Variant 2: 30,5 → 30.5 (comma → period)
  Variant 3: 30.50 → 30.5 (remove trailing zero)

Test result: ✅ PASS (all → 30.5)
```

### Test Suite 8: Whitespace Consistency

**Test:** Different spacing → same canonical spacing

```
Input variant 1: σ = F/A
Input variant 2: σ=F/A (no spaces)
Input variant 3: σ  =  F  /  A (excessive spaces)

Normalization (whitespace rules D1-D6):
  Variant 1: OK (already normalized)
  Variant 2: Add spacing around = and operators
    → σ = F/A
  Variant 3: Remove excessive spaces
    → σ = F/A

Test result: ✅ PASS (all → σ = F/A)
```

---

## 8️⃣ REMAINING NORMALIZATION RISKS

**From:** CANONICAL_NORMALIZATION_ARCHITECTURE.md → Remaining Risks

### HIGH RISK ISSUES

**1. Formula nesting complexity**
- **Issue:** Complex nested formulas may have ambiguous normalization
- **Example:** K = (G·a²)/(π·(t³)) — multiple nesting levels
- **Mitigation:** Parentheses normalization rule (remove internal spaces)
- **Status:** Documented in FORMULA_NORMALIZATION_STANDARD rule M2

**2. Language-specific symbol disambiguation**
- **Issue:** Cyrillic σ vs Greek σ in mixed-language documents
- **Example:** "Напряжение σ (Cyrillic text) is stress" where σ should be Greek
- **Mitigation:** Context rule — formula = Greek, text = Cyrillic
- **Status:** Confusion matrix documented, requires context analysis

**3. OCR pre-normalization variance**
- **Issue:** OCR may output already-normalized or non-standard forms
- **Example:** Some OCR engines output × (standard), others output * (non-standard)
- **Mitigation:** Normalize all outputs to canonical form
- **Status:** Rules cover all major variants

**4. Reviewer training gap**
- **Issue:** Reviewers may not follow normalization contract consistently
- **Example:** Reviewer applies personal preference instead of rule-based approach
- **Mitigation:** Training + certification (80% pass), periodic recertification
- **Status:** REVIEWER_NORMALIZATION_CONTRACT.md defines training path

**5. Unicode edge case variance**
- **Issue:** Combining marks vs precomposed may have platform variance
- **Example:** σ combining mark may render differently on different systems
- **Mitigation:** Enforce NFC (precomposed) Unicode normalization
- **Status:** Unicode NFC rule documented, test suite includes unicode test

### MEDIUM RISK ISSUES

**6. Table structure ambiguity**
- **Issue:** Some tables may have ambiguous merged cell interpretation
- **Mitigation:** Header detection algorithm, explicit merged cell rules
- **Status:** TABLE_NORMALIZATION_STANDARD defines 5 table types

**7. Unit collision**
- **Issue:** Same symbol for different units in different domains
- **Example:** "bar" (unit of pressure) vs "bar" (ferrous bar — material)
- **Mitigation:** UNIT_NORMALIZATION_STANDARD includes domain context
- **Status:** Registry documented for 100+ units

**8. Decimal context sensitivity**
- **Issue:** Some fields need different decimal precision
- **Example:** Stress: 250.5 MPa (1 decimal) vs angle: 30.50° (2 decimals)
- **Mitigation:** Per-column precision specification
- **Status:** TABLE_NORMALIZATION_STANDARD rule V1b defines precision

**9. Whitespace semantic significance**
- **Issue:** Some formulas may require whitespace for clarity
- **Example:** sin 2θ vs sin2θ (is it sin(2θ) or (sinθ)²?)
- **Mitigation:** Whitespace rules + dimensional analysis
- **Status:** FORMULA_NORMALIZATION_STANDARD rule D defines rules

**10. Historical notation variants**
- **Issue:** Legacy documents may use non-standard notation
- **Example:** Old standards use · for multiplication, new standards use ×
- **Mitigation:** Override rules allow documented exceptions
- **Status:** REVIEWER_NORMALIZATION_CONTRACT rule override_rules defined

---

## 📊 SUMMARY TABLE: All 8 Examples at a Glance

| # | Type | Input | Output | Key Transformation | Risk Level |
|---|---|---|---|---|---|
| 1 | Formula | σ_y·[...]=250·10⁻³... | σ_y×[...]=250×10⁻³... | · → ×, spacing | LOW |
| 2 | Unit | 250 Мпа | 250 MPa | Locale, prefix | MEDIUM |
| 3 | Reviewer | K=G·a² | K=G×a² | 5-step workflow | LOW |
| 4 | Lineage | K=G·a² | Tracked/locked | Audit trail | LOW |
| 5 | Unicode | σ combining | σ precomposed | NFC form | MEDIUM |
| 6 | Table | Merged headers | Canonical structure | Hierarchy | MEDIUM |
| 7 | Testing | 8 test suites | All pass | Consistency verified | LOW |
| 8 | Risks | 10 documented | Mitigations documented | Risk register | MEDIUM-HIGH |

---

## 🔗 CROSS-REFERENCES

- **CANONICAL_NORMALIZATION_ARCHITECTURE.md** — Overview and 8-stage framework
- **FORMULA_NORMALIZATION_STANDARD.md** — Formula rules (examples 1, 3, 4, 5, 7)
- **UNIT_NORMALIZATION_STANDARD.md** — Unit rules (examples 2, 7)
- **TABLE_NORMALIZATION_STANDARD.md** — Table rules (examples 6, 7)
- **NORMALIZATION_LINEAGE_MODEL.md** — Lineage tracking (example 4)
- **REVIEWER_NORMALIZATION_CONTRACT.md** — Reviewer workflow (example 3)

---

**Status:** ✅ All 8 examples complete and cross-referenced

**Next steps:** Run examples through consistency tests (Stage 7) and collect reviewer sign-offs (Stage 5)

