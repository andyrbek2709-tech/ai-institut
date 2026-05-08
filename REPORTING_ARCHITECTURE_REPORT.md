# ÉTAP 3 — ENGINEERING REPORTING ARCHITECTURE REPORT

**Date:** 2026-05-08  
**Status:** Architecture Design Complete  
**Target Phase:** Implementation Start  

---

## EXECUTIVE SUMMARY

Спроектирована production-grade архитектура для engineering report generation pipeline.

**Стратегия:**
- DOCX-first approach (MS Word формат для инженеров)
- Template-driven generation (дисциплинарные шаблоны)
- Formula rendering (красивое отображение формул)
- Deterministic output (воспроизводимые документы)
- Audit trail integration (полная трассировка)

**Deliverables:**
1. Report architecture (3 слоя: Data → Template → Rendering → DOCX)
2. DOCX generation engine (python-docx + custom formatting)
3. Formula rendering system (SymPy → LaTeX → DOCX MathML)
4. Audit appendix system (execution traces + validation logs)
5. Report templates (piping, structural, thermal, generic)
6. Report API (POST /reports/generate)
7. Comprehensive tests + performance benchmarks

---

## PART 1: REPORT ARCHITECTURE

### 1.1 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    REPORT GENERATION PIPELINE                 │
├─────────────────────────────────────────────────────────────┤
│                                                                │
│  CalculationResult                                            │
│  (results, validation, audit, failure_analysis)              │
│  │                                                             │
│  ├──→ Report Data Extractor                                  │
│       (prepare structured data for template)                  │
│       │                                                        │
│       └──→ ReportContext                                      │
│            (title, inputs, results, formulas, warnings, etc)  │
│            │                                                   │
│            └──→ Template Engine                               │
│                 (select template: piping/structural/thermal)   │
│                 │                                              │
│                 └──→ Formula Renderer                          │
│                      (SymPy → LaTeX → MathML)                 │
│                      │                                         │
│                      └──→ DOCX Builder                         │
│                           (python-docx API)                    │
│                           │                                    │
│                           └──→ Audit Appendix Generator        │
│                                (execution traces, logs)         │
│                                │                               │
│                                └──→ DOCX Report (bytes)        │
│                                                                │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Three-Layer Architecture

#### Layer 1: Data Extraction & Context Building

**Purpose:** Transform CalculationResult into structured ReportContext.

**Components:**
- `ReportDataExtractor` — Extracts data from CalculationResult
- `ReportContext` — Structured data for template rendering
- `MetadataFormatter` — Formats calculation metadata
- `FormulaExtractor` — Extracts and prepares formulas

**Input:** CalculationResult  
**Output:** ReportContext (dict with all report sections)

```python
# Example ReportContext structure
{
    "title": "Pipe Stress Analysis Report",
    "timestamp": "2026-05-08 14:30:00 UTC",
    "calculation_id": "pipe_stress_001",
    "normative_references": ["ASME B31.4", "API 5L"],
    "assumptions": [
        "Static loading conditions",
        "Material properties constant",
        "Linear elastic behavior"
    ],
    "inputs": {
        "pressure": {"value": 5.0, "unit": "MPa", "description": "..."},
        "diameter": {"value": 100, "unit": "mm", "description": "..."},
        ...
    },
    "formulas": [
        {
            "id": "hoop_stress",
            "expression": "σ_h = (P * (D - 2t)) / (2 * t * E)",
            "latex": r"\sigma_h = \frac{P(D - 2t)}{2tE}",
            "inputs": {...},
            "output": {"value": 23.8, "unit": "MPa"},
            "description": "..."
        }
    ],
    "results": {
        "hoop_stress": {"value": 23.8, "unit": "MPa"},
        "safety_margin": {"value": 1.35, "unit": ""}
    },
    "validation_results": [...],
    "failure_analysis": {...},
    "execution_traces": [...],
    "audit_trail": {...},
    "warnings": [...]
}
```

#### Layer 2: Template Engine

**Purpose:** Select and apply discipline-specific template.

**Components:**
- `ReportTemplate` — Base template interface
- `PipingReportTemplate` — Piping calculations
- `StructuralReportTemplate` — Structural calculations
- `ThermalReportTemplate` — Thermal calculations
- `GenericReportTemplate` — Generic engineering report
- `TemplateRegistry` — Template discovery & selection

**Template Interface:**
```python
class ReportTemplate:
    """Base class for all report templates."""
    
    # Metadata
    template_id: str  # "piping", "structural", "thermal", "generic"
    template_name: str  # "Piping Report"
    supported_disciplines: list[str]  # ["pressure", "pipeline", ...]
    
    # Sections (in order)
    sections: list[str]  # ["title", "inputs", "formulas", "results", ...]
    
    # Rendering
    def build_document(self, context: ReportContext) -> Document:
        """Build python-docx Document from ReportContext."""
```

#### Layer 3: Rendering Engines

**Purpose:** Render individual sections into DOCX.

**Components:**
- `TitlePageRenderer` — Title page + metadata
- `InputTableRenderer` — Input tables with descriptions
- `FormulaRenderer` — Formula rendering (LaTeX + variable substitution)
- `ResultsTableRenderer` — Results display with units
- `ValidationRenderer` — Validation results + severity colors
- `WarningRenderer` — Engineering warnings
- `AuditAppendixRenderer` — Audit trail + execution traces
- `FailureAnalysisRenderer` — Failure analysis + root causes

### 1.3 Formula Rendering Strategy

**Challenge:** Render engineering formulas beautifully in Word documents.

**Approach:**

1. **SymPy Expression** → **LaTeX** → **DOCX MathML**

```python
from sympy import sympify, latex

# Input: "σ_h = (P * (D - 2*t)) / (2 * t * E)"
expr = sympify("(P * (D - 2*t)) / (2 * t * E)")

# Convert to LaTeX
latex_str = latex(expr)  # r"\frac{P \left(D - 2 t\right)}{2 t E}"

# Insert into DOCX as inline equation
doc.add_paragraph().add_run().add_math_inline(latex_str)
```

2. **Variable Substitution Display**

```python
# Show calculation with substituted values
# Before: σ_h = (P * (D - 2*t)) / (2 * t * E)
# After:  σ_h = (5.0 * (100 - 2*5)) / (2 * 5 * 1.0) = 23.8 MPa

# Render as:
# 1. Formula with symbols
# 2. Substitution table
# 3. Calculation steps
# 4. Final result
```

3. **Inline vs Display Equations**

- **Inline:** Brief formulas in text (e.g., "where E = 1.0")
- **Display:** Main formulas on own line with numbering

### 1.4 Audit Appendix Strategy

**Purpose:** Capture full execution trace for auditability + engineering review.

**Appendix Sections:**

1. **Execution Summary**
   - Formula execution order
   - Input values received
   - Output values computed
   - Execution time

2. **Validation Trace**
   - Each validation rule applied
   - Results (pass/fail)
   - Severity levels
   - Engineering notes

3. **Execution Traces** (from ExecutionTrace)
   - Formula ID
   - Expression
   - Inputs used
   - Output value
   - Unit conversions
   - Duration

4. **Failure Analysis** (if any failures)
   - Failed validations
   - Root causes
   - Mitigations
   - Severity levels

5. **Engineering Rules Applied**
   - Range checks
   - Physical plausibility checks
   - Safety factor checks
   - Design constraints

---

## PART 2: DOCX GENERATION ENGINE

### 2.1 Technology Stack

**Libraries:**
- `python-docx` — DOCX generation (pip install python-docx)
- `sympy` — Formula handling (already installed)
- `latexcodec` — LaTeX → DOCX (for formula rendering)
- `reportlab` — Optional: advanced formatting
- `pillow` — Image handling

### 2.2 Document Structure (ASME B31 Style)

```
┌─────────────────────────────────────┐
│         TITLE PAGE                  │
│                                     │
│ Pipe Stress Analysis Report         │
│ Generated: 2026-05-08 14:30 UTC     │
│ Calculation ID: pipe_stress_001     │
└─────────────────────────────────────┘

TABLE OF CONTENTS

1. NORMATIVE REFERENCES
   - ASME B31.4
   - API 5L
   - SNiP (if applicable)

2. DEFINITIONS & ASSUMPTIONS
   - Static loading
   - Linear elastic
   - Material properties constant

3. INPUT DATA
   ┌──────────────────────────┐
   │ Pressure     │ 5.0 MPa   │
   │ Diameter     │ 100 mm    │
   │ Thickness    │ 5 mm      │
   │ Safety Factor│ 1.5       │
   └──────────────────────────┘

4. FORMULAS & CALCULATIONS
   
   4.1 Hoop Stress Calculation
       σ_h = (P * (D - 2t)) / (2 * t * E)
       
       Where:
       σ_h = hoop stress (MPa)
       P = internal pressure (MPa) = 5.0
       D = outer diameter (mm) = 100
       t = wall thickness (mm) = 5
       E = weld joint efficiency (-) = 1.0
       
       Substitution:
       σ_h = (5.0 * (100 - 2*5)) / (2 * 5 * 1.0)
           = (5.0 * 90) / 10
           = 450 / 10
           = 45.0 MPa
       
       ⚠️ WARNING: hoop_stress (45.0 MPa) exceeds design limit (40 MPa)

5. RESULTS
   ┌───────────────────────┐
   │ Hoop Stress │ 45 MPa  │
   │ Safety Ratio│ 0.89    │
   └───────────────────────┘

6. VALIDATION RESULTS
   ✓ Pressure within range (0 - 1000 MPa)
   ✓ Diameter within range (1 - 10000 mm)
   ✗ Result exceeds design limit (45.0 > 40 MPa) [WARNING]

7. ENGINEERING WARNINGS
   - Hoop stress exceeds design limit by 12.5%
   - Safety margin: 0.89 < 1.0
   - Recommendation: Increase wall thickness or reduce pressure

APPENDIX A: CALCULATION AUDIT TRAIL
   - Formula execution trace
   - Validation rules applied
   - Execution timing
   - Failure analysis (if applicable)

APPENDIX B: SYSTEM INFORMATION
   - Calculation Engine Version
   - Execution Platform
   - Generated: [timestamp]
```

### 2.3 Core Implementation Plan

**File:** `src/engine/reporting/docx_builder.py`

```python
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from typing import Dict, Any

class DocxReportBuilder:
    """Builds production-grade DOCX reports from ReportContext."""
    
    def __init__(self):
        self.doc = Document()
        self._setup_styles()
    
    def _setup_styles(self):
        """Configure document styles for engineering reports."""
        # Title, Heading, Normal styles
        
    def build_report(self, context: Dict[str, Any]) -> bytes:
        """Generate complete DOCX from ReportContext."""
        self._add_title_page(context)
        self._add_toc_placeholder()
        self._add_normative_references(context)
        self._add_assumptions(context)
        self._add_inputs(context)
        self._add_formulas(context)
        self._add_results(context)
        self._add_validation(context)
        self._add_warnings(context)
        self._add_audit_appendix(context)
        
        return self.doc.save_to_bytes()
    
    def _add_title_page(self, context): ...
    def _add_inputs(self, context): ...
    def _add_formulas(self, context): ...
    def _add_results(self, context): ...
    def _add_validation(self, context): ...
    def _add_warnings(self, context): ...
    def _add_audit_appendix(self, context): ...
```

---

## PART 3: FORMULA RENDERING

### 3.1 SymPy → LaTeX → DOCX Pipeline

**File:** `src/engine/reporting/formula_renderer.py`

```python
from sympy import sympify, latex
from typing import Dict, Any

class FormulaRenderer:
    """Renders engineering formulas with variable substitution."""
    
    def render_formula(self, 
                       formula_expr: str,
                       variables: Dict[str, Any],
                       output_value: float) -> Dict[str, str]:
        """
        Render formula with three components:
        1. Formula with symbols (LaTeX)
        2. Variable definitions
        3. Substitution and calculation steps
        """
        
        # Parse formula
        expr = sympify(formula_expr)
        latex_formula = latex(expr)  # LaTeX version
        
        # Variable definitions
        var_definitions = self._format_variable_definitions(variables)
        
        # Calculation steps
        steps = self._generate_calculation_steps(expr, variables, output_value)
        
        return {
            "formula_latex": latex_formula,
            "formula_text": str(expr),
            "variable_definitions": var_definitions,
            "calculation_steps": steps,
            "final_value": output_value
        }
    
    def _format_variable_definitions(self, variables: Dict[str, Any]) -> str:
        """Format variable definitions for display."""
        
    def _generate_calculation_steps(self, expr, variables, output) -> list[str]:
        """Generate step-by-step calculation breakdown."""
```

### 3.2 Variable Substitution Display

**Example:**

```
Formula:
    σ_h = (P * (D - 2*t)) / (2 * t * E)

Where:
    σ_h — hoop stress (MPa)
    P — internal pressure (MPa) = 5.0
    D — outer diameter (mm) = 100
    t — wall thickness (mm) = 5
    E — weld joint efficiency (-) = 1.0

Substitution:
    σ_h = (5.0 * (100 - 2*5)) / (2 * 5 * 1.0)
       = (5.0 * 90) / 10
       = 45.0 MPa
```

---

## PART 4: AUDIT APPENDIX SYSTEM

### 4.1 Appendix Structure

**File:** `src/engine/reporting/audit_appendix.py`

```python
class AuditAppendixBuilder:
    """Builds comprehensive audit appendix from execution data."""
    
    def build_appendix(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate audit appendix from CalculationResult."""
        
        return {
            "execution_summary": self._build_execution_summary(context),
            "validation_trace": self._build_validation_trace(context),
            "execution_traces": self._build_execution_traces(context),
            "failure_analysis": self._build_failure_analysis(context),
            "rules_applied": self._build_rules_applied(context),
        }
    
    def _build_execution_summary(self, context): ...
    def _build_validation_trace(self, context): ...
    def _build_execution_traces(self, context): ...
    def _build_failure_analysis(self, context): ...
    def _build_rules_applied(self, context): ...
```

### 4.2 Appendix Content Examples

**Execution Summary:**
```
┌──────────────────────────────────────────┐
│ Execution Summary                        │
├──────────────────────────────────────────┤
│ Calculation ID: pipe_stress_001          │
│ Template: Pipe Stress Analysis           │
│ Timestamp: 2026-05-08 14:30:00 UTC       │
│ Total Execution Time: 142 ms             │
│                                          │
│ Formulas Executed: 1                     │
│  - hoop_stress: 45.2 ms                  │
│                                          │
│ Validation Rules Applied: 7              │
│  - Range checks: 3                       │
│  - Plausibility checks: 2                │
│  - Safety checks: 2                      │
│                                          │
│ Status: WARNING (1 failed validation)    │
└──────────────────────────────────────────┘
```

**Validation Trace:**
```
┌────────────┬──────────────────┬────────┬──────────┐
│ Rule ID    │ Rule Name        │ Status │ Severity │
├────────────┼──────────────────┼────────┼──────────┤
│ range_P    │ Pressure Range   │ PASS   │ INFO     │
│ range_D    │ Diameter Range   │ PASS   │ INFO     │
│ range_t    │ Thickness Range  │ PASS   │ INFO     │
│ design_P   │ Design Limit     │ FAIL   │ WARNING  │
│ safety_E   │ Safety Factor    │ PASS   │ INFO     │
└────────────┴──────────────────┴────────┴──────────┘
```

---

## PART 5: REPORT TEMPLATES

### 5.1 Template Types

**Piping Report Template:**
- Input: pressure, diameter, thickness, material
- Focus: Stress analysis, code compliance (ASME, API)
- Formulas: Hoop stress, longitudinal stress, combined stress
- Sections: Design conditions, stress calculations, code checks

**Structural Report Template:**
- Input: loads, geometry, material
- Focus: Deflection, stress, stability
- Formulas: Moment, stress, safety factors
- Sections: Load cases, stress analysis, deformations

**Thermal Report Template:**
- Input: temperatures, material properties, geometry
- Focus: Heat transfer, thermal stresses
- Formulas: Heat flux, temperature distribution, thermal stress
- Sections: Boundary conditions, heat transfer analysis, stresses

**Generic Report Template:**
- Input: any inputs
- Focus: Flexible presentation
- Formulas: User-defined
- Sections: Standard engineering report format

### 5.2 Template Registry

**File:** `src/engine/reporting/templates.py`

```python
class TemplateRegistry:
    """Manages available report templates."""
    
    TEMPLATES = {
        "piping": PipingReportTemplate(),
        "structural": StructuralReportTemplate(),
        "thermal": ThermalReportTemplate(),
        "generic": GenericReportTemplate(),
    }
    
    @classmethod
    def select_template(cls, context: Dict[str, Any]) -> ReportTemplate:
        """Select appropriate template based on context."""
        
        # Try to identify from tags/categories
        if "piping" in context.get("tags", []):
            return cls.TEMPLATES["piping"]
        elif "structural" in context.get("tags", []):
            return cls.TEMPLATES["structural"]
        # ... etc
        else:
            return cls.TEMPLATES["generic"]
```

---

## PART 6: REPORT SERIALIZATION

### 6.1 Deterministic Output

**Challenge:** Ensure identical inputs → identical DOCX output (for auditing).

**Strategy:**
1. Seed random number generators (all formatting is deterministic)
2. Fix timestamps in metadata (can be overridden)
3. Use consistent font sizing/spacing
4. Avoid platform-dependent formatting

**File:** `src/engine/reporting/determinism.py`

```python
import hashlib
from docx import Document

class DeterministicReportBuilder:
    """Ensures reports are reproducible."""
    
    def build_deterministic_report(self, context: Dict) -> tuple[bytes, str]:
        """Build report and compute hash for verification."""
        
        # Build report with fixed settings
        builder = DocxReportBuilder()
        report_bytes = builder.build_report(context)
        
        # Compute hash
        report_hash = hashlib.sha256(report_bytes).hexdigest()
        
        return report_bytes, report_hash
```

### 6.2 Report Metadata

```json
{
    "report_id": "rpt_pipe_stress_001",
    "calculation_id": "calc_pipe_stress_001",
    "template": "piping",
    "version": "1.0",
    "generated": "2026-05-08T14:30:00Z",
    "hash": "sha256:abc123...",
    "engine_version": "0.3.0",
    "content_hash": "sha256:def456..."  // Hash of content (excluding metadata)
}
```

---

## PART 7: REPORT API

### 7.1 API Endpoint

**Endpoint:** `POST /api/reports/generate`

**Request:**
```json
{
    "calculation_id": "calc_pipe_stress_001",
    "template": "piping",  // optional, auto-detect if omitted
    "include_audit_appendix": true,
    "include_failure_analysis": true
}
```

**Response:**
```json
{
    "report_id": "rpt_pipe_stress_001",
    "status": "generated",
    "download_url": "/api/reports/rpt_pipe_stress_001/download",
    "metadata": {
        "calculation_id": "calc_pipe_stress_001",
        "template": "piping",
        "generated": "2026-05-08T14:30:00Z",
        "file_size_bytes": 245632,
        "hash": "sha256:abc123..."
    }
}
```

**Download:** `GET /api/reports/{report_id}/download`
- Returns: DOCX file (application/vnd.openxmlformats-officedocument.wordprocessingml.document)

---

## PART 8: IMPLEMENTATION ROADMAP

### Phase 1: Core Infrastructure (Week 1)
- [ ] ReportContext model
- [ ] Data extraction pipeline
- [ ] Basic DOCX builder (title, inputs, results)
- [ ] Unit tests for data extraction

### Phase 2: Formula Rendering (Week 1-2)
- [ ] FormulaRenderer (SymPy → LaTeX)
- [ ] Variable substitution display
- [ ] Calculation steps generation
- [ ] Integration with DOCX builder

### Phase 3: Template System (Week 2)
- [ ] ReportTemplate base class
- [ ] PipingReportTemplate implementation
- [ ] GenericReportTemplate implementation
- [ ] TemplateRegistry

### Phase 4: Audit Appendix (Week 2)
- [ ] AuditAppendixBuilder
- [ ] Execution trace formatting
- [ ] Validation results display
- [ ] Failure analysis rendering

### Phase 5: API & Integration (Week 3)
- [ ] Report generation endpoints
- [ ] Deterministic hash computation
- [ ] Report caching
- [ ] Download mechanism

### Phase 6: Testing & Optimization (Week 3)
- [ ] Comprehensive test suite
- [ ] Performance benchmarks
- [ ] Large report generation testing
- [ ] Formatting consistency checks

---

## PART 9: SUCCESS CRITERIA

**ÉTAP 3 is COMPLETE when:**

1. ✅ DOCX generation works for all template types
2. ✅ Formulas render correctly with SymPy → LaTeX → DOCX
3. ✅ Audit appendix captures full execution trace
4. ✅ Reports are deterministic (same input → same hash)
5. ✅ All validation results appear in report
6. ✅ Engineering warnings are clearly visible
7. ✅ Failure analysis is included when present
8. ✅ Report generation <500ms for typical calculation
9. ✅ All tests passing (100+ test cases)
10. ✅ 5+ example reports generated (piping, structural, thermal, etc.)

---

## PART 10: DELIVERABLES CHECKLIST

### Code Deliverables
- [ ] `src/engine/reporting/` — Reporting module
  - [ ] `__init__.py`
  - [ ] `models.py` — ReportContext, ReportTemplate, etc.
  - [ ] `data_extractor.py` — CalculationResult → ReportContext
  - [ ] `formula_renderer.py` — Formula rendering
  - [ ] `docx_builder.py` — DOCX generation
  - [ ] `audit_appendix.py` — Audit appendix generation
  - [ ] `templates.py` — ReportTemplate implementations
  - [ ] `determinism.py` — Reproducibility utilities
  - [ ] `utils.py` — Formatting helpers

### API Deliverables
- [ ] `src/api/endpoints/reports.py` — Report API routes
  - [ ] POST /api/reports/generate
  - [ ] GET /api/reports/{report_id}/download

### Test Deliverables
- [ ] `tests/test_report_context.py`
- [ ] `tests/test_formula_renderer.py`
- [ ] `tests/test_docx_builder.py`
- [ ] `tests/test_audit_appendix.py`
- [ ] `tests/test_report_generation.py` — End-to-end tests
- [ ] `tests/test_report_determinism.py`

### Documentation Deliverables
- [ ] `REPORTING_ARCHITECTURE_REPORT.md` (this file)
- [ ] `DOCX_RENDERING_REPORT.md` (formula rendering details)
- [ ] `AUDIT_APPENDIX_REPORT.md` (appendix design)
- [ ] `REPORT_TEMPLATES_GUIDE.md` (template creation guide)
- [ ] `REPORT_PERFORMANCE_REPORT.md` (benchmarks)
- [ ] Example reports (5+):
  - [ ] `examples/pipe_stress_report.docx`
  - [ ] `examples/structural_analysis_report.docx`
  - [ ] `examples/thermal_analysis_report.docx`
  - [ ] `examples/piping_code_check_report.docx`
  - [ ] `examples/combined_failure_analysis_report.docx`

---

## NEXT STEPS

**Start ÉTAP 3, Week 1:**
1. Create ReportContext model (data structures)
2. Implement ReportDataExtractor (CalculationResult → ReportContext)
3. Create basic DocxReportBuilder (title page + sections)
4. Write initial tests

**Target:** Functional DOCX generation by end of Week 1

---

**Architecture locked:** Ready for implementation  
**Estimated effort:** 50 hours (5 weeks @ 10 hours/week)  
**Priority:** HIGH (critical for engineering deliverables)
