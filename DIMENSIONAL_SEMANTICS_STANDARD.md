# DIMENSIONAL SEMANTICS STANDARD
## Размерно-осведомлённая семантическая эквивалентность

**Статус:** 🟦 SEMANTIC ARCHITECTURE — PHASE 2  
**Дата:** 2026-05-09  
**Версия:** 1.0  
**Контекст:** SEMANTIC_EQUIVALENCE_ARCHITECTURE.md → STAGE 2

---

## 🎯 НАЗНАЧЕНИЕ

Обеспечить **размерно-осведомлённую классификацию** инженерных формул, которая:
- Автоматически проверяет размерную согласованность
- Идентифицирует "скрытые" эквивалентности (same dimension, different domain)
- Обнаруживает размерные ошибки ДО человеческого анализа
- Поддерживает эквивалентность независимо от выбора единиц

**Принцип:** Размерная согласованность — необходимое (но не достаточное) условие семантической эквивалентности.

---

## 1️⃣ DIMENSIONAL ANALYSIS FRAMEWORK

### 1.1 DIMENSIONAL SIGNATURES

Каждая инженерная величина имеет размерную подпись:

```
DIMENSION := {
  mass: ℤ                    // exponent for M
  length: ℤ                  // exponent for L
  time: ℤ                    // exponent for T
  temperature: ℤ             // exponent for Θ (Kelvin)
  current: ℤ                 // exponent for I (Ampere)
  substance: ℤ               // exponent for N (mole)
  luminosity: ℤ              // exponent for J (candela)
}

Notation: [M^a L^b T^c Θ^d I^e N^f J^g]
```

### 1.2 COMMON ENGINEERING DIMENSIONS

```
FORCE:                    [M¹ L¹ T⁻²]           (Newton: kg⋅m⋅s⁻²)
MASS:                     [M¹]                  (kg)
LENGTH:                   [L¹]                  (m)
TIME:                     [T¹]                  (s)
AREA:                     [L²]                  (m²)
VOLUME:                   [L³]                  (m³)
DENSITY:                  [M¹ L⁻³]              (kg/m³)
VELOCITY:                 [L¹ T⁻¹]              (m/s)
ACCELERATION:             [L¹ T⁻²]              (m/s²)
PRESSURE (= STRESS):      [M¹ L⁻¹ T⁻²]          (Pa = N/m²)
ENERGY:                   [M¹ L² T⁻²]           (Joule: kg⋅m²/s²)
POWER:                    [M¹ L² T⁻³]           (Watt: kg⋅m²/s³)
TEMPERATURE:              [Θ¹]                  (Kelvin)
THERMAL_CONDUCTIVITY:     [M¹ L¹ T⁻³ Θ⁻¹]      (W/(m⋅K))
MODULUS_OF_ELASTICITY:    [M¹ L⁻¹ T⁻²]          (Pa)
MOMENT_OF_INERTIA:        [M¹ L²]               (kg⋅m²)
ANGULAR_VELOCITY:         [T⁻¹]                 (rad/s)
TORQUE:                   [M¹ L² T⁻²]           (N⋅m)
FREQUENCY:                [T⁻¹]                 (Hz)
VISCOSITY:                [M¹ L⁻¹ T⁻¹]          (Pa⋅s)
SURFACE_TENSION:          [M¹ T⁻²]              (N/m)
HEAT_CAPACITY:            [M¹ L² T⁻² Θ⁻¹]      (J/K)
ELECTRICAL_RESISTANCE:    [M¹ L² T⁻³ I⁻²]      (Ω)
```

### 1.3 DIMENSIONAL ARITHMETIC

```
RULE DIM-1: Multiplication
  [A] × [B] = [A + B]  (exponents add)
  Example: [L¹] × [L¹] = [L²]  (length × length = area)

RULE DIM-2: Division
  [A] / [B] = [A - B]  (exponents subtract)
  Example: [M¹ L² T⁻²] / [L²] = [M¹ T⁻²]  (energy / area = pressure)

RULE DIM-3: Exponentiation
  [A]^n = [A × n]  (exponents multiply)
  Example: [L¹]² = [L²]  (length squared = area)

RULE DIM-4: Root
  [A]^(1/n) = [A / n]
  Example: [L²]^(1/2) = [L¹]  (square root of area = length)

RULE DIM-5: Dimensionless
  [A] / [A] = [ ]  (dimensionless)
  Example: strain = ε = ΔL / L = [L¹] / [L¹] = [ ]

RULE DIM-6: Addition/Subtraction
  Only allowed between quantities with SAME dimension
  [A] + [B] is valid ONLY if [A] = [B]
  Example: Force + Force = Force ✓
  Example: Force + Length = ERROR ❌
```

---

## 2️⃣ DIMENSIONAL CONSISTENCY CHECKING

### 2.1 DEFINITION

A formula is **dimensionally consistent** if:

```
Every operation respects dimensional arithmetic rules
AND all operands have compatible dimensions for the operation
AND final result has expected dimension
```

### 2.2 ALGORITHM

```
function check_dimensional_consistency(
  formula: ALGEBRAIC_TREE,
  expected_dimension: DIMENSION
): {valid: boolean, errors: DIMENSIONAL_ERROR[]}

algorithm:
  // Step 1: Assign dimensions to leaf nodes (variables, constants)
  for each variable in formula:
    dim[variable] = lookup_dimension(variable)
  
  for each constant in formula:
    if constant is pure number:
      dim[constant] = [ ]  (dimensionless)
    else:
      dim[constant] = lookup_constant_dimension(constant)
  
  // Step 2: Propagate dimensions through operations
  function propagate(node):
    if node is leaf:
      return dim[node]
    
    if node is operation(op, operands):
      switch op:
        case "+", "-":
          // Check all operands have same dimension
          dims = [propagate(op) for op in operands]
          if not all_equal(dims):
            ERROR: "Incompatible dimensions for" op
          return dims[0]
        
        case "*":
          dims = [propagate(op) for op in operands]
          return sum(dims)  // exponents add
        
        case "/":
          if len(operands) != 2:
            ERROR
          dim_num = propagate(operands[0])
          dim_denom = propagate(operands[1])
          return dim_num - dim_denom  // exponents subtract
        
        case "^":
          dim_base = propagate(operands[0])
          exponent = operands[1]  // must be dimensionless
          if dim(exponent) != [ ]:
            ERROR: "Exponent must be dimensionless"
          return dim_base * exponent
        
        case "^(1/n)":
          dim_base = propagate(operands[0])
          return dim_base / n
  
  // Step 3: Check result dimension
  result_dim = propagate(root)
  
  if result_dim != expected_dimension:
    ERROR: "Result dimension mismatch"
    expected: expected_dimension
    got: result_dim
  
  return {valid: true}
```

### 2.3 EXAMPLE: PRESSURE FORMULA

```
Formula: P = F / A
Expected result: [M¹ L⁻¹ T⁻²]  (pressure dimension)

Step 1: Assign dimensions
  F → FORCE → [M¹ L¹ T⁻²]
  A → AREA → [L²]

Step 2: Propagate
  operation "/" with:
    numerator F → [M¹ L¹ T⁻²]
    denominator A → [L²]
  result: [M¹ L¹ T⁻²] - [L²] = [M¹ L⁻¹ T⁻²]

Step 3: Check result
  Result [M¹ L⁻¹ T⁻²] == Expected [M¹ L⁻¹ T⁻²] ✓
  
Conclusion: ✅ Dimensionally consistent
```

### 2.4 EXAMPLE: ERROR DETECTION

```
Formula: σ = F / L  (WRONG — dividing by length instead of area)
Expected result: [M¹ L⁻¹ T⁻²]  (pressure/stress dimension)

Step 1: Assign dimensions
  F → [M¹ L¹ T⁻²]
  L → [L¹]

Step 2: Propagate
  operation "/" with:
    numerator F → [M¹ L¹ T⁻²]
    denominator L → [L¹]
  result: [M¹ L¹ T⁻²] - [L¹] = [M¹ T⁻²]

Step 3: Check result
  Result [M¹ T⁻²] ≠ Expected [M¹ L⁻¹ T⁻²] ❌
  
Conclusion: ❌ Dimensionally INCONSISTENT
Error: "Result dimension [M¹ T⁻²] is invalid for stress/pressure. 
        Expected [M¹ L⁻¹ T⁻²]. Check: are you dividing by area or length?"
```

---

## 3️⃣ THE STRESS-PRESSURE PARADOX

### 3.1 THE PROBLEM

```
STRESS (σ):      [M¹ L⁻¹ T⁻²]
PRESSURE (P):    [M¹ L⁻¹ T⁻²]

Formula: σ = F / A
Formula: P = F / A

Same dimension!
Same formula!
Different meaning!
```

### 3.2 DIMENSIONAL EQUIVALENCE vs SEMANTIC EQUIVALENCE

```
DIMENSIONAL EQUIVALENCE:
  [σ] = [P] = [M¹ L⁻¹ T⁻²]
  σ = F / A
  P = F / A
  → dimensionally equivalent ✅

SEMANTIC EQUIVALENCE:
  σ: stress in solids, deformation under force
  P: pressure in fluids, normal force on surface
  → NOT semantically equivalent ❌ (different physics)

CONCLUSION:
  Same dimensions & formulas ≠ semantic equivalence
  Dimensional equivalence is necessary but NOT sufficient
```

### 3.3 DOMAIN-DEPENDENT INTERPRETATION

```
When you see: X = F / A

In STRUCTURAL context:
  X = STRESS (σ)
  Domain assumptions: solids, uniaxial, linear elasticity
  Units: Pa, MPa, psi
  Failure criterion: yield strength

In FLUID context:
  X = PRESSURE (P)
  Domain assumptions: fluids, normal force, hydrostatic
  Units: Pa, bar, atm, psi
  Failure criterion: pressure relief valve setting

SAME FORMULA, DIFFERENT SEMANTICS
```

### 3.4 ENGINEERING QUANTITY CATEGORIES BY DIMENSION

```
Category: FORCE_PER_AREA  [M¹ L⁻¹ T⁻²]
  Members:
    - STRESS (solids)
    - PRESSURE (fluids)
    - NORMAL_STRESS (mechanics)
    - SHEAR_STRESS (mechanics)
    - SURFACE_PRESSURE (contact)
  
  Common confusion: Treating as identical when contexts differ
  Safety risk: Using fluid pressure formula in structural design

---

Category: ENERGY_PER_VOLUME  [M¹ L⁻¹ T⁻²]
  Members:
    - PRESSURE (same as above!)
    - ENERGY_DENSITY
    - STRAIN_ENERGY_DENSITY
  
  Common confusion: Energy density ≠ pressure in design
  Safety risk: Mixing energy and force calculations

---

Category: VISCOSITY  [M¹ L⁻¹ T⁻¹]
  Members:
    - DYNAMIC_VISCOSITY (Pa⋅s)
    - KINEMATIC_VISCOSITY (m²/s)  ← Different dimension!
  
  Common confusion: Confusing dynamic with kinematic
  Safety risk: Pressure drop calculations fail
```

---

## 4️⃣ UNIT-INVARIANT EQUIVALENCE

### 4.1 PRINCIPLE

```
Two formulas with equivalent semantics should:
  ✅ Remain equivalent regardless of unit choice
  ✅ Transform consistently between unit systems
  ✅ Preserve dimensional relationships
```

### 4.2 UNIT TRANSFORMATION

```
Given: σ = 250 MPa (in SI units)

Transform to alternative units:
  σ = 250 MPa = 250 N/mm² = 250 × 10⁶ Pa = 2.5 × 10⁸ Pa
  σ = 250 / 145.038 psi ≈ 1.72 psi
  σ = 250 × 0.102 kgf/mm² ≈ 25.5 kgf/mm²

Key point: Semantic equivalence should HOLD across all unit systems
  σ = 250 MPa (SI)
  σ = 1.72 psi (imperial)
  σ = 25.5 kgf/mm² (mixed)
  
All represent SAME physical reality → semantically equivalent
```

### 4.3 UNIT SYSTEM CATEGORIES

```
SI (International System):
  Base: m, kg, s, K, A, mol, cd
  Pressure: Pa = N/m² = kg/(m⋅s²)
  
CGS (Centimeter-Gram-Second):
  Base: cm, g, s, K
  Pressure: dyne/cm² = g/(cm⋅s²)
  Conversion: 1 Pa = 10 dyne/cm²

Imperial (English/USC):
  Base: ft, lb, s, °R
  Pressure: psi = lbf/in²
  Conversion: 1 psi = 6.89476 kPa

Engineering (Mixed):
  Pressure: kgf/mm² (common in Europe)
  Conversion: 1 kgf/mm² = 9.80665 MPa

Metric (technical):
  Pressure: bar = 10⁵ Pa = 0.98692 atm
  
Absolute vs Gauge:
  P_absolute = P_gauge + P_atmospheric
  Conversion depends on reference pressure
```

### 4.4 DIMENSIONAL PROOF

```
How to prove two formulas are dimensionally equivalent:

Example: Are these equivalent?
  σ₁ = F / A       (stress = force / area)
  σ₂ = P           (pressure = already defined as force/area)

Proof via dimensional analysis:
  [σ₁] = [F] / [A] = [M¹ L¹ T⁻²] / [L²] = [M¹ L⁻¹ T⁻²]
  [σ₂] = [P] = [M¹ L⁻¹ T⁻²]
  [σ₁] = [σ₂] ✓
  
Conclusion: Dimensionally equivalent
But: NOT necessarily semantically equivalent (depends on domain)

---

Example: Are these equivalent?
  v = √(E / ρ)   (wave velocity)
  σ = E × ε      (stress-strain)

Proof:
  [v] = √([E] / [ρ])
      = √([M¹ L⁻¹ T⁻²] / [M¹ L⁻³])
      = √([L²] / [T²])
      = √[L² T⁻²]
      = [L¹ T⁻¹]  ✓ (velocity dimension)
  
  [σ] = [E] × [ε]
      = [M¹ L⁻¹ T⁻²] × [ ]  (strain is dimensionless)
      = [M¹ L⁻¹ T⁻²]  ✓ (pressure/stress dimension)
  
Conclusion: Dimensionally consistent but DIFFERENT dimensions
  [v] = [L¹ T⁻¹]
  [σ] = [M¹ L⁻¹ T⁻²]
→ NOT dimensionally equivalent
```

---

## 5️⃣ DIMENSIONAL CONFLICT DETECTION

### 5.1 TYPES OF CONFLICTS

```
CONFLICT TYPE 1: ADDITIVE DIMENSION MISMATCH
  Formula: σ = F / A + L
  Issue: Can't add [Force/Area] + [Length]
  Dimensions: [M¹ L⁻¹ T⁻²] + [L¹] ❌
  Severity: CRITICAL (formula is wrong)

CONFLICT TYPE 2: EXPONENT DIMENSION ERROR
  Formula: σ² = F / A
  Issue: Square of pressure doesn't make physical sense
  Check: [M¹ L⁻¹ T⁻²]² = [M² L⁻² T⁻⁴] (no engineering quantity has this)
  Severity: HIGH (likely OCR/transcription error)

CONFLICT TYPE 3: MISSING FACTOR
  Formula: v = √E / ρ  (missing parentheses)
  OCR might parse as: v = (√E) / ρ
  Check: [L¹ T⁻¹] ≠ √[M¹ L⁻¹ T⁻²] / [M¹ L⁻³] = [T⁻¹]
  Should be: v = √(E / ρ)
  Severity: CRITICAL (changes physics)

CONFLICT TYPE 4: DOMAIN-SPECIFIC ASSUMPTION VIOLATION
  Formula: P = ρ × g × h  (hydrostatic pressure)
  Domain: Fluid mechanics (h = fluid depth)
  If used in: Solid mechanics for h = height above datum
  Issue: Formula assumes vertical fluid column, not structural height
  Severity: MEDIUM (formula is correct, context is wrong)

CONFLICT TYPE 5: UNIT SYSTEM MISMATCH
  Formula: v = √(2 × g × h)  (in SI units)
  Common error: Using with g = 32.174 (imperial) and h in meters
  Check: √([L¹ T⁻²] × [L¹]) = √[L² T⁻²] = [L¹ T⁻¹] ✓
  Issue: Mixed unit system (g in ft/s², h in m)
  Severity: HIGH (produces wrong magnitude)
```

### 5.2 CONFLICT DETECTION ALGORITHM

```
function detect_dimensional_conflicts(
  formula: SEMANTIC_FORMULA,
  domain: string
): DIMENSIONAL_CONFLICT[]

algorithm:
  conflicts = []
  
  // Check 1: Dimension consistency
  if not check_dimensional_consistency(formula):
    conflicts.add({
      type: "DIMENSIONAL_INCONSISTENCY",
      severity: "CRITICAL",
      location: formula,
      description: "Formula violates dimensional arithmetic"
    })
  
  // Check 2: Physics plausibility
  expected_dimension = lookup_expected_dimension(formula.predicate, domain)
  actual_dimension = calculate_dimension(formula)
  
  if not is_dimensionally_reasonable(actual_dimension, expected_dimension):
    conflicts.add({
      type: "DIMENSION_MISMATCH",
      severity: "HIGH",
      expected: expected_dimension,
      actual: actual_dimension
    })
  
  // Check 3: Formula variant detection
  if formula matches known_incorrect_variant(domain):
    conflicts.add({
      type: "KNOWN_ERROR_PATTERN",
      severity: "MEDIUM",
      pattern_name: known_variant.name,
      correction: known_variant.correct_form
    })
  
  // Check 4: Domain assumptions
  for each assumption in formula.context.assumptions:
    if assumption is violated_in(domain):
      conflicts.add({
        type: "ASSUMPTION_VIOLATION",
        severity: "MEDIUM",
        assumption: assumption,
        domain_context: domain
      })
  
  return conflicts
```

### 5.3 EXAMPLE: CONFLICT IN STRESS FORMULA

```
Input formula: σ = F / L²  (instead of F / A)

Detection:
  1. Dimension check:
     [σ] = [F] / [L²]
         = [M¹ L¹ T⁻²] / [L²]
         = [M¹ L⁻¹ T⁻²] ✓ (correct dimension!)
  
  2. Physics plausibility:
     Expected for STRESS: [M¹ L⁻¹ T⁻²] ✓
     Actual: [M¹ L⁻¹ T⁻²] ✓
     (Both match, so this check passes)
  
  3. Known error pattern:
     Pattern: σ = F / L²
     Correct: σ = F / A (where A = L²)
     Severity: HIGH (using length instead of area)
     
  4. Context check:
     Assumption: "F is force applied to specimen"
     Assumption: "A is cross-sectional area"
     Issue: Using L (one dimension of area) instead of A
     
Conflict report:
  Type: DIMENSION_USAGE_ERROR
  Severity: HIGH
  Issue: "Stress formula should divide by AREA (L²), not by single length dimension"
  Correction: "σ = F / A  (where A is cross-sectional area)"
  Evidence: "Formula dimensionally OK but violates engineering convention"
```

---

## 6️⃣ ENGINEERING QUANTITY CATEGORIES

### 6.1 CLASSIFICATION

```
Category: FORCE_DERIVED QUANTITIES
  Dimension: [M¹ L¹ T⁻²]
  Members: Force, Weight, Tension
  Formula: F = m × a

Category: STRESS_DERIVED QUANTITIES
  Dimension: [M¹ L⁻¹ T⁻²]
  Members: Stress, Pressure, Modulus of Elasticity
  Formula: σ = F / A
  ⚠️ WARNING: Stress and Pressure same dimension, different domains

Category: KINEMATIC QUANTITIES
  Dimension: [L¹ T⁻¹]
  Members: Velocity, Flow rate per unit area
  Formula: v = Δx / Δt

Category: ACCELERATION_DERIVED
  Dimension: [L¹ T⁻²]
  Members: Acceleration, Gravitational acceleration
  Formula: a = Δv / Δt

Category: ENERGY_DERIVED
  Dimension: [M¹ L² T⁻²]
  Members: Energy, Work, Torque (when defined as energy)
  Formula: E = F × d
  ⚠️ WARNING: Torque and Energy have same dimension!

Category: DIMENSIONLESS QUANTITIES
  Dimension: [ ]
  Members: Strain, Ratio, Poisson's ratio
  Formula: ε = ΔL / L
  ✓ ALWAYS numerator and denominator same dimension

Category: THERMAL QUANTITIES
  Dimension: [Θ¹]
  Members: Temperature, Temperature difference
  Formula: ΔT = T₂ - T₁
  ⚠️ WARNING: Kelvin absolute vs Celsius difference
```

### 6.2 DANGEROUS DIMENSION EQUALITIES

```
These have SAME dimension but DIFFERENT meanings:
(Highest confusion risk in engineering)

✓ STRESS vs PRESSURE
  [M¹ L⁻¹ T⁻²]
  Same formula: X = F / A
  Different: stress in solids vs pressure in fluids
  Risk: High (common confusion in multi-phase analysis)

✓ TORQUE vs ENERGY
  [M¹ L² T⁻²]
  Different formulas: τ = F × r vs E = F × d
  Different: Torque (rotational) vs Energy (translational)
  Risk: Medium (dimensionally distinct in context, but formula looks similar)

✓ ANGULAR FREQUENCY vs FREQUENCY
  [T⁻¹]
  Different units: rad/s vs Hz
  Same dimension but: angular is dimensionless × time
  Risk: Medium (commonly confused in vibration analysis)

✓ ENERGY DENSITY vs PRESSURE
  [M¹ L⁻¹ T⁻²]
  Same as stress/pressure!
  Different: Energy per volume vs force per area
  Risk: Low (context usually clarifies, but theoretically identical)

✓ KINEMATIC vs DYNAMIC VISCOSITY
  Different dimensions: [L² T⁻¹] vs [M¹ L⁻¹ T⁻¹]
  NOT same dimension, but constantly confused
  Risk: HIGH (major source of fluid mechanics errors)
```

---

## 7️⃣ DIMENSIONAL EQUIVALENCE MATRIX

### 7.1 MATRIX DEFINITION

Create a matrix showing which engineering quantities are dimensionally equivalent:

```
              | STRESS | PRESS | MOD_E | ENRG | TORQUE | VISCOSITY
STRESS        |   ✓    |  ✓**  |   ✓   |  ✓   |        |
PRESSURE      |  ✓**   |   ✓   |   ✓   |  ✓   |        |
MOD_E         |   ✓    |   ✓   |   ✓   |  ✓   |        |
ENERGY        |   ✓    |   ✓   |   ✓   |   ✓  |  ✓     |
TORQUE        |        |       |       |   ✓  |   ✓    |
VISCOSITY     |        |       |       |      |        |   ✓

✓ = dimensionally equivalent
** = dimensionally equivalent but semantically dangerous

Note:
  All [M¹ L⁻¹ T⁻²] quantities: STRESS, PRESSURE, MODULUS, ENERGY/volume
  All [M¹ L² T⁻²] quantities: ENERGY, TORQUE
```

### 7.2 READING THE MATRIX

```
STRESS and PRESSURE:
  Dimensionally equivalent: ✓
  Semantically different: YES (solids vs fluids)
  Safety risk: HIGH
  Action: Domain check mandatory

STRESS and MODULUS:
  Dimensionally equivalent: ✓
  Semantically related: YES (elastic properties)
  Safety risk: MEDIUM (common to confuse in design)
  Action: Context check for material vs stress

ENERGY and TORQUE:
  Dimensionally equivalent: ✓
  Semantically different: YES (translational vs rotational)
  Safety risk: MEDIUM
  Action: Check if formula is for rotating or translating body
```

---

## 8️⃣ DIMENSIONAL VALIDATION API

### 8.1 CORE FUNCTIONS

```typescript
// Check dimensional consistency
function check_dimensional_consistency(
  formula: SEMANTIC_FORMULA
): {valid: boolean, errors: string[]}

// Calculate dimension of formula
function calculate_dimension(
  formula: SEMANTIC_FORMULA
): DIMENSION

// Check dimensional equivalence
function are_dimensionally_equivalent(
  d1: DIMENSION,
  d2: DIMENSION
): boolean

// Find all quantities with same dimension
function find_dimensionally_equivalent_quantities(
  dimension: DIMENSION
): ENGINEERING_QUANTITY[]

// Detect dimensional conflicts
function detect_dimensional_conflicts(
  formula: SEMANTIC_FORMULA,
  domain: string
): DIMENSIONAL_CONFLICT[]

// Transform between unit systems
function transform_formula_units(
  formula: SEMANTIC_FORMULA,
  from_units: UNIT_SYSTEM,
  to_units: UNIT_SYSTEM
): SEMANTIC_FORMULA

// Generate dimensional proof
function generate_dimensional_proof(
  formula: SEMANTIC_FORMULA
): PROOF
```

### 8.2 DATA STRUCTURES

```typescript
type DIMENSIONAL_CONFLICT = {
  type: "INCONSISTENT" | "MISMATCH" | "USAGE_ERROR" | "ASSUMPTION_VIOLATION"
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  description: string
  expected_dimension?: DIMENSION
  actual_dimension?: DIMENSION
  evidence: string[]
  suggestion?: string
}

type PROOF = {
  formula: string
  steps: PROOF_STEP[]
  result_dimension: DIMENSION
  valid: boolean
}

type PROOF_STEP = {
  step_number: number
  expression: string
  dimension: DIMENSION
  rule_applied: string
  explanation: string
}
```

### 8.3 EXAMPLE: DIMENSIONAL PROOF API

```typescript
// Input: σ = F / A
const formula = parse_semantic_formula("σ = F / A", "structural")

// Generate proof
const proof = generate_dimensional_proof(formula)

// Output:
{
  formula: "σ = F / A",
  steps: [
    {
      step_number: 1,
      expression: "σ = F / A",
      dimension: null,
      rule_applied: "IDENTIFY_COMPONENTS",
      explanation: "Identify variables and their dimensions"
    },
    {
      step_number: 2,
      expression: "F",
      dimension: "[M¹ L¹ T⁻²]",
      rule_applied: "LOOKUP_DIMENSION",
      explanation: "Force has dimension [M¹ L¹ T⁻²]"
    },
    {
      step_number: 3,
      expression: "A",
      dimension: "[L²]",
      rule_applied: "LOOKUP_DIMENSION",
      explanation: "Area has dimension [L²]"
    },
    {
      step_number: 4,
      expression: "F / A = [M¹ L¹ T⁻²] / [L²]",
      dimension: "[M¹ L⁻¹ T⁻²]",
      rule_applied: "RULE_DIM-2",
      explanation: "Division: exponents subtract"
    },
    {
      step_number: 5,
      expression: "σ = [M¹ L⁻¹ T⁻²]",
      dimension: "[M¹ L⁻¹ T⁻²]",
      rule_applied: "ASSIGNMENT",
      explanation: "Result assigned to σ"
    }
  ],
  result_dimension: "[M¹ L⁻¹ T⁻²]",
  valid: true,
  note: "Result dimension matches expected dimension for STRESS/PRESSURE. 
         Additional domain check required to distinguish STRESS (solids) 
         from PRESSURE (fluids)."
}
```

---

## 9️⃣ REMAINING QUESTIONS FOR PHASE 2

- [ ] How to handle non-SI derived units (e.g., kilocalorie with complex dimension)?
- [ ] How to represent uncertainties in dimensional relationships?
- [ ] How to handle historical or archaic units with non-standard dimensions?
- [ ] How to represent conditional dimensions (e.g., dimension depends on which formula)?
- [ ] How to track dimensional assumptions that are context-dependent?

---

## PHASE 2 SUMMARY

✅ **Delivered:**
1. Dimensional analysis framework (SI + extended)
2. Dimensional consistency checking algorithm
3. Stress-pressure paradox (same dimension, different semantics)
4. Unit-invariant equivalence
5. Dimensional conflict detection (5 types)
6. Dangerous dimension equalities (high-confusion pairs)
7. Engineering quantity categories
8. Dimensional equivalence matrix
9. Dimensional validation API
10. Worked examples with proofs

➡️ **NEXT PHASE:** ENGINEERING_DOMAIN_SEMANTICS.md (ÉTАП 3)
   - Domain-aware semantic mapping
   - Discipline-specific interpretations
   - Multi-domain formula disambiguation
