# ÉTAP 2: ENGINEERING VALIDATION & CALCULATION SEMANTICS
## Comprehensive Design Document

**Status:** Design Phase  
**Version:** 1.0  
**Date:** 2026-05-09  

---

## OVERVIEW

ÉTAP 2 extends the unit-aware execution platform with semantic validation, engineering integrity checking, and auditability.

### Current State (ÉTAP 1)
- ✅ Unit propagation (Pint)
- ✅ Dimensional analysis
- ✅ Multi-formula execution (DAG)
- ✅ API integration
- ❌ Engineering validation
- ❌ Semantic metadata
- ❌ Explainability
- ❌ Audit trail

### Goals (ÉTAP 2)

Build production-grade engineering correctness layer:

1. **Physical Plausibility Validation** — reject physically impossible outputs
2. **Semantic Metadata System** — engineering meaning for each variable
3. **Calculation Explainability** — explain every step to engineers
4. **Engineering Audit Trail** — full trace for compliance/review
5. **Failure Analysis** — categorize and explain failures
6. **Template Semantic Rules** — extend templates with engineering constraints

---

## ARCHITECTURE: VALIDATION PIPELINE

```
Input Variables + Units
    ↓
[EXISTING] Quantity Creation & Dimensional Analysis
    ↓
[NEW] Input Semantic Validation
    ├─ Range checks (expected_min, expected_max)
    ├─ Domain rules (must be positive, etc.)
    └─ Engineering constraints
    ↓
[EXISTING] Formula Execution
    ↓
[NEW] Output Semantic Validation
    ├─ Physical plausibility
    ├─ Engineering constraint checks
    ├─ Safety factor verification
    ├─ Instability detection
    └─ Failure mode detection
    ↓
[NEW] Explainability Generation
    ├─ Execution explanation
    ├─ Validation explanation
    └─ Failure explanation
    ↓
[NEW] Audit Trail Generation
    ├─ Input capture
    ├─ Execution trace
    ├─ Validation trace
    └─ Failure trace
    ↓
Response (with validation results, explanations, audit trail)
```

---

## COMPONENT 1: ENGINEERING VALIDATION FRAMEWORK

### Architecture

```python
# Base classes
SeverityLevel (enum): INFO, WARNING, ERROR, FAILURE
ValidationRule (abstract): extensible base for rules
ValidationResult: pass/fail + message + severity
ValidationContext: execution context for rule evaluation

# Rule types
PhysicalPlausibilityRule: thickness >= 0, efficiency <= 1
RangeCheckRule: min <= value <= max
EngineeringConstraintRule: custom domain rules
SafetyCheckRule: safety_factor >= minimum
InstabilityDetectionRule: detects numerical instability
DisciplineSpecificRule: discipline-dependent rules
```

### Validation Rules Examples

**Stress/Pressure Domain:**
```python
ValidationRule(
    id="stress_positive",
    name="Stress must be positive",
    formula_output="stress",
    check="stress >= 0",
    severity="ERROR",
    message="Stress cannot be negative (indicates model error)",
    engineering_notes="Negative stress is physically impossible in most cases"
)

ValidationRule(
    id="stress_plausible",
    name="Stress within material limits",
    formula_output="stress",
    check="stress <= yield_strength",
    severity="FAILURE",
    message="Stress exceeds material yield strength",
    probable_causes=[
        "Insufficient wall thickness",
        "Excessive pressure",
        "Incorrect material selection"
    ],
    mitigations=[
        "Increase wall thickness",
        "Reduce operating pressure",
        "Use material with higher yield strength"
    ]
)
```

**Efficiency Domain:**
```python
ValidationRule(
    id="efficiency_plausible",
    name="Efficiency must be <= 1.0",
    formula_output="efficiency",
    check="efficiency <= 1.0",
    severity="ERROR",
    message="Efficiency > 100% is physically impossible",
    engineering_notes="Violates thermodynamic law of conservation"
)
```

**Safety Factor Domain:**
```python
ValidationRule(
    id="safety_factor_adequate",
    name="Safety factor meets minimum",
    formula_output="safety_factor",
    parameters={"minimum": 1.5},
    check="safety_factor >= minimum",
    severity="FAILURE",
    message="Safety factor below required minimum",
    engineering_notes="Check design constraints and material selection"
)
```

### Rule Storage

Rules defined in template YAML:
```yaml
template:
  id: pipe_stress
  formulas: [...]
  
  # NEW: Engineering validation rules
  engineering_rules:
    - id: stress_positive
      name: Stress must be positive
      output: stress
      check: "stress >= 0"
      severity: ERROR
      engineering_notes: "Stress cannot be negative"
    
    - id: efficiency_plausible
      name: Efficiency <= 1.0
      output: efficiency
      check: "efficiency <= 1.0"
      severity: ERROR
      engineering_notes: "Cannot exceed 100% efficiency"
```

### Rule Evaluation

```python
class EngineeringValidationEngine:
    def validate_output(
        self,
        output_name: str,
        output_value: Quantity,
        variables: dict[str, Quantity],
        rules: list[ValidationRule]
    ) -> list[ValidationResult]:
        """Evaluate all applicable rules for output."""
        results = []
        for rule in rules:
            if rule.applies_to(output_name):
                result = rule.evaluate(output_value, variables)
                results.append(result)
        return results
```

---

## COMPONENT 2: SEMANTIC METADATA SYSTEM

### Variable Semantics

Each variable carries engineering meaning:

```python
@dataclass
class VariableSemantics:
    """Engineering meaning of a variable."""
    id: str
    name: str
    engineering_meaning: str  # What it means physically
    physical_interpretation: str  # How to understand it
    discipline: str  # "piping", "structural", "thermal", etc.
    expected_range: tuple[float, float]  # (min, max)
    expected_unit: str
    engineering_notes: str
    failure_modes: list[str]
    related_variables: list[str]
```

### Examples

```python
# Pipe stress
VariableSemantics(
    id="stress",
    name="Hoop Stress",
    engineering_meaning="Circumferential stress in pipe wall due to internal pressure",
    physical_interpretation="Tensile stress acting tangentially around pipe circumference",
    discipline="piping",
    expected_range=(0, 1000),  # MPa
    expected_unit="MPa",
    engineering_notes="Must not exceed material yield strength. Typically < 2/3 yield for design.",
    failure_modes=[
        "Elastic instability (bulging)",
        "Plastic instability (thinning)",
        "Brittle fracture (low temperature)"
    ],
    related_variables=["wall_thickness", "inner_diameter", "internal_pressure"]
)

# Efficiency
VariableSemantics(
    id="efficiency",
    name="Isentropic Efficiency",
    engineering_meaning="Ratio of actual to isentropic work for thermodynamic process",
    physical_interpretation="Fraction of theoretical maximum work extracted/required",
    discipline="thermal",
    expected_range=(0.7, 0.95),  # dimensionless
    expected_unit="dimensionless",
    engineering_notes="Cannot exceed 1.0 due to thermodynamic law. Typical range 0.7-0.95.",
    failure_modes=[
        "Calculation error if result > 1.0",
        "Design issue if < 0.5",
        "Unusual conditions if outside typical range"
    ],
    related_variables=["pressure_ratio", "temperature", "process_type"]
)
```

### Semantic Metadata Storage

In templates:
```yaml
template:
  id: pipe_stress
  
  # NEW: Semantic metadata
  variable_semantics:
    - id: stress
      name: Hoop Stress
      engineering_meaning: "Circumferential stress in pipe wall"
      discipline: piping
      expected_range: [0, 1000]
      expected_unit: MPa
      engineering_notes: "Must not exceed yield strength"
      failure_modes:
        - "Elastic instability"
        - "Plastic instability"
      related_variables: ["wall_thickness", "pressure"]
```

---

## COMPONENT 3: CALCULATION EXPLAINABILITY SYSTEM

### Explanation Types

```python
@dataclass
class ExecutionExplanation:
    """Explains calculation execution to engineer."""
    formula_id: str
    formula_text: str
    description: str
    step_order: int
    reason_for_step: str  # Why is this calculated here?
    dependencies: list[str]  # Which formulas does this depend on?
    inputs_used: dict[str, str]  # input_name -> display value + unit

@dataclass
class ValidationExplanation:
    """Explains validation result to engineer."""
    rule_id: str
    rule_name: str
    status: str  # "passed", "warning", "failed"
    severity: str
    message: str
    engineering_notes: str
    actual_value: str  # display value + unit
    expected_condition: str  # what the rule checks
    why_it_matters: str

@dataclass
class FailureExplanation:
    """Explains failure mode to engineer."""
    failure_id: str
    failure_type: str  # e.g., "physical_implausibility"
    message: str
    root_cause: str
    probable_causes: list[str]
    mitigation_suggestions: list[str]
    debug_hints: list[str]
```

### Example Explanations

```python
# Execution explanation
ExecutionExplanation(
    formula_id="stress_calc",
    formula_text="stress = (pressure * diameter) / (2 * thickness)",
    description="Calculate hoop stress in pipe wall",
    step_order=2,
    reason_for_step="Hoop stress is fundamental to piping design",
    dependencies=["pressure", "diameter", "thickness"],
    inputs_used={
        "pressure": "10 MPa",
        "diameter": "100 mm",
        "thickness": "5 mm"
    }
)

# Validation explanation
ValidationExplanation(
    rule_id="stress_plausible",
    rule_name="Stress within material limits",
    status="failed",
    severity="FAILURE",
    message="Stress exceeds material yield strength",
    engineering_notes="This calculation violates material design constraints",
    actual_value="450 MPa",
    expected_condition="stress <= yield_strength (250 MPa)",
    why_it_matters="Exceeding yield strength causes plastic deformation and failure"
)

# Failure explanation
FailureExplanation(
    failure_id="f001",
    failure_type="physical_implausibility",
    message="Efficiency result > 1.0 is physically impossible",
    root_cause="Calculation logic error or incorrect input units",
    probable_causes=[
        "Formula reversal (actual/theoretical instead of theoretical/actual)",
        "Unit mismatch (energy vs. power)",
        "Measurement error in inputs"
    ],
    mitigation_suggestions=[
        "Review formula in template",
        "Verify input units match expected values",
        "Check calculation against reference"
    ],
    debug_hints=[
        "Efficiency should be between 0 and 1.0",
        "Check isentropic process assumptions",
        "Verify pressure/temperature values are reasonable"
    ]
)
```

### Explainability Engine

```python
class ExplainabilityEngine:
    def explain_execution(
        self,
        execution_plan: ExecutionPlan,
        traces: list[ExecutionTrace],
        semantics: dict[str, VariableSemantics]
    ) -> list[ExecutionExplanation]:
        """Generate execution explanations."""
        pass
    
    def explain_validation(
        self,
        results: list[ValidationResult],
        semantics: dict[str, VariableSemantics]
    ) -> list[ValidationExplanation]:
        """Generate validation explanations."""
        pass
    
    def explain_failure(
        self,
        validation_failures: list[ValidationResult],
        variables: dict[str, Quantity],
        semantics: dict[str, VariableSemantics]
    ) -> list[FailureExplanation]:
        """Generate failure explanations."""
        pass
```

---

## COMPONENT 4: ENGINEERING AUDIT TRAIL SYSTEM

### Audit Trail Structure

```python
@dataclass
class AuditTrailEntry:
    """Single entry in engineering audit trail."""
    timestamp: datetime
    event_type: str  # "input", "formula_execution", "validation", "failure"
    details: dict
    severity: str

@dataclass
class EngineeringAuditTrail:
    """Complete audit trail for a calculation."""
    calculation_id: str
    template_id: str
    user: str
    started_at: datetime
    completed_at: datetime
    entries: list[AuditTrailEntry]
    
    # Summary
    input_snapshot: dict  # All inputs captured
    execution_summary: dict  # Which formulas executed
    validation_summary: dict  # Total passed/failed/warnings
    failure_summary: dict  # Failure count by severity
    
    def to_report(self) -> str:
        """Generate human-readable audit report."""
        pass
```

### Audit Trail Capture

```python
class AuditLogger:
    def log_input(self, variable_name: str, value: Quantity, semantics: VariableSemantics):
        """Log input variable."""
        entry = AuditTrailEntry(
            timestamp=now(),
            event_type="input",
            details={
                "variable": variable_name,
                "value": value.magnitude,
                "unit": str(value.units),
                "expected_range": semantics.expected_range,
                "engineering_meaning": semantics.engineering_meaning
            },
            severity="info"
        )
        trail.append(entry)
    
    def log_formula_execution(self, trace: ExecutionTrace):
        """Log formula execution."""
        entry = AuditTrailEntry(
            timestamp=now(),
            event_type="formula_execution",
            details={
                "formula_id": trace.formula_id,
                "inputs": trace.inputs_used,
                "output": trace.output,
                "unit": trace.output_unit,
                "duration_ms": trace.duration_ms
            },
            severity="info"
        )
        trail.append(entry)
    
    def log_validation(self, result: ValidationResult):
        """Log validation result."""
        entry = AuditTrailEntry(
            timestamp=now(),
            event_type="validation",
            details={
                "rule_id": result.rule_id,
                "status": result.status,
                "message": result.message,
                "severity": result.severity
            },
            severity=result.severity.lower()
        )
        trail.append(entry)
```

---

## COMPONENT 5: FAILURE ANALYSIS SYSTEM

### Failure Categorization

```python
class FailureCategory(str, Enum):
    """Categories of calculation failures."""
    PHYSICAL_IMPLAUSIBILITY = "physical_implausibility"
    ENGINEERING_CONSTRAINT = "engineering_constraint"
    SAFETY_VIOLATION = "safety_violation"
    NUMERICAL_INSTABILITY = "numerical_instability"
    INPUT_ERROR = "input_error"
    FORMULA_ERROR = "formula_error"
    UNIT_ERROR = "unit_error"

@dataclass
class FailureAnalysis:
    """Analysis of a calculation failure."""
    failure_id: str
    category: FailureCategory
    severity: str  # ERROR, FAILURE
    message: str
    root_cause: str
    probable_causes: list[str]
    affected_outputs: list[str]
    mitigation_suggestions: list[str]
    reference_docs: list[str]
    confidence: float  # 0.0 to 1.0
```

### Failure Analyzer

```python
class FailureAnalyzer:
    def analyze(
        self,
        validation_failures: list[ValidationResult],
        variables: dict[str, Quantity],
        semantics: dict[str, VariableSemantics],
        traces: list[ExecutionTrace]
    ) -> list[FailureAnalysis]:
        """Analyze validation failures and provide detailed analysis."""
        analyses = []
        
        for failure in validation_failures:
            analysis = self._analyze_single_failure(
                failure, variables, semantics, traces
            )
            analyses.append(analysis)
        
        return analyses
    
    def _analyze_single_failure(
        self,
        failure: ValidationResult,
        variables: dict[str, Quantity],
        semantics: dict[str, VariableSemantics],
        traces: list[ExecutionTrace]
    ) -> FailureAnalysis:
        """Analyze single failure."""
        # Categorize failure
        category = self._categorize_failure(failure, variables, semantics)
        
        # Find probable causes
        probable_causes = self._find_probable_causes(
            failure, variables, semantics, category
        )
        
        # Generate mitigations
        mitigations = self._generate_mitigations(
            failure, category, probable_causes
        )
        
        return FailureAnalysis(
            failure_id=failure.rule_id,
            category=category,
            severity=failure.severity,
            message=failure.message,
            root_cause=self._find_root_cause(failure, variables),
            probable_causes=probable_causes,
            affected_outputs=[failure.output_name],
            mitigation_suggestions=mitigations,
            reference_docs=self._find_relevant_docs(failure, category),
            confidence=0.95
        )
```

---

## COMPONENT 6: TEMPLATE SEMANTIC RULES

### Extended Template Schema

```yaml
template:
  id: pipe_stress_analysis
  name: Pipe Stress Calculation
  version: 2.0
  discipline: piping
  
  # Variables with semantic metadata
  inputs:
    - id: pressure
      name: Internal Pressure
      unit: MPa
      engineering_meaning: "Gauge pressure inside pipe"
      expected_range: [0, 100]
      required: true
      notes: "Absolute pressure = gauge + atmospheric"
    
    - id: diameter
      name: Outer Diameter
      unit: mm
      engineering_meaning: "Outside diameter of pipe"
      expected_range: [10, 2000]
      required: true
      notes: "Standard pipe sizes recommended"
  
  # Formulas with semantic metadata
  formulas:
    - id: stress_calc
      name: Hoop Stress
      expression: "(pressure * diameter) / (2 * thickness)"
      description: "Calculate circumferential stress per Barlow's formula"
      discipline: piping
      engineering_notes: "Valid for thin-walled pipes (thickness < diameter/20)"
  
  # NEW: Engineering validation rules
  engineering_rules:
    - id: stress_positive
      applies_to: stress
      rule: "value >= 0"
      severity: ERROR
      message: "Stress cannot be negative"
      engineering_notes: "Indicates model or input error"
    
    - id: stress_plausible
      applies_to: stress
      rule: "value <= 300"  # Material-dependent
      severity: FAILURE
      message: "Stress exceeds typical design limit"
      engineering_notes: "Check material selection or increase thickness"
  
  # NEW: Semantic constraints
  semantic_constraints:
    - constraint: "diameter > 2 * thickness"
      reason: "Required for thin-wall assumption"
      severity: WARNING
  
  # NEW: Variable relationships
  variable_semantics:
    stress:
      failure_modes:
        - "Elastic instability (buckling)"
        - "Plastic instability (necking)"
        - "Brittle fracture"
      related_variables: ["pressure", "diameter", "thickness", "material"]
      physical_constraints:
        - "Must be <= yield_strength"
        - "Must be >= 0"
```

---

## VALIDATION PIPELINE INTEGRATION

### Full Request/Response

**Request (unchanged):**
```json
{
  "template_id": "pipe_stress",
  "inputs": [
    {"name": "pressure", "value": 10, "unit": "MPa"},
    {"name": "diameter", "value": 100, "unit": "mm"},
    {"name": "thickness", "value": 5, "unit": "mm"}
  ]
}
```

**Response (enhanced):**
```json
{
  "status": "success",
  "template_id": "pipe_stress",
  "results": {
    "stress": {"value": 500, "unit": "MPa"}
  },
  
  // NEW: Validation results
  "validation": {
    "status": "failed",
    "results": [
      {
        "rule_id": "stress_plausible",
        "status": "failed",
        "severity": "FAILURE",
        "message": "Stress exceeds material limit",
        "engineering_notes": "Check material or design"
      }
    ]
  },
  
  // NEW: Explanations
  "explanations": {
    "execution": [
      {
        "formula_id": "stress_calc",
        "step_order": 1,
        "reason": "Calculate hoop stress",
        "inputs": {"pressure": "10 MPa", "diameter": "100 mm"}
      }
    ],
    "validation": [
      {
        "rule_id": "stress_plausible",
        "status": "failed",
        "message": "Stress exceeds yield strength",
        "why_it_matters": "Material will deform plastically"
      }
    ]
  },
  
  // NEW: Audit trail summary
  "audit": {
    "calculation_id": "calc_xyz",
    "timestamp": "2026-05-09T10:15:30Z",
    "entries_summary": {
      "inputs_logged": 3,
      "formulas_executed": 1,
      "validations_run": 5,
      "failures_detected": 1
    }
  }
}
```

---

## IMPLEMENTATION PHASES

### Phase 2.1: Validation Framework (2-3 hours)
- ValidationRule base class
- ValidationEngine
- Rule evaluation system
- Integration with Runner

### Phase 2.2: Semantic Metadata (1-2 hours)
- VariableSemantics dataclass
- Template schema extension
- Semantics loader
- Semantic context management

### Phase 2.3: Explainability (2-3 hours)
- ExecutionExplanation generation
- ValidationExplanation generation
- FailureExplanation generation
- ExplainabilityEngine

### Phase 2.4: Audit Trail (1-2 hours)
- AuditTrailEntry dataclass
- AuditLogger
- Trail capture integration
- Report generation

### Phase 2.5: Failure Analysis (2-3 hours)
- FailureAnalyzer
- Failure categorization
- Root cause detection
- Mitigation suggestion engine

### Phase 2.6: API Integration (1-2 hours)
- Response schema updates
- Validation inclusion in responses
- Explanation endpoints
- Audit trail endpoints

### Phase 2.7: Testing & Documentation (2-3 hours)
- Comprehensive test suite
- Documentation and examples
- Performance baseline
- Completion report

---

## EXPECTED DELIVERABLES

After ÉTAP 2 completion, will exist:

✅ Engineering validation framework  
✅ Semantic metadata system  
✅ Calculation explainability  
✅ Engineering audit trail  
✅ Failure analysis system  
✅ Extended template schema  
✅ API integration with validation  
✅ 50+ tests  
✅ 5 documentation guides  

---

## NOT DOING IN ÉTAP 2

❌ AI-based validation rule generation  
❌ OCR/document processing  
❌ Parser system  
❌ WebSocket real-time updates  
❌ Batch processing  
❌ Advanced scaling  

---

## WEAK POINTS & FUTURE WORK

- Rules are template-defined (good) but not learned from execution
- Failure analysis uses pattern matching (good but not ML-based)
- Semantics are static (not adaptive to user feedback)
- No cross-template consistency checking
- No regulatory framework integration (yet)

---

## SUCCESS CRITERIA

ÉTAP 2 is complete when:

1. ✅ All validation rules evaluate correctly
2. ✅ All outputs have validation results
3. ✅ All failures have explanations
4. ✅ Audit trail captures all events
5. ✅ Semantic metadata loaded correctly
6. ✅ All 24 ÉTAP 1 tests still pass
7. ✅ 50+ new tests passing
8. ✅ No breaking changes to API
9. ✅ Performance within 2x ÉTAP 1 baseline
10. ✅ Complete documentation

---

**Next:** Implementation starts with Component 1 (Validation Framework).
