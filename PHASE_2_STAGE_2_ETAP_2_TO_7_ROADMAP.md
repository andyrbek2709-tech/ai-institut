# PHASE 2 — STAGE 2: ÉTAP 1.2-7 IMPLEMENTATION ROADMAP

**Current Status:** ✅ ÉTAP 1.1 Complete  
**Next:** ÉTAP 1.2-1.6 Integration Phase  
**Target Completion:** All 7 étapes by 2026-05-13

---

## ÉTAP 1.2: ExecutionGraph Integration (2 hours)

**Goal:** Make ExecutionGraph unit-aware, track unit flow through DAG.

### Changes Required

**File: `src/engine/execution_graph.py`**

```python
@dataclass
class FormulaNode:
    # Existing fields...
    unit: Optional[str] = None  # ✅ Already exists
    # ADD:
    output_unit: Optional[str] = None  # Unit of output variable

@dataclass
class ExecutionTrace:
    # Existing fields...
    output: float  # ← becomes output_quantity next
    unit: Optional[str] = None  # ← gets populated from Quantity
    # ADD:
    input_units: dict[str, str]  # {'var_name': 'unit'}
    validation_events: list = field(default_factory=list)  # ✅ Future

class FormulaExecutionGraph:
    def build_from_template(self, template_dict: dict) -> None:
        # ADD: Extract unit information from template
        # For each formula, store expected output unit
        # Validate unit flow consistency
        
    def execute_with_units(self, variables: Dict[str, Quantity]) -> ExecutionResult:
        # ✅ Already planned, replaces execute()
        # Pass Quantities through graph
        # Record units in ExecutionTrace

    def validate_unit_flow(self) -> None:
        # NEW: Verify unit propagation through DAG
        # Check intermediate variables have consistent units
        # Raises error if dimension mismatches in graph
```

### Implementation Steps

1. [ ] Update FormulaNode to track output units
2. [ ] Update ExecutionTrace to capture input_units
3. [ ] Add validate_unit_flow() method
4. [ ] Update execute() to pass Quantities through
5. [ ] Record units in trace collection
6. [ ] Test: 10+ tests for unit flow through graph

**Deliverables:**
- Unit-aware FormulaExecutionGraph
- Tests: 10+ for unit propagation through DAG
- Example: stress → utilization_ratio (unit chain)

---

## ÉTAP 1.3: Runner Integration (2 hours)

**Goal:** Integrate PintAwareSafeFormulaExecutor into runner.py.

### Changes Required

**File: `src/engine/runner.py`**

```python
class CalculationRunner:
    def __init__(self, ...):
        # ADD:
        self.executor = PintAwareSafeFormulaExecutor(timeout_ms=1000)
        self.unit_manager = self.executor.unit_manager
    
    def _build_variables_with_units(
        self,
        variables_dict: dict[str, float],
        variable_definitions: dict
    ) -> dict[str, Quantity]:
        # NEW: Convert float values to Quantities using unit info
        # Example:
        #   variables_dict: {"pressure": 100}
        #   variable_definitions: {"pressure": {"unit": "MPa"}}
        #   Returns: {"pressure": Quantity(100, "MPa")}
        
    def execute_template(self, template_dict: dict, variables_dict: dict) -> CalculationResult:
        # CHANGE: Build variables as Quantities
        variables_with_units = self._build_variables_with_units(...)
        
        # CHANGE: Use PintAwareSafeFormulaExecutor instead of SafeFormulaExecutor
        if is_multi_formula:
            # Use FormulaExecutionGraph with unit support
            result = self.graph.execute_with_units(variables_with_units)
        else:
            # Use PintAwareSafeFormulaExecutor.execute_with_units()
            result = self.executor.execute_with_units(...)
        
        # Handle results with units preserved
        return self._build_calculation_result(result, ...)
```

### Implementation Steps

1. [ ] Add UnitManager to CalculationRunner
2. [ ] Create _build_variables_with_units() method
3. [ ] Update execute_template() to use unit variables
4. [ ] Update execute_with_graph() to handle Quantities
5. [ ] Update result building to preserve units
6. [ ] Test: 10+ end-to-end tests with runner

**Deliverables:**
- Runner integrated with unit-aware executor
- Variables built as Quantities from template
- Results preserve unit information
- Tests: 10+ for runner integration

---

## ÉTAP 1.4: API Layer Integration (2 hours)

**Goal:** REST API accepts/returns float+unit, converts internally.

### Changes Required

**File: `src/api/routes/calculations.py` (example)**

```python
from pydantic import BaseModel

class CalculationRequest(BaseModel):
    template_id: str
    variables: dict[str, VariableInput]
    # Example: {
    #   "pressure": {"value": 100, "unit": "MPa"},
    #   "area": {"value": 10, "unit": "mm**2"}
    # }

class VariableInput(BaseModel):
    value: float
    unit: str

class CalculationResponse(BaseModel):
    success: bool
    result: Optional[CalculationOutput] = None
    error: Optional[str] = None

class CalculationOutput(BaseModel):
    value: float
    unit: str
    execution_time_ms: float
    # Example: {"value": 1000000, "unit": "newton", "execution_time_ms": 12.5}

@router.post("/calculate")
async def calculate(request: CalculationRequest) -> CalculationResponse:
    # Convert API input to runner variables
    variables_dict = {}
    for var_name, var_input in request.variables.items():
        variables_dict[var_name] = var_input.value  # Float
        # Unit is in template, used by runner to create Quantities
    
    # Call runner (which handles Quantity conversion internally)
    result = runner.execute_template(
        template_dict=template,
        variables_dict=variables_dict
    )
    
    # Convert result to API output (float + unit)
    return CalculationResponse(
        success=result.success,
        result=CalculationOutput(
            value=float(result.output.magnitude),
            unit=str(result.output.units),
            execution_time_ms=result.execution_time_ms
        )
    )
```

### Implementation Steps

1. [ ] Update request/response models to include units
2. [ ] Add unit validation in request handler
3. [ ] Pass units to runner via template
4. [ ] Convert Quantity results to float+unit
5. [ ] Maintain backward compatibility
6. [ ] Test: 10+ tests for API serialization

**Deliverables:**
- REST API with unit support (no breaking changes)
- Quantities used internally
- API accepts/returns float+unit
- Tests: 10+ for API integration

---

## ÉTAP 1.5: Performance Hardening (2 hours)

**Goal:** Verify execution performance on large templates.

### Testing Strategy

1. **Test Templates**
   - Small: 1-10 formulas ✅ (already works)
   - Medium: 10-50 formulas (create test template)
   - Large: 50-100+ formulas (create test template)
   - Deep chain: 50-level dependency tree

2. **Performance Targets**
   - Small templates: <10ms
   - Medium templates: <50ms
   - Large templates: <100ms
   - Deep chains: <200ms

3. **Profiling**
   - Identify hot paths
   - Cache effectiveness (expression cache, quantity cache)
   - Unit conversion overhead
   - Dimensional analysis cost

### Implementation Steps

1. [ ] Create benchmark suite with 3 template sizes
2. [ ] Create deep dependency chain template
3. [ ] Run profiling (time.perf_counter)
4. [ ] Measure cache hit rates
5. [ ] Optimize if needed
6. [ ] Document results in completion report

**Deliverables:**
- Performance benchmark suite
- Profiling results
- Optimization recommendations
- Baseline for future work

---

## ÉTAP 1.6: Documentation + Completion (1 hour)

**Goal:** Complete documentation and verification.

### Documentation to Create/Update

1. **PHASE_2_STAGE_2_COMPLETION_REPORT.md** (Main deliverable)
   - Executive summary
   - Architecture overview (with diagrams)
   - Components (UnitManager, Analyzer, Executor)
   - Test results (coverage, examples)
   - Performance benchmarks
   - Integration points
   - Operational runbook

2. **UNIT_PROPAGATION_EXAMPLES.md**
   - Visual examples of unit flow
   - Valid operations (MPa × mm² = N)
   - Invalid operations (MPa + mm = ERROR)
   - Automatic conversions (mm → cm)

3. **ENGINEER_VALIDATION_DESIGN.md** (for ÉTAP 2)
   - Validation rule format
   - Built-in rules
   - Template-defined rules
   - Severity levels

4. **Update CLAUDE.md**
   - Add PHASE_2_STAGE_2 section
   - Point to completion report
   - Link to code examples

### Architecture Diagrams

```
Diagram 1: Unit Flow Through Execution
Variables (as Quantities) → Graph → Executor → Results (with units)

Diagram 2: Security Layers with Units
Layer 1: Input validation + unit check
  ↓
Layer 1.5: Dimensional analysis (NEW)
  ↓
Layer 2: SymPy parsing + whitelist
  ↓
Layer 3: Pint-aware execution

Diagram 3: Example Calculation
pressure (100 MPa) × area (10 mm²)
  ↓
Pint automatic propagation
  ↓
Result: 1,000,000 N (force)
```

### Success Criteria Verification

- [ ] Unit propagation works (test case: MPa × mm² → N)
- [ ] Dimensional validation works (test case: MPa + mm → ERROR)
- [ ] Security layers work (test case: eval() blocked)
- [ ] 70+ tests pass ✅
- [ ] No breaking changes to API
- [ ] Performance acceptable (<100ms typical)
- [ ] Documentation complete

### Implementation Steps

1. [ ] Create comprehensive completion report
2. [ ] Add architecture diagrams
3. [ ] Update CLAUDE.md with STAGE 2 section
4. [ ] Create unit propagation examples doc
5. [ ] Verify all success criteria
6. [ ] Final review

**Deliverables:**
- PHASE_2_STAGE_2_COMPLETION_REPORT.md
- Architecture diagrams
- Example documentation
- Updated CLAUDE.md
- Success criteria verified

---

## ÉTAP 2-7 PREVIEW (After STAGE 2.1)

### ÉTAP 2: Engineering Validation Layer (6 hours)
- EngineeringValidator class
- Built-in validation rules
- Template-defined rules
- Severity levels (WARNING/ERROR/CRITICAL)

### ÉTAP 3: Execution Traceability (4 hours)
- Enhanced ExecutionTrace with validation events
- Complete formula-by-formula trace
- Dependency resolution trace
- DOCX report generation ready

### ÉTAP 4: Intermediate Variable System (4 hours)
- Chained calculations support
- Derived variables
- Reusable intermediate outputs

### ÉTAP 5: Performance Hardening (4 hours)
- Deep dependency chains (100+ formulas)
- Cache validation
- Optimization review

### ÉTAP 6: Testing Expansion (4 hours)
- 50+ comprehensive tests
- Performance benchmarks
- Integration scenarios

### ÉTAP 7: Documentation (2 hours)
- Final completion report
- Architecture documentation
- Operational guides

---

## TIMELINE

**Phase:** STAGE 2.1 — Full Pint Integration  
**Current:** ✅ ÉTAP 1.1 Complete (2026-05-09 17:55)  
**Next:** ÉTAP 1.2-1.6 Integration Phase

```
2026-05-09 17:55: ✅ ÉTAP 1.1 Complete (UnitManager, Analyzer, Executor)
2026-05-10  09:00: ⏳ ÉTAP 1.2 Integration (Graph + Runner)
2026-05-10  13:00: ⏳ ÉTAP 1.3-1.6 (API, Performance, Documentation)
2026-05-13  00:00: ⏳ STAGE 2.1 COMPLETE (all 7 étapes)
```

**Estimated Total Time:** 30 hours  
**Status:** On track (foundation solid, integration phase next)

---

## DEPENDENCIES & BLOCKERS

### No Blockers
- ✅ All dependencies in place (Pint, SymPy, NetworkX)
- ✅ Code syntactically valid
- ✅ Tests created + ready
- ✅ Security layers verified

### Nice-to-Have (Not Blocking)
- Symbolic unit inference (for ÉTAP 2+)
- Custom validation rules format (for ÉTAP 2)
- Advanced error messages (for ÉTAP 3)

---

## SUCCESS METRICS (STAGE 2 Complete)

By end of ÉTAP 7:

✅ **Unit-Aware Execution**
- Every formula carries unit information
- Invalid dimensional math caught early
- Automatic unit conversion works

✅ **Engineering Validation**
- Post-calculation validation rules
- Multiple severity levels
- Template-defined rules supported

✅ **Execution Traceability**
- Formula-by-formula execution trace
- Validation events recorded
- Dependency resolution logged

✅ **Intermediate Variables**
- Chained calculations support
- Derived variables work
- Reusable intermediate outputs

✅ **Production Grade**
- 70+ comprehensive tests
- <100ms execution time
- Full error handling
- Complete documentation

---

## READY FOR NEXT PHASE?

✅ **YES** — Proceed with ÉTAP 1.2-1.6 integration.

**No show-stoppers. All foundation in place.**

