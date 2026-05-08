# FORMULA SEMANTIC MODEL
## Детерминированное семантическое представление инженерных формул

**Статус:** 🟦 SEMANTIC ARCHITECTURE — PHASE 1  
**Дата:** 2026-05-09  
**Версия:** 1.0  
**Контекст:** SEMANTIC_EQUIVALENCE_ARCHITECTURE.md → STAGE 1

---

## 🎯 НАЗНАЧЕНИЕ

Обеспечить **машиночитаемое семантическое представление** инженерных формул, которое:
- Не зависит от нотации (σ vs P vs "stress")
- Сохраняет алгебраическую структуру
- Явно отслеживает переменные и их смысл
- Поддерживает эквивалентность без нормализации

**Принцип:** Одинаковая семантика → идентичное представление (regardless of notation).

---

## 1️⃣ SEMANTIC FORMULA ANATOMY

### 1.1 СТРУКТУРНЫЕ КОМПОНЕНТЫ

Каждая инженерная формула состоит из:

```
SEMANTIC_FORMULA := {
  symbol: string                        // σ, τ, P, F
  canonical_symbol: string              // STRESS, SHEAR_STRESS, PRESSURE, FORCE
  semantic_domain: string               // "structural", "thermal", "fluid", "electrical"
  definition: string                    // Natural language definition
  structure: ALGEBRAIC_TREE             // Parse tree
  variables: {
    [name]: VARIABLE_SEMANTICS
  }
  dimensional_signature: DIMENSION      // [M¹ L⁻¹ T⁻²]
  equivalence_class: string             // "STRESS", "PRESSURE" (may differ by domain)
  context_required: boolean             // Does meaning depend on domain?
}
```

### 1.2 VARIABLE SEMANTICS

```
VARIABLE_SEMANTICS := {
  symbol: string                        // "F", "σ", "A"
  engineering_quantity: string          // "FORCE", "STRESS", "AREA"
  dimension: DIMENSION                  // [M¹ L² T⁻²]
  unit_family: string[]                 // ["N", "kN", "kgf", "lbf"]
  domain_context: string[]              // ["structural", "mechanical"]
  canonical_notation: string            // How this quantity MUST be written
  synonyms: string[]                    // Alternative symbols for same quantity
}
```

### 1.3 ALGEBRAIC TREE REPRESENTATION

```
ALGEBRAIC_TREE := TERMINAL | OPERATION

TERMINAL := {
  type: "CONSTANT" | "VARIABLE" | "FUNCTION"
  value: string                         // "2", "π", "σ", "sin"
  semantics: VARIABLE_SEMANTICS         // (if VARIABLE)
}

OPERATION := {
  operator: "+" | "-" | "*" | "/" | "^" | "LOG" | "EXP"
  operands: ALGEBRAIC_TREE[]
  implicit_assumptions: string[]        // ["assumes F > 0", "order of magnitude"]
}
```

---

## 2️⃣ SYMBOLIC EQUIVALENCE

### 2.1 DEFINITION

Two formulas F₁ and F₂ are **symbolically equivalent** if:

```
F₁ ≈ₛ F₂  ⟺  
  same algebraic structure(F₁, F₂)
  AND same_variable_mapping(F₁, F₂)
  AND same_constants(F₁, F₂)
```

### 2.2 EXAMPLES: SYMBOLIC EQUIVALENCE

```
✅ IDENTICAL SYMBOLIC STRUCTURE:

σ = F / A
stress = force / area
σ = P / A

All reduce to: QUANTITY = QUANTITY1 / QUANTITY2
Structure: DIV(VAR, VAR)
Mapping: {σ→STRESS, F→FORCE, A→AREA, P→FORCE_EQUIV}

---

❌ DIFFERENT SYMBOLIC STRUCTURE:

σ = F / A      [DIV(VAR, VAR)]
τ = G · θ      [MUL(VAR, VAR)]

Structure differs → NOT symbolically equivalent
```

### 2.3 VARIABLE MAPPING RULES

```
RULE SYM-1: Canonical symbol replacement
  Any symbol representing same engineering quantity 
  → maps to same VARIABLE_SEMANTICS
  
Example: 
  σ (Greek sigma) → STRESS
  "stress" (English) → STRESS
  S (uppercase letter) → STRESS (in context)

RULE SYM-2: Domain-specific aliases
  Same symbol may represent different quantities in different domains
  → must explicitly track domain_context
  
Example:
  ρ = density (structural context)
  ρ = resistivity (electrical context)
  → NOT symbolically equivalent without domain

RULE SYM-3: Order-independence for commutative operations
  A × B ≈ₛ B × A  (multiplication)
  A + B ≈ₛ B + A  (addition)
  But: A / B ≁ₛ B / A (division NOT commutative)
  And: A - B ≁ₛ B - A (subtraction NOT commutative)

RULE SYM-4: Associativity for grouping
  (A × B) × C ≈ₛ A × (B × C)  (implicit parentheses)
```

### 2.4 SYMBOLIC EQUIVALENCE ALGORITHM

```
function are_symbolically_equivalent(f1, f2):
  // Parse to algebraic trees
  tree1 = parse_formula(f1)
  tree2 = parse_formula(f2)
  
  // Check structure
  if not same_algebraic_structure(tree1, tree2):
    return False
  
  // Check variable mappings
  var_map1 = extract_variable_semantics(tree1)
  var_map2 = extract_variable_semantics(tree2)
  
  canonical_map1 = normalize_to_canonical(var_map1)
  canonical_map2 = normalize_to_canonical(var_map2)
  
  if canonical_map1 != canonical_map2:
    return False
  
  // Check constants
  const1 = extract_constants(tree1)
  const2 = extract_constants(tree2)
  
  if const1 != const2:
    return False
  
  return True
```

---

## 3️⃣ ALGEBRAIC EQUIVALENCE

### 3.1 DEFINITION

Two formulas F₁ and F₂ are **algebraically equivalent** if:

```
F₁ ≈ₐ F₂  ⟺  
  can_transform(F₁ → F₂) using algebraic rules
  AND same dimensional signature
  AND no domain-specific assumptions violated
```

### 3.2 ALGEBRAIC TRANSFORMATION RULES

```
RULE ALG-1: Commutativity
  A × B = B × A
  A + B = B + A

RULE ALG-2: Associativity
  (A × B) × C = A × (B × C)
  (A + B) + C = A + (B + C)

RULE ALG-3: Distributivity
  A × (B + C) = A×B + A×C

RULE ALG-4: Exponent rules
  A^m × A^n = A^(m+n)
  (A^m)^n = A^(m×n)
  A^(m/n) = ⁿ√(A^m)

RULE ALG-5: Division as multiplication
  A / B = A × B^(-1)

RULE ALG-6: Fraction simplification
  (A × C) / (B × C) = A / B  (if C ≠ 0)

RULE ALG-7: Factor extraction
  A×B + A×C = A×(B+C)
```

### 3.3 EXAMPLES: ALGEBRAIC EQUIVALENCE

```
✅ ALGEBRAICALLY EQUIVALENT:

σ = F / A
σ × A = F           (multiply both sides by A)
F = σ × A           (rearrange)

All represent same relationship, different form.

---

✅ ALGEBRAICALLY EQUIVALENT (via exponent rules):

E = m × c²
E / m = c²          (divide by m)
√(E / m) = c        (square root)

All are algebraic rearrangements.

---

❌ NOT ALGEBRAICALLY EQUIVALENT (different structure):

σ = F / A           [linear relationship]
τ = G × θ           [different relationship]

No algebraic transformation bridges them.
```

### 3.4 DOMAIN-SPECIFIC CONSTRAINTS

```
Important: Algebraic transformation rules may be violated 
by domain constraints.

Example:
  σ = F / A  (always)
  But in structural design: σ_max must respect yield criterion
  So: σ = F / A BUT σ ≤ σ_yield (domain constraint)

Algebraic rule: can rearrange to F ≤ σ_yield × A
But CANNOT rearrange backwards without respecting yield criterion.
```

---

## 4️⃣ NOTATION-INDEPENDENT SEMANTICS

### 4.1 NOTATION VARIANTS

```
SINGLE FORMULA can be written as:

σ = F / A           (ASCII symbols)
σ = F÷A             (division symbol)
σ = F∕A             (fraction slash)
stress = force ÷ area    (English words)
Напряжение = Сила ÷ Площадь  (Russian)
σ = 
    F
    ─              (vertical fraction)
    A
σ(A) = F(A)/A      (functional notation)
σ(A) := F(A)/A     (definition notation)
```

### 4.2 CANONICAL SEMANTIC REPRESENTATION

Regardless of notation, all map to:

```
SEMANTIC_CORE := {
  predicate: "STRESS"
  arguments: [
    {role: "subject", quantity: "STRESS", symbol: "σ"},
    {role: "numerator", quantity: "FORCE", symbol: "F"},
    {role: "denominator", quantity: "AREA", symbol: "A"}
  ]
  operation: "DIVISION"
  intent: "Stress is defined as force divided by area"
}
```

### 4.3 NORMALIZATION TO SEMANTIC CORE

```
ALGORITHM normalize_to_semantic_core(formula_string, domain):
  
  // Step 1: Parse to algebraic tree
  tree = parse_formula(formula_string)
  
  // Step 2: Resolve symbols → engineering quantities
  resolved = resolve_symbol_semantics(tree, domain)
  
  // Step 3: Extract predicate and arguments
  predicate = identify_main_quantity(resolved)
  operands = identify_operands(resolved)
  
  // Step 4: Canonicalize operand order
  canonical_operands = order_operands(operands)
  
  // Step 5: Create SEMANTIC_CORE
  core = {
    predicate: predicate,
    arguments: canonical_operands,
    operation: identify_operation(tree),
    intent: extract_intent(formula_string, domain)
  }
  
  return core
```

---

## 5️⃣ CONTEXT PRESERVATION

### 5.1 IMPLICIT ASSUMPTIONS

Every formula carries implicit assumptions:

```
σ = F / A

Implicit assumptions:
- F is positive (compression/tension makes sense)
- A is positive (area cannot be zero or negative)
- Units are compatible (F in Newtons, A in mm²)
- Formula applies only for uniaxial stress (not multi-axial)
- Assumes linear elasticity (small deformations)
- Assumes homogeneous material
```

### 5.2 CONTEXT METADATA

```
CONTEXT := {
  domain: string                    // "structural", "thermal", "fluid"
  subdiscipline: string             // "stress_analysis", "material_selection"
  applicability_range: string       // "linear elasticity", "small strains"
  assumptions: string[]             // Explicit list
  forbidden_uses: string[]          // When this formula does NOT apply
  typical_units: {
    [quantity]: unit[]              // What units are typical
  }
  validation_criteria: string[]     // How to verify correctness
}
```

### 5.3 CONTEXT-DEPENDENT SEMANTICS

```
Example: Same formula, different contexts

σ = F / A   (structural design)
Context: Uniaxial stress in bars
Assumptions: Linear elasticity, homogeneous material
Units: [σ] = [Force]/[Area]

vs

σ = F / A   (material testing)
Context: Testing specimen under load
Assumptions: Strain rate effects, temperature control
Units: [σ] = [Force]/[Cross-sectional area of specimen]

SEMANTIC EQUIVALENCE: YES (same formula structure)
CONTEXT EQUIVALENCE: DEPENDENT (may behave differently under:
  - High strain rates
  - Temperature variations
  - Non-homogeneous materials
)
```

---

## 6️⃣ SEMANTIC EQUIVALENCE CLASSES

### 6.1 CLASSIFICATION

```
For each formula pair (F₁, F₂):

IDENTICAL (I):
  F₁ = F₂ textually
  Example: σ = F / A  vs  σ = F / A

EQUIVALENT (E):
  F₁ ≈ₛ F₂  (symbolically equivalent)
  AND F₁ ≈ₐ F₂  (algebraically equivalent)
  AND same_domain_context(F₁, F₂)
  Example: σ = F / A  vs  F = σ × A

EQUIVALENT_ALGEBRAICALLY (EA):
  F₁ ≈ₐ F₂  (can rearrange)
  BUT different primary form
  Example: σ = F / A  vs  F = σ × A

CONTEXT_DEPENDENT (CD):
  F₁ and F₂ equivalent only under specific domain/context
  Example: σ = F / A (structural) vs σ (strain-dependent in materials)

PARTIALLY_EQUIVALENT (PE):
  F₁ and F₂ share some variables but not all semantics
  Example: σ = F / A  vs  τ = G × θ
  (both are "strength properties" but different structure)

NON_EQUIVALENT (NE):
  F₁ and F₂ have no semantic overlap
  Example: σ = F / A  vs  v = √(E / ρ)
```

### 6.2 EQUIVALENCE DECISION TREE

```
function classify_equivalence(f1, f2, domain):
  
  if same_textual_form(f1, f2):
    return IDENTICAL
  
  tree1 = parse_formula(f1)
  tree2 = parse_formula(f2)
  
  if not same_predicate(tree1, tree2):
    return NON_EQUIVALENT
  
  // Same main quantity
  if same_algebraic_structure(tree1, tree2):
    if same_domain_context(f1, f2, domain):
      return EQUIVALENT
    else:
      return CONTEXT_DEPENDENT
  
  // Can rearrange?
  if can_algebraically_transform(tree1, tree2):
    return EQUIVALENT_ALGEBRAICALLY
  
  // Share some variables?
  if have_overlapping_variables(f1, f2):
    return PARTIALLY_EQUIVALENT
  
  return NON_EQUIVALENT
```

---

## 7️⃣ ENGINEERING QUANTITY REGISTRY

### 7.1 REGISTRY STRUCTURE

```
ENGINEERING_QUANTITY := {
  canonical_name: string            // "STRESS", "PRESSURE", "FORCE"
  symbol_canonical: string          // σ, P, F
  alternative_symbols: string[]     // ["S", "τ_n", "σ_n"]
  dimension: DIMENSION              // [M¹ L⁻¹ T⁻²]
  unit_family: UNIT_FAMILY          // [Pa, MPa, kPa, psi, bar]
  domains: string[]                 // ["structural", "piping", "equipment"]
  definition: string                // Clear English definition
  engineering_formula: string       // How it's defined
  typical_values_range: {           // Domain-specific typical ranges
    [domain]: {min: number, max: number, unit: string}
  }
  common_mistakes: string[]         // What confusions to watch for
  see_also: string[]                // Related quantities
}
```

### 7.2 REGISTRY ENTRIES (Examples)

```
Entry: STRESS
  canonical_name: "STRESS"
  symbol_canonical: σ
  alternative_symbols: [σ_normal, σ_n, τ (shear), S, σ_b (bending)]
  dimension: [M¹ L⁻¹ T⁻²]
  unit_family: [Pa, MPa, kPa, psi, bar, N/mm²]
  domains: ["structural", "mechanical", "material science"]
  definition: "Normal force per unit area perpendicular to the force"
  engineering_formula: "σ = F / A"
  typical_values_range: {
    structural: {min: 0, max: 1000, unit: "MPa"},
    material_testing: {min: 0.1, max: 10000, unit: "MPa"}
  }
  common_mistakes: [
    "Confusing stress with strain",
    "Using wrong cross-sectional area (gross vs net)",
    "Ignoring stress concentrations",
    "Not accounting for safety factors"
  ]
  see_also: ["STRAIN", "MODULUS_OF_ELASTICITY", "PRESSURE"]

---

Entry: PRESSURE
  canonical_name: "PRESSURE"
  symbol_canonical: P
  alternative_symbols: [p, F/A (in context), atm (absolute), gauge]
  dimension: [M¹ L⁻¹ T⁻²]  (same as stress!)
  unit_family: [Pa, bar, atm, psi, MPa, mbar]
  domains: ["fluid mechanics", "piping", "HVAC", "equipment design"]
  definition: "Normal force per unit area in fluids or on surfaces"
  engineering_formula: "P = F / A"
  typical_values_range: {
    atmospheric: {min: 0.5, max: 1.5, unit: "bar"},
    industrial_piping: {min: 1, max: 350, unit: "bar"}
  }
  common_mistakes: [
    "Confusing gauge pressure with absolute",
    "Unit conversion errors (atm vs bar vs psi)",
    "Ignoring hydrostatic pressure variation",
    "Not accounting for surge pressure"
  ]
  see_also: ["STRESS", "FORCE", "AREA", "HYDROSTATIC_PRESSURE"]
```

**⚠️ CRITICAL OBSERVATION:**

```
STRESS and PRESSURE have:
  ✅ IDENTICAL dimension [M¹ L⁻¹ T⁻²]
  ✅ IDENTICAL formula (F / A)
  ✅ PARTIALLY OVERLAPPING domains (structural = solids, fluid = liquids)
  ❌ DIFFERENT semantic contexts (stress in solids, pressure in fluids)
  
This is NOT true equivalence — different semantic meaning despite same math.
```

---

## 8️⃣ SEMANTIC MODEL API

### 8.1 CORE FUNCTIONS

```typescript
// Parse formula to semantic model
function parse_semantic_formula(
  formula_string: string,
  domain: string
): SEMANTIC_FORMULA

// Check symbolic equivalence
function are_symbolically_equivalent(
  f1: SEMANTIC_FORMULA,
  f2: SEMANTIC_FORMULA
): boolean

// Check algebraic equivalence
function are_algebraically_equivalent(
  f1: SEMANTIC_FORMULA,
  f2: SEMANTIC_FORMULA,
  domain: string
): boolean

// Classify equivalence
function classify_semantic_equivalence(
  f1: SEMANTIC_FORMULA,
  f2: SEMANTIC_FORMULA,
  domain: string
): EQUIVALENCE_CLASS

// Extract context
function extract_context(
  formula: SEMANTIC_FORMULA
): CONTEXT

// Find all equivalent forms
function find_algebraic_rearrangements(
  formula: SEMANTIC_FORMULA
): SEMANTIC_FORMULA[]

// Validate formula for domain
function validate_formula_in_domain(
  formula: SEMANTIC_FORMULA,
  domain: string
): {valid: boolean, errors: string[]}

// Detect semantic conflicts
function detect_semantic_conflict(
  f1: SEMANTIC_FORMULA,
  f2: SEMANTIC_FORMULA,
  domain: string
): CONFLICT | null
```

### 8.2 DATA STRUCTURES (TypeScript)

```typescript
type DIMENSION = {
  mass: number        // exponent for mass
  length: number      // exponent for length
  time: number        // exponent for time
  current?: number    // exponent for electric current
  temperature?: number // exponent for temperature
}

type EQUIVALENCE_CLASS = 
  | "IDENTICAL"
  | "EQUIVALENT"
  | "EQUIVALENT_ALGEBRAICALLY"
  | "CONTEXT_DEPENDENT"
  | "PARTIALLY_EQUIVALENT"
  | "NON_EQUIVALENT"

type CONFLICT = {
  type: "DIMENSIONAL_MISMATCH" | "ALGEBRAIC_CONTRADICTION" | "SEMANTIC_AMBIGUITY"
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  description: string
  evidence: string[]
}
```

---

## 9️⃣ VALIDATION & EXAMPLES

### 9.1 WORKED EXAMPLE: STRESS FORMULA

```
Input: σ = F / A (structural context)

Step 1: Parse
  Symbols: σ, F, A
  Operation: Division
  
Step 2: Resolve semantics
  σ → ENGINEERING_QUANTITY{
    canonical_name: "STRESS"
    symbol_canonical: σ
    dimension: [M¹ L⁻¹ T⁻²]
  }
  F → FORCE
    dimension: [M¹ L² T⁻²]
  A → AREA
    dimension: [L²]

Step 3: Build algebraic tree
  DIV(
    VAR(σ, STRESS),
    MUL(VAR(F, FORCE), OP^(-1), VAR(A, AREA))
  )

Step 4: Semantic core
  SEMANTIC_CORE {
    predicate: "STRESS"
    arguments: [
      {role: "subject", quantity: "STRESS", symbol: "σ"},
      {role: "numerator", quantity: "FORCE", symbol: "F"},
      {role: "denominator", quantity: "AREA", symbol: "A"}
    ]
    operation: "DIVISION"
    intent: "Stress defined as force divided by area"
  }

Step 5: Context
  CONTEXT {
    domain: "structural",
    assumptions: ["F positive", "A positive", "uniaxial stress"],
    typical_units: {F: ["N", "kN"], A: ["mm²", "m²"], σ: ["Pa", "MPa"]}
  }
```

### 9.2 WORKED EXAMPLE: ALGEBRAIC EQUIVALENCE

```
Question: Are these equivalent?

σ = F / A
F = σ × A

Step 1: Parse both
  f1: DIV(σ, [F, A])
  f2: MUL(σ, [A]) = F

Step 2: Check algebraic structure
  f1: DIV(X, Y)
  f2: MUL(X, Y) = Z
  
  Can transform f1 to f2 via:
    σ = F / A
    multiply both sides by A:
    σ × A = F

Step 3: Verify dimension consistency
  f1: [σ] = [F]/[A] = [M¹ L² T⁻²]/[L²] = [M¹ T⁻²] ✓
  f2: [F] = [σ]×[A] = [M¹ T⁻²]×[L²] = [M¹ L² T⁻²] ✓

Step 4: Classify
  Result: EQUIVALENT_ALGEBRAICALLY (can rearrange, same domain)
  Better classification: EQUIVALENT (since we're solving for F)
```

### 9.3 WORKED EXAMPLE: NON-EQUIVALENCE

```
Question: Are these equivalent?

σ = F / A      (stress)
τ = G × θ      (shear strain)

Step 1: Identify predicates
  f1 predicate: STRESS
  f2 predicate: SHEAR_STRAIN

Step 2: Check algebraic structure
  f1: DIV(F, A)
  f2: MUL(G, θ)
  
  Different structures → cannot transform algebraically

Step 3: Check domain overlap
  f1 domain: "structural" (solids, stress)
  f2 domain: "structural" (solids, strain)
  
  Domains overlap but quantities different

Step 4: Classify
  Result: NON_EQUIVALENT
  Note: Both are structural properties, but measure different physical phenomena
```

---

## 🔟 REMAINING QUESTIONS FOR PHASE 1

- [ ] How to handle implicit variables? (e.g., "stress" without specifying area)
- [ ] How to represent conditional formulas? (e.g., "if A > B, then σ = F/A, else σ = 0")
- [ ] How to handle approximations? (e.g., "σ ≈ F/A" for thin sections)
- [ ] How to track formula derivation chains? (e.g., σ from E = σ/ε)
- [ ] How to represent uncertainty in semantic equivalence? (e.g., "probably equivalent")
- [ ] How to handle circular definitions? (cross-references between formulas)

---

## PHASE 1 SUMMARY

✅ **Delivered:**
1. Semantic formula anatomy (structure, components)
2. Symbolic equivalence definition and algorithm
3. Algebraic equivalence rules and examples
4. Notation-independent semantics
5. Context preservation model
6. Semantic equivalence classification
7. Engineering quantity registry (with examples)
8. Semantic model API
9. Validation examples

➡️ **NEXT PHASE:** DIMENSIONAL_SEMANTICS_STANDARD.md (ÉTАП 2)
   - Dimensional analysis framework
   - Unit-independent equivalence
   - Dimensional conflict detection
