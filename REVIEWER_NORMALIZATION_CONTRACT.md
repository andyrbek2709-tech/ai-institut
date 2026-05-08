# REVIEWER NORMALIZATION CONTRACT
## Mandatory нормализация rules для всех reviewers

**Статус:** 🟦 CONTRACT DESIGN  
**Дата:** 2026-05-10  
**Версия:** 1.0  
**Ссылка:** CANONICAL_NORMALIZATION_ARCHITECTURE.md → STAGE 5

---

## 🎯 НАЗНАЧЕНИЕ

Обеспечить, что **humans НЕ инвентируют нормализацию вручную**, но следуют **formal, deterministic rules**.

**Принцип:** Reviewers validate against standards, don't create new canonical forms.

**Signing requirement:** All reviewers MUST sign this contract before engaging with ground truth corpus.

---

## 1️⃣ CORE NORMALIZATION PRINCIPLES

### Principle 1: Determinism First

> **Reviewers MUST apply rules deterministically.**
> 
> ❌ **Forbidden:** "I think this should be normalized as..."
> ✅ **Required:** "FORMULA_NORMALIZATION_STANDARD rule A1 applies here..."

### Principle 2: Standards-Based Only

> **Reviewers MUST reference applicable normalization standard.**
> 
> ❌ **Forbidden:** Custom canonicalization or personal preference
> ✅ **Required:** Map source → standard rule → canonical form

### Principle 3: Ambiguity Escalation

> **Reviewers MUST flag ambiguities instead of deciding unilaterally.**
> 
> ❌ **Forbidden:** Resolve unclear symbol without evidence
> ✅ **Required:** Flag as AMBIGUOUS → escalate to arbitration

### Principle 4: Immutable Audit Trail

> **Reviewers MUST enable complete lineage recording.**
> 
> ❌ **Forbidden:** Manual changes that bypass lineage tracking
> ✅ **Required:** All normalization recorded in NORMALIZATION_LINEAGE_MODEL

### Principle 5: No Invention

> **Reviewers MUST NOT invent canonical forms.**
> 
> ❌ **Forbidden:** "I'll normalize this as..." (unauthorized choice)
> ✅ **Required:** "Standard says this normalizes to..." (rule-based)

---

## 2️⃣ NORMALIZATION WORKFLOW FOR REVIEWERS

### Step 1: Receive Ground Truth Block

```
Block content:
  σ_y = 250 Мпа
  E = 210 ГПа

Reviewer receives:
  - source_representation (extracted text)
  - block_id (unique identifier)
  - context (document type, domain)
```

### Step 2: Apply Normalization Standards (IN ORDER)

**MANDATORY SEQUENCE** (cannot skip or reorder):

#### Stage 1: FORMULA NORMALIZATION
- ✅ Apply FORMULA_NORMALIZATION_STANDARD
- Normalize symbols (·→×, −→-, etc.)
- Normalize whitespace
- Normalize superscripts/subscripts
- Normalize engineering notation
- **Output:** Normalized formula string

#### Stage 2: UNIT NORMALIZATION
- ✅ Apply UNIT_NORMALIZATION_STANDARD
- Extract units from formula/cells
- Normalize locale (Мпа → MPa)
- Normalize prefixes (М → M)
- Normalize symbols (mm² from mm^2)
- **Output:** Canonical units

#### Stage 3: SYMBOL NORMALIZATION
- ✅ Apply SYMBOL_NORMALIZATION_STANDARD
- Check for Greek/Cyrillic confusion
- Check confusion matrix (σ vs Σ vs 6, etc.)
- Apply context rules for disambiguation
- **Output:** Canonical symbols

#### Stage 4: TABLE NORMALIZATION (if applicable)
- ✅ Apply TABLE_NORMALIZATION_STANDARD
- Classify table type
- Detect headers and merged cells
- Normalize cell values
- Normalize column units
- **Output:** Canonical table structure

#### Stage 5: REVIEWER VALIDATION
- ✅ Review applied normalizations
- Check for consistency
- Flag ambiguities
- Record reviewer confidence
- **Output:** Validation status + confidence score

#### Stage 6: ARBITRATION (if needed)
- ✅ Request arbitration for conflicts
- Submit evidence for each option
- Await arbitrator decision
- Record arbitration result
- **Output:** Resolved canonical form

### Step 3: Record Lineage

```sql
INSERT INTO normalization_lineage (
  block_id,
  normalization_stage,
  source_representation,
  normalized_representation,
  normalization_rule_id,
  normalization_version,
  reviewer_id,
  reviewer_override,
  arbitration_decision_id,
  is_locked
)
VALUES (
  'block_xyz',
  1,
  'K = G·a²/(π·t³)',
  'K = G×a²/(π×t³)',
  'rule_A1',
  '1.0.0',
  'alice_id',
  FALSE,
  NULL,
  TRUE
);
```

### Step 4: Lock After Approval

```sql
UPDATE normalization_lineage
SET is_locked = TRUE,
    locked_at = NOW()
WHERE block_id = 'block_xyz' AND is_locked = FALSE;
```

---

## 3️⃣ REVIEWER CHECKLIST (MANDATORY)

**Before approving any ground truth block, reviewer MUST verify:**

### ✅ Formula Checklist

- [ ] All multiplication symbols normalized (· × * → ×)
- [ ] All minus signs normalized (− - -- → -)
- [ ] All decimal separators normalized (. not ,)
- [ ] All whitespace normalized (consistent spacing around operators)
- [ ] All superscripts/subscripts in Unicode form (² not ^2)
- [ ] Unicode NFC normalization applied
- [ ] Engineering notation standardized (e → ×10^)
- [ ] No confusion matrix conflicts (σ ≠ С, μ ≠ м)
- [ ] Dimensional analysis passes (if applicable)
- [ ] Symbol consistency verified (same symbol = same meaning)

**Signature required:** Reviewer confirms all 10 items

### ✅ Unit Checklist

- [ ] All units normalized to canonical forms (Pa not Па)
- [ ] All prefixes normalized (M not М, m not м)
- [ ] All unit variants resolved (mm² from mm^2, N·m from Nm)
- [ ] Locale conversion done (English/ASCII only)
- [ ] No ambiguous units (mPa vs MPa flagged and resolved)
- [ ] Column units explicit (header includes [MPa], [kg/m³], etc.)
- [ ] Micro prefix uses μ not u or m
- [ ] Unit consistency across all cells in column
- [ ] Dimensional consistency with formula
- [ ] Conversion factors documented (if needed)

**Signature required:** Reviewer confirms all 10 items

### ✅ Symbol Checklist

- [ ] Greek symbols identified (σ, τ, μ, π, etc.)
- [ ] Cyrillic/Greek confusion resolved (С vs σ, т vs τ)
- [ ] Unicode normalization applied (NFC form)
- [ ] Symbol context verified (σ in formula = stress, not text)
- [ ] Subscript notation normalized (σ_y → σᵧ)
- [ ] Superscript notation normalized (a^2 → a²)
- [ ] Symbol consistency across document
- [ ] Engineering convention followed (τ for torque, T for temperature)
- [ ] No look-alike confusion (0 vs O, 1 vs l vs I)
- [ ] Confusion matrix conflicts resolved

**Signature required:** Reviewer confirms all 10 items

### ✅ Table Checklist (if applicable)

- [ ] Table type classified (simple, hierarchical, index, matrix, decision)
- [ ] Header rows identified
- [ ] Merged cells tracked and structure preserved
- [ ] All numeric values normalized
- [ ] All units canonicalized in column headers
- [ ] Columns have consistent data types
- [ ] Empty cells marked NULL (not —, N/A, etc.)
- [ ] Zero (0) distinguished from NULL
- [ ] Cell values match column units
- [ ] Rectangular consistency verified

**Signature required:** Reviewer confirms all 10 items

### ✅ Ambiguity Resolution Checklist

- [ ] All ambiguities identified and flagged
- [ ] No unresolved conflicts
- [ ] Ambiguities either resolved by rules OR escalated to arbitration
- [ ] Arbitration decisions recorded in NORMALIZATION_LINEAGE
- [ ] Override decisions documented with reasons
- [ ] Confidence score assigned (0.0 to 1.0)

**Signature required:** Reviewer confirms all 6 items

---

## 4️⃣ CONFLICT RESOLUTION PROTOCOL

### Protocol Step 1: Identify Conflict Type

| Conflict | Description | Resolution |
|----------|---|---|
| **Symbol ambiguity** | σ (Greek) vs С (Cyrillic) | Check formula context vs text context |
| **Unit ambiguity** | mPa vs MPa | Check domain (material strength = MPa) |
| **Value disagreement** | 276 vs 278 | Cross-reference source (standard, spec) |
| **Notation variant** | K·a² vs K*a^2 | Apply FORMULA_NORMALIZATION_STANDARD |
| **Locale mismatch** | Мпа vs MPa | Apply UNIT_NORMALIZATION_STANDARD |

### Protocol Step 2: Gather Evidence

For each option, document:
- ✅ Which standard rule applies
- ✅ Context supporting this option
- ✅ Confidence level (0-1)
- ✅ Any counter-evidence

### Protocol Step 3: Request Arbitration

If multiple reviewers disagree:

```
Conflict submission:
  Block: block_xyz
  Conflict type: symbol_ambiguity
  Option A: σ (Greek sigma, U+03C3) - Confidence 0.8
    Evidence: "Material domain convention, formula syntax"
  Option B: С (Cyrillic C, U+0421) - Confidence 0.3
    Evidence: "Russian document text"
  Requested arbitrator: diana@enghub.io
```

### Protocol Step 4: Accept Arbitration Decision

Arbitrator decides. Decision is final and locked.

```
Arbitration decision:
  Chosen option: σ (Greek sigma)
  Reasoning: "Domain convention + formula syntax > text language"
  Locked: YES
  Immutable: YES
```

---

## 5️⃣ OVERRIDE RULES (WHEN ALLOWED)

### When CAN Reviewer Override?

**Override is ALLOWED only in these cases:**

1. **Non-standard but correct notation**
   - Example: Formula uses × but standard says · (unlikely)
   - Requirement: Document why standard doesn't apply, get approval

2. **Domain-specific convention**
   - Example: Field uses different unit (e.g., bar for some domains vs Pa standard)
   - Requirement: Reference domain standard, get domain expert approval

3. **Historical/legacy notation**
   - Example: Old standard notation differs from current standard
   - Requirement: Cite legacy standard, note as historical variant

### When CANNOT Override?

❌ **Override is FORBIDDEN:**

- **"I think this looks better..."** (personal preference)
- **"This is non-standard but I'll allow it"** (without documented reason)
- **"Let me normalize this my way"** (deviation from standard)
- **"This doesn't fit the rules..."** (instead, flag AMBIGUOUS)

### Override Recording

If override is used:

```sql
UPDATE normalization_lineage
SET reviewer_override = TRUE,
    override_reason = "Domain-specific: Engineering field uses bar (ISO 13894)"
WHERE id = 'line_xyz';
```

**Override is recorded and auditable** (not hidden).

---

## 6️⃣ TRAINING AND CERTIFICATION

### Training Requirement

Before reviewing any ground truth block, reviewer MUST:

1. ✅ Read CANONICAL_NORMALIZATION_ARCHITECTURE.md
2. ✅ Read FORMULA_NORMALIZATION_STANDARD.md
3. ✅ Read UNIT_NORMALIZATION_STANDARD.md
4. ✅ Read SYMBOL_NORMALIZATION_STANDARD.md
5. ✅ Read TABLE_NORMALIZATION_STANDARD.md
6. ✅ Read NORMALIZATION_LINEAGE_MODEL.md
7. ✅ Read THIS CONTRACT (REVIEWER_NORMALIZATION_CONTRACT.md)
8. ✅ Complete practice test (normalize 3 example blocks)
9. ✅ Pass certification quiz (80% minimum)

### Certification Quiz (Sample)

```
Question 1: What does rule A1 say about multiplication symbols?
  A) · and * are equivalent  B) · → ×  C) Convert nothing
  Correct answer: B

Question 2: When should a reviewer override a normalization rule?
  A) When they prefer different notation
  B) When the standard doesn't apply (documented reason)
  C) Whenever convenient
  Correct answer: B

Question 3: If you find σ (Greek) vs С (Cyrillic), what do you do?
  A) Pick whichever looks better
  B) Apply context rules (formula = Greek, text = Cyrillic)
  C) Ask for a guess
  Correct answer: B

Question 4: What must be recorded in lineage for every normalization?
  A) Just the final form
  B) Source, rule, canonical form, reviewer, timestamp
  C) Whatever you remember
  Correct answer: B

Question 5: How do you handle a disputed normalization?
  A) Decide yourself
  B) Flag as AMBIGUOUS and escalate to arbitration
  C) Hide the conflict
  Correct answer: B

Pass criteria: ≥4/5 correct
```

### Recertification

Recertify every 6 months OR when standards update.

---

## 7️⃣ REVIEWER SIGNATURE AND COMMITMENT

> **I, the undersigned, commit to:**
> 
> ✅ **Apply normalization standards deterministically**, not by personal preference
> 
> ✅ **Never invent canonical forms** — only implement rules from standards
> 
> ✅ **Flag all ambiguities** instead of resolving them unilaterally
> 
> ✅ **Enable complete lineage recording** for all normalization decisions
> 
> ✅ **Use overrides only with documented justification** and approval
> 
> ✅ **Complete all items in the normalization checklist** before approving blocks
> 
> ✅ **Escalate conflicts to arbitration** when consensus cannot be reached
> 
> ✅ **Maintain immutable audit trail** of all decisions
> 
> ✅ **Acknowledge that this contract overrides personal judgment** in normalization
> 
> ✅ **Accept that violations may result in review suspension**

**Reviewer name:** ___________________  
**Reviewer email:** ___________________  
**Date signed:** ___________________  
**Certification valid until:** ___________________

---

## 8️⃣ VIOLATION CONSEQUENCES

### Severity Levels

| Violation | Example | Consequence |
|-----------|---------|---|
| **CRITICAL** | Normalized without following standards | Immediate review suspension |
| **CRITICAL** | Invented canonical form without rule | Immediate review suspension |
| **HIGH** | Skipped ambiguity flagging | Warning + retraining |
| **HIGH** | Used override without documentation | Warning + approval required for future |
| **MEDIUM** | Incomplete checklist | Reviewer required to re-review block |
| **LOW** | Typo in lineage note | Correction required |

### Appeal Process

If violation disputed:

1. Reviewer submits appeal with evidence
2. Arbitration panel reviews appeal
3. Panel decision is final
4. Suspension lifted or upheld

---

## 9️⃣ EXAMPLES: WHAT REVIEWERS SHOULD DO

### ✅ CORRECT: Standard-Based Normalization

```
Input: K = G·a²/(π·t³)

Reviewer action:
  1. Check: FORMULA_NORMALIZATION_STANDARD rule A1
  2. Find: "· → × (always)"
  3. Apply: K = G×a²/(π×t³)
  4. Record: normalization_lineage entry with rule_A1 reference
  5. Confidence: 1.0 (deterministic)
  
Lineage entry:
  source: K = G·a²/(π·t³)
  normalized: K = G×a²/(π×t³)
  rule: formula_rule_A1
  reviewer_override: FALSE
```

### ✅ CORRECT: Ambiguity Flagging

```
Input: σ = F/A (uncertain if Greek σ or Cyrillic С)

Reviewer action:
  1. Check: SYMBOL_NORMALIZATION_STANDARD
  2. Find: Confusion matrix (σ vs С)
  3. Determine: Insufficient context (could be either)
  4. Action: Flag as AMBIGUOUS
  5. Escalate: Request arbitration
  6. Wait: Arbitration decision

Lineage entry:
  source: σ = F/A [AMBIGUOUS]
  normalized: [AWAITING ARBITRATION]
  rule: symbol_rule_Greek1
  arbitration_decision_id: arb_001
  is_locked: FALSE
```

### ✅ CORRECT: Override with Justification

```
Input: Stress = 250 bar (field uses bar, not standard Pa)

Reviewer action:
  1. Check: UNIT_NORMALIZATION_STANDARD
  2. Find: bar is non-SI, canonical is Pa
  3. Recognize: Domain exception (some fields use bar historically)
  4. Document: "Domain exception: Hydraulic engineering industry standard"
  5. Get approval: Domain expert approval recorded
  6. Override: reviewer_override = TRUE with reason

Lineage entry:
  source: 250 bar
  normalized: 250 bar [DOMAIN EXCEPTION]
  rule: unit_rule_domain_exception
  reviewer_override: TRUE
  override_reason: "Hydraulic engineering industry standard (ISO 13891)"
  approver_id: domain_expert_id
  is_locked: TRUE
```

---

## 🔟 EXAMPLES: WHAT REVIEWERS SHOULD NOT DO

### ❌ INCORRECT: Personal Preference

```
Input: K = G·a²/(π·t³)

WRONG reviewer action:
  "I prefer middle dot, so I'll keep it as K = G·a²/(π·t³)"

Problem: No standard rule cited, personal preference, no lineage
Consequence: CRITICAL violation
```

### ❌ INCORRECT: Unilateral Ambiguity Resolution

```
Input: σ = F/A (Greek vs Cyrillic unknown)

WRONG reviewer action:
  "It looks Greek to me, so σ is U+03C3"
  [No context analysis, no escalation, no arbitration]

Problem: Ambiguity decided without evidence, no arbitration
Consequence: HIGH violation
```

### ❌ INCORRECT: Skipped Checklist

```
Block review without checking:
  - Formula multiplication symbols
  - Unit locale normalization
  - Symbol confusion matrix
  - Table structure

WRONG: "Block looks OK, moving on"

Problem: Checklist not completed
Consequence: MEDIUM violation (must re-review)
```

### ❌ INCORRECT: Hidden Override

```
Input: 250 MPa

WRONG action:
  "Change to 250 bar without noting why"
  reviewer_override: FALSE [HIDDEN!]
  no override_reason

Problem: Change is hidden, audit trail broken
Consequence: CRITICAL violation
```

---

## 1️⃣1️⃣ NORMALIZATION STANDARDS REFERENCE

| Standard | Document | When to Use |
|----------|----------|---|
| Formula | FORMULA_NORMALIZATION_STANDARD.md | Any formula block |
| Unit | UNIT_NORMALIZATION_STANDARD.md | Any numeric with units |
| Symbol | SYMBOL_NORMALIZATION_STANDARD.md | Greek/Cyrillic symbols |
| Table | TABLE_NORMALIZATION_STANDARD.md | Table blocks |
| Lineage | NORMALIZATION_LINEAGE_MODEL.md | Recording decisions |

**All standards are MANDATORY** (not optional).

---

## 1️⃣2️⃣ VERSIONING

**Version 1.0 (2026-05-10):**
- Core principles (5 principles)
- Normalization workflow (6 stages)
- Reviewer checklists (5 checklists × 10 items each)
- Conflict resolution protocol
- Override rules
- Training requirements
- Reviewer signature
- Violation consequences
- Correct/incorrect examples
- Standards reference

**Future updates:**
- Domain-specific specializations (electrical, thermal, etc.)
- Advanced conflict scenarios
- Automation rule engine (for simple cases)
- AI-assisted normalization (with human validation)

---

## 📝 ПРИМЕЧАНИЯ

1. **This contract is binding:** All reviewers MUST sign before engaging with corpus.
2. **Standards are authoritative:** If this contract conflicts with standards, standards win.
3. **Ambiguity escalation is mandatory:** Do not resolve ambiguous cases yourself.
4. **Lineage is immutable:** All decisions recorded and locked (audit-safe).
5. **Violations have consequences:** Non-compliance may result in review suspension.

---

## 🔗 DEPENDENCIES

- CANONICAL_NORMALIZATION_ARCHITECTURE.md (overview)
- FORMULA_NORMALIZATION_STANDARD.md (formula rules)
- UNIT_NORMALIZATION_STANDARD.md (unit rules)
- SYMBOL_NORMALIZATION_STANDARD.md (symbol rules — to be created)
- TABLE_NORMALIZATION_STANDARD.md (table rules)
- NORMALIZATION_LINEAGE_MODEL.md (lineage tracking)

---

## ✍️ REVIEWER SIGN-OFF TEMPLATE

```
REVIEWER NORMALIZATION CONTRACT SIGN-OFF

Name: ___________________
Email: ___________________
Organization: ___________________

Training completion:
  ☐ Read CANONICAL_NORMALIZATION_ARCHITECTURE.md
  ☐ Read FORMULA_NORMALIZATION_STANDARD.md
  ☐ Read UNIT_NORMALIZATION_STANDARD.md
  ☐ Read SYMBOL_NORMALIZATION_STANDARD.md
  ☐ Read TABLE_NORMALIZATION_STANDARD.md
  ☐ Read NORMALIZATION_LINEAGE_MODEL.md
  ☐ Read REVIEWER_NORMALIZATION_CONTRACT.md
  ☐ Completed practice test (3 blocks)
  ☐ Passed certification quiz (≥80%)

Certification:
  ☐ I understand and accept all principles in this contract
  ☐ I commit to apply standards deterministically
  ☐ I will flag ambiguities instead of deciding unilaterally
  ☐ I will enable complete lineage recording
  ☐ I acknowledge violations may result in review suspension

Signature: ___________________ Date: ___________

Valid until: ___________
Recertification due: ___________
```

---

**Статус:** All 6 normalization architecture documents complete ✅  
**Next step:** Normalization consistency testing and sign-off with 3 test reviewers

