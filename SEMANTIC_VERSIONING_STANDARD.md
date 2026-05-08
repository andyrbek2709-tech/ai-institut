# SEMANTIC VERSIONING STANDARD
## Controlled Evolution Strategy for Engineering Semantic Entities

**Status:** 🟨 SEMANTIC IDENTITY GOVERNANCE — PHASE 3  
**Date:** 2026-05-09  
**Version:** 1.0  
**Foundation:** SEMANTIC_IDENTITY_ARCHITECTURE.md

---

## 🎯 EXECUTIVE SUMMARY

Semantic versioning governs **controlled evolution** of semantic identities.

```
PROBLEM:
========

Semantic meanings change:
  - Standards evolve
  - Physics understanding improves
  - Definitions clarified
  - Formulas refined

Question:
  How to distinguish:
    PATCH (bug fix, no change) vs
    MINOR (refinement, backward compatible) vs
    MAJOR (redefinition, breaking change)?

Without versioning:
  ❌ Consumers don't know impact
  ❌ Silent incompatibilities
  ❌ Corpus degrades
  ❌ AI linking breaks
```

### The Solution: Semantic Versioning

```
MAJOR . MINOR . PATCH

Semantic Versioning Guarantees:

  PATCH (1.0.0 → 1.0.1):
    ✅ No semantic change
    ✅ Typo fix / clarification only
    ✅ Fully backward compatible
    ✅ Safe to adopt immediately
    
  MINOR (1.0.0 → 1.1.0):
    ⚠️  Semantic refinement
    ⚠️  New related concept introduced
    ⚠️  Backward compatible (old formulas valid)
    ⚠️  Safe to adopt
    ⚠️  May deprecate old variant
    
  MAJOR (1.0.0 → 2.0.0):
    ❌ Significant change
    ❌ New physics / domain added
    ❌ NOT backward compatible
    ❌ Requires consumer migration
    ❌ Immutable migration path required
```

---

## 1️⃣ SEMANTIC VERSIONING MODEL

### Version Structure

```
semantic_version = MAJOR . MINOR . PATCH

  MAJOR:
    - Incremented on breaking changes
    - Significant redefinition or domain expansion
    - Requires consumer migration
    - Format: integer (1, 2, 3, ...)
  
  MINOR:
    - Incremented on backward-compatible changes
    - Refinement, extension, clarification
    - Old formulas still valid
    - Format: integer (0, 1, 2, ...)
  
  PATCH:
    - Incremented on bug fixes / clarifications
    - No semantic change
    - Format: integer (0, 1, 2, ...)

Initial Version:
  All new semantic entities: 1.0.0
  
Stable Release:
  Versions reaching 1.0.0 considered stable
  Pre-release: 1.0.0-draft, 1.0.0-rc1, etc.
```

### Version Precedence

```
Version Ordering (oldest to newest):
  1.0.0-draft
  1.0.0-rc1
  1.0.0-rc2
  1.0.0
  1.0.1
  1.1.0
  1.1.1
  2.0.0-rc1
  2.0.0

Precedence Rule:
  When comparing versions A and B:
    1. If MAJOR differs: higher MAJOR > lower MAJOR
    2. If MAJOR same, if MINOR differs: higher MINOR > lower MINOR
    3. If MAJOR and MINOR same: higher PATCH > lower PATCH
    4. Prerelease versions sort before release
       (1.0.0-rc1 < 1.0.0)
```

---

## 2️⃣ PATCH VERSION (1.0.0 → 1.0.1)

### When to Bump PATCH

```
PATCH bumps are for:
  ✅ Typos in definition text
  ✅ Notation clarification (σ vs "stress")
  ✅ Formula representation change (same meaning)
  ✅ Reference updates (standard citation)
  ✅ Example clarification
  ✅ Documentation improvement
  ✅ Alias correction (wrong notation fixed)

NEVER bump PATCH for:
  ❌ Semantic change (use MINOR/MAJOR)
  ❌ New formula variant (use MINOR/MAJOR)
  ❌ Definition clarification affecting meaning (use MINOR)
  ❌ Adding related concept (use MINOR)
```

### PATCH Version Guarantees

```
BACKWARD COMPATIBILITY:
  ✅ Formula unchanged (semantically)
  ✅ Physical quantity unchanged
  ✅ Domain unchanged
  ✅ Unit dimension unchanged
  
CONSUMER SAFETY:
  ✅ Existing code using v1.0.0 works with v1.0.1
  ✅ No migration needed
  ✅ Safe to auto-upgrade
  
IMMUTABILITY:
  ✅ PATCH creates new immutable snapshot
  ✅ Previous version preserved
  ✅ Lineage appended
```

### PATCH Version Examples

```
EXAMPLE 1: Typo Fix

Before (v1.0.0):
  definition: "Force per unit area acting on solud material"
  
After (v1.0.1):
  definition: "Force per unit area acting on solid material"
  
Change: Typo "solud" → "solid"
Semantic impact: NONE
Backward compatibility: ✅ FULL
Version bump: PATCH (1.0.0 → 1.0.1)

---

EXAMPLE 2: Notation Clarification

Before (v1.0.0):
  formula: σ = F / A
  notation: Not explicitly stated
  
After (v1.0.1):
  formula: σ = F / A
    where σ = stress [Pa]
          F = force [N]
          A = cross-sectional area [m²]
  notation: Explicitly defined
  
Change: Added notation clarification
Semantic impact: NONE
Backward compatibility: ✅ FULL
Version bump: PATCH (1.0.0 → 1.0.1)

---

EXAMPLE 3: Reference Update

Before (v1.0.0):
  reference: "ASME B31.3"
  
After (v1.0.1):
  reference: "ASME B31.3-2016 Section 302.2.1"
  
Change: Updated citation precision
Semantic impact: NONE
Backward compatibility: ✅ FULL
Version bump: PATCH (1.0.0 → 1.0.1)

---

EXAMPLE 4: Unit Clarification

Before (v1.0.0):
  unit: "Pa"
  
After (v1.0.1):
  unit: "Pa (Pascal) = N/m² = kg/(m·s²)"
  common_engineering_units: "MPa, psi, bar, kg/cm²"
  
Change: Added unit clarification
Semantic impact: NONE
Backward compatibility: ✅ FULL
Version bump: PATCH (1.0.0 → 1.0.1)
```

---

## 3️⃣ MINOR VERSION (1.0.0 → 1.1.0)

### When to Bump MINOR

```
MINOR bumps are for:
  ✅ Refinement (definition clarified, same core meaning)
  ✅ Related concept introduced (variant of same base)
  ✅ New formula variant (same physical phenomenon)
  ✅ Extended domain application (new discipline using same entity)
  ✅ Additional constraints documented
  ✅ New failure mode identified (related phenomenon)
  ✅ Alias expansion (new domain or language variant)

NEVER bump MINOR for:
  ❌ Complete redefinition (use MAJOR)
  ❌ Incompatible formula change (use MAJOR)
  ❌ Domain change (use MAJOR)
  ❌ Breaking consumer code (use MAJOR)
```

### MINOR Version Guarantees

```
BACKWARD COMPATIBILITY:
  ✅ Old formula still valid
  ✅ Old definition still applies
  ✅ New variant doesn't negate old usage
  ✅ Can coexist (old and new formula)
  
CONSUMER SAFETY:
  ✅ Existing code using v1.0.0 works with v1.1.0
  ✅ May not use new feature, but old code unaffected
  ✅ Safe to adopt
  ✅ May recommend upgrading (optional)
  
IMMUTABILITY:
  ✅ MINOR creates new immutable snapshot
  ✅ Previous version preserved
  ✅ Lineage appended
```

### MINOR Version Examples

```
EXAMPLE 1: Shear Stress Variant Introduction

Before (v1.0.0):
  entity_id: physics.solids.stress
  definition: "Force per unit area acting on material"
  formula: σ = F / A
  type: Generic stress (mainly normal/axial)
  
After (v1.1.0):
  entity_id: physics.solids.stress
  definition: "Force per unit area acting on material
              (includes normal stress and shear stress variants)"
  formulas:
    - Normal: σ_n = F_n / A
    - Shear: τ = F_s / A
  variants: [normal_stress, shear_stress]
  
Change: Extended definition to include shear stress
Semantic impact: REFINEMENT (same base entity, new variant)
Backward compatibility: ✅ FULL (old σ = F/A still valid for normal stress)
Version bump: MINOR (1.0.0 → 1.1.0)
Consumer action: Optional (can ignore shear variant)

---

EXAMPLE 2: Domain Expansion

Before (v1.0.0):
  entity_id: physics.materials.stress
  domain: structural_engineering
  formula: σ = F / A
  
After (v1.1.0):
  entity_id: physics.materials.stress
  domains: [structural_engineering, mechanical_engineering, materials_science]
  formulas:
    - Uniaxial: σ = F / A
    - Multi-axial: σ_eff = √[½((σ₁-σ₂)² + ...)] (von Mises)
  domain_specific_constraints:
    structural: σ ≤ σ_yield
    mechanical: σ ≤ σ_allowable (with safety factor)
  
Change: Extended to multiple domains
Semantic impact: REFINEMENT (core entity applies more broadly)
Backward compatibility: ✅ FULL (old usage still valid)
Version bump: MINOR (1.0.0 → 1.1.0)
Consumer action: Optional (basic stress formula still works)

---

EXAMPLE 3: New Language Alias

Before (v1.0.0):
  entity_id: physics.solids.stress
  aliases: ["σ" (notation), "stress" (English)]
  
After (v1.1.0):
  entity_id: physics.solids.stress
  aliases: ["σ" (notation), "stress" (English), "напряжение" (Russian), "esfuerzo" (Spanish)]
  
Change: Added language aliases
Semantic impact: NONE (same entity, new language access)
Backward compatibility: ✅ FULL
Version bump: MINOR (1.0.0 → 1.1.0)
Consumer action: None required

---

EXAMPLE 4: Additional Constraint Documentation

Before (v1.0.0):
  entity_id: physics.fluids.pressure
  formula: P = ρgh (hydrostatic)
  domain: piping_engineering
  
After (v1.1.0):
  entity_id: physics.fluids.pressure
  formula: P = ρgh (hydrostatic)
  domain: piping_engineering
  additional_constraints:
    - temperature_effect: "P_corrected = P_ref × (T_actual / T_ref)"
    - dynamic_pressure: "P_dynamic = ½ρv² (aerodynamic, distinct entity)"
    - gauge_vs_absolute: "P_gauge = P_absolute - P_atmospheric"
  failure_modes: [leakage, rupture, corrosion, thermal_stress]
  
Change: Added constraints and clarifications
Semantic impact: REFINEMENT (same base formula, additional context)
Backward compatibility: ✅ FULL (basic formula unchanged)
Version bump: MINOR (1.0.0 → 1.1.0)
Consumer action: Recommended to review constraints
```

---

## 4️⃣ MAJOR VERSION (1.0.0 → 2.0.0)

### When to Bump MAJOR

```
MAJOR bumps are for:
  ❌ Complete redefinition
  ❌ Incompatible formula change
  ❌ Fundamental domain shift
  ❌ Breaking physics change
  ❌ New mathematical framework
  ❌ Significant consumer impact

Examples:
  ✅ σ_1.0.0 (scalar stress) → σ_2.0.0 (tensor stress)
  ✅ P_1.0.0 (hydrostatic only) → P_2.0.0 (unified pressure including dynamic)
  ✅ E_1.0.0 (Young's modulus) → E_2.0.0 (complex modulus E'(ω))
```

### MAJOR Version Guarantees

```
NO BACKWARD COMPATIBILITY:
  ❌ Old formula NOT valid with new definition
  ❌ Old code BREAKS with new version
  ❌ Consumer MUST migrate
  ❌ v1.0.0 and v2.0.0 are DIFFERENT entities
  
CONSUMER SAFETY:
  ⚠️  MAJOR bump is HIGH RISK signal
  ⚠️  Requires explicit migration decision
  ⚠️  Migration path MUST be documented
  ⚠️  NOT safe to auto-upgrade
  ⚠️  Requires careful testing
  
IMMUTABILITY:
  ✅ MAJOR creates new immutable snapshot
  ✅ v1.0.0 PRESERVED (read-only reference)
  ✅ v2.0.0 SEPARATE (new entity, same semantic_id)
  ✅ Lineage records transition
```

### MAJOR Version Migration Path

```
REQUIRED for MAJOR bump:

1. Clear rationale
   WHY is this breaking change necessary?
   
2. Migration guide
   HOW do consumers migrate from v1.0.0 to v2.0.0?
   
3. Transition timeline
   WHEN must migration be complete?
   
4. Deprecation notice
   OLD entity goes through deprecation lifecycle
   
5. Immutable record
   Complete audit trail of change

EXAMPLE MIGRATION PATH:

Old Entity (v1.0.0):
  entity_id: physics.solids.stress
  definition: "Scalar stress (normal force per unit area)"
  formula: σ = F / A
  uses_in_corpus: 1,247 formulas

New Entity (v2.0.0):
  entity_id: physics.solids.stress (same ID!)
  semantic_version: 2.0.0
  definition: "Tensor stress (stress at all orientations)"
  formula: σ = [σ_xx σ_xy σ_xz]
           [σ_xy σ_yy σ_yz]
           [σ_xz σ_yz σ_zz]
  reason: "Standards evolution: ASME 2026 requires tensor representation
           for multi-axial analysis"

Migration Timeline:
  2026-01-01: v2.0.0 released (v1.0.0 still supported)
  2026-06-01: v1.0.0 marked DEPRECATED_WARNING
  2026-12-01: v1.0.0 marked DEPRECATED_MANDATORY
  2027-06-01: v1.0.0 archived (read-only)

Migration Guide:
  1. Identify formulas using v1.0.0
  2. Replace σ = F/A with σ_tensor = [3×3 matrix]
  3. For uniaxial case: σ_tensor[0,0] = F/A (backward compatible)
  4. For multi-axial case: Use von Mises equivalent stress
  5. Update design checks to use tensor invariants
  6. Test thoroughly (different behavior expected)
  
Immutable Record:
  major_version_change = {
    entity_id: "physics.solids.stress",
    old_version: "1.0.0",
    new_version: "2.0.0",
    change_date: 2026-01-01,
    reason: "Tensor representation required by ASME 2026",
    migration_deadline: 2027-06-01,
    approved_by: semantic_governance_board,
    immutable: true,
  }
```

### MAJOR Version Examples

```
EXAMPLE 1: Scalar → Tensor Transformation

Before (v1.0.0):
  entity_id: physics.solids.stress
  definition: "Force per unit area (scalar)"
  formula: σ = F / A ∈ ℝ
  dimensionality: Scalar
  failure_check: σ ≤ σ_yield (simple comparison)
  
After (v2.0.0):
  entity_id: physics.solids.stress
  definition: "Stress at all orientations (tensor)"
  formula: σ = [σ_ij] 3×3 matrix ∈ ℝ^{3×3}
  dimensionality: Tensor
  failure_check: σ_eff = von_Mises(σ) ≤ σ_yield (complex)
  
Breaking Changes:
  ❌ Formula structure changed (scalar → matrix)
  ❌ Calculation method changed (simple division → eigenvalue analysis)
  ❌ Failure check changed (direct comparison → von Mises)
  
Migration Required:
  v1.0.0: σ = F / A = 100 MPa
  v2.0.0: σ = [100    0   0]
           [  0    0   0]  MPa
           [  0    0   0]

Version bump: MAJOR (1.0.0 → 2.0.0)

---

EXAMPLE 2: Domain Expansion (Significant)

Before (v1.0.0):
  entity_id: physics.modulus.youngs
  definition: "Elastic modulus for uniaxial stress"
  formula: E = σ / ε (Young's modulus)
  domain: structural_mechanics (static loading)
  stress_type: Normal stress only
  
After (v2.0.0):
  entity_id: physics.modulus.youngs
  definition: "Complex modulus for time-dependent and multi-frequency loading"
  formula: E(ω) = E'(ω) + i E''(ω) (complex)
  domain: materials_science (dynamic loading)
  frequency_dependent: Yes (E varies with ω)
  
Breaking Changes:
  ❌ Formula changed (real number → complex number)
  ❌ Meaning changed (static → dynamic)
  ❌ Domain shifted (structural → materials)
  ❌ Calculation method completely different
  
Migration Required:
  v1.0.0: E = 200 GPa (static, constant)
  v2.0.0: E(100 Hz) = 205 + 15i GPa (dynamic, frequency-dependent)

Version bump: MAJOR (1.0.0 → 2.0.0)

---

EXAMPLE 3: New Physical Framework

Before (v1.0.0):
  entity_id: physics.fluids.pressure
  definition: "Hydrostatic pressure (static fluids)"
  formula: P = ρgh (fluids at rest)
  domain: piping_engineering
  
After (v2.0.0):
  entity_id: physics.fluids.pressure
  definition: "Unified pressure concept (static + dynamic)"
  formulas:
    - Hydrostatic: P_s = ρgh (stationary)
    - Dynamic: P_d = ½ρv² (moving fluid)
    - Total: P_total = P_s + P_d (Bernoulli)
  domain: fluid_mechanics (comprehensive)
  
Breaking Changes:
  ❌ Formula expanded (single equation → three equations)
  ❌ Physical interpretation changed
  ❌ Domain unified (piping-only → general fluid mechanics)
  ❌ New components introduced
  
Migration Required:
  v1.0.0: P = ρgh = 10,000 Pa (static only)
  v2.0.0: P_total = ρgh + ½ρv²
          P_total = 10,000 + ½(1000)(5²) = 22,500 Pa (includes dynamic)

Version bump: MAJOR (1.0.0 → 2.0.0)
```

---

## 5️⃣ SEMANTIC VERSIONING DECISION ALGORITHM

### Version Bump Decision Tree

```
NEW_VERSION_NEEDED():

1. Is this a semantic change?
   NO  → No version bump needed
   YES → Continue
   
2. Does it affect backward compatibility?
   NO  → Continue
   YES → Go to MAJOR DECISION
   
3. Is core meaning preserved?
   NO  → Go to MAJOR DECISION
   YES → Continue
   
4. Is this a bug fix or clarification?
   YES → PATCH (1.0.0 → 1.0.1)
   NO  → Continue
   
5. Is this refinement or extension?
   YES → MINOR (1.0.0 → 1.1.0)
   NO  → Go to MAJOR DECISION
   
MAJOR DECISION:
  Is this a significant redefinition?
  YES → MAJOR (1.0.0 → 2.0.0)
  
  Is this a complete domain shift?
  YES → MAJOR (1.0.0 → 2.0.0)
  
  Is this incompatible with old consumers?
  YES → MAJOR (1.0.0 → 2.0.0)
  
  Default → MINOR (1.0.0 → 1.1.0)
```

### Version Bump Heuristics

```
PATCH indicators:
  • Only documentation changed
  • Typos fixed
  • Notation clarified
  • No semantic change
  • No formula change
  • 100% backward compatible

MINOR indicators:
  • Definition refined (same core)
  • New related variant introduced
  • Extended domain application
  • New formula variant (same phenomenon)
  • Additional constraints documented
  • New aliases added
  • Backward compatible (old formula valid)

MAJOR indicators:
  • Complete redefinition
  • Incompatible formula change
  • Fundamental physics change
  • Breaking consumer code
  • Domain completely shifted
  • New mathematical framework
  • NOT backward compatible

RED FLAGS for MAJOR:
  🚩 "Now we understand stress is actually..."
  🚩 "Turns out pressure formula was wrong..."
  🚩 "New standard requires completely different..."
  🚩 "This applies to solids, not fluids..."
  🚩 "Formula becomes tensor instead of scalar..."
  🚩 "Domain changed from engineering to physics..."
```

---

## 6️⃣ VERSIONING AND REGISTRY INTEGRATION

### Registry Versioning Record

```
semantic_entity = {
  semantic_id: "physics.solids.stress",
  
  # Current active version
  semantic_version: "1.1.0",
  definition: {...},
  
  # Complete version history
  version_history: [
    {
      version: "1.0.0",
      created: 2025-01-15,
      definition: "Force per unit area acting on material",
      formula: σ = F / A,
      status: RELEASED,
      immutable: true,
    },
    {
      version: "1.0.1",
      created: 2025-03-20,
      change: "Typo fix: solud → solid",
      previous_version: "1.0.0",
      change_type: PATCH,
      status: RELEASED,
      immutable: true,
    },
    {
      version: "1.1.0",
      created: 2025-06-20,
      change: "Introduced shear stress variant",
      previous_version: "1.0.1",
      change_type: MINOR,
      status: RELEASED,
      immutable: true,
    },
  ],
  
  # Current version details
  status: ACTIVE,
  stability: STABLE,
  compatibility_baseline: "1.0.0",
  immutable: true,
}
```

### Version Query API

```
# Get current version
get_current_version(semantic_id) → version

# Get all versions
get_version_history(semantic_id) → [versions]

# Get specific version
get_version(semantic_id, version) → semantic_entity

# Check backward compatibility
is_backward_compatible(semantic_id, v1, v2) → boolean

# Get migration path for MAJOR bump
get_migration_path(semantic_id, from_version) → migration_guide

# Find all MAJOR breaks
find_breaking_changes(semantic_id) → [major_bumps]

# Verify version consistency
verify_version_integrity(registry) → {issues, warnings}
```

---

## 7️⃣ VERSIONING GOVERNANCE

### Versioning Authority

```
PATCH decisions:
  Authority: Single semantic reviewer
  Approval: Self-approval sufficient
  Review: Quick (1 day)
  
MINOR decisions:
  Authority: Domain expert reviewer
  Approval: Domain expert sign-off required
  Review: Standard (3 days)
  
MAJOR decisions:
  Authority: Semantic governance board
  Approval: Board super-majority (5/6 required)
  Review: Full (7 days)
  Escalation: Allowed for contentious cases
```

### Versioning Immutability

```
IMMUTABLE:
  ✅ semantic_version number (never reuse)
  ✅ version_history (append-only)
  ✅ change_type (PATCH/MINOR/MAJOR marked immutably)
  ✅ approval record (who approved, when)
  ✅ previous_version linkage
  ✅ changelog text
  
NEVER:
  ❌ Change version number retroactively
  ❌ Delete version from history
  ❌ Rewrite changelog
  ❌ Modify approval record
  ❌ Change change_type designation
```

---

## 8️⃣ SEMANTIC VERSIONING EXAMPLES

### Example 1: Stress Evolution (Complete Versioning)

```
physics.solids.stress Versioning Timeline:

v1.0.0 (2025-01-15):
  definition: "Force per unit area acting on material"
  formula: σ = F / A
  status: RELEASED
  type: Atomic entity

v1.0.1 (2025-03-20):
  change: Typo fix (solud → solid)
  change_type: PATCH
  status: RELEASED
  backward_compatibility: ✅ FULL
  consumer_action: None required

v1.0.2 (2025-04-10):
  change: Added reference ASME B31.3-2020
  change_type: PATCH
  status: RELEASED
  backward_compatibility: ✅ FULL

v1.1.0 (2025-06-20):
  change: Introduced shear stress variant
  new_content:
    - τ = F_s / A (shear formula)
    - τ_max in cylindrical coordinates
  change_type: MINOR
  status: RELEASED
  backward_compatibility: ✅ FULL (normal stress unchanged)
  consumer_action: Optional (can ignore shear)

v1.1.1 (2025-08-30):
  change: Added piping domain alias (hoop_stress)
  change_type: PATCH
  status: RELEASED
  backward_compatibility: ✅ FULL

v1.2.0 (2025-10-15):
  change: Added domain-specific constraints
  new_content:
    - Structural: σ ≤ σ_yield
    - Piping: σ ≤ σ_allowable × safety_factor
    - Fatigue: σ_eff ≤ σ_endurance
  change_type: MINOR
  status: RELEASED
  backward_compatibility: ✅ FULL (constraints additive)
  consumer_action: Recommended (review constraints)

v2.0.0 (2026-03-20):
  change: Expanded to tensor representation
  breaking_change: YES
  new_content:
    - Scalar stress → tensor stress
    - σ: scalar [Pa] → σ: 3×3 matrix [Pa]
    - New formula: σ = [σ_ij] with eigenvalue analysis
  change_type: MAJOR
  status: RELEASED
  backward_compatibility: ❌ BREAKING
  migration_deadline: 2027-03-20
  consumer_action: REQUIRED migration
  migration_path: See MIGRATION_STRESS_v1_to_v2.md

v2.1.0 (2026-06-10):
  change: Added multi-axis failure criteria
  new_content:
    - von Mises equivalent: σ_eff = ...
    - Tresca criterion: τ_max = ...
    - Principal stress analysis
  change_type: MINOR
  status: RELEASED
  backward_compatibility: ✅ FULL (extends v2.0.0)
  consumer_action: Optional (can use basic tensor)
```

### Example 2: Pressure Versioning (Domain-Specific)

```
physics.fluids.pressure Versioning Timeline:

v1.0.0 (2025-02-01):
  definition: "Hydrostatic pressure in piping"
  formula: P = ρgh
  domain: piping_engineering
  status: RELEASED

v1.1.0 (2025-05-15):
  change: Added gauge vs absolute pressure distinction
  new_content:
    - P_gauge = P_absolute - P_atmosphere
    - Commonly used in HVAC (expressed as gauge)
    - Design calcs must use absolute
  change_type: MINOR
  backward_compatibility: ✅ FULL (original formula still valid)

v1.1.1 (2025-07-20):
  change: Added temperature correction factor
  new_content:
    - P_corrected = P_reference × (T_actual / T_reference)
  change_type: PATCH
  backward_compatibility: ✅ FULL

v2.0.0 (2026-01-10):
  change: Unified pressure concept (static + dynamic)
  breaking_change: YES
  new_formulas:
    - P_hydrostatic = ρgh
    - P_dynamic = ½ρv²
    - P_total = P_hydrostatic + P_dynamic (Bernoulli)
  change_type: MAJOR
  domain_expansion: piping_engineering → fluid_mechanics
  status: RELEASED
  backward_compatibility: ❌ BREAKING
  migration_deadline: 2027-01-10
  migration_path: Must account for dynamic pressure component
  migration_risk: HIGH (many piping calcs underestimate total pressure)
```

### Example 3: Modulus Versioning (Physics Change)

```
physics.materials.youngs_modulus Versioning Timeline:

v1.0.0 (2024-11-01):
  definition: "Elastic modulus for static loading"
  formula: E = σ / ε (Hooke's law)
  domain: structural_mechanics
  status: RELEASED

v1.1.0 (2025-04-15):
  change: Added temperature dependence
  new_content:
    - E(T) = E_ref - α(T - T_ref)
    - Temperature coefficient α for various materials
  change_type: MINOR
  backward_compatibility: ✅ FULL (constant E still valid)

v2.0.0 (2026-02-01):
  change: Complex modulus for dynamic loading
  breaking_change: YES
  new_formula: E(ω) = E'(ω) + i E''(ω)
  new_properties:
    - E': Storage modulus (elastic energy)
    - E'': Loss modulus (damping)
    - Frequency-dependent: E ≠ constant
  domain_expansion: structural → materials_science
  change_type: MAJOR
  status: RELEASED
  backward_compatibility: ❌ BREAKING
  migration_deadline: 2027-02-01
  migration_risk: CRITICAL (dynamic behavior completely different)
  note: v1.0.0 applies to static loading
        v2.0.0 applies to dynamic/cyclic loading
        These are DIFFERENT physical regimes
```

---

## 9️⃣ VERSIONING AND SEMANTIC IDENTITY

### Version Immutability

```
RULE: semantic_id is IMMUTABLE
      BUT semantic_version CHANGES

This means:
  ✅ Same semantic_id can have multiple versions
  ✅ Version captures evolution
  ✅ Complete history preserved
  ✅ Lineage tracked by version number
  
NOT:
  ❌ Different semantic_id for each version
  ❌ Versions are separate entities
  ❌ Lineage lost across versions
```

### Backward Compatibility Matrix

```
Version Compatibility:

                    Uses v1.0.0    Uses v1.1.0    Uses v2.0.0
Code for v1.0.0:        ✅            ✅            ❌
Code for v1.1.0:        ✅            ✅            ❌
Code for v2.0.0:        ❌            ❌            ✅

Key Rules:
  • Code written for v1.0.0 works with v1.1.0 (extended)
  • Code written for v1.1.0 may NOT work with v1.0.0 (if using new features)
  • Code written for v1.x CANNOT use v2.0.0 (breaking change)
  • Code written for v2.0.0 CANNOT use v1.x (incompatible)
```

---

## 🔟 SEMANTIC VERSIONING REVIEW GATE

### Pre-Release Checklist

```
Before releasing new semantic_version:

PATCH releases:
  [ ] Is this truly a bug fix / clarification?
  [ ] No semantic change involved?
  [ ] 100% backward compatible?
  [ ] Documentation/examples updated?
  [ ] Immutable record created?
  
MINOR releases:
  [ ] Is core meaning preserved?
  [ ] Backward compatible (old formulas valid)?
  [ ] Related concept, not new domain?
  [ ] Rationale documented?
  [ ] Migration guide provided (if relevant)?
  [ ] Immutable record created?
  
MAJOR releases:
  [ ] Governance board approval obtained (5/6)?
  [ ] Breaking change clearly documented?
  [ ] Migration path provided?
  [ ] Migration deadline set?
  [ ] Old version goes through deprecation?
  [ ] All consumers identified?
  [ ] Test migration plan created?
  [ ] Immutable record created (signed)?
```

---

## NEXT PHASES

This document establishes **SEMANTIC VERSIONING STANDARD** (Phase 3).

### Phase 4: SEMANTIC ALIASING STANDARD
Document: `SEMANTIC_ALIASING_STANDARD.md`
- Alias types and governance
- Multilingual alias strategy
- Notation aliases and collision detection
- Deprecated alias management

---

## CONCLUSION

**SEMANTIC VERSIONING STANDARD** provides:

✅ **PATCH:** Bug fixes / clarifications (100% backward compatible)  
✅ **MINOR:** Refinements / extensions (backward compatible)  
✅ **MAJOR:** Breaking changes (requires migration path)  
✅ **Versioning guarantees:** Consumers know impact  
✅ **Complete history:** All versions preserved  
✅ **Immutable record:** No version rewriting  
✅ **Migration paths:** Clear upgrade strategy  
✅ **Governance:** Authority aligned with change impact  

**Result:** Semantic evolution is controlled, documented, and reversible.

---

**Document Status:** 🟨 Semantic Versioning Standard (Phase 3)  
**Next Review:** Phase 4 (Semantic Aliasing) in progress
