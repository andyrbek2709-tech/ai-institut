# PHASE 2 — STAGE 2: IMPLEMENTATION CHECKLIST

**Status:** IN PROGRESS  
**Target Completion:** Production-grade (all 7 étapes)

---

## ÉTAP 1: FULL PINT INTEGRATION (8 hours)

### 1.1 Create UnitManager + Unit Utilities
- ✅ Create `services/calculation-engine/src/engine/unit_manager.py` (180 lines)
  - ✅ UnitRegistry setup with engineering units (MPa, kPa, bar, N, etc.)
  - ✅ Custom engineering units loading
  - ✅ create_quantity() with validation
  - ✅ Unit parsing and normalization (parse_unit_string)
  - ✅ Quantity serialization for API (quantity_to_dict, dict_to_quantity)
  - ✅ Unit conversion (convert_to_unit)
  - ✅ Dimensionality checking (get_dimensionality, are_dimensionally_compatible)

- ✅ Create `services/calculation-engine/src/engine/dimensional_analysis.py` (200 lines)
  - ✅ DimensionalAnalyzer class
  - ✅ check_dimensional_consistency()
  - ✅ Operation validation (Add, Mul, Div, Pow)
  - ✅ Error reporting for dimensional mismatches (DimensionalAnalysisError)
  - ✅ Dimensionality inference

- ✅ Create `services/calculation-engine/src/engine/pint_safe_executor.py` (250 lines)
  - ✅ PintAwareSafeFormulaExecutor (extends SafeFormulaExecutor)
  - ✅ execute_with_units() method
  - ✅ execute_with_unit_strings() convenience method
  - ✅ Unit validation layer
  - ✅ Pint-aware execution (Layer 3)
  - ✅ Security layers intact

- ✅ Unit tests for unit_manager.py (40+ tests in test_unit_manager.py)
  - ✅ Quantity creation (valid, invalid, edge cases)
  - ✅ Unit conversion + compatibility
  - ✅ Dimensionality checking
  - ✅ Serialization/deserialization
  - ✅ Dimensionless quantities
  - ✅ Engineering units (MPa, N, kPa, bar)

- ✅ Integration tests for PintAwareSafeFormulaExecutor (30+ tests in test_pint_safe_executor.py)
  - ✅ Basic execution with units
  - ✅ Unit propagation (MPa × mm² → N)
  - ✅ Dimensional mismatch detection (MPa + mm → ERROR)
  - ✅ Valid addition (same dimension)
  - ✅ Security enforcement (eval, __import__ blocked)
  - ✅ Complex formulas
  - ✅ Edge cases (zero, negative, precision)

### 1.2 Update SafeFormulaExecutor Signature
- [ ] SafeFormulaExecutor.__init__() → accept UnitManager
- [ ] SafeFormulaExecutor.execute() signature change
  - [ ] variables: dict[str, float] → dict[str, Quantity]
  - [ ] ExecutionResult.value: float → Optional[Quantity]
  - [ ] Preserve ExecutionStatus, error handling

- [ ] Update ExecutionResult dataclass
  - [ ] value: Optional[Quantity]
  - [ ] as_dict() for API serialization
  - [ ] unit property for backward compat if needed

### 1.3 Add Unit Binding Layer
- [ ] Layer 1.5 in SafeFormulaExecutor._validate_and_bind_units()
  - [ ] Validate unit syntax in variable dict keys
  - [ ] Convert variables to Quantity objects
  - [ ] Error handling for invalid units

### 1.4 Add Dimensional Analysis to Layer 2
- [ ] Layer 2 enhancement: _parse_and_check()
  - [ ] After function whitelist check
  - [ ] Call DimensionalAnalyzer.check()
  - [ ] Catch invalid dimensional math (e.g., MPa + mm)
  - [ ] Provide clear error messages

### 1.5 Update Layer 3 for Pint Execution
- [ ] Layer 3 enhancement: _execute_with_timeout()
  - [ ] expr.subs(variables) with Quantity objects
  - [ ] Handle SymPy + Pint interaction
  - [ ] Extract unit from result
  - [ ] Error handling for unit mismatches

### 1.6 Comprehensive Unit Propagation Tests
- [ ] Create `services/calculation-engine/tests/test_pint_integration.py`
  - [ ] Basic Quantity operations (50+ tests)
    - [ ] Valid dimensional math (MPa * mm = force)
    - [ ] Invalid dimensional math (MPa + mm = ERROR)
    - [ ] Automatic conversions (10 mm = 1 cm)
    - [ ] Unit normalization
  
  - [ ] SafeFormulaExecutor with Quantities
    - [ ] Simple formula with units
    - [ ] Complex formula with multiple units
    - [ ] Intermediate variables with units
    - [ ] Invalid operations caught
  
  - [ ] ExecutionResult serialization
    - [ ] as_dict() for API
    - [ ] Unit extraction
    - [ ] Edge cases (dimensionless, complex units)

---

## ÉTAP 2: ENGINEERING VALIDATION LAYER (6 hours)

### 2.1 Create EngineeringValidator
- [ ] Create `services/calculation-engine/src/engine/engineering_validator.py`
  - [ ] ValidationRule dataclass
  - [ ] EngineeringValidator class
  - [ ] validate_result() method
  - [ ] Rule severity levels (WARNING, ERROR, CRITICAL)

### 2.2 Add Post-Calculation Validation Rules
- [ ] Built-in rules:
  - [ ] Negative thickness check
  - [ ] Negative stress check
  - [ ] Efficiency > 1.0 check
  - [ ] Utilization ratio > 1.0 check
  - [ ] Division by near-zero warning
  - [ ] NaN / Infinity check
  - [ ] Unrealistic ranges check

### 2.3 Support Template-Defined Rules
- [ ] EngineeringValidator.load_rules_from_template()
  - [ ] Parse validation rules from template YAML
  - [ ] Support custom formulas for rules
  - [ ] Rule inheritance/composition

### 2.4 Severity Levels & Messages
- [ ] ValidationEvent dataclass
  - [ ] rule_id, description, severity
  - [ ] affected_variable, value, unit
  - [ ] recovery_suggestion

- [ ] Test validation rules (20+ tests)

---

## ÉTAP 3: EXECUTION TRACEABILITY (4 hours)

### 3.1 Enhance ExecutionTrace with Units
- [ ] ExecutionTrace dataclass enhancement
  - [ ] input_units: dict[str, str]
  - [ ] output_unit: Optional[str]
  - [ ] validation_events: list[ValidationEvent]
  - [ ] dependency_trace: list[str] (formulas used)

### 3.2 Formula-by-Formula Trace
- [ ] Complete execution trace in FormulaExecutionGraph.execute()
  - [ ] Record each formula execution
  - [ ] Input values + units per formula
  - [ ] Output value + unit per formula
  - [ ] Timing information

### 3.3 Dependency Resolution Trace
- [ ] Track dependency resolution order
  - [ ] Which formulas were dependencies
  - [ ] When they were resolved
  - [ ] Order of computation

### 3.4 Validation Events in Trace
- [ ] ValidationEvent recording during execution
  - [ ] Record all validation results
  - [ ] Store in ExecutionTrace.validation_events
  - [ ] Include in trace output

- [ ] Test trace generation (15+ tests)

---

## ÉTAP 4: INTERMEDIATE VARIABLE SYSTEM (4 hours)

### 4.1 Integrate Derived Variables
- [ ] Update FormulaExecutionGraph
  - [ ] Track derived variables
  - [ ] Variable categories (input, intermediate, output)
  - [ ] Dependency chain management

### 4.2 Support Chained Calculations
- [ ] Enable formulas that depend on other formula outputs
  - [ ] stress → allowable_stress → utilization
  - [ ] Complete chain execution
  - [ ] Error propagation through chain

### 4.3 Reusable Intermediate Outputs
- [ ] Store intermediate variable results
  - [ ] Make available to subsequent formulas
  - [ ] Avoid recomputation where possible
  - [ ] Cache intermediate values

### 4.4 Dependency-Aware Execution
- [ ] FormulaExecutionGraph.execute()
  - [ ] Compute only required formulas
  - [ ] Skip unnecessary intermediate computations
  - [ ] Full dependency DAG traversal

- [ ] Test intermediate variables (15+ tests)

---

## ÉTAP 5: PERFORMANCE HARDENING (4 hours)

### 5.1 Test on Deep Dependency Chains
- [ ] Create test template with 100+ formulas
- [ ] Create deep chain: 50-level dependency tree
- [ ] Measure execution time
- [ ] Target: <100ms for typical sizes

### 5.2 Performance Profiling
- [ ] Profile SafeFormulaExecutor
  - [ ] Identify hot paths
  - [ ] Optimize unit propagation
  - [ ] Cache effectiveness

### 5.3 Cache Validation
- [ ] Expression cache behavior
  - [ ] Cache hit rate measurement
  - [ ] Correctness verification
  - [ ] Memory usage monitoring

### 5.4 Optimization Review
- [ ] Lazy evaluation verification
- [ ] Unnecessary computations removed
- [ ] Benchmark results documented

---

## ÉTAP 6: TESTING EXPANSION (4 hours)

### 6.1 Unit Propagation Comprehensive Tests
- [ ] 20+ tests for Pint integration
- [ ] Valid/invalid dimensional math
- [ ] Automatic conversions
- [ ] Complex units (N/mm², kPa, etc.)

### 6.2 Engineering Validation Tests
- [ ] 20+ tests for validation rules
- [ ] Each rule tested independently
- [ ] Rule combinations
- [ ] Template-defined rules

### 6.3 Execution Trace Tests
- [ ] 15+ tests for trace generation
- [ ] Complete trace information
- [ ] Dependency resolution accuracy
- [ ] Validation event recording

### 6.4 Performance Benchmarks
- [ ] Execution time benchmarks
- [ ] Memory usage measurements
- [ ] Scalability tests (1-100 formulas)
- [ ] Result documentation

---

## ÉTAP 7: DOCUMENTATION (2 hours)

### 7.1 Architecture Diagrams
- [ ] Execution flow diagram (with units)
- [ ] Unit propagation diagram
- [ ] Layer interaction diagram
- [ ] Trace generation diagram

### 7.2 PHASE_2_STAGE_2_COMPLETION_REPORT.md
- [ ] Executive summary
- [ ] Architecture delivered
- [ ] Components (UnitManager, Validator, Tracer)
- [ ] Integration points
- [ ] Success criteria verification
- [ ] Test coverage summary
- [ ] Performance results
- [ ] Known limitations
- [ ] Future enhancements

### 7.3 Integration Guide
- [ ] How to use unit-aware executor
- [ ] API examples
- [ ] Common patterns
- [ ] Error handling guide
- [ ] Performance tuning

---

## TEST COVERAGE TARGETS

By ÉTAP 6:
- **50+ comprehensive tests** across all layers
- **100% pass rate** on unit, dimensional, validation tests
- **Scalability verified** on 100+ formula templates
- **Benchmark baseline** established

---

## COMMIT STRATEGY

Each étape = 1-2 commits:

1. **ÉTAP 1 commit:** `feat(calc-platform): STAGE 2.1 Full Pint Integration Complete`
   - UnitManager + DimensionalAnalyzer
   - SafeFormulaExecutor updates
   - Comprehensive tests

2. **ÉTAP 2 commit:** `feat(calc-platform): STAGE 2.2 Engineering Validation Layer Complete`
   - EngineeringValidator implementation
   - Validation rules
   - Tests

3. **ÉTAP 3 commit:** `feat(calc-platform): STAGE 2.3 Execution Traceability Complete`
   - Enhanced traces
   - Dependency tracking
   - Tests

4. **ÉTAP 4 commit:** `feat(calc-platform): STAGE 2.4 Intermediate Variables Complete`
   - Chained calculations
   - Derived variables
   - Tests

5. **ÉTAP 5 commit:** `feat(calc-platform): STAGE 2.5 Performance Hardening Complete`
   - Optimization results
   - Benchmarks

6. **ÉTAP 6 commit:** `feat(calc-platform): STAGE 2.6 Testing Expansion Complete`
   - Comprehensive test suite
   - 50+ tests, 100% pass

7. **ÉTAP 7 commit:** `feat(calc-platform): STAGE 2 COMPLETE — Production-Grade Execution Engine`
   - Completion report
   - Documentation
   - Architecture diagrams

---

## PROGRESS TRACKING

### Completed:
- ✅ Architecture impact analysis
- ✅ Implementation checklist

### In Progress:
- ⏳ ÉTAP 1.1: UnitManager implementation

### Next:
- [ ] ÉTAP 1.2-1.6: SafeFormulaExecutor updates + tests
- [ ] ÉTAP 2-7: Validation, traceability, optimization

**Target:** All 7 étapes complete by 2026-05-13

