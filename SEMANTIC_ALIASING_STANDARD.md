# SEMANTIC ALIASING STANDARD
## Multi-Domain, Multi-Language, Multi-Notation Access to Semantic Entities

**Status:** 🟨 SEMANTIC IDENTITY GOVERNANCE — PHASE 4  
**Date:** 2026-05-09  
**Version:** 1.0  
**Foundation:** SEMANTIC_IDENTITY_ARCHITECTURE.md + SEMANTIC_VERSIONING_STANDARD.md

---

## 🎯 EXECUTIVE SUMMARY

### The Aliasing Problem

Engineering domains use **different names for identical concepts**.

```
SAME ENTITY, MULTIPLE NAMES:

Stress (structural):
  English: "stress"
  Russian: "напряжение"
  Notation: σ, S, τ (shear)
  Domain: "axial_stress" (mechanical) vs "hoop_stress" (piping)

Pressure (fluids):
  English: "pressure"
  Notation: P, p
  Domain: "gauge_pressure" vs "absolute_pressure"
  Domain: "hydrostatic_pressure" vs "dynamic_pressure"

Without aliasing governance:
  ❌ AI parser sees "hoop_stress" and "stress" as different
  ❌ Multilingual corpus fragments
  ❌ Notation variants cause confusion
  ❌ Domain-specific terms create islands
```

### The Solution

**SEMANTIC ALIASING STANDARD** — unified access, stable identity.

```
ALIAS GOVERNANCE:

CREATE
  ├─ Domain alias
  ├─ Language alias
  ├─ Notation alias
  └─ Deprecated alias

REGISTER
  └─ Alias in registry
     └─ Indexed for search
     └─ Semantic linking aware

MANAGE
  ├─ Alias versioning (with entity version)
  ├─ Deprecated alias pathway
  └─ Alias collision detection

PROTECT
  ├─ Aliases don't confuse entities
  ├─ Deprecated aliases have replacements
  └─ Immutable alias history
```

---

## 1️⃣ ALIAS TYPES

### Type 1: Domain Alias

Different engineering disciplines use different terminology for **same concept**.

```
EXAMPLE: Stress in different domains

Structural Engineering:
  Term: "axial_stress" / "normal_stress"
  Formula: σ = F / A
  Usage: Column buckling, beam design
  Standard: AISC Steel Construction Manual

Piping Engineering:
  Term: "hoop_stress" / "circumferential_stress"
  Formula: σ_h = P × D / (2 × t)
  Usage: Vessel wall, pipe thickness calc
  Standard: ASME B31.3

Mechanical Engineering:
  Term: "principal_stress"
  Formula: σ = eigenvalue(stress_tensor)
  Usage: Multi-axial failure analysis
  Standard: Machine design codes

SAME ENTITY: physics.solids.stress
DIFFERENT DOMAIN ALIASES:
  axial_stress (structural)
  hoop_stress (piping)
  principal_stress (mechanical)

Alias Registry Entry:
  domain_alias = {
    alias_name: "hoop_stress",
    semantic_id: "physics.solids.stress",
    domain: piping_engineering,
    reference: "ASME B31.3 Section 302.2.1",
    context: "Circumferential stress in cylindrical pressure vessels",
    formula_variant: "σ_h = P × D / (2 × t)",
    created: 2026-01-15,
    creator: piping-standards-board,
    immutable: true,
  }
```

### Type 2: Language Alias

Engineering concepts have **multilingual names**.

```
EXAMPLE: Stress in different languages

English: "stress"
Russian: "напряжение"
Spanish: "esfuerzo"
German: "Spannung"
French: "contrainte"
Chinese: "应力"
Arabic: "الإجهاد"

SAME ENTITY: physics.solids.stress
DIFFERENT LANGUAGE ALIASES:
  (All point to identical semantic identity)

Alias Registry Entry:
  language_alias = {
    alias_name: "напряжение",
    semantic_id: "physics.solids.stress",
    language: Russian,
    transliteration: "naprjazheniye",
    created: 2026-02-20,
    creator: russian-engineering-board,
    immutable: true,
  }

Benefits:
  ✅ Multilingual corpus unified
  ✅ Russian engineers find same entity
  ✅ Spanish engineers find same entity
  ✅ Semantic linking language-independent
```

### Type 3: Notation Alias

Mathematical notation varies **by context and convention**.

```
EXAMPLE: Stress notation variants

Standard notation: σ (sigma)
Older notation: S
Shear stress: τ (tau)
Complex notation: σ = [σ_ij] (tensor)

SAME ENTITY: physics.solids.stress
DIFFERENT NOTATION ALIASES:
  σ (canonical, most common)
  S (older textbooks)
  τ (when referring to shear)

Alias Registry Entry:
  notation_alias = {
    alias_name: "S",
    semantic_id: "physics.solids.stress",
    notation_type: "older_convention",
    frequency: "rare (5% of corpus)",
    reference: "Pre-2000 engineering textbooks",
    created: 2026-03-10,
    creator: semantics-team,
    note: "Discourage new use (use σ instead)",
    immutable: true,
  }

HIGH-RISK NOTATIONS:
  🚩 "P" for pressure vs "p" for shear stress
  🚩 "E" for Young's modulus vs "E'" for complex modulus
  🚩 "σ" for stress vs "S" for compliance (inverse)
  
Detection:
  COLLISION_RISK(alias_name) → potential confusions
```

### Type 4: Deprecated Alias

**Old names** should be tracked, not deleted.

```
EXAMPLE: Deprecated alias

Old term (v1.0.0): "hoop_strength"
New term (v1.1.0): "hoop_stress"

Reason: "Strength" implies failure limit
        "Stress" is more precise (actual force/area)

Deprecated Alias Entry:
  deprecated_alias = {
    old_alias: "hoop_strength",
    semantic_id: "physics.solids.stress",
    deprecated_date: 2026-04-01,
    deprecated_by: standards-review-board,
    reason: "Terminology precision: stress ≠ strength",
    replacement_alias: "hoop_stress",
    migration_deadline: 2026-10-01,
    immutable: true,
  }

Deprecation Timeline:
  2026-04-01: DEPRECATED_WARNING (old name still works)
  2026-07-01: DEPRECATED_MANDATORY (new code must use new name)
  2026-10-01: DEPRECATED_ARCHIVED (old name removed, historical only)

Search Impact:
  Searching for "hoop_strength":
    ✅ Found: "Did you mean 'hoop_stress'?"
    ✅ Returns replacement
    ✅ Shows deprecation notice
```

---

## 2️⃣ ALIAS GOVERNANCE RULES

### Rule A1: Alias-to-Entity Relationship

```
ONE semantic_id: MANY aliases

physics.solids.stress
  ├─ Domain aliases:
  │   ├─ axial_stress (structural)
  │   ├─ hoop_stress (piping)
  │   └─ principal_stress (mechanical)
  ├─ Language aliases:
  │   ├─ stress (English)
  │   ├─ напряжение (Russian)
  │   ├─ esfuerzo (Spanish)
  │   └─ 应力 (Chinese)
  ├─ Notation aliases:
  │   ├─ σ (standard)
  │   ├─ S (older)
  │   └─ τ (shear variant)
  └─ Deprecated aliases:
      ├─ hoop_strength → replaced by hoop_stress
      └─ normal_force_per_area → replaced by stress

Reverse Index (by alias):
  hoop_stress → physics.solids.stress
  σ → physics.solids.stress
  "напряжение" → physics.solids.stress
  esfuerzo → physics.solids.stress
  (all point to same entity)
```

### Rule A2: Alias Uniqueness Within Domain

```
UNIQUENESS CONSTRAINT:
  No two aliases with same name in SAME domain
  
EXAMPLE:

Structural domain:
  ✅ axial_stress → physics.solids.stress (unique)
  ✅ bending_stress → physics.solids.stress (unique)
  ❌ stress → physics.solids.stress (TOO GENERIC)
     (conflicts with generic "stress" term)

Piping domain:
  ✅ hoop_stress → physics.solids.stress (unique)
  ✅ longitudinal_stress → physics.solids.stress (unique)
  ❌ pressure → physics.fluids.pressure (different entity!)
     (would be different semantic_id)

Language domain:
  ✅ "stress" (English) → physics.solids.stress (unique)
  ✅ "напряжение" (Russian) → physics.solids.stress (unique)
  ❌ "S" (notation) in multiple languages? ALLOWED
     (notation aliases not language-specific)

Collision Detection:
  REGISTER_ALIAS(alias_name, domain, semantic_id):
    if alias_name in registry.by_alias[domain]:
      return ERROR: "Alias already used in this domain"
    else:
      register and proceed
```

### Rule A3: No Dangerous Confusions

```
DANGEROUS CONFUSION DETECTION:

High-risk confusion patterns:
  🚩 Stress vs Pressure (identical notation risk, different meaning)
  🚩 Torque vs Energy (identical dimension [M¹ L² T⁻²])
  🚩 Kinematic vs Dynamic Viscosity (both "viscosity", different dimension)
  🚩 Gauge vs Absolute Pressure (same units, different baseline)

PROTECTION:

Before registering alias:
  CHECK_CONFUSION(alias_name):
    dimensionally_equivalent = get_entities_by_dimension(alias_dim)
    for candidate in dimensionally_equivalent:
      if DANGEROUS_CONFUSION(alias, candidate):
        return RISK_HIGH
        → Escalate to governance board
        → Require explicit clarification in alias
        → Document risk in registry

Example Safe Aliases:
  "hoop_stress" → physics.solids.stress
    NOT confused with pressure (explicit domain)
  
  "gauge_pressure" → physics.fluids.pressure
    NOT confused with absolute_pressure (explicit variant)
    Alias includes "gauge_" prefix (clarity)

Example Dangerous Aliases (REJECTED):
  "pressure" as alias for physics.solids.stress
    🚩 HIGH RISK: confuses stress and pressure
    → REJECTED
    → Use "normal_stress" instead (explicit)
    
  "E" as alias for Young's modulus
    🚩 HIGH RISK: same notation as complex modulus
    → REJECTED if complex modulus also in corpus
    → Use "youngs_modulus" (explicit)
```

### Rule A4: Alias-Version Coupling

```
ALIASES EVOLVE WITH SEMANTIC_VERSION:

Alias lifecycle:
  v1.0.0:
    aliases: [σ, S, stress]
  
  v1.1.0:
    aliases: [σ, S, stress, axial_stress, shear_stress]
    (new aliases added in MINOR version)
  
  v1.2.0:
    aliases: [σ, S, stress, axial_stress, shear_stress, hoop_stress]
    (piping domain alias added)
    deprecated_aliases: [S → discourage]

  v2.0.0:
    aliases: [σ, τ, stress_tensor, ...]
    (redesigned for tensor representation)
    deprecated_aliases: [S, (scalar) stress] → replaced by stress_tensor

Key Rule:
  Aliases are APPENDED to version history
  Not deleted or rewritten
  Complete lineage preserved
  Each version has immutable alias set
```

### Rule A5: Deprecated Alias Immutability

```
DEPRECATED ALIASES MUST:

  ✅ Include replacement path
  ✅ Include deprecation reason
  ✅ Include timeline
  ✅ Be searchable with deprecation notice
  ✅ Be completely immutable (no edits)

DEPRECATED ALIASES MUST NOT:

  ❌ Disappear from registry
  ❌ Be retroactively deleted
  ❌ Lose audit trail
  ❌ Appear as if they never existed
  ❌ Create orphaned references

Deprecated Alias Record:
  {
    old_alias: "hoop_strength",
    deprecated_date: 2026-04-01,
    replacement: "hoop_stress",
    reason_text: "Terminology refinement",
    timeline: {
      warning_start: 2026-04-01,
      mandatory_start: 2026-07-01,
      archive_start: 2026-10-01,
    },
    immutable_lock: true,
    signed: true,
  }

Search Behavior:
  User searches for "hoop_strength":
    Result 1: DEPRECATED "hoop_strength" (v1.0.0-v1.0.5)
    Suggestion: Did you mean "hoop_stress" (v1.1.0+)?
    Message: "Deprecated 2026-04-01, use 'hoop_stress' instead"
    Link: Show replacement in current version
```

---

## 3️⃣ ALIAS REGISTRY STRUCTURE

### Alias Index

```
registry.aliases = {
  by_name: {
    "stress": physics.solids.stress,
    "pressure": physics.fluids.pressure,
    "hoop_stress": physics.solids.stress,
    "напряжение": physics.solids.stress,
    "esfuerzo": physics.solids.stress,
    σ: physics.solids.stress,
    "τ": physics.solids.stress,
    "axial_stress": physics.solids.stress,
    ...
  },
  
  by_semantic_id: {
    "physics.solids.stress": [
      { alias: "stress", type: "language", language: "English" },
      { alias: "σ", type: "notation", notation: "standard" },
      { alias: "S", type: "notation", notation: "deprecated" },
      { alias: "hoop_stress", type: "domain", domain: "piping" },
      { alias: "напряжение", type: "language", language: "Russian" },
      { alias: "axial_stress", type: "domain", domain: "structural" },
      ...
    ],
  },
  
  by_domain: {
    structural_engineering: [
      { alias: "axial_stress", semantic_id: "physics.solids.stress" },
      { alias: "bending_stress", semantic_id: "physics.solids.stress" },
      { alias: "shear_stress", semantic_id: "physics.solids.stress" },
      ...
    ],
    piping_engineering: [
      { alias: "hoop_stress", semantic_id: "physics.solids.stress" },
      { alias: "gauge_pressure", semantic_id: "physics.fluids.pressure" },
      ...
    ],
  },
  
  by_language: {
    English: ["stress", "pressure", ...],
    Russian: ["напряжение", "давление", ...],
    Spanish: ["esfuerzo", "presión", ...],
  },
  
  deprecated: {
    "hoop_strength": {
      semantic_id: "physics.solids.stress",
      replacement: "hoop_stress",
      deprecated_date: 2026-04-01,
      status: DEPRECATED_WARNING,
    },
    ...
  },
}
```

### Collision Detection Index

```
# High-risk aliases (need explicit clarification)
registry.dangerous_confusions = {
  "pressure": [
    physics.solids.stress,
    physics.fluids.pressure,
    (identical dimension risk)
  ],
  "E": [
    physics.materials.youngs_modulus,
    physics.materials.complex_modulus,
    (notation collision)
  ],
  "viscosity": [
    physics.fluids.kinematic_viscosity,
    physics.fluids.dynamic_viscosity,
    (terminology collision, different dimension)
  ],
}

Detection Method:
  When registering new alias:
    dimensionally_equivalent = get_by_dimension(alias)
    notation_equivalent = get_by_notation(alias)
    terminology_equivalent = get_by_partial_match(alias)
    
    if any significant overlap:
      return RISK_DETECTED
      → require explicit domain/notation in alias
      → escalate to governance
```

---

## 4️⃣ ALIAS REGISTRATION WORKFLOW

### Workflow Steps

```
1. SUBMISSION
   Reviewer submits alias with:
     - Alias name
     - Alias type (domain/language/notation/deprecated)
     - Semantic entity (semantic_id)
     - Domain/language/notation specification
     - Justification/context
     - References (standard, textbook, common usage)

2. VALIDATION
   System checks:
     - Alias uniqueness within domain
     - No dangerous confusion
     - Proper formatting
     - Complete required fields
   
   If validation fails:
     → Return for revision
   
   If validation passes:
     → Continue to review

3. REVIEW
   Domain expert reviews:
     - Is this a real, documented usage?
     - References valid?
     - Context correct?
     - No confusion risk?
   
   Authority levels:
     - PATCH/new alias: Single reviewer
     - Cross-domain alias: Domain board
     - Dangerous confusion: Full governance board

4. APPROVAL
   Reviewer signs off:
     - Approval date
     - Approver name/ID
     - Immutable authorization

5. REGISTRATION
   Alias added to registry:
     - Indexed by name, semantic_id, domain, language
     - Immutable record created
     - Signed and timestamped

6. VERSIONING
   Alias versioned with semantic entity:
     - If adding alias to v1.1.0
     - Becomes part of v1.1.0 alias set
     - If new version needed, creates v1.2.0

7. COMMUNICATION
   Notify:
     - All systems using semantic entity
     - Search indexes updated
     - Semantic linking aware
     - Documentation updated
```

### Deprecated Alias Registration

```
1. SUBMISSION
   Reviewer identifies deprecated alias:
     - Old alias name
     - Semantic entity affected
     - Reason for deprecation
     - Replacement alias
     - Timeline (warning → mandatory → archive)

2. DEPRECATION BOARD REVIEW
   Board verifies:
     - Replacement clear
     - Timeline reasonable
     - All old code can migrate
     - No orphaned references

3. DEPRECATION NOTICE
   Published timeline:
     T+0: DEPRECATED_WARNING (old name still works, recommendation to migrate)
     T+3mo: DEPRECATED_MANDATORY (new code must use new name)
     T+6mo: DEPRECATED_ARCHIVED (old name read-only historical)

4. IMMUTABLE DEPRECATION RECORD
   Registry locked with:
     - Old alias name
     - Replacement path
     - Timeline fixed
     - Complete audit trail

5. SEARCH BEHAVIOR UPDATE
   Search index updated:
     - Old alias searches show deprecation notice
     - Automatically suggest replacement
     - Show timeline
```

---

## 5️⃣ ALIAS LIFECYCLE EXAMPLES

### Example 1: Domain Alias Addition

```
SCENARIO: Piping engineers use "hoop_stress" for circumferential stress

SUBMISSION:
  Reviewer (piping-standards-group) submits:
    alias: "hoop_stress"
    semantic_id: "physics.solids.stress"
    type: domain_alias
    domain: piping_engineering
    context: "Circumferential stress in cylindrical pressure vessels"
    formula: σ_h = P × D / (2 × t)
    reference: ASME B31.3-2020 Section 302.2.1
    justification: "Standard piping terminology, used in 95% of piping codes"

VALIDATION:
  ✅ Alias unique in piping domain
  ✅ No collision with physics.fluids.pressure
  ✅ Complete required fields
  ✅ Reference valid

REVIEW:
  Piping domain expert approves:
    "Verified ASME usage, legitimate domain-specific term"

REGISTRATION:
  Alias added to registry:
    {
      alias_name: "hoop_stress",
      semantic_id: "physics.solids.stress",
      type: domain_alias,
      domain: piping_engineering,
      version_added: 1.1.0,
      created: 2026-03-15,
      created_by: piping-standards-group,
      reference: "ASME B31.3-2020",
      immutable: true,
      signed: true,
    }

VERSIONING:
  Version updated: 1.1.0
  Added to alias list of v1.1.0
  Indexed for search: "hoop_stress" → physics.solids.stress

RESULT:
  ✅ Domain alias registered
  ✅ Searchable by piping engineers
  ✅ Semantic linking aware
  ✅ Immutable record created
```

### Example 2: Language Alias Addition

```
SCENARIO: Russian corpus needs Russian term for stress

SUBMISSION:
  Reviewer (russian-engineering-association) submits:
    alias: "напряжение"
    semantic_id: "physics.solids.stress"
    type: language_alias
    language: Russian
    transliteration: "naprjazheniye"
    context: "Standard Russian engineering term"
    reference: "GOST standards, Russian textbooks"

VALIDATION:
  ✅ Language alias unique (Russian)
  ✅ No conflicts with existing terms
  ✅ Complete required fields

REVIEW:
  Russian language expert approves:
    "Standard term in Russian engineering, verified against GOST"

REGISTRATION:
  {
    alias_name: "напряжение",
    semantic_id: "physics.solids.stress",
    type: language_alias,
    language: Russian,
    transliteration: "naprjazheniye",
    version_added: 1.1.0,
    created: 2026-02-20,
    created_by: russian-engineering-association,
    immutable: true,
    signed: true,
  }

INDEXING:
  registry.by_language["Russian"].add("напряжение")
  registry.by_name["напряжение"] = "physics.solids.stress"
  Semantic linking now language-independent

RESULT:
  ✅ Russian engineers can search for "напряжение"
  ✅ Same semantic entity as English "stress"
  ✅ Multilingual corpus unified
  ✅ Immutable record created
```

### Example 3: Notation Alias Addition

```
SCENARIO: Older textbooks use "S" for stress, need backward compatibility

SUBMISSION:
  Reviewer (semantics-team) submits:
    alias: "S"
    semantic_id: "physics.solids.stress"
    type: notation_alias
    notation: older_convention
    frequency: "5% of historical corpus"
    context: "Pre-2000 engineering textbooks use S for stress"
    note: "Modern convention prefers σ (sigma)"

VALIDATION:
  ⚠️  WARNING: "S" also used for compliance (inverse of stiffness)
  → Check for confusion risk
  → Need explicit differentiation

REVIEW:
  Board notes confusion risk:
    "S has dual meaning (stress vs compliance)"
    "Can only be resolved by context"
    Recommendation: Add note "Use σ in new work"

REGISTRATION:
  {
    alias_name: "S",
    semantic_id: "physics.solids.stress",
    type: notation_alias,
    notation: "older_convention",
    frequency: "rare (5%)",
    status: "discouraged_in_new_work",
    confusion_note: "S also used for compliance (inverse); resolve by context",
    version_added: 1.1.0,
    created: 2026-03-10,
    created_by: semantics-team,
    note: "Support legacy documents; recommend σ for new work",
    immutable: true,
  }

RESULT:
  ✅ Legacy documents understood
  ✅ Confusion noted explicitly
  ✅ New code discouraged from using "S"
  ✅ Immutable record with warning
```

### Example 4: Deprecated Alias Removal

```
SCENARIO: "hoop_strength" is imprecise, replacing with "hoop_stress"

SUBMISSION:
  Reviewer (standards-board) submits:
    old_alias: "hoop_strength"
    semantic_id: "physics.solids.stress"
    reason: "Terminology precision: 'strength' implies failure limit, 'stress' is actual force/area"
    replacement: "hoop_stress"
    timeline:
      warning_start: 2026-04-01
      mandatory_start: 2026-07-01
      archive_start: 2026-10-01

REVIEW:
  Board approves:
    "Terminology distinction is valid and important"
    "6-month migration window is reasonable"
    "Clear replacement path"

REGISTRATION:
  Old entry marked deprecated:
    {
      old_alias: "hoop_strength",
      semantic_id: "physics.solids.stress",
      type: deprecated_alias,
      replacement: "hoop_stress",
      deprecated_date: 2026-04-01,
      reason: "Terminology precision: stress ≠ strength",
      timeline: {
        warning: "2026-04-01 to 2026-07-01",
        mandatory: "2026-07-01 to 2026-10-01",
        archive: "2026-10-01+",
      },
      immutable: true,
      signed: true,
    }

SEARCH BEHAVIOR:
  User searches "hoop_strength":
    Result: ⚠️ DEPRECATED (use "hoop_stress" instead)
    Timeline: Must migrate by 2026-07-01
    Link: Show "hoop_stress" (current alias)

VERSIONING:
  v1.0.0 - v1.0.5: "hoop_strength" active
  v1.1.0+: "hoop_stress" active
            "hoop_strength" marked deprecated

TIMELINE:
  2026-04-01: Warning (old name still works)
  2026-07-01: Mandatory (new code must use new name)
  2026-10-01: Archived (old name read-only)

RESULT:
  ✅ Graceful migration path
  ✅ Backward compatibility window
  ✅ Clear timeline
  ✅ Immutable deprecation record
  ✅ Complete audit trail
```

---

## 6️⃣ DANGEROUS ALIAS PATTERNS

### Pattern 1: Notation Collision

```
HIGH-RISK: Same notation for different meanings

E:
  Young's modulus: E = σ / ε (static)
  Complex modulus: E(ω) = E'(ω) + i E''(ω) (dynamic)
  Completely different!

P:
  Pressure: P = F / A
  Power: P = F × v
  Completely different!

σ:
  Stress: normal force per area
  Conductivity: σ (electrical)
  Completely different!

PROTECTION:
  Before registering notation alias "E":
    existing_E = get_entities_by_notation("E")
    if len(existing_E) > 1:
      return RISK_HIGH
      → Require clarification
      → Example: "E_youngs" instead of "E"
      → Or: separate entities (E, E_complex)
```

### Pattern 2: Terminology Collision

```
HIGH-RISK: Same term for different entities

"Pressure":
  ❌ Use as alias for BOTH:
     physics.fluids.pressure AND
     physics.solids.stress
  
  These are DIFFERENT entities!
  Same dimension, different meaning

PROTECTION:
  Before registering alias "pressure":
    dimensionally_equivalent = get_by_dimension([M L⁻¹ T⁻²])
    # Returns: stress, pressure, modulus, etc.
    if len(dimensionally_equivalent) > 2:
      return RISK_HIGH
      → Require explicit domain in alias
      → "hydrostatic_pressure" instead of "pressure"
      → "stress_tensor" instead of generic "stress"
```

### Pattern 3: Partial Match Collision

```
HIGH-RISK: Similar names for different entities

"viscosity" (generic):
  ❌ Ambiguous - could mean:
     kinematic viscosity ν [L² T⁻¹]
     dynamic viscosity η [M L⁻¹ T⁻¹]
     completely different dimensions!

PROTECTION:
  Before registering alias "viscosity":
    Check if other entities have similar names
    Require explicit alias:
      "kinematic_viscosity" (ν, [L² T⁻¹])
      "dynamic_viscosity" (η, [M L⁻¹ T⁻¹])
```

---

## 7️⃣ ALIAS VALIDATION CHECKLIST

### Pre-Registration Checklist

```
DOMAIN ALIAS:
  [ ] Alias name specific to domain?
  [ ] Usage documented in domain standard?
  [ ] No confusion with other domains?
  [ ] Reference provided (ASME, ISO, etc.)?
  [ ] Correct semantic_id identified?
  [ ] Dimensional equivalence verified?

LANGUAGE ALIAS:
  [ ] Native speaker verified?
  [ ] Standard term in that language?
  [ ] Translation documented?
  [ ] No collisions within language?
  [ ] Multilingual indexing ready?

NOTATION ALIAS:
  [ ] Mathematical notation correct?
  [ ] No collision with other notations?
  [ ] Frequency of use documented?
  [ ] Confusion risks identified?
  [ ] Clarification text provided (if risky)?

DEPRECATED ALIAS:
  [ ] Replacement alias provided?
  [ ] Reason clear and documented?
  [ ] Timeline specified (3-6 months)?
  [ ] Migration path documented?
  [ ] All old usage identified?
  [ ] New code policy communicated?

DANGEROUS CONFUSION ASSESSMENT:
  [ ] Dimensionally equivalent check?
  [ ] Notation collision check?
  [ ] Terminology collision check?
  [ ] Cross-domain confusion check?
  [ ] Risk level assessed (LOW/MEDIUM/HIGH)?
  [ ] If HIGH: governance board escalated?
```

---

## 8️⃣ ALIAS GOVERNANCE AUTHORITY

### Approval Authority

```
DOMAIN ALIAS:
  Authority: Domain expert reviewer (single)
  Review time: 2 days
  Escalation: If high-risk confusion → full board

LANGUAGE ALIAS:
  Authority: Native speaker + language coordinator
  Review time: 3 days
  Escalation: If new language expansion → board

NOTATION ALIAS:
  Authority: Mathematical notation expert
  Review time: 2 days
  Escalation: If collision risk → full board

DEPRECATED ALIAS:
  Authority: Semantic governance board (5/6)
  Review time: 5 days
  Escalation: Always board-level (affects consumers)
```

---

## NEXT PHASES

This document establishes **SEMANTIC ALIASING STANDARD** (Phase 4).

### Phase 5: SEMANTIC SPLIT/MERGE GOVERNANCE
Document: `SEMANTIC_SPLIT_MERGE_GOVERNANCE.md`
- Formal criteria for splitting semantic entities
- Formal process for merging entities
- Historical preservation (old entities archived)

---

## CONCLUSION

**SEMANTIC ALIASING STANDARD** provides:

✅ **Domain aliases:** Different engineering disciplines, same entity  
✅ **Language aliases:** Multilingual access, unified corpus  
✅ **Notation aliases:** Multiple symbols for same concept  
✅ **Deprecated aliases:** Safe retirement with replacement path  
✅ **Collision detection:** Dangerous confusions prevented  
✅ **Governance:** Authority aligned with alias risk  
✅ **Immutable history:** All aliases and deprecations tracked  
✅ **Search integration:** Aliases work transparently in search  

**Result:** Engineering corpus unified across domains, languages, and notations.

---

**Document Status:** 🟨 Semantic Aliasing Standard (Phase 4)  
**Next Review:** Phase 5 (Semantic Split/Merge Governance) in progress
