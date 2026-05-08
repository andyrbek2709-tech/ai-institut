# PHASE 2 — STAGE 2: ARCHITECTURE IMPACT ANALYSIS

**Date:** 2026-05-09  
**Status:** PRE-IMPLEMENTATION ANALYSIS

---

## EXECUTIVE SUMMARY

STAGE 2 requires **fundamental architectural shift** from `SafeFormulaExecutor(variables: dict[str, float])` to **unit-aware execution** with `dict[str, pint.Quantity]`.

This is **NOT a simple parameter change** — it impacts all 3 security layers, execution model, and integration points.

---

## CURRENT ARCHITECTURE (STAGE 1 DELIVERED)

```
SafeFormulaExecutor.execute(formula: str, variables: dict[str, float]) → ExecutionResult
  ├─ Layer 1: Input Validation (pattern detection only)
  │   ├─ Forbidden patterns (code injection, reflection)
  │   ├─ Large number detection
  │   ├─ Parenthesis nesting depth
  │   └─ NO unit syntax validation
  │
  ├─ Layer 2: Parse & Check (SymPy whitelist)
  │   ├─ SymPy.sympify(formula)
  │   ├─ Function whitelist check
  │   ├─ Expression depth validation
  │   └─ Cache parsed expression
  │   └─ NO dimensional analysis
  │
  ├─ Layer 3: Execute with Timeout (threading sandbox)
  │   ├─ expr.subs(variables)  ← expects float values
  │   ├─ expr.evalf()
  │   ├─ Thread-based timeout
  │   └─ NO unit propagation
  │
  └─ Result: ExecutionResult
      ├─ value: float (naked number)
      ├─ unit: Optional[str] (metadata only, not connected to value)
      ├─ status, error_code, error_message
      └─ formula, variables_used, duration_ms
```

**Problem:** `unit` field exists but is **metadata only**. No enforcement that `value` corresponds to declared `unit`.

---

## TARGET ARCHITECTURE (STAGE 2)

```
SafeFormulaExecutor.execute(formula: str, variables: dict[str, Quantity]) → ExecutionResult
  ├─ Layer 1: Input Validation (pattern detection + unit syntax)
  │   ├─ Forbidden patterns (code injection, reflection)
  │   ├─ Large number detection
  │   ├─ Parenthesis nesting depth
  │   └─ ✅ NEW: Unit string syntax validation (e.g., "MPa", "mm", "N/mm²")
  │
  ├─ Unit Binding Layer (NEW LAYER 1.5)
  │   ├─ Parse variable unit strings from template
  │   ├─ Create Pint Quantity objects: Quantity(value, unit)
  │   ├─ Validate unit syntax
  │   └─ Store in variables dict as Quantity
  │
  ├─ Layer 2: Parse & Check (SymPy whitelist + dimensional analysis)
  │   ├─ SymPy.sympify(formula)
  │   ├─ Function whitelist check
  │   ├─ Expression depth validation
  │   ├─ ✅ NEW: Dimensional analysis (MPa + mm → ERROR, MPa * mm → OK)
  │   ├─ ✅ NEW: Unit propagation rules (force / area = pressure)
  │   └─ Cache parsed expression
  │
  ├─ Layer 3: Execute with Timeout (Pint-aware sandbox)
  │   ├─ expr.subs(variables)  ← now receives Quantity values
  │   ├─ Pint automatic unit conversion in math ops
  │   ├─ expr.evalf() with Quantity result
  │   ├─ Thread-based timeout
  │   └─ ✅ NEW: Unit-aware error handling
  │
  └─ Result: ExecutionResult
      ├─ value: Quantity (value WITH unit baked in)
      ├─ unit: str (extracted from Quantity for API)
      ├─ status, error_code, error_message
      └─ formula, variables_used, duration_ms
```

---

## CRITICAL BREAKING CHANGES

### 1. Function Signature

**Before:**
```python
def execute(
    self,
    formula: str,
    variables: dict[str, float],  # <-- NAKED FLOATS
    formula_id: str = "unknown"
) -> ExecutionResult:
```

**After:**
```python
from pint import Quantity

def execute(
    self,
    formula: str,
    variables: dict[str, Quantity],  # <-- PINT QUANTITIES
    formula_id: str = "unknown"
) -> ExecutionResult:
```

### 2. Layer 2 Security Check

**Before:**
```python
# Check allowed functions only (no dimensional awareness)
functions_used = {f.name for f in expr.atoms(sp.Function)}
for func in functions_used:
    if func in self.FORBIDDEN_FUNCTIONS:
        raise SecurityError(f"Forbidden function: {func}")
    if func not in self.ALLOWED_FUNCTIONS:
        raise SecurityError(f"Disallowed function: {func}")
```

**After:**
```python
# SAME function whitelist check (backward compatible)
functions_used = {f.name for f in expr.atoms(sp.Function)}
for func in functions_used:
    if func in self.FORBIDDEN_FUNCTIONS:
        raise SecurityError(f"Forbidden function: {func}")
    if func not in self.ALLOWED_FUNCTIONS:
        raise SecurityError(f"Disallowed function: {func}")

# NEW: Dimensional analysis pass
# Check that formula operations are dimensionally consistent
# E.g., catch "MPa + mm" as invalid
try:
    self._check_dimensional_consistency(expr, variables)
except DimensionalAnalysisError as e:
    raise SecurityError(f"Invalid dimensional math: {e}")
```

### 3. Layer 3 Execution

**Before:**
```python
def execute_formula():
    try:
        r = expr.subs(variables)  # variables: dict[str, float]
        if hasattr(r, 'evalf'):
            r = float(r.evalf())
        else:
            r = float(r)
        result[0] = r
    except Exception as e:
        error[0] = e
```

**After:**
```python
def execute_formula():
    try:
        # variables now contains Quantity objects
        # SymPy + Pint work together to propagate units
        r = expr.subs(variables)
        
        # r is now a Quantity (or can be Quantity)
        if isinstance(r, Quantity):
            # Store as-is, keeping unit information
            result[0] = r
        elif hasattr(r, 'evalf'):
            # Try to get Quantity if possible
            try:
                r = r.evalf()
                if isinstance(r, Quantity):
                    result[0] = r
                else:
                    # Fallback: wrap in default unit
                    result[0] = Quantity(float(r), 'dimensionless')
            except:
                result[0] = Quantity(float(r), 'dimensionless')
        else:
            result[0] = Quantity(float(r), 'dimensionless')
    except Exception as e:
        error[0] = e
```

### 4. ExecutionResult Changes

**Before:**
```python
@dataclass
class ExecutionResult:
    status: ExecutionStatus
    value: Optional[float] = None  # NAKED FLOAT
    unit: Optional[str] = None     # METADATA ONLY
    # ...
```

**After:**
```python
@dataclass
class ExecutionResult:
    status: ExecutionStatus
    value: Optional[Quantity] = None  # ✅ QUANTITY (value + unit together)
    unit: Optional[str] = None        # Derived from Quantity if needed
    # ...
    
    def as_dict(self) -> dict:
        """API serialization: value + unit as separate fields."""
        return {
            'value': float(self.value.magnitude) if self.value else None,
            'unit': str(self.value.units) if self.value else None,
            'status': self.status,
            # ...
        }
```

---

## NEW COMPONENTS REQUIRED

### 1. UnitRegistry Manager
```python
class UnitManager:
    """Centralized Pint UnitRegistry and utilities."""
    
    def __init__(self):
        self.ureg = pint.UnitRegistry()
        # Load custom engineering units
        self._load_engineering_units()
    
    def create_quantity(self, value: float, unit: str) -> Quantity:
        """Create a Quantity with validation."""
        try:
            return self.ureg.Quantity(value, unit)
        except:
            raise InvalidUnitError(f"Invalid unit string: {unit}")
    
    def check_dimensional_compatibility(self, expr, variables) -> None:
        """Verify dimensional consistency of formula operations."""
        # Implementation in ETAP 2
```

### 2. Dimensional Analysis Layer
```python
class DimensionalAnalyzer:
    """Check dimensional consistency of formulas."""
    
    def analyze(self, expr: sp.Expr, variables: dict[str, Quantity]) -> None:
        """
        Check that all operations are dimensionally valid.
        
        Examples:
        - MPa + mm  → INVALID (different dimensions)
        - MPa * mm  → VALID (produces mixed dimension)
        - MPa / mm  → VALID
        - force / area → stress (physical meaning)
        """
        # Implementation in ETAP 2
```

### 3. Unit Propagation Rules
```python
# SymPy operations automatically propagate Pint units
# No explicit code needed if using Pint.SymPy bridge correctly

# Example:
pressure = Quantity(100, 'MPa')
area = Quantity(10, 'mm**2')
force = pressure * area  # Automatically: MPa * mm² = 10000 N
```

---

## IMPACT ON EXISTING CODE

### Affected Files:

1. **services/calculation-engine/src/engine/safe_executor.py**
   - ✅ Layer 1: Add unit syntax validation
   - ✅ Add UnitManager integration
   - ✅ Update Layer 2: Add dimensional analysis
   - ✅ Update Layer 3: Pint-aware execution
   - ✅ Update ExecutionResult handling

2. **services/calculation-engine/src/engine/execution_graph.py**
   - ✅ FormulaNode: track unit information per formula
   - ✅ ExecutionTrace: record unit at each step
   - ✅ Execution planner: validate unit flow through graph

3. **services/calculation-engine/src/runner.py**
   - ✅ Build variables dict with Quantities (not floats)
   - ✅ Call SafeFormulaExecutor with Quantities
   - ✅ Handle ExecutionResult with Quantity values

4. **services/calculation-engine/tests/test_safe_executor.py**
   - ✅ Add Pint-based test cases
   - ✅ Dimensional mismatch tests
   - ✅ Unit propagation tests

5. **services/calculation-engine/tests/test_execution_graph.py**
   - ✅ Test unit tracking through graph
   - ✅ Test intermediate variable units
   - ✅ Test execution trace with units

### Backward Compatibility:

**NOT BACKWARD COMPATIBLE** — this is a breaking change, but:
- ✅ Internal to calculation-engine service
- ✅ External API (REST endpoints) can still accept/return floats + units separately
- ✅ Conversion happens at API boundary (HttpInput → dict[str, Quantity] → Executor)

---

## EXECUTION STRATEGY

### Stage 2 Roadmap (Production-First)

1. **ETAP 1: FULL PINT INTEGRATION** (8 hours)
   - 1.1 Create UnitManager + unit utilities
   - 1.2 Update SafeFormulaExecutor signature
   - 1.3 Add unit binding layer
   - 1.4 Add dimensional analysis
   - 1.5 Update Layer 3 for Pint execution
   - 1.6 Comprehensive unit propagation tests
   
2. **ETAP 2: ENGINEERING VALIDATION LAYER** (6 hours)
   - 2.1 Create EngineeringValidator
   - 2.2 Add post-calculation validation rules
   - 2.3 Support template-defined rules
   - 2.4 Severity levels (warning/error)

3. **ETAP 3: EXECUTION TRACEABILITY** (4 hours)
   - 3.1 Enhance ExecutionTrace with units
   - 3.2 Full formula-by-formula trace
   - 3.3 Dependency resolution trace
   - 3.4 Timing + validation events

4. **ETAP 4: INTERMEDIATE VARIABLE SYSTEM** (4 hours)
   - 4.1 Integrate derived variables
   - 4.2 Support chained calculations
   - 4.3 Reusable intermediate outputs
   - 4.4 Dependency-aware execution

5. **ETAP 5: PERFORMANCE HARDENING** (4 hours)
   - 5.1 Test on 100+ formula templates
   - 5.2 Deep dependency chains
   - 5.3 Cache validation
   - 5.4 Optimization review

6. **ETAP 6: TESTING EXPANSION** (4 hours)
   - 6.1 Unit propagation comprehensive tests
   - 6.2 Engineering validation tests
   - 6.3 Execution trace tests
   - 6.4 Performance benchmarks

7. **ETAP 7: DOCUMENTATION** (2 hours)
   - 7.1 Architecture diagrams
   - 7.2 Completion report
   - 7.3 Integration guide

**Total: ~32 hours of focused production-grade work**

---

## SUCCESS CRITERIA

After STAGE 2 completion:

✅ **Unit-Aware Execution**
- Every formula result carries unit information
- MPa + mm → ERROR (caught in Layer 2)
- MPa * mm → N (automatic propagation)
- Conversions work automatically (10 mm = 1 cm)

✅ **Engineering Validation**
- Negative thickness → WARNING or ERROR
- Stress < 0 → ERROR
- Division by near-zero → WARNING
- Extensible rule system

✅ **Execution Traceability**
- Formula execution order recorded
- Input → output per formula
- Units at each stage
- Validation events logged
- Dependency resolution traced

✅ **Intermediate Variables**
- Derived variables computed and stored
- Chained calculations supported
- Reusable intermediate outputs
- Full dependency awareness

✅ **Production Grade**
- 50+ comprehensive tests
- No edge case failures
- <100ms execution for typical templates
- Full error handling + recovery

---

## NEXT STEPS

1. ✅ Review this architecture impact analysis
2. ⬜ Begin ETAP 1: FULL PINT INTEGRATION
3. ⬜ Create unit propagation tests
4. ⬜ Implement UnitManager
5. ⬜ Update SafeFormulaExecutor layer by layer

**Ready to proceed?**
