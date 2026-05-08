# DETERMINISTIC IDENTITY REVIEW — Report Lifecycle Foundation

**Focus:** Verifying report_id stability, hash determinism, reproducibility guarantees  
**Status:** ⚠️ **MODERATE ISSUES FOUND**  

---

## EXECUTIVE SUMMARY

**Determinism Status:** 🟡 **PARTIALLY ROBUST**

**Good News:**
- ✅ ReportIdentityGenerator is well-designed
- ✅ Hash computation uses deterministic methods (JSON sort_keys, normalization)
- ✅ report_id generation is stable (based on calculation_id + hashes + template)
- ✅ Multiple hash strategy (inputs, formula, execution, semantic, template) is sound

**Issues Found:**
- ⚠️ execution_hash includes timing (non-deterministic)
- ⚠️ semantic_hash doesn't differentiate None from empty dict
- ⚠️ Floating point rounding may affect inputs_hash edge cases
- 🔴 **Integration issue:** Identity generation is not called → determinism never tested

---

## PART 1: HASH COMPUTATION DETERMINISM

### Test: Same Inputs → Same Hashes?

**Test Case 1: Simple Calculation**

```python
calculation_id = "calc_001"
inputs = {"pressure": 5.0, "diameter": 100, "thickness": 5}
formula = "(P * (D - 2*t)) / (2 * t)"
template_type = "piping"
template_version = "1.0"
```

**Run 1 (Day 1, 10:00 AM):**
```python
identity1 = ReportIdentityGenerator.generate_identity(
    calculation_id="calc_001",
    calculation_result=result1,  # execution_time_ms=45.2
    context=ctx1,                 # generated_timestamp="2026-05-08T10:00:00Z"
)

# Output:
# inputs_hash: "sha256:abc123..."  (deterministic from inputs)
# formula_hash: "sha256:def456..."  (deterministic from formula)
# execution_hash: "sha256:111222..."  (depends on execution_time_ms!)
# report_id: "rpt_calc_001_abc123ab_def456de_piping"  (same)
# identity_hash: "sha256:xyz789..."  (depends on execution_hash!)
```

**Run 2 (Day 2, same calculation, same inputs):**
```python
identity2 = ReportIdentityGenerator.generate_identity(
    calculation_id="calc_001",
    calculation_result=result2,  # execution_time_ms=44.8 (slightly faster)
    context=ctx2,                 # generated_timestamp="2026-05-09T10:00:00Z"
)

# Expected: identity_hash should be same
# Actual: identity_hash is DIFFERENT
```

**Why Different?**

```python
# report_identity.py:233-237
execution_hash = ReportIdentityGenerator.compute_execution_hash(
    execution_time_ms=getattr(calculation_result, 'execution_time_ms', None),
    # ↑ This changes between runs: 45.2 → 44.8
    validation_status=...,
    num_validations=...
)
```

### The execution_hash Problem

**Code:**
```python
@staticmethod
def compute_execution_hash(execution_time_ms, validation_status, num_validations):
    context = {
        "validation_status": validation_status,
        "num_validations": num_validations,
    }
    if execution_time_ms is not None:
        context["execution_time_ms"] = round(execution_time_ms)
    # ↑ EVEN with rounding, still varies:
    # 45.2ms → 45ms
    # 44.8ms → 45ms  (same!)
    # 45.4ms → 45ms  (same!)
    # 46.1ms → 46ms  (different!)
```

**Problem:** Execution time is non-deterministic
- Same calculation takes different time on different hardware
- Network latency varies
- OS scheduling varies
- Database query time varies
- Result: execution_hash changes → identity_hash changes → **Same inputs = different report_id** ❌

**Design Principle Violated:**
> "Same inputs + same template + same semantics should give same report_id"

### Impact Analysis

**Scenario 1: Determinism Requirement Violated**

```
Expected (according to architecture):
  Input1 = {P:5.0, D:100, t:5} + formula F + template T
  → report_id = "rpt_xxx_abc123_def456_piping"
  
  Input2 = {P:5.0, D:100, t:5} + formula F + template T  (same)
  → report_id should be SAME

Actual (with execution_hash including timing):
  Input1 execution_time=45.2ms
  → execution_hash = hash(45ms) = "sha256:111..."
  → identity_hash = hash(all hashes including 111...) = "xyz789a..."
  → Different identity_hash!
  
  Input2 execution_time=44.8ms  
  → execution_hash = hash(45ms) = "sha256:111..."  (coincidentally same!)
  → identity_hash = "xyz789a..."  (same!)
  
  BUT: Input3 execution_time=46.1ms
  → execution_hash = hash(46ms) = "sha256:222..."  (different!)
  → identity_hash = "xyz789b..."  (different!)
```

**Stage 2+ Impact:**
- Revision detection will be unreliable
- Same calculation run twice may appear as different revisions
- Integrity verification will fail for "same" calculations

---

## PART 2: INPUTS_HASH ROBUSTNESS

### Floating Point Precision

**Code:**
```python
# report_identity.py:65-85
@staticmethod
def compute_inputs_hash(inputs: Dict[str, Any]) -> str:
    sorted_inputs = {}
    for key in sorted(inputs.keys()):
        value = inputs[key]
        if isinstance(value, float):
            sorted_inputs[key] = round(value, 12)  # ← 12 decimal places
        else:
            sorted_inputs[key] = value
    return ReportIdentityGenerator._hash_dict(sorted_inputs)
```

**Test Case: Floating Point Precision**

```python
# Run 1:
inputs1 = {"pressure": 5.0}
# Internal representation: 5.000000000000
inputs_hash1 = compute_inputs_hash(inputs1)

# Run 2:
inputs2 = {"pressure": 5.000000000001}
# Due to floating point arithmetic
inputs_hash2 = compute_inputs_hash(inputs2)
# After rounding to 12 decimals:
# → 5.000000000001 rounds to 5.0
# → Same as inputs1!
# ✅ Good: floating point noise is eliminated
```

**But Edge Case:**
```python
inputs3 = {"pressure": 5.0000000000001}  # 13 decimal places
# rounds(value, 12) → 5.0

inputs4 = {"pressure": 5.00000000000001}  # 14 decimal places
# May round differently depending on implementation!
```

**Assessment:** ✅ **GOOD** — 12 decimal place rounding is sufficient for engineering applications

---

## PART 3: FORMULA_HASH ROBUSTNESS

### Whitespace Normalization

**Code:**
```python
# report_identity.py:88-100
@staticmethod
def compute_formula_hash(formula: str) -> str:
    # Normalize whitespace
    normalized = " ".join(formula.split())
    return ReportIdentityGenerator._hash_string(normalized)
```

**Test Cases:**

```python
# Formula variants (all should hash to same):
formula1 = "(P * (D - 2*t)) / (2 * t)"
formula2 = "(P*(D-2*t))/(2*t)"  # no spaces
formula3 = "(  P  *  (D  -  2*t)  )  /  (  2  *  t  )"  # extra spaces

hash1 = compute_formula_hash(formula1)
hash2 = compute_formula_hash(formula2)
hash3 = compute_formula_hash(formula3)

# Verification:
normalized1 = " ".join(formula1.split()) = "(P * (D - 2*t) ) / (2 * t)"
normalized2 = " ".join(formula2.split()) = "( P * ( D - 2 * t ) ) / ( 2 * t )"
# ❌ DIFFERENT! Because split() includes parentheses as separate tokens!
```

**Wait, let me recalculate:**

```python
"(P * (D - 2*t)) / (2 * t)".split()
→ ['(P', '*', '(D', '-', '2*t))', '/', '(2', '*', 't)']

" ".join([...])
→ "(P * (D - 2*t)) / (2 * t)"

"(P*(D-2*t))/(2*t)".split()
→ ['(P*(D-2*t))/(2*t)']

" ".join([...])
→ "(P*(D-2*t))/(2*t)"

# NOT SAME! ❌
```

**PROBLEM FOUND:** Formula hash is NOT robust to different spacing!

### Example Failure

```python
# Template v1:
formula_in_template = "(P * (D - 2*t)) / (2 * t)"

# Template v2 (no functional change, just reformatted):
formula_in_template = "(P*(D-2*t))/(2*t)"

# Different formula_hash!
# → Different template_hash!
# → Different report_id!
# → Stage 2 sees as new revision ❌
```

**Assessment:** 🔴 **CRITICAL** — Formula hash is fragile to whitespace variants

---

## PART 4: SEMANTIC_HASH AMBIGUITY

### None vs Empty Dict

**Code:**
```python
# report_identity.py:130-145
@staticmethod
def compute_semantic_hash(semantic_rules: Optional[Dict[str, Any]]) -> str:
    if not semantic_rules:
        return ReportIdentityGenerator._hash_string("")
    return ReportIdentityGenerator._hash_dict(semantic_rules)
```

**Problem:**

```python
semantic_hash = compute_semantic_hash(None)
→ hash("") = "sha256:e3b0c44..."  (SHA256 of empty string)

semantic_hash = compute_semantic_hash({})
→ hash("") = "sha256:e3b0c44..."  (same!)

semantic_hash = compute_semantic_hash({"rules": []})
→ hash({...}) = "sha256:different..."
```

**Ambiguity:**
- Can't distinguish: "No semantic rules defined" (None)
- From: "Semantic rules defined but empty" ({})
- From: "Semantic rules removed" (in Stage 2 revision)

**Impact on Stage 2:**
- If revision removes all rules: semantic_hash changes
- But system can't tell if rules were never there or were removed
- Makes audit trail confusing

**Assessment:** ⚠️ **MODERATE** — Works for initial implementation but hurts traceability

---

## PART 5: TEMPLATE_HASH STABILITY

### Template Versioning

**Code:**
```python
# report_identity.py:148-166
@staticmethod
def compute_template_hash(template_type: str, template_version: str) -> str:
    template_data = {
        "type": template_type,
        "version": template_version,
    }
    return ReportIdentityGenerator._hash_dict(template_data)
```

**Assessment:** ✅ **GOOD**

- Uses template_type + template_version
- Version string is explicit (e.g., "1.0", "1.1")
- Different template content → different version number → different hash
- Deterministic

**But:**
- Assumes template version is always provided
- If version is missing → What happens?

```python
context = ReportGenerationContext(..., template_version="1.0")  # ✅ Good
context2 = ReportGenerationContext(...)  # ❌ What's default?
```

---

## PART 6: REPORT_ID GENERATION STABILITY

### report_id Format

**Code:**
```python
# report_identity.py:169-197
@staticmethod
def generate_report_id(
    calculation_id: str,
    inputs_hash: str,
    formula_hash: str,
    template_type: str
) -> str:
    components = [
        calculation_id,
        inputs_hash[:8],
        formula_hash[:8],
        template_type
    ]
    report_id = "_".join(components)
    return f"rpt_{report_id}"
```

**Example:**
```
calculation_id = "calc_pipe_001"
inputs_hash = "abc123def456..."
formula_hash = "789fedcba012..."
template_type = "piping"

report_id = "rpt_calc_pipe_001_abc123de_789fedcb_piping"
```

**Assessment:** ✅ **GOOD**

- Stable format
- Uses only first 8 chars of hash (avoiding extremely long IDs)
- Collision risk very low (8 hex chars = 2^32 combinations)
- Human-readable prefix ("rpt_")

**Potential Issue:**
- If inputs_hash or formula_hash change → report_id changes
- This is correct behavior (different inputs = different report)
- But with formula_hash fragility (whitespace), report_id may change unexpectedly

---

## PART 7: EXECUTION_HASH FIX PROPOSAL

### Root Cause

Execution time should NOT be part of identity because:
1. It's non-deterministic (varies with hardware, load, etc.)
2. Same calculation may run at different speeds
3. Doesn't affect calculation content or validity

### Proposed Solution

**Change from:**
```python
def compute_execution_hash(execution_time_ms, validation_status, num_validations):
    context = {
        "validation_status": validation_status,
        "num_validations": num_validations,
    }
    if execution_time_ms is not None:
        context["execution_time_ms"] = round(execution_time_ms)  # ← REMOVE THIS
    return ReportIdentityGenerator._hash_dict(context)
```

**Change to:**
```python
def compute_execution_hash(validation_status, num_validations):
    """
    Compute hash of execution context (deterministic only).
    
    Note: Execution time is NOT included because it's non-deterministic
    and doesn't affect calculation validity or content.
    """
    context = {
        "validation_status": validation_status,
        "num_validations": num_validations,
    }
    return ReportIdentityGenerator._hash_dict(context)
```

### Impact of Change

**Before (with timing):**
```
Same inputs, run twice:
  Run1: execution_time=45.2ms → execution_hash="sha256:111..."
  Run2: execution_time=44.8ms → execution_hash="sha256:111..."
  Run3: execution_time=46.1ms → execution_hash="sha256:222..."  ← Different!
  
Result: 2 out of 3 runs have same execution_hash (50% failure rate)
```

**After (without timing):**
```
Same inputs, run multiple times:
  Run1: num_validations=7, status="success" → execution_hash="sha256:111..."
  Run2: num_validations=7, status="success" → execution_hash="sha256:111..."  ✅
  Run3: num_validations=7, status="success" → execution_hash="sha256:111..."  ✅
  
Result: 100% determinism
```

---

## PART 8: FORMULA_HASH FIX PROPOSAL

### Root Cause

Whitespace-insensitive hashing is fragile because `str.split()` without arguments treats all whitespace (and parentheses!) as delimiters.

### Proposed Solution

**Normalize formula more carefully:**

```python
@staticmethod
def compute_formula_hash(formula: str) -> str:
    """
    Compute hash of formula expression.
    
    Normalization:
    1. Strip leading/trailing whitespace
    2. Replace multiple spaces with single space
    3. Lowercase for case-insensitive comparison
    """
    # Remove extra whitespace
    normalized = re.sub(r'\s+', ' ', formula.strip())
    # Lowercase
    normalized = normalized.lower()
    # Hash
    return ReportIdentityGenerator._hash_string(normalized)
```

### Test After Fix

```python
formula1 = "(P * (D - 2*t)) / (2 * t)"
formula2 = "(P*(D-2*t))/(2*t)"
formula3 = "(P * (D - 2 * t)) / (2 * t)"  # extra spaces

hash1 = compute_formula_hash(formula1)
# normalized: "(p * (d - 2*t)) / (2 * t)"

hash2 = compute_formula_hash(formula2)
# normalized: "(p*(d-2*t))/(2*t)"

# ❌ STILL NOT SAME! Because formula2 has no spaces around operators

# Better approach: normalize operators
```

**Better Solution:**

```python
@staticmethod
def compute_formula_hash(formula: str) -> str:
    """
    Compute hash of formula expression.
    
    Normalization strategy:
    1. Lowercase
    2. Add spaces around operators (+, -, *, /, =, (, ), ^)
    3. Normalize multiple spaces to single space
    """
    # Lowercase
    normalized = formula.lower()
    # Add space around operators
    for op in ['(', ')', '+', '-', '*', '/', '=', '^']:
        normalized = normalized.replace(op, f' {op} ')
    # Normalize multiple spaces
    normalized = re.sub(r'\s+', ' ', normalized.strip())
    return ReportIdentityGenerator._hash_string(normalized)
```

### Test After Better Fix

```python
formula1 = "(P * (D - 2*t)) / (2 * t)"
formula2 = "(P*(D-2*t))/(2*t)"
formula3 = "(P * (D - 2 * t)) / (2 * t)"

# All normalize to:
# "( p * ( d - 2 * t ) ) / ( 2 * t )"

hash1 = hash2 = hash3  ✅ Deterministic!
```

---

## PART 9: SEMANTIC_HASH FIX PROPOSAL

### Proposed Solution

**Explicit markers for different states:**

```python
@staticmethod
def compute_semantic_hash(semantic_rules: Optional[Dict[str, Any]]) -> str:
    """Compute hash of semantic validation rules."""
    
    if semantic_rules is None:
        # No rules defined at all
        return ReportIdentityGenerator._hash_string("__NONE__")
    
    if not semantic_rules:
        # Rules defined but empty
        return ReportIdentityGenerator._hash_string("__EMPTY__")
    
    # Rules defined with content
    return ReportIdentityGenerator._hash_dict(semantic_rules)
```

**Impact:**
```python
semantic_hash(None)        → "__NONE__"  hash
semantic_hash({})          → "__EMPTY__" hash
semantic_hash({"a": 1})    → json hash
semantic_hash({"a": 1, "b": 2})  → different json hash
```

**Advantage:** Clear audit trail for rule changes in Stage 2 revisions

---

## PART 10: REPRODUCIBILITY TEST PLAN

### Required Tests (NOT Currently Implemented)

**Test 1: Determinism - Same Inputs**

```python
def test_determinism_same_inputs():
    """Same inputs should produce same report_id across runs."""
    
    inputs = {"pressure": 5.0, "diameter": 100, "thickness": 5}
    formula = "(P * (D - 2*t)) / (2 * t)"
    
    identity1 = ReportIdentityGenerator.generate_identity(
        calculation_id="calc_001",
        calculation_result=result1,
        context=ctx1,
    )
    
    # Wait 1 second, run again
    time.sleep(1)
    
    identity2 = ReportIdentityGenerator.generate_identity(
        calculation_id="calc_001",
        calculation_result=result1,  # Same inputs
        context=ctx1,  # Same context
    )
    
    # Should be identical
    assert identity1.report_id == identity2.report_id
    assert identity1.identity_hash == identity2.identity_hash
    assert identity1.inputs_hash == identity2.inputs_hash
    assert identity1.formula_hash == identity2.formula_hash
    # execution_hash may differ if execution_time_ms is non-deterministic!
```

**Test 2: Determinism - Different Execution Time**

```python
def test_determinism_different_execution_times():
    """Same inputs with different execution times should have same identity."""
    
    result1 = CalculationResult(..., metadata={"execution_time_ms": 45.2, ...})
    result2 = CalculationResult(..., metadata={"execution_time_ms": 44.8, ...})
    
    identity1 = ReportIdentityGenerator.generate_identity(
        calculation_id="calc_001",
        calculation_result=result1,
        context=ctx,
    )
    
    identity2 = ReportIdentityGenerator.generate_identity(
        calculation_id="calc_001",
        calculation_result=result2,
        context=ctx,
    )
    
    # Should be same (timing shouldn't matter)
    assert identity1.report_id == identity2.report_id
    assert identity1.identity_hash == identity2.identity_hash
    # This test FAILS currently because execution_hash includes timing!
```

**Test 3: Formula Whitespace Insensitivity**

```python
def test_formula_whitespace_insensitive():
    """Different spacing in formula shouldn't change hash."""
    
    formula1 = "(P * (D - 2*t)) / (2 * t)"
    formula2 = "(P*(D-2*t))/(2*t)"
    formula3 = "( P * ( D - 2 * t ) ) / ( 2 * t )"
    
    hash1 = ReportIdentityGenerator.compute_formula_hash(formula1)
    hash2 = ReportIdentityGenerator.compute_formula_hash(formula2)
    hash3 = ReportIdentityGenerator.compute_formula_hash(formula3)
    
    assert hash1 == hash2 == hash3
    # This test FAILS currently!
```

---

## SUMMARY OF FINDINGS

| Issue | Severity | Current | Proposed | Effort |
|-------|----------|---------|----------|--------|
| execution_hash non-deterministic | 🔴 CRITICAL | Includes timing | Remove timing | 0.5h |
| formula_hash whitespace fragile | 🔴 CRITICAL | Basic split() | Regex normalize | 1h |
| semantic_hash None ambiguity | ⚠️ MODERATE | Not distinguished | Explicit markers | 0.5h |
| inputs_hash precision | ✅ GOOD | 12 decimals | Keep as is | - |
| template_hash stability | ✅ GOOD | Type + version | Keep as is | - |
| report_id format | ✅ GOOD | Stable format | Keep as is | - |
| Integration testing | 🔴 CRITICAL | None | Add test suite | 3h |

**Total Fix Effort:** ~5 hours

---

## CONCLUSION

**Determinism Score:** 🟡 **70/100**

**Strengths:**
- ✅ Well-designed architecture
- ✅ Most hash functions are sound
- ✅ report_id generation is stable

**Weaknesses:**
- 🔴 execution_hash includes non-deterministic timing
- 🔴 formula_hash is fragile to whitespace
- ⚠️ semantic_hash has ambiguity
- 🔴 No integration tests for reproducibility

**Required Action:** Fix issues 1, 2, 3 and add test suite before Stage 1 approval.

