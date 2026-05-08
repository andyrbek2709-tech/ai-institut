# PHASE 2 — STAGE 2: FORMULA ENGINE HARDENING
## Research Phase Report

**Date:** 2026-05-09  
**Phase:** Research & Architecture Analysis  
**Status:** IN PROGRESS

---

## EXECUTIVE SUMMARY

Задача: Create production-grade formula execution architecture for calculations platform.

**Ключевые вопросы:**
1. Какая архитектура лучше для dependency graph execution?
2. DAG vs other execution models?
3. Как обеспечить security SymPy evaluation?
4. Как управлять intermediate variables?
5. Как сохранить unit consistency?
6. Как масштабировать на 100+ formulas?

---

## SECTION 1: FORMULA EXECUTION ENGINES

### Option 1: SymPy-based (Current Foundation)

**Pros:**
- ✅ Already integrated (src/engine/evaluator.py)
- ✅ Strong symbolic computation
- ✅ Unit support via Pint
- ✅ Formula simplification/transformation
- ✅ Large community, well-documented

**Cons:**
- ❌ Single-formula evaluation only
- ❌ No built-in dependency tracking
- ❌ Security concerns (eval-like behavior)
- ❌ Performance issues on large expressions
- ❌ No intermediate variable support

**Security Model:**
```
Risk: SymPy.sympify() can execute code
sympify("__import__('os').system('rm -rf /')")  # DANGEROUS!

Mitigation:
- Parse-only mode (no code execution)
- Whitelist allowed functions
- Sandbox evaluation
- No external input to sympify()
```

**Verdict:** ✅ **KEEP** as core, but add hardening layer

---

### Option 2: NetworkX-based DAG Execution

**Pros:**
- ✅ Production-grade graph library
- ✅ Topological sort built-in
- ✅ Cycle detection
- ✅ Path finding, visualization support
- ✅ Well-tested, used in Airflow, Dask

**Cons:**
- ❌ Need to build formula execution layer
- ❌ Additional dependency

**When to Use:** Primary choice for dependency graph infrastructure

**Verdict:** ✅ **ADOPT** for execution graph

---

### Option 3: Custom DAG + Execution Planner

**Pros:**
- ✅ Full control
- ✅ Optimized for our use case
- ✅ No external dependencies

**Cons:**
- ❌ High maintenance burden
- ❌ Reinvent the wheel
- ❌ Harder to scale

**Verdict:** ❌ **AVOID** — use NetworkX instead

---

## SECTION 2: DEPENDENCY GRAPH & EXECUTION MODEL

### Current State (Broken)
```python
# src/engine/evaluator.py - SIMPLE, NO DEPENDENCIES
expr = sp.sympify(formula)
result = expr.subs(variables)
```

### Target Architecture

**Phase 1: Build Execution Graph**
```
Template → Extract Variables & Formulas
         → Build Dependency Graph (NetworkX)
         → Topological Sort
         → Execution Plan
```

**Phase 2: Execute with Tracing**
```
For each formula in execution_order:
  1. Check all dependencies resolved
  2. Execute formula
  3. Store result + trace
  4. Move to next
```

**Phase 3: Handle Intermediate Variables**
```
Example (pipe_stress template):
  input_pressure → [Formula 1] → stress (intermediate)
  stress → [Formula 2] → safety_factor (output)
  safety_factor → [Formula 3] → utilization_ratio (output)
```

### Execution Graph Structure

```
FormulaExecutionGraph:
  - nodes: {formula_id: formula_metadata}
  - edges: {formula_id: [dependent_formula_ids]}
  - topological_order: [formula_id_1, formula_id_2, ...]
  - trace: {formula_id: execution_result}

ExecutionResult:
  - value: float
  - unit: str (e.g., "MPa")
  - formula: str
  - dependencies_used: [var_name_1, var_name_2, ...]
  - timestamp: float
  - duration_ms: float
```

---

## SECTION 3: SYMBOLIC COMPUTATION SECURITY

### SymPy Evaluation Risks

**DANGER 1: Code Injection via sympify()**
```python
# UNSAFE
formula = user_input  # "x + 1"
expr = sp.sympify(formula)  # Can execute code!

# SAFE
expr = sp.sympify(formula, transformations=sp.parse_expr)  # Parse-only
# Or use safe_sympify() wrapper
```

**DANGER 2: Unsupported Operations**
```python
# These should be blocked:
"x.__class__.__bases__[0].__subclasses__()"  # Reflection
"__import__('os').system('...')"  # Code execution
"eval(...)"  # Arbitrary Python
"exec(...)"  # Arbitrary Python
```

**DANGER 3: Performance Attacks**
```python
# DoS: Simplification hangs on complex expressions
sympy.simplify("((x+1)**1000).expand()")  # Takes forever
```

### Mitigation Strategy

**Layer 1: Input Validation**
```python
def safe_sympify(formula: str) -> sp.Expr:
    # Check against blacklist of dangerous patterns
    dangerous_patterns = [
        '__import__', '__class__', '__bases__',
        'eval', 'exec', 'globals', 'locals',
        'getattr', 'setattr', 'delattr',
        'open', 'file', 'input', 'raw_input'
    ]
    
    for pattern in dangerous_patterns:
        if pattern in formula:
            raise SecurityError(f"Dangerous pattern: {pattern}")
    
    # Parse with transformations=sp.parse_expr (parse-only, no code execution)
    return sp.sympify(formula, transformations=sp.parse_expr)
```

**Layer 2: Allowed Operations Whitelist**
```python
ALLOWED_FUNCTIONS = {
    'sin', 'cos', 'tan',
    'sqrt', 'exp', 'log',
    'abs', 'max', 'min',
    'pi', 'e',
    'atan2', 'sinh', 'cosh',
    # ... add only safe functions
}

def check_allowed_functions(expr: sp.Expr) -> bool:
    functions_used = {f.name for f in expr.atoms(sp.Function)}
    return functions_used.issubset(ALLOWED_FUNCTIONS)
```

**Layer 3: Execution Sandbox**
```python
# Timeout-based execution
from signal import alarm, SIGALRM

def evaluate_with_timeout(expr, variables, timeout_ms=1000):
    try:
        signal.alarm(timeout_ms // 1000)  # Convert to seconds
        result = float(expr.subs(variables))
        signal.alarm(0)  # Cancel alarm
        return result
    except (signal.alarm, TimeoutError):
        raise ExecutionTimeout(f"Formula evaluation exceeded {timeout_ms}ms")
```

**Verdict:** ✅ **IMPLEMENT** 3-layer security model

---

## SECTION 4: UNIT SYSTEM INTEGRATION (Pint)

### Current State
```python
# No unit tracking in execution
result = float(expr.subs(variables))  # Units lost!
```

### Target State
```
Input: pressure = 50 MPa
       diameter = 100 mm
       
Formula: stress = (pressure * diameter) / (2 * thickness)

Output: stress = 25 MPa (units preserved)
```

### Pint Integration Strategy

**Phase 1: Wrap Variables in Quantities**
```python
from pint import UnitRegistry

ureg = UnitRegistry()

inputs = {
    'pressure': 50 * ureg.MPa,
    'diameter': 100 * ureg.mm,
    'thickness': 5 * ureg.mm
}
```

**Phase 2: Execute with Unit Tracking**
```python
# SymPy can work with Pint quantities
result = expr.subs(inputs)
# result = 500 MPa·mm / (2·mm) = 250 MPa
```

**Phase 3: Validate Units**
```python
expected_dimension = ureg.MPa  # Expected output dimension
actual_dimension = result.dimensionality

if actual_dimension != expected_dimension.dimensionality:
    raise DimensionalError(
        f"Expected {expected_dimension.dimensionality}, "
        f"got {actual_dimension.dimensionality}"
    )
```

### Dimensional Analysis Rules

```python
DIMENSIONAL_RULES = {
    'stress': ureg.Force / ureg.Area,  # MPa
    'strain': ureg.dimensionless,       # unitless
    'safety_factor': ureg.dimensionless,
    'deflection': ureg.Length,          # mm
}

def validate_dimensions(formula_id, result):
    expected = DIMENSIONAL_RULES.get(formula_id)
    if expected and result.dimensionality != expected.dimensionality:
        raise DimensionalError(...)
```

**Verdict:** ✅ **ADOPT** Pint for all execution

---

## SECTION 5: INTERMEDIATE VARIABLES & CHAINING

### Problem

Current templates only support input → formula → output.
Real engineering needs:
- stress (intermediate) → safety_factor
- utilization_ratio depends on safety_factor

### Solution: Marked Dependencies

```yaml
formulas:
  hoop_stress:
    expression: "(pressure * diameter) / (2 * thickness)"
    outputs: ["stress"]  # Mark as output (not input)
    type: "intermediate"
  
  safety_factor:
    expression: "allowable_stress / stress"
    inputs: ["allowable_stress", "stress"]
    outputs: ["safety_factor"]
    type: "output"
```

### Execution Order

```
1. Load inputs (pressure, diameter, ...)
2. Execute hoop_stress → get stress (intermediate)
3. Execute safety_factor → uses stress from step 2
4. Return final outputs only (safety_factor)
```

### Graph Representation

```
pressure ──┐
diameter ──┼──→ hoop_stress ──→ stress ──┐
thickness ─┘                              ├──→ safety_factor ──→ OUTPUT
allowable_stress ──────────────────────────┘
```

**Verdict:** ✅ **IMPLEMENT** with explicit output marking

---

## SECTION 6: PERFORMANCE & SCALABILITY

### Targets

- Single template: < 100ms for 50 formulas
- Large template: < 500ms for 100+ formulas
- Typical case: < 50ms for 10 formulas

### Optimization Strategies

**Strategy 1: Topological Sort Once**
```python
# Build graph once during template load
execution_order = nx.topological_sort(graph)  # O(V + E)

# Use many times during execution
for formula_id in execution_order:
    results[formula_id] = execute(formula_id)
```

**Strategy 2: Lazy Evaluation**
```python
# Only execute formulas needed for final outputs
required_formulas = compute_transitive_closure(output_formulas)

for formula_id in required_formulas:
    results[formula_id] = execute(formula_id)
```

**Strategy 3: Expression Caching**
```python
# Cache parsed SymPy expressions
expression_cache = {}

def get_expression(formula_id, formula_text):
    if formula_id not in expression_cache:
        expression_cache[formula_id] = sp.sympify(formula_text)
    return expression_cache[formula_id]
```

**Strategy 4: Parallel Execution**
```
For independent branches:
  stress1 ──→ output1
  stress2 ──→ output2
  
Can execute in parallel (future optimization)
```

### Benchmark Targets

```
Template Size        Single Exec    100 Execs
10 formulas          10ms           200ms
50 formulas          40ms           800ms
100 formulas         100ms          2s
```

**Verdict:** ✅ **IMPLEMENT** strategies 1-3 initially, leave 4 for future

---

## SECTION 7: RESULT TRACEABILITY

### Current Problem
```python
result = 250  # How did we get here? What was used?
```

### Solution: Execution Trace

```python
@dataclass
class FormulaTrace:
    formula_id: str
    formula_expression: str
    inputs_used: dict[str, Any]  # {var_name: value}
    output: float
    unit: str
    timestamp: float
    duration_ms: float
    status: str  # "success" or "error"
    error: Optional[str]
    
    def to_dict(self):
        return {
            'formula': self.formula_id,
            'expression': self.formula_expression,
            'input_values': self.inputs_used,
            'output': self.output,
            'unit': self.unit,
            'ms': self.duration_ms,
        }
```

### Execution Trace Example

```json
{
  "template_id": "pipe_stress",
  "status": "success",
  "execution_traces": [
    {
      "step": 1,
      "formula": "hoop_stress",
      "expression": "(P * D) / (2 * t)",
      "inputs": {"P": 50, "D": 100, "t": 5},
      "output": 500.0,
      "unit": "MPa",
      "ms": 2.5
    },
    {
      "step": 2,
      "formula": "safety_factor",
      "expression": "S_a / stress",
      "inputs": {"S_a": 800, "stress": 500},
      "output": 1.6,
      "unit": "dimensionless",
      "ms": 1.8
    }
  ],
  "total_ms": 12.3
}
```

**Use Cases:**
- Debugging failed calculations
- Report generation (formula-by-formula breakdown)
- AI training data (how was this result derived?)
- Engineering audit trail

**Verdict:** ✅ **IMPLEMENT** full traceability

---

## SECTION 8: ENGINEERING VALIDATION LAYER

### Post-Calculation Checks

**Check 1: Physical Plausibility**
```python
PLAUSIBILITY_RULES = {
    'stress': lambda v: v > 0,  # Stress must be positive
    'safety_factor': lambda v: v > 0.1,  # SF > 0.1 (safety critical)
    'strain': lambda v: abs(v) < 10,  # Strain typically < 1000%
    'thickness': lambda v: v > 0,  # Thickness must be positive
}
```

**Check 2: Engineering Ranges**
```python
SAFE_RANGES = {
    'stress': (0, 2000),  # MPa — typical for steels
    'safety_factor': (0.5, 100),  # Normally 1-10
    'temperature': (-50, 500),  # Celsius
}
```

**Check 3: Invalid Combinations**
```python
def validate_combination(results):
    stress = results['stress']
    material_yield = results['material_yield']
    
    if stress > material_yield:
        warnings.append(
            f"Stress ({stress} MPa) exceeds yield strength "
            f"({material_yield} MPa)"
        )
```

### Validation Output

```python
@dataclass
class ValidationWarning:
    level: str  # "warning" or "error"
    code: str  # e.g., "STRESS_EXCEEDS_YIELD"
    message: str
    affected_outputs: list[str]  # Which outputs are affected
```

**Verdict:** ✅ **IMPLEMENT** as post-calculation layer

---

## SECTION 9: TESTING STRATEGY

### Test Categories

**1. Execution Graph Tests** (10 tests)
- Empty graph
- Single formula
- Linear dependency chain
- Parallel branches
- Circular dependency detection
- Large graphs (100+ formulas)

**2. Security Tests** (8 tests)
- Code injection attempts
- Reflection attacks
- Timeout on complex expressions
- Unsupported operations
- Illegal patterns in formulas

**3. Unit Consistency Tests** (6 tests)
- Unit propagation
- Dimensional analysis
- Incompatible dimensions
- Automatic conversions
- Unit mismatch detection

**4. Intermediate Variable Tests** (5 tests)
- Intermediate variable resolution
- Chained dependencies
- Multiple intermediate steps
- Circular intermediate deps
- Missing intermediate inputs

**5. Traceability Tests** (4 tests)
- Complete execution trace
- Step-by-step verification
- Trace format validation
- Performance metrics in trace

**6. Performance Tests** (4 tests)
- Single formula < 10ms
- 50 formulas < 100ms
- 100 formulas < 500ms
- Cache effectiveness

**7. Engineering Validation Tests** (6 tests)
- Plausibility checks
- Range validation
- Combination detection
- Warning generation

**Total: 43 tests minimum**

---

## SECTION 10: IMPLEMENTATION ROADMAP

### Recommended Order

**Etap 1: Foundation (Execution Graph)**
- [ ] FormulaExecutionGraph class (NetworkX-based)
- [ ] Topological sort + execution order
- [ ] Dependency resolution
- [ ] Tests (10)

**Etap 2: Secure Executor**
- [ ] Safe SymPy wrapper (safe_sympify)
- [ ] Operation whitelist
- [ ] Timeout sandbox
- [ ] Tests (8)

**Etap 3: Unit-Aware Execution**
- [ ] Pint integration
- [ ] Unit wrapping for inputs
- [ ] Dimensional analysis
- [ ] Unit validation
- [ ] Tests (6)

**Etap 4: Intermediate Variables**
- [ ] Mark intermediate vs output formulas
- [ ] Resolve intermediate dependencies
- [ ] Chain execution
- [ ] Tests (5)

**Etap 5: Traceability**
- [ ] FormulaTrace dataclass
- [ ] Trace collection during execution
- [ ] Trace formatting
- [ ] Tests (4)

**Etap 6: Validation Layer**
- [ ] Plausibility rules
- [ ] Range validation
- [ ] Combination checks
- [ ] Tests (6)

**Etap 7: Performance**
- [ ] Caching strategies
- [ ] Lazy evaluation
- [ ] Performance tests
- [ ] Tests (4)

**Etap 8: Integration**
- [ ] Update runner.py to use new engine
- [ ] Update API endpoints
- [ ] Integration tests

**Etap 9: Documentation**
- [ ] Architecture document
- [ ] Security model documentation
- [ ] Scaling guidelines
- [ ] Developer guide

---

## DECISIONS SUMMARY

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Formula engine | Keep SymPy + harden | Already integrated, strong features |
| Execution model | NetworkX DAG | Production-grade, well-tested |
| Security | 3-layer model | Defense in depth |
| Units | Pint throughout | Dimensional safety |
| Intermediates | Explicit marking | Clear dependency flow |
| Performance | Lazy evaluation + caching | Scales to 100+ formulas |
| Traceability | Full execution trace | Debugging & AI readiness |
| Validation | Post-calculation layer | Engineering plausibility |

---

## RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|-----------|
| SymPy code injection | CRITICAL | 3-layer security model |
| Infinite loops (circular) | HIGH | Topological sort validation |
| Performance (100+ formulas) | MEDIUM | Lazy evaluation + caching |
| Unit mismatch bugs | HIGH | Dimensional analysis layer |
| Complex dependency chains | MEDIUM | Graph visualization support |

---

## ESTIMATED EFFORT

- Research & architecture: 4 hours ✅ (this document)
- Stage 1 (Graph): 8 hours
- Stage 2 (Security): 6 hours
- Stage 3 (Units): 8 hours
- Stage 4 (Intermediates): 6 hours
- Stage 5 (Traceability): 4 hours
- Stage 6 (Validation): 6 hours
- Stage 7 (Performance): 4 hours
- Stage 8 (Integration): 4 hours
- Stage 9 (Documentation): 4 hours
- Testing: 10 hours

**Total: ~60 hours (realistic 80-100 with iteration)**

---

## NEXT STEPS

1. ✅ Research complete
2. → Architect Stage 1: FormulaExecutionGraph
3. → Implement FormulaExecutionGraph (6-8 hours)
4. → Build comprehensive tests
5. → Proceed to Stage 2: Secure Executor

---

*End of Research Phase Report*
