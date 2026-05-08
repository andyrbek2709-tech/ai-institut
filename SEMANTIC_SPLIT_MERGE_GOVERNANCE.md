# SEMANTIC SPLIT/MERGE GOVERNANCE
## Formal Process for Semantic Entity Transformation Events

**Status:** 🟨 SEMANTIC IDENTITY GOVERNANCE — PHASE 5  
**Date:** 2026-05-09  
**Version:** 1.0  
**Foundation:** SEMANTIC_IDENTITY_ARCHITECTURE.md + SEMANTIC_VERSIONING_STANDARD.md

---

## 🎯 EXECUTIVE SUMMARY

### The Problem

As engineering knowledge evolves, single semantic entities sometimes become **multiple distinct entities** (split), or multiple entities prove to be **semantically equivalent** (merge).

```
SPLIT SCENARIO:

Today:
  Stress (generic concept)
    σ = F / A
    Single semantic_id

Tomorrow:
  ASME introduces:
    σ_nominal = nominal stress (gross section)
    σ_effective = effective stress (multi-axial)
    σ_local = local stress (at concentration)
  
Question:
  SAME semantic identity?
  or THREE NEW entities?

Without governance:
  ❌ Silent split (entities diverge)
  ❌ Formulas become incompatible
  ❌ Semantic graph becomes inconsistent
  ❌ Lineage breaks

---

MERGE SCENARIO (Rare):

Today:
  physics.solids.stress (scalar)
  physics.solids.stress_tensor (tensor)
  Two separate entities

Tomorrow:
  Unified understanding:
    Tensor is more fundamental
    Scalar is special case of tensor
  
Question:
  Merge into one entity?

Without governance:
  ❌ Confusion about which to use
  ❌ Silent incompatibilities
  ❌ Lineage becomes circular
```

### The Solution

**SEMANTIC SPLIT/MERGE GOVERNANCE** — formal, auditable processes.

```
SPLIT GOVERNANCE:
  ✅ Formal justification criteria
  ✅ Governance board review
  ✅ New entities created with lineage
  ✅ Parent entity marked SPLIT_FROM
  ✅ Immutable split record
  ✅ Complete audit trail

MERGE GOVERNANCE:
  ✅ Formal justification criteria
  ✅ Full governance board review (rare)
  ✅ New unified entity created
  ✅ Old entities marked MERGED_INTO
  ✅ Immutable merge record
  ✅ Complete audit trail
```

---

## 1️⃣ SPLIT GOVERNANCE

### When to Split

Split is justified when **one semantic entity becomes multiple distinct entities**.

```
SPLIT CRITERIA (ALL must be true):

1. DIFFERENT FORMULAS
   Original: σ = F / A
   New entity 1: σ = F / A (nominal)
   New entity 2: σ_eff = von_Mises(σ₁, σ₂, σ₃)
   New entity 3: σ_local = K_t × σ_nominal
   → Different formulas prove distinction
   
2. DIFFERENT FAILURE MODES
   Original: Plastic deformation (ductile failure)
   New entity 1: Ductile yield (same)
   New entity 2: Brittle crack initiation (different)
   New entity 3: Stress concentration amplification (different)
   → Different physics warrants separate identities
   
3. DIFFERENT DESIGN STANDARDS
   Original: AISC Steel Design (one approach)
   New entity 1: AISC (nominal stress approach)
   New entity 2: Fracture mechanics (local stress, different standard)
   New entity 3: Multi-axial (von Mises, different standard)
   → Different regulatory frameworks
   
4. DIFFERENT DOMAIN APPLICATION
   Original: Structural mechanics only
   New entity 1: Structural (nominal)
   New entity 2: Materials science / Fatigue (local, effective)
   New entity 3: Mechanical / Pressure vessel (effective)
   → New domains require distinct identities
   
5. DOMAIN EXPERT CONSENSUS
   Engineering standards body agrees
   Academic consensus supports
   Practical usage validates
   → Broad agreement on distinction
```

### Split Governance Board

```
COMPOSITION:
  Chair: Chief Semanticist (permanent)
  Members (8):
    1. Structural engineering representative
    2. Materials science representative
    3. Mechanical engineering representative
    4. Thermal/fluid engineering representative
    5. Standards body liaison (ASME/ISO)
    6. AI/corpus integrity representative
    7. Domain expert (relevant to split)
    8. Semantic architecture lead

QUORUM: 6/8 members required

AUTHORITY LEVEL: HIGHEST
  Split decisions are major architectural changes
  Require full governance board consensus
  Cannot be delegated to domain reviewers
```

### Split Process (Formal)

```
PHASE 1: SUBMISSION (Week 1)

Proposer submits:
  1. Current entity description
     - semantic_id
     - current definition
     - current formula
  
  2. Proposed split justification
     - Why one entity becomes multiple?
     - Evidence (standards, papers, practical usage)
     - Different formulas (quantified)
     - Different failure modes (identified)
     - Different design standards (listed)
     - Different domains (specified)
  
  3. Proposed new entities
     - semantic_id for each
     - Definition for each
     - Formula for each
     - Domain for each
     - Lineage parent (original entity)
  
  4. Impact assessment
     - Formulas affected in corpus (count)
     - Domains impacted
     - Consumer migration burden
     - Timeline for migration

---

PHASE 2: INITIAL REVIEW (Week 2-3)

Split board reviews:
  1. Justification sufficiency
     Does evidence support split?
     Are criteria truly met?
  
  2. New entity definitions
     Are definitions complete (5 components)?
     Are they mutually exclusive?
     Do they cover all cases (no gaps)?
  
  3. Lineage correctness
     Parent clearly identified?
     Child entities properly scoped?
     No circular dependencies?
  
  4. Impact assessment
     Is migration burden acceptable?
     Timeline realistic?
     Consumer communication plan?
  
  Questions/Requests for clarification (if any):
    → Return to proposer for revision
    → Resubmit revised proposal

---

PHASE 3: EXPERT CONSULTATION (Week 3-4)

Board consults:
  1. Domain experts (structural, materials, etc.)
     "Is this split valid in your domain?"
  
  2. Standards bodies (ASME, ISO)
     "Do your standards support this distinction?"
  
  3. Corpus users
     "How many formulas would be affected?"
     "Can you migrate in the proposed timeline?"
  
  4. Academic consensus
     "Is this supported by research?"

---

PHASE 4: BOARD DISCUSSION & VOTE (Week 4)

Board meeting (in-person or virtual):
  1. Presentations
     - Proposer presents split rationale
     - Experts present their findings
  
  2. Discussion
     - Technical questions
     - Impact concerns
     - Timeline feasibility
     - Risk assessment
  
  3. Vote
     - Must achieve 6/8 super-majority
     - Vote recorded (immutable)
     - Each member justifies vote
  
  If rejected:
    → Return for revision with feedback
  
  If approved:
    → Proceed to Phase 5

---

PHASE 5: IMPLEMENTATION (Week 5-6)

1. Create immutable split record:
     split_event = {
       split_id: unique_id,
       original_entity_id: "physics.solids.stress",
       new_entity_ids: [
         "physics.solids.stress.nominal",
         "physics.solids.stress.effective",
         "physics.solids.stress.local",
       ],
       split_date: 2026-03-20,
       reason: "ASME 2026 standards distinguish nominal, effective, local stress",
       split_criteria_met: {
         different_formulas: true,
         different_failure_modes: true,
         different_design_standards: true,
         different_domains: true,
         expert_consensus: true,
       },
       board_vote: "6/8 approved",
       approved_by: semantic_split_governance_board,
       immutable: true,
       signed: true,
     }

2. Create new semantic entities:
     For each new entity:
       - Assign immutable semantic_id
       - Write complete definition
       - Document formula
       - Set version to 1.0.0
       - Set parent lineage to original entity
       - Create immutable creation record
       - Sign all records

3. Mark original entity:
     - Status: SPLIT_FROM
     - Lifecycle: Moved to DEPRECATED
     - Immutable record: updated with split reference

4. Registry update:
     - Add new entities
     - Update indices
     - Update search (old entity shows deprecation notice)

5. Communication:
     - Publish split notice
     - Migration guide created
     - Timeline announced
     - Consumer support established

---

PHASE 6: DEPRECATION & MIGRATION (Months 2-6)

Timeline:
  Month 1: SPLIT_NOTICE (informational)
  Month 2-3: SPLIT_WARNING (migration encouraged)
  Month 4-5: SPLIT_MANDATORY (new code must use new entities)
  Month 6+: SPLIT_ARCHIVED (old entity read-only)

Immutability:
  ✅ Split decision locked
  ✅ New entities locked
  ✅ Timeline fixed
  ✅ Migration path immutable
```

### Split Examples

#### Example 1: Stress Split (Complete)

```
ORIGINAL ENTITY (v1.1.0):
  semantic_id: physics.solids.stress
  definition: "Force per unit area acting on material"
  formula: σ = F / A
  variants: normal_stress, shear_stress
  domain: structural_engineering, materials_science

SPLIT JUSTIFICATION:

1. Different Formulas:
   Nominal:    σ = F / A (gross section)
   Effective:  σ_eff = √[½((σ₁-σ₂)² + ...)] (von Mises)
   Local:      σ = K_t × σ_nominal (stress concentration)
   → Three distinct formulas

2. Different Failure Modes:
   Nominal:    Ductile yield
   Effective:  Multi-axial failure (complex criterion)
   Local:      Crack initiation, fatigue (stress concentration)
   → Three different failure mechanisms

3. Different Design Standards:
   Nominal:    AISC (simple strength check)
   Effective:  von Mises criterion (materials)
   Local:      Fracture mechanics (fatigue codes)
   → Different regulatory frameworks

4. Different Domain Applications:
   Nominal:    Structural engineering (simple design)
   Effective:  Mechanical engineering (complex loading)
   Local:      Materials/Fatigue analysis (stress concentration)
   → Distinct engineering domains

NEW ENTITIES (CREATED):

1. physics.solids.stress.nominal (v1.0.0)
   definition: "Force per unit area in gross cross-section"
   formula: σ = F / A
   domain: structural_engineering
   standard: AISC Steel Construction Manual
   parent: physics.solids.stress (lineage)
   immutable: ✅ signed

2. physics.solids.stress.effective (v1.0.0)
   definition: "Equivalent uniaxial stress from multi-axial state"
   formula: σ_eff = √[½((σ₁-σ₂)² + (σ₂-σ₃)² + (σ₃-σ₁)²)]
   domain: materials_science
   standard: von Mises criterion
   parent: physics.solids.stress (lineage)
   immutable: ✅ signed

3. physics.solids.stress.local (v1.0.0)
   definition: "Stress at stress concentration due to geometry"
   formula: σ = K_t × σ_nominal
   domain: materials_science, fatigue_analysis
   standard: Fracture mechanics / Fatigue codes
   parent: physics.solids.stress (lineage)
   immutable: ✅ signed

ORIGINAL ENTITY (UPDATED):
  physics.solids.stress (v1.1.0) → SPLIT_FROM
  Status: DEPRECATED
  Children: [nominal, effective, local]
  Immutable split record created and signed

MIGRATION GUIDE:
  Old code: σ = F / A (ambiguous)
  New code: σ_nominal = F / A (explicit)
  
  Old code: σ (mixed contexts)
  New code: σ_nominal, σ_eff, or σ_local (specific)
  
  Timeline:
    Month 1: Notice published
    Month 2-3: Migrate non-critical code
    Month 4-5: Migrate critical code (mandatory)
    Month 6: Old entity archived
```

#### Example 2: Pressure Split (Hydrostatic vs Dynamic)

```
ORIGINAL ENTITY:
  semantic_id: physics.fluids.pressure
  definition: "Force per unit area exerted by fluid"
  formula: P = ρgh (hydrostatic only)
  domain: piping_engineering

SPLIT CRITERIA MET:

1. Different Formulas:
   Hydrostatic: P = ρgh (static fluid, constant)
   Dynamic: P = ½ρv² (moving fluid, velocity-dependent)

2. Different Physics:
   Hydrostatic: Weight of fluid column
   Dynamic: Kinetic energy of motion

3. Different Applications:
   Hydrostatic: Pipe sizing, vessel design (static)
   Dynamic: Flow control, aerodynamics (transient)

4. Standards Distinction:
   ASME B31.3 (hydrostatic)
   Aerodynamics / CFD (dynamic)

NEW ENTITIES:

1. physics.fluids.pressure.hydrostatic
   definition: "Pressure due to weight of fluid column"
   formula: P = ρgh
   domain: piping_engineering
   parent: physics.fluids.pressure

2. physics.fluids.pressure.dynamic
   definition: "Pressure due to fluid motion"
   formula: P = ½ρv²
   domain: aerodynamics
   parent: physics.fluids.pressure

IMPACT:
  Most piping formulas use hydrostatic
  Migration straightforward (rename to .hydrostatic)
```

---

## 2️⃣ MERGE GOVERNANCE

### When to Merge (Very Rare)

Merge is justified when **multiple entities prove to be semantically equivalent**.

```
MERGE CRITERIA (ALL must be true, and all VERY difficult to meet):

1. UNIFIED THEORY PROVES EQUIVALENCE
   Not just similarity, but mathematical equivalence
   One formula is special case of other
   Physics unifies the concepts
   Example: Scalar stress is special case of tensor stress
   
2. EQUIVALENT FAILURE MODES
   Entities fail in same way (not just similar)
   Failure prediction identical
   Design checks produce same result
   
3. IDENTICAL DOMAIN APPLICATION
   Same design standards apply
   Same regulatory framework covers both
   Interchangeable in practice
   
4. NO REMAINING DISTINCTION
   No formula variant
   No domain-specific aspect
   No historical reason to keep separate
   
5. UNANIMOUS EXPERT CONSENSUS
   All domain experts agree (not just majority)
   Standards bodies unified (not fragmented)
   Academic consensus complete
   
Example of High Bar:
  "Scalar stress" and "normal stress" could potentially merge
  BUT only after complete unification of physics understanding
  NOT just because they're related
```

### Merge Process (Formal, Rare)

```
PHASE 1: PROBLEM IDENTIFICATION (Rare)

Proposer identifies:
  Entity A: "physics.solids.stress"
  Entity B: "physics.solids.stress_tensor"
  
  Observation: Tensor is fundamental, scalar is special case
  Question: Should these be unified?

PHASE 2: RESEARCH PHASE (Extended, 4-8 weeks)

Full semantic research:
  1. Are these truly equivalent?
  2. Or just related?
  3. What would unification require?
  4. Would it break existing formulas?
  5. Is there any remaining reason to keep separate?

Consultation:
  - Domain experts across all using domains
  - Standards bodies
  - Academic researchers
  - Current code users

Result:
  - Detailed equivalence proof
  - Migration impact assessment
  - Risk analysis

PHASE 3: BOARD REVIEW (8+ weeks)

Merge governance board (full, 8 members):
  
  Standard: UNANIMOUS approval required
    (Not just super-majority, must be unanimous)
  
  Rationale: Merge is extremely rare, high-risk
  
  Analysis:
    - Is equivalence proof convincing?
    - Can all existing code migrate?
    - Are failure modes identical?
    - Is there ANY remaining reason to keep separate?
  
  If ANY board member:
    - Disagrees
    - Sees remaining distinction
    - Identifies unresolved issue
    → MERGE REJECTED

PHASE 4: IMPLEMENTATION (If Approved, Rare)

1. Create immutable merge record
2. Create unified entity
3. Mark both old entities as MERGED_INTO
4. Complete lineage chain
5. Migration plan for all code

PHASE 5: DEPRECATION & MIGRATION (6-12 months)

Old entities moved to read-only archive
Complete immutability of merge decision
```

### Merge Example (Hypothetical)

```
HYPOTHETICAL SCENARIO:

Currently:
  physics.solids.stress (scalar)
  physics.solids.stress_tensor (3×3 matrix)
  Treated as separate entities

Hypothetical discovery:
  New unified theory proves:
    Scalar stress = special case of tensor
    All failure criteria work in tensor form
    Scalar is just principal component
    No remaining distinction needed

Merge Criteria Analysis:

1. Unified theory: ✅ Proven (scalar = principal component)
2. Same failure modes: ✅ All use tensor formulation
3. Same domain: ✅ Both cover all engineering
4. No remaining distinction: ✅ Scalar redundant
5. Unanimous consensus: ✅ All experts agree

MERGE EXECUTION:

Merge record:
  merge_id: "stress.merge.001"
  original_entities: [
    "physics.solids.stress",
    "physics.solids.stress_tensor"
  ]
  unified_entity: "physics.solids.stress_unified"
  reason: "Unified theory: scalar is principal component of tensor"
  merge_date: hypothetical future
  approved_by: merge_governance_board (unanimous)

New unified entity:
  semantic_id: "physics.solids.stress_unified"
  definition: "Stress tensor with special case for scalar"
  formula_primary: σ = [3×3 tensor]
  formula_special_case: σ_scalar = √(eigenvalue(σ))
  lineage:
    merged_from: [scalar, tensor]
    merge_date: date
    merge_reason: unified theory

Old entities marked MERGED_INTO:
  physics.solids.stress → MERGED_INTO physics.solids.stress_unified
  physics.solids.stress_tensor → MERGED_INTO physics.solids.stress_unified
  Status: ARCHIVED (read-only)
  Access: Historical reference only

Migration path:
  All code converted to use unified entity
  Both old formulas work (special cases of unified)
  Timeline: 6-12 months
```

---

## 3️⃣ SPLIT/MERGE IMMUTABILITY

### Immutable Records

```
SPLIT IMMUTABILITY:

split_record = {
  split_id: "stress.split.001",
  original_entity_id: "physics.solids.stress",
  new_entity_ids: [...],
  split_date: ISO8601,
  reason_text: (complete rationale),
  split_criteria: {
    different_formulas: boolean,
    different_failure_modes: boolean,
    different_design_standards: boolean,
    different_domains: boolean,
    expert_consensus: boolean,
  },
  board_composition: [members who voted],
  vote_result: "6/8 approved",
  each_member_justification: {...},
  immutable_lock: true,
  cryptographic_hash: hash_of_record,
  signed_by: governance_board_chair,
  timestamp: ISO8601,
}

NEVER:
  ❌ Modify split record
  ❌ Delete split decision
  ❌ Hide vote details
  ❌ Rewrite rationale
  ❌ Unsplit entities

---

MERGE IMMUTABILITY:

merge_record = {
  merge_id: "stress.merge.001",
  original_entity_ids: [...],
  unified_entity_id: "physics.solids.stress_unified",
  merge_date: ISO8601,
  reason_text: (complete equivalence proof),
  equivalence_proof: (detailed technical proof),
  board_composition: [all 8 members],
  vote_result: "8/8 unanimous",
  each_member_signature: {...},
  immutable_lock: true,
  cryptographic_hash: hash_of_record,
  signed_by: [all board members],
  timestamp: ISO8601,
}

NEVER:
  ❌ Modify merge record
  ❌ Delete merge decision
  ❌ Hide any board member's dissent
  ❌ Rewrite equivalence proof
  ❌ Unmerge entities
```

---

## 4️⃣ SPLIT/MERGE DOCUMENTATION

### Split Documentation Package

```
DELIVERABLES after split approval:

1. SPLIT_DECISION_RECORD.md
   - Original entity details
   - Split justification (detailed)
   - New entities definitions
   - Board vote & rationale
   - Timeline
   - Immutable signatures

2. MIGRATION_GUIDE.md
   - Old formula → New entity mapping
   - Step-by-step migration process
   - Test plan for migrations
   - Timeline and deadlines
   - Support contact information

3. TECHNICAL_SPECIFICATION.md
   - New entity specifications
   - Formulas with derivations
   - Domain applications
   - Design standards applicability
   - Failure criteria

4. LINEAGE_DOCUMENTATION.md
   - Original entity lineage
   - Split event record
   - New entity lineages
   - Complete ancestor chain

All documents:
  ✅ Immutable
  ✅ Signed
  ✅ Timestamped
  ✅ Part of permanent record
```

### Merge Documentation Package (If rare event occurs)

```
DELIVERABLES after merge approval:

1. MERGE_DECISION_RECORD.md
   - Original entities details
   - Equivalence proof (detailed)
   - Unified entity definition
   - Unanimous board signatures
   - Immutable record

2. EQUIVALENCE_PROOF.md
   - Mathematical proof
   - Physics unification
   - Failure mode equivalence
   - Design standards unification
   - Peer review sign-off

3. MIGRATION_GUIDE.md
   - Both old formulas still work
   - How to migrate code
   - Verification procedures
   - Complete timeline

4. LINEAGE_DOCUMENTATION.md
   - Original entities lineages
   - Merge event record
   - Unified entity lineage
   - Complete history preserved
```

---

## 5️⃣ SPLIT/MERGE AND REGISTRY

### Registry Updates After Split

```
registry.entities:
  "physics.solids.stress":
    status: SPLIT_FROM
    split_date: 2026-03-20
    children: [nominal, effective, local]
    access: read-only (deprecated)
  
  "physics.solids.stress.nominal":
    status: ACTIVE
    version: 1.0.0
    parent: physics.solids.stress (split)
  
  "physics.solids.stress.effective":
    status: ACTIVE
    version: 1.0.0
    parent: physics.solids.stress (split)
  
  "physics.solids.stress.local":
    status: ACTIVE
    version: 1.0.0
    parent: physics.solids.stress (split)

registry.split_events:
  "stress.split.001": {
    original: "physics.solids.stress",
    children: [nominal, effective, local],
    date: 2026-03-20,
    immutable: true,
  }
```

### Registry Updates After Merge

```
registry.entities:
  "physics.solids.stress":
    status: MERGED_INTO
    merged_into: "physics.solids.stress_unified"
    merge_date: [date]
    access: read-only (archived)
  
  "physics.solids.stress_tensor":
    status: MERGED_INTO
    merged_into: "physics.solids.stress_unified"
    merge_date: [date]
    access: read-only (archived)
  
  "physics.solids.stress_unified":
    status: ACTIVE
    version: 1.0.0
    merged_from: [scalar, tensor]
    merge_date: [date]

registry.merge_events:
  "stress.merge.001": {
    original_entities: [scalar, tensor],
    unified_entity: "physics.solids.stress_unified",
    date: [date],
    immutable: true,
  }
```

---

## 6️⃣ SPLIT/MERGE VALIDATION

### Pre-Split Checklist

```
BEFORE split board approval:

Justification:
  [ ] Different formulas clearly documented
  [ ] Different failure modes identified
  [ ] Different design standards specified
  [ ] Different domains confirmed
  [ ] Domain expert consensus obtained
  [ ] Standards body input received

New Entities:
  [ ] Each has complete definition (5 components)
  [ ] Each has formula (specified, derived)
  [ ] Each has domain (clearly scoped)
  [ ] Each has version (1.0.0 assigned)
  [ ] Each has lineage (parent identified)
  [ ] No gaps (all cases covered by new entities)
  [ ] No overlap (entities mutually exclusive)

Impact Assessment:
  [ ] Affected formulas identified
  [ ] Migration path defined
  [ ] Timeline realistic
  [ ] Consumer communication prepared
  [ ] Support plan established

Immutability Preparation:
  [ ] Split record template prepared
  [ ] Digital signatures ready
  [ ] Timestamp service available
  [ ] Archive storage ready
```

### Pre-Merge Checklist

```
BEFORE merge board vote (all must pass for rare approval):

Equivalence Proof:
  [ ] Mathematical equivalence proven
  [ ] Physics completely unified
  [ ] No outstanding distinction
  [ ] Peer review completed
  [ ] All domain experts confirm

Failure Equivalence:
  [ ] Same failure criteria
  [ ] Same design checks
  [ ] Same safety factors
  [ ] Interchangeable in all applications

Domain Unification:
  [ ] All domains using both entities
  [ ] Can consolidate to one
  [ ] Standards unified
  [ ] No domain-specific aspects

Consensus:
  [ ] All 8 board members confirmed equivalent
  [ ] No remaining objections
  [ ] No hidden concerns
  [ ] Unanimous agreement reached

Migration:
  [ ] All old code can migrate
  [ ] No functionality lost
  [ ] Migration procedure documented
  [ ] Timeline specified
  [ ] Support plan established

Immutability:
  [ ] Merge record prepared (comprehensive)
  [ ] All 8 signatures collected
  [ ] Equivalence proof archived
  [ ] Immutable storage ready
```

---

## NEXT PHASES

This document establishes **SEMANTIC SPLIT/MERGE GOVERNANCE** (Phase 5).

### Phase 6: SEMANTIC IDENTITY LINEAGE
Document: `SEMANTIC_IDENTITY_LINEAGE.md`
- Lineage tree structure
- Ancestry tracking
- Split/merge history recording
- Immutable lineage integrity

---

## CONCLUSION

**SEMANTIC SPLIT/MERGE GOVERNANCE** provides:

✅ **Split governance:** Formal criteria, board review, immutable records  
✅ **Split process:** 6-phase formal process (8+ weeks)  
✅ **Merge governance:** Unanimous approval (extremely rare)  
✅ **Immutable records:** Complete audit trail for all decisions  
✅ **Migration paths:** Clear processes for consumer transition  
✅ **Historical preservation:** Old entities never deleted  
✅ **Lineage tracking:** Complete parent-child relationships  

**Result:** Semantic entities can evolve safely without losing audit trail or confusing consumers.

---

**Document Status:** 🟨 Split/Merge Governance (Phase 5)  
**Next Review:** Phase 6 (Semantic Identity Lineage) in progress
