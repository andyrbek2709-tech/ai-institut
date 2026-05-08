# Formula Truth Validation Architecture

> **Specialized Ground Truth Validation for Mathematical & Engineering Formulas**
>
> *Formulas are the highest-risk OCR domain. This architecture ensures symbolic correctness, unit consistency, and notation normalization.*

**Version:** 1.0  
**Date:** 2026-05-10  
**Status:** 🟡 **CRITICAL SPECIALIZED VALIDATION**  
**Implements:** GROUND_TRUTH_GOVERNANCE.md — LAYER 6 (Specialized Validation)

---

## Executive Summary

Formulas are **the most dangerous OCR domain** because:

```
Single character error →
  ├─ σ (sigma) misread as Σ (capital) or 6 (digit)
  ├─ e (Euler's number) confused with l (letter L)
  ├─ μ (mu, micro) confused with u or m
  ├─ Subscript position confusion (a_i vs a i)
  ├─ Unit loss in formula result
  └─ Design calculation failure / safety issue
```

**This system ensures:**
- ✅ Symbolic equivalence validation (semantic correctness)
- ✅ Subscript/superscript position accuracy
- ✅ Unit tracking through formula
- ✅ Greek/Cyrillic/Latin character disambiguation
- ✅ Operator normalization
- ✅ Notation standardization
- ✅ Formula structure verification

---

## Core Principle

**Formula ground truth MUST be context-independent.**

Ground truth formula value is **NOT** merely visual transcription. It is:
- **Semantically correct** (symbols mean what they should in context)
- **Structurally sound** (operators, operands, precedence correct)
- **Dimensionally consistent** (units balance)
- **Notation normalized** (canonical representation)

---

## PHASE 1: Formula Recognition & Typing

### Step 1: Identify Formula Blocks

```
When reviewing document, identify formula:
  ├─ Single-line: σ = F/A
  ├─ Multi-line: 
  │    x = (-b ± sqrt(b² - 4ac)) / 2a
  │        (quadratic formula)
  ├─ Inline: within text "...using formula K = G/π..."
  └─ Standalone: centered, formal equation numbering
```

### Step 2: Classify Formula Type

```
TYPE A: Material Property Formula
  Example: σ_max = (M * y) / I
  Components:
    - Symbols: σ_max (stress), M (moment), y (distance), I (moment of inertia)
    - Units result: MPa or Pa
    - Context: mechanical design, strength of materials

TYPE B: Calculation Formula
  Example: P = V * I * cos(φ)
  Components:
    - Symbols: P (power), V (voltage), I (current), cos (function), φ (phase)
    - Units result: Watts (W)
    - Context: electrical engineering

TYPE C: Transcendental Formula
  Example: f(x) = e^(-x²/2σ²) / (σ * sqrt(2π))
  Components:
    - Functions: e (Euler), sqrt (square root), π (pi)
    - Subscripts/superscripts: ^(-x²/2σ²), σ²
    - Units: probability density (no units)

TYPE D: Empirical/Curve-Fit Formula
  Example: y = a * x^n + b
  Constants: a, b, n (from experimental data)
  Context: often involves unit consistency challenges

TYPE E: Standard Reference Formula
  Example: σ_eq = sqrt(σ_x² + σ_y² - σ_x*σ_y) (von Mises)
  Reference: standard (ISO, GOST, ASME)
  Validation: cross-reference published formula
```

---

## PHASE 2: Character & Symbol Validation

### Critical Character Confusion Matrix

```
┌─────────────┬──────────────┬──────────────┬─────────────────┐
│ CORRECT     │ CONFUSION    │ CONTEXT      │ DETECTION       │
├─────────────┼──────────────┼──────────────┼─────────────────┤
│ σ (sigma)   │ Σ (capital)  │ Variable     │ Formula should  │
│             │ 6 (digit)    │ vs operator  │ be lowercase    │
│             │ ς (variant)  │ vs constant  │ unless specified│
├─────────────┼──────────────┼──────────────┼─────────────────┤
│ τ (tau)     │ T (Latin)    │ Variable     │ Check context   │
│             │ τ itself     │ naming       │ (stress/time?)  │
├─────────────┼──────────────┼──────────────┼─────────────────┤
│ μ (mu)      │ u (letter)   │ Variable     │ Micro-prefix    │
│             │ m (letter)   │ micro-unit   │ vs variable     │
│             │ µ (U+00B5)   │ Unicode      │ Normalize       │
├─────────────┼──────────────┼──────────────┼─────────────────┤
│ ν (nu)      │ v (Latin V)  │ Variable     │ Greek letter    │
│             │ υ (upsilon)  │ Poisson's    │ Poisson = ν     │
├─────────────┼──────────────┼──────────────┼─────────────────┤
│ ρ (rho)     │ p (Latin)    │ Variable     │ Density = ρ     │
│             │ ρ (Unicode)  │ Greek        │ Corrosion = p   │
├─────────────┼──────────────┼──────────────┼─────────────────┤
│ π (pi)      │ Π (capital)  │ Constant     │ Lowercase π     │
│             │ n (letter)   │ 3.14159...   │ means constant  │
├─────────────┼──────────────┼──────────────┼─────────────────┤
│ e (Euler)   │ l (letter)   │ Constant     │ Context: e^x?   │
│ 2.71828...  │ I (capital)  │ exponential  │ or natural log? │
│             │ 1 (digit)    │ function     │                 │
├─────────────┼──────────────┼──────────────┼─────────────────┤
│ φ (phi)     │ ø (diameter) │ Variable     │ Angle/phase     │
│ angle/phase │ Φ (capital)  │ Flux         │ vs diameter     │
├─────────────┼──────────────┼──────────────┼─────────────────┤
│ ω (omega)   │ w (letter)   │ Variable     │ Angular freq    │
│ angular     │ Ω (capital)  │ Resistance   │ vs ohm (unit)   │
├─────────────┼──────────────┼──────────────┼─────────────────┤
│ λ (lambda)  │ Λ (capital)  │ Variable     │ Wavelength      │
│ wavelength  │ λ (Unicode)  │ Eigenvalue   │ Lambda function │
├─────────────┼──────────────┼──────────────┼─────────────────┤
│ Δ (delta)   │ △ (triangle) │ Operator     │ Change in       │
│ change      │ D (letter)   │ Difference   │ Partial diff    │
│             │ δ (lower)    │              │ vs delta        │
└─────────────┴──────────────┴──────────────┴─────────────────┘
```

### Validation Protocol

```
STEP 1: Extract Every Symbol
  └─ For each character in formula: [char, position, context]
     Example: σ = F/A
     ├─ σ [position 0, LHS, variable]
     ├─ = [position 1, operator]
     ├─ F [position 2, RHS, variable]
     ├─ / [position 3, operator]
     └─ A [position 4, RHS, variable]

STEP 2: Validate Each Symbol
  For each symbol:
    ├─ CASE 1: Greek letter (σ, τ, μ, ν, ρ, π, φ, ω, λ, Δ, δ, Ω, Φ, Π, Σ)
    │   ├─ Verify: correct Greek letter (not Latin, not digit, not special char)
    │   ├─ Verify: case correct (uppercase vs lowercase per context)
    │   ├─ Verify: Unicode correct (not variant forms)
    │   └─ Verify: meaning in context (density ρ, not rho variant)
    │
    ├─ CASE 2: Latin variable (a-z, A-Z except confusion set)
    │   ├─ Verify: consistent naming (E for Young's modulus, not l)
    │   ├─ Verify: case preservation (K vs k = different variables)
    │   └─ Verify: not confused with numbers (0 vs O, 1 vs I vs l)
    │
    ├─ CASE 3: Constant (e, π, ∞)
    │   ├─ Verify: correct constant symbol
    │   ├─ Verify: not confused with variable
    │   └─ Verify: value is known (e ≈ 2.71828, π ≈ 3.14159)
    │
    ├─ CASE 4: Cyrillic (иногда в формулах)
    │   ├─ Verify: character set (Cyrillic vs Latin lookalikes: е/e, с/c, о/o)
    │   └─ Verify: context (Russian standards use Cyrillic subscripts)
    │
    └─ CASE 5: Operator (+, -, ×, ÷, =, ≈, ≤, ≥, ≠, ∑, ∏, ∫, √)
        ├─ Verify: operator semantics (× vs *, - vs −)
        ├─ Verify: precedence correct (implied multiplication vs explicit)
        └─ Verify: not confused with similar symbols

STEP 3: Validate Subscripts & Superscripts
  ├─ SUBSCRIPT validation:
  │   Example: σ_max, x_i, a_{ij}
  │   ├─ Verify: subscript is at correct depth
  │   ├─ Verify: subscript character correct (e.g., "i" not "l")
  │   ├─ Verify: subscript is readable (not too small/obscured)
  │   └─ Verify: multi-subscript order (if a_{ij}, is i,j correct order?)
  │
  └─ SUPERSCRIPT validation:
      Example: x^2, e^(-x), a^{(n)}
      ├─ Verify: superscript at correct height
      ├─ Verify: exponent correct (2 vs z, -1 vs l)
      ├─ Verify: parentheses in superscript (e^(-x) vs e^-x)
      └─ Verify: multi-level nesting depth

STEP 4: Verify Units in Formula
  Example: σ = F/A
  Result units: [Force]/[Area] = N/m² = Pa ✓
  
  Process:
    ├─ Identify all units in formula components
    ├─ Calculate result units (dimension analysis)
    ├─ Verify result matches expected (stress should give Pa/MPa, not kg)
    └─ If units wrong → symbol misidentified (likely error)
```

---

## PHASE 3: Semantic Validation

### Verification Steps

```
STEP 1: Known Formula Reference Check
  IF formula is standard (e.g., von Mises, Hooke's law):
    ├─ Look up published formula in standards (ISO, GOST, ASME)
    ├─ Compare OCR-extracted version with published
    ├─ Verify: all symbols, operators, units match published
    └─ Confidence boost: VERIFIED (if matches exactly)

STEP 2: Dimensional Analysis
  Example: σ = F/A
    ├─ F has dimensions [Force] = kg·m/s² (Newton)
    ├─ A has dimensions [Area] = m²
    ├─ Result: [Force]/[Area] = kg/m·s² = Pa ✓
    │
    └─ IF units don't balance:
        ├─ Symbol likely misidentified (wrong Greek letter?)
        ├─ Operator likely wrong (+ vs ×?)
        ├─ Escalate to arbitration

STEP 3: Physical/Engineering Reasonableness
  Example: Maximum stress σ_max = 450 MPa
    ├─ Check: is this value reasonable for material type?
    │   ├─ If material is aluminum: 450 MPa is reasonable (yield ~200-300)
    │   ├─ If material is paper: 450 MPa is UNREASONABLE (must be 4.5 MPa)
    │   └─ Verify unit not lost in OCR
    │
    └─ IF unreasonable:
        ├─ Unit likely missing (450 kPa, not MPa?)
        ├─ Decimal misplaced (45.0, not 450?)
        ├─ Escalate for human review

STEP 4: Multi-Line Formula Continuity
  Example: Quadratic formula across 2 lines:
    Line 1: x = (-b ± sqrt(b² - 4ac)) /
    Line 2:     2a
    
  Validation:
    ├─ Verify: line 1 ends with incomplete operator (/ division)
    ├─ Verify: line 2 continues operand (2a)
    ├─ Verify: logical grouping is preserved
    ├─ Verify: parentheses balance across lines
    └─ Verify: no spurious line breaks in middle of variable names

STEP 5: Notation Normalization
  Example: Handwritten formulas might use:
    ├─ × vs * vs · for multiplication
    ├─ ÷ vs / for division
    ├─ − vs - for minus (different Unicode)
    ├─ √ vs sqrt() for square root
    └─ E+5 vs 1e5 for scientific notation
    
  Process:
    ├─ Identify all notation variants
    ├─ Normalize to canonical form:
    │   ├─ Multiplication: always use × or ·
    │   ├─ Division: always use /
    │   ├─ Minus: always use − (U+2212, not hyphen)
    │   ├─ Square root: always use √ (not sqrt())
    │   ├─ Scientific: always use e notation (1e5, not E+5)
    │   └─ Document all normalizations in lineage
    │
    └─ Confidence impact: REVIEWED (if notation normalized, not VERIFIED)
```

---

## PHASE 4: Multi-Reviewer Formula Validation

### Reviewer Checklist

```
FORMULA VALIDATION CHECKLIST
═════════════════════════════════════════════════════════════════

[ ] 1. SYMBOL INTEGRITY
    [ ] All Greek letters identified correctly (σ not Σ, not 6)
    [ ] All Latin variables consistent (E not l, not 1)
    [ ] All constants recognized (π, e, ∞)
    [ ] No Cyrillic/Latin confusion
    [ ] Unicode normalization verified

[ ] 2. SUBSCRIPT/SUPERSCRIPT
    [ ] All subscripts present and readable
    [ ] All superscripts present and readable
    [ ] No subscript/superscript confusion (a_i not a i)
    [ ] Multi-level nesting depth correct
    [ ] Character in subscript is correct (i not l, n not m)

[ ] 3. OPERATORS
    [ ] All operators present (+ - × ÷ = ≈ ≤ ≥ ≠)
    [ ] Operator precedence correct (× before +)
    [ ] No operator transposition (+ vs ×)
    [ ] Parentheses balanced
    [ ] Implicit multiplication correct (ab means a*b, not separate)

[ ] 4. UNITS & DIMENSIONS
    [ ] Units identified in all terms
    [ ] Dimensional analysis balances
    [ ] Result units make sense for formula type
    [ ] Unit prefixes correct (μm, nm, mm, not confused)
    [ ] Unit notation normalized

[ ] 5. SEMANTIC CORRECTNESS
    [ ] Formula matches published standard (if exists)
    [ ] Physical/engineering reasonableness verified
    [ ] No obvious calculation errors detectable
    [ ] Context-appropriate (stress formula, not temperature formula)

[ ] 6. MULTI-LINE CONTINUITY (if applicable)
    [ ] Line breaks between lines semantically correct
    [ ] Parentheses balanced across lines
    [ ] No line breaks in middle of variable names
    [ ] Indentation/alignment preserved if meaningful

[ ] 7. NOTATION NORMALIZATION
    [ ] Consistent notation (× vs * resolved)
    [ ] Unicode normalized (− vs - resolved)
    [ ] Scientific notation standardized
    [ ] All normalizations documented

[ ] 8. ALTERNATIVES EXCLUDED
    [ ] No ambiguous interpretations remain
    [ ] If multiple interpretations exist → escalate
    [ ] Source image clear and unambiguous
    [ ] Confidence level can be assigned
```

---

## PHASE 5: Disagreement Resolution for Formulas

### Common Formula Disagreements

```
DISAGREEMENT TYPE 1: Symbol Confusion
═════════════════════════════════════════════════════════════
Reviewer-A: σ (lowercase sigma) — stress variable
Reviewer-B: Σ (uppercase sigma) — summation operator

Resolution:
  ├─ Context: "stress σ_max" → lowercase sigma (variable)
  ├─ Arbitration: uppercase Σ would be summation (semantically wrong)
  └─ Final: σ (VERIFIED) — context determines lowercase

DISAGREEMENT TYPE 2: Subscript Depth
═════════════════════════════════════════════════════════════
Reviewer-A: a_{ij} (double subscript, formatted)
Reviewer-B: a_ij (two separate subscripts?)

Resolution:
  ├─ Check source image: formatted subscript depth
  ├─ Physics context: matrix notation uses a_{ij}
  ├─ Arbitration: verify subscript grouping from image
  └─ Final: a_{ij} if image shows grouped, else escalate

DISAGREEMENT TYPE 3: Operator Interpretation
═════════════════════════════════════════════════════════════
Reviewer-A: σ = F/A (division)
Reviewer-B: σ = F:A (ratio notation — European style)

Resolution:
  ├─ Both are mathematically equivalent
  ├─ Normalize to canonical: F/A (forward slash)
  ├─ Document variation: "European notation σ = F:A normalized to F/A"
  └─ Final: REVIEWED (normalized, notation variation acceptable)

DISAGREEMENT TYPE 4: Unit Presence
═════════════════════════════════════════════════════════════
Reviewer-A: K = G·a²/(π·t³)  [result: Pa, no unit in formula]
Reviewer-B: K = G·a²/(π·t³) Pa  [unit appended]

Resolution:
  ├─ Check source image: is Pa written after formula?
  ├─ Context: standard engineering practice (Pa usually external)
  ├─ If unit is part of formula text: include
  ├─ If unit is in separate line: exclude from formula
  └─ Final: depends on image interpretation

DISAGREEMENT TYPE 5: Constant Value Precision
═════════════════════════════════════════════════════════════
Reviewer-A: π (symbolic, no decimal)
Reviewer-B: 3.14159 (numerical approximation shown)

Resolution:
  ├─ Check source: does source show 3.14159 or just π?
  ├─ If shown numerically → include precision (3.14159)
  ├─ If shown symbolically → preserve as π
  └─ Final: match source representation (VERIFIED if clear)
```

---

## PHASE 6: Formula Truth Confidence Assignment

### Decision Matrix

```
FORMULA CONFIDENCE ASSIGNMENT
═══════════════════════════════════════════════════════════════

VERIFIED: ALL of following true:
  ✅ All symbols confirmed by ≥2 reviewers
  ✅ Subscripts/superscripts accurate
  ✅ Operators all correct
  ✅ Units balanced (dimensional analysis pass)
  ✅ Matches published standard (if available)
  ✅ No ambiguities remain
  ✅ Physical reasonableness confirmed
  
  Example: σ = F/A [from mechanical engineering standard]
  Status: PRODUCTION-READY

REVIEWED: ALL of following true:
  ✅ Single expert review completed
  ✅ Most symbols confirmed
  ✅ Minor ambiguity resolved
  ✅ Units balanced
  ✅ Not a known standard formula (so less boost)
  ⚠️ Some notation variance documented
  
  Example: K = 1.2·σ_y·r/t [empirical, minor notation variation]
  Status: USABLE, minor risk

PROBABLE: ANY of following true:
  ⚠️ Single review, reasonable interpretation
  ⚠️ Minor ambiguity in subscript/superscript
  ⚠️ Units balance but not obvious
  ⚠️ Alternative interpretation exists but documented
  
  Example: Coefficient c = 0.85 [could be 0.80 from image, but 0.85 preferred]
  Status: REQUIRES escalation for critical use

AMBIGUOUS: ANY of following true:
  ❌ Reviewers disagree on value (σ vs τ? 0.85 vs 4.85?)
  ❌ Units don't balance
  ❌ Multiple reasonable interpretations
  ❌ Source image unclear
  
  Example: σ_? = F/A [symbol unclear from scan, could be σ, τ, or 6]
  Status: BLOCKED — requires image rescanning or source lookup
```

---

## PHASE 7: Audit & Lineage

### Formula Ground Truth Record

```
Formula Ground Truth Entry:
═══════════════════════════════════════════════════════════════

BLOCK ID: pdf_doc_001_page_3_formula_2
SOURCE: IEC-60038-v2_Scanned_Standard.pdf
FORMULA VALUE: K = (G × a²) / (π × t³)

COMPONENT VALIDATION:
  ├─ K: symbol=letter, meaning=constant, confidence=VERIFIED
  ├─ G: symbol=letter, meaning=shear_modulus, confidence=VERIFIED
  ├─ a: symbol=letter, meaning=dimension, confidence=VERIFIED
  ├─ t: symbol=letter, meaning=thickness, confidence=VERIFIED
  ├─ π: symbol=pi, meaning=constant_3.14159, confidence=VERIFIED
  ├─ Superscripts: [^2, ^3], position_correct, confidence=VERIFIED
  └─ Operators: [×, ×, /], precedence_correct, confidence=VERIFIED

UNITS ANALYSIS:
  ├─ G dimensions: [Pressure] = Pa = N/m²
  ├─ a² dimensions: [Length²] = m²
  ├─ t³ dimensions: [Length³] = m³
  ├─ Result: (Pa × m²) / m³ = Pa/m = N/m³ ← UNITS CHECK
  │  ✓ Result units = pressure/length (stiffness per length)
  └─ Unit balance: CORRECT

MULTI-REVIEWER VALIDATION:
  ├─ Reviewer-A (Engineer-1): "K = G×a²/(π×t³)" @ 2026-05-10 10:15
  │   ├─ Confidence: 0.95
  │   └─ Notes: "Standard formula, all symbols clear"
  │
  ├─ Reviewer-B (Engineer-2): "K = (G·a²)/(π·t³)" @ 2026-05-10 11:30
  │   ├─ Confidence: 0.92
  │   └─ Notes: "Notation variant (· vs ×), semantically identical"
  │
  └─ Reviewer-C (Materials-Specialist): K formula verified @ 2026-05-10 13:45
      ├─ Consensus: VERIFIED (3 independent reviewers agree)
      └─ Confidence: VERIFIED

FINAL GROUND TRUTH:
  ├─ Value: K = (G × a²) / (π × t³)
  ├─ Confidence Level: VERIFIED
  ├─ Normalized Notation: [× for multiplication, / for division, − for minus]
  ├─ Unit Result: stiffness per length (Pa/m or N/m³)
  └─ Audit Status: LOCKED (immutable until correction required)

LINEAGE CHAIN:
  1. Source: IEC-60038-v2 Standard PDF
  2. Manual extraction: timestamp 2026-05-10 10:00
  3. Specialist review: mechanical engineering formula → pass
  4. Reviewer-A validation: 2026-05-10 10:15 (confidence 0.95)
  5. Reviewer-B validation: 2026-05-10 11:30 (agreement signal)
  6. Reviewer-C specialist: 2026-05-10 13:45 (consensus verified)
  7. Truth locked: confidence=VERIFIED
  8. Ready for pilot use ✓
```

---

## Summary

**Formula ground truth validation ensures:**
- ✅ Symbolic correctness (σ not Σ, not 6)
- ✅ Subscript/superscript accuracy
- ✅ Operator correctness
- ✅ Dimensional consistency
- ✅ Unit balance
- ✅ Notation normalization
- ✅ Semantic validation (context-appropriate)
- ✅ Multi-reviewer consensus
- ✅ Complete lineage tracking
- ✅ Confidence assignment (VERIFIED/REVIEWED/PROBABLE/AMBIGUOUS)

**Critical:** Formula is **NOT** OCR-extracted candidate. It is **validated truth** ready for pilot calibration.

**Next:** TABLE_TRUTH_VALIDATION.md for specialized table validation.
