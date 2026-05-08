# PHASE 2 — STAGE 1: TEMPLATE SYSTEM HARDENING ANALYSIS & PLAN

**Date:** 2026-05-08  
**Phase:** REAL CALCULATION WORKFLOW  
**Stage:** 1 — Template System Hardening  
**Status:** Analysis Complete → Ready for Implementation

---

## EXECUTIVE SUMMARY

Current template system is **foundation-grade but NOT production-ready** for engineering platform.

**Critical Gaps:**
1. ❌ **No formal specification** — Template format lacks rigor
2. ❌ **Weak variable metadata** — Missing engineering semantics (dimension, engineering_meaning, examples)
3. ❌ **No versioning strategy** — Can't evolve templates safely
4. ❌ **No validation schema** — YAML files can have arbitrary structure
5. ❌ **No dependency analysis** — Formula dependencies not tracked
6. ❌ **No circular dependency detection** — Can create infinite loops
7. ❌ **No explanation system** — No structured variable explanations
8. ❌ **No template testing framework** — Can't validate template quality

**Impact:** These gaps will compound during Phase 2-3 when adding:
- Multiple formula dependencies
- Cross-template references
- User-defined templates
- AI integration

---

## CURRENT STATE ANALYSIS

### 1. Template Format (Current)

```yaml
metadata:
  name: "Pipe Stress Analysis"
  description: "Calculate stress in pressurized pipe"
  category: "Mechanical/Piping"
  version: "1.0.0"
  author: "EnGHub Foundation"

inputs:
  - name: "pressure"
    description: "Internal pressure"
    unit: "MPa"
    type: "float"
    min_value: 0
    max_value: 100
    required: true

outputs:
  - name: "hoop_stress"
    description: "Hoop stress in pipe wall"
    unit: "MPa"
    type: "float"

formulas:
  hoop_stress: "(pressure * (outer_diameter - 2 * wall_thickness)) / (2 * wall_thickness)"
  safety_factor: "yield_strength / hoop_stress"

validation_rules:
  pressure: "positive"
  outer_diameter: "positive"
```

**Issues with Current Format:**

| Issue | Severity | Impact |
|-------|----------|--------|
| No dimension field (e.g., `[M L^-2]` for stress) | HIGH | Can't do automatic unit validation |
| No engineering_meaning field | HIGH | AI won't understand semantic context |
| No examples field | MEDIUM | Users don't know valid ranges |
| No citation/reference field | MEDIUM | Can't track formula source |
| No deprecation/supersedes field | MEDIUM | Can't manage template evolution |
| No input grouping/sections | MEDIUM | Large templates are confusing |
| Inconsistent naming (inputs vs variables) | LOW | Confusing for developers |

---

### 2. Schema Analysis

**Current Pydantic Models:**

```python
class CalcVariable(BaseModel):
    name: str
    label: str
    description: str
    unit: str
    data_type: str  # "float", "int", "string"
    required: bool
    min_value: Optional[float]
    max_value: Optional[float]
    default_value: Optional[Any]
    choices: Optional[list[str]]
```

**Missing Fields (Engineering):**
- `dimension` — Physical dimension (e.g., "M L^2 T^-2")
- `engineering_meaning` — Semantic explanation for engineers
- `example_value` — Typical value for documentation
- `reference` — Where this variable comes from (standard, reference)
- `category` — Input/output/intermediate
- `symbolic_notation` — Variable symbol (e.g., "σ_h" for hoop stress)

---

### 3. Template Loader Architecture

**Current:** `TemplateLoader` → loads YAML → creates `CalcTemplate`

**Issues:**
- No schema validation before loading
- No version management
- No template inheritance
- No circular dependency detection
- No cache invalidation strategy
- No template hot-reloading support

---

### 4. Validator (Input Validation)

**Current Capabilities:**
- ✅ Required field checking
- ✅ Type checking (float, int, string)
- ✅ Range checking (min/max)
- ✅ Choice validation
- ❌ Unit dimension checking
- ❌ Cross-variable validation
- ❌ Engineering range validation
- ❌ Formula feasibility checking

**Example:** No detector for physically impossible inputs:
```
pressure = -10 MPa  # INVALID but not caught!
diameter = 1000 mm, wall_thickness = 500 mm  # INVALID (2*wt > od)
```

---

### 5. Evaluator (Formula Execution)

**Current Capabilities:**
- ✅ SymPy expression parsing
- ✅ Variable substitution
- ✅ Basic error handling
- ❌ No dependency graph
- ❌ No execution order optimization
- ❌ No intermediate variable tracking
- ❌ No formula simplification
- ❌ No formula documentation/explanation

**Risk:** If formulas reference intermediate variables:
```
formulas:
  A = "x + y"
  B = "A + z"
  C = "B * 2"
```
Current evaluator can't track dependency graph → execution order bugs.

---

## HARDENING STRATEGY

### STAGE 1A: Formal Template Specification (Foundation)

**Goal:** Create version-controlled, validated template format.

**Deliverables:**
1. `TemplateFormatV2.md` — Formal YAML specification (Jsonschema)
2. `template-schema.json` — JSON Schema for validation
3. Template versioning rules
4. Template backward compatibility strategy

**Example V2 format:**

```yaml
metadata:
  id: "pipe_stress_analysis"          # Unique ID
  name: "Pipe Stress Analysis"
  description: "Calculate stress in pressurized pipe"
  category: "Mechanical/Piping"
  version: "2.0.0"                    # Semantic versioning
  author: "EnGHub Foundation"
  created_at: "2026-05-08"
  last_modified: "2026-05-08"
  deprecates: ["pipe_stress_v1.0"]    # Migration path
  reference_url: "https://..."        # Standard reference

variables:
  # Instead of inputs/outputs, unified schema
  pressure:
    label: "Internal Pressure"
    description: "Internal pressure inside the pipeline"
    engineering_meaning: "Gauge pressure at nominal conditions"
    unit: "MPa"
    dimension: "M L^-1 T^-2"           # SI dimension
    type: "float"
    required: true
    min_value: 0.1
    max_value: 100
    default_value: ~
    example_value: 10.0
    symbolic_notation: "P"
    category: "input"                  # input, output, intermediate
    section: "Pressure Data"           # UI grouping
    reference: "ASME B31.8 Section 401"
    
  hoop_stress:
    label: "Hoop Stress"
    description: "Circumferential stress in pipe wall"
    engineering_meaning: |
      Maximum tensile stress in the circumferential direction,
      calculated using Barlow's formula for thin-walled cylinders.
    unit: "MPa"
    dimension: "M L^-1 T^-2"
    type: "float"
    required: false
    category: "output"
    symbolic_notation: "σ_h"
    reference: "Barlow's formula"

formulas:
  hoop_stress:
    expression: "(pressure * (outer_diameter - 2 * wall_thickness)) / (2 * wall_thickness)"
    description: "Barlow's formula for thin-walled cylinder"
    dependencies: ["pressure", "outer_diameter", "wall_thickness"]
    reference: "ASME B31.8"
    unit_check: true                  # Validate dimensional consistency

validation:
  # Multi-level validation rules
  input:
    - field: "pressure"
      rule: "positive"
    - field: "outer_diameter"
      rule: "positive"
    - field: "wall_thickness"
      rule: "positive"
    - field: "outer_diameter"
      rule: "range:10-5000"
      
  engineering:
    - rule: "wall_thickness < outer_diameter / 2"
      error: "Wall thickness cannot exceed half the diameter"
    - rule: "yield_strength > hoop_stress"
      error: "Safety factor must be > 1"
      
  unit:
    - check_dimensional_consistency: true
```

---

### STAGE 1B: Template Validation Schema

**Goal:** Enable template-level validation before deployment.

```python
# services/calculation-engine/src/templates/validator.py

class TemplateValidator:
    """Validates template YAML against formal specification."""
    
    def validate_template_yaml(self, yaml_dict: dict) -> ValidationResult:
        """
        Validate YAML structure, types, semantic constraints.
        
        Returns:
            ValidationResult with errors/warnings/metadata
        """
        # 1. Schema validation (JSON Schema)
        # 2. Semantic validation (variable references, formula vars)
        # 3. Engineering validation (dimensional analysis, feasibility)
        # 4. Quality checks (coverage, completeness)
        
        return ValidationResult(...)
```

---

### STAGE 1C: Versioning Strategy

**Approach:** Semantic versioning for templates

```
pipe_stress.yaml              # Current: v2.0.0
pipe_stress@1.0.0.yaml        # Archive
pipe_stress@2.0.0.yaml        # Archive

Migration rules:
- v1.0 → v2.0: Auto-migrate input/output to variables schema
- v2.0 → v3.0: Requires explicit migration function
```

---

### STAGE 1D: Template Registry

**Goal:** Central registry of all templates with discovery.

```python
class TemplateRegistry:
    """Central registry of all templates."""
    
    def register_template(self, template: CalcTemplate) -> None:
        """Register validated template."""
        
    def discover_templates(self, 
                          category: str = None,
                          tags: list[str] = None) -> list[CalcTemplate]:
        """Discover templates by category/tags."""
        
    def get_template_info(self, template_id: str) -> TemplateMetadata:
        """Get template metadata (version, deprecation, etc)."""
        
    def get_template_by_version(self, 
                               template_id: str,
                               version: str) -> CalcTemplate:
        """Get specific version of template."""
```

---

## IMPLEMENTATION ROADMAP

### Phase 2A: Template Format Evolution (Week 1)

**Tasks:**
1. Design V2 format specification
   - Define metadata schema
   - Define variables schema
   - Define formulas schema
   - Define validation schema
   
2. Create JSON Schema for validation
   
3. Create migration tool (V1 → V2)

4. Update documentation

**Deliverables:**
- `TemplateFormatV2Spec.md`
- `template-schema.json`
- `TemplateMigrator` class
- Updated `TEMPLATE_SPEC.md`

---

### Phase 2B: Template System Hardening (Week 2-3)

**Tasks:**
1. Implement `TemplateValidator` class
2. Implement `TemplateRegistry` class
3. Update `TemplateLoader` to use registry
4. Add template versioning support
5. Create template test framework
6. Add 10+ validation tests

**Deliverables:**
- `TemplateValidator` with full validation
- `TemplateRegistry` with discovery
- 15+ test cases covering edge cases
- Template loading benchmarks

---

## CRITICAL DECISIONS

### Decision 1: Unified Variables Schema

**Current:** Separate inputs/outputs  
**Proposed:** Unified variables with `category` field

**Trade-offs:**
- ✅ More consistent, easier to extend
- ✅ Supports intermediate variables naturally
- ✅ Better for dependency graph
- ❌ Slightly different conceptually
- ❌ Requires migration

**Recommendation:** ADOPT unified schema

---

### Decision 2: Dimension Tracking

**Options:**
1. String dimension: `"M L^-1 T^-2"` (simple, readable)
2. Structured dimension: `{mass: 1, length: -1, time: -2}`
3. Pint built-in dimensions

**Recommendation:** String dimension with validation

---

### Decision 3: Formula Dependency Tracking

**Current:** Implicit (formula contains variable names)  
**Proposed:** Explicit `dependencies: [...]` in formula definition

**Benefit:** Enables:
- Execution order optimization
- Circular dependency detection
- Partial calculation support

**Recommendation:** REQUIRE explicit dependencies

---

## RISKS & MITIGATIONS

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Breaking changes to template format | HIGH | Create migration tool, versioning strategy |
| Large templates become hard to manage | MEDIUM | Add sections/grouping support, validation tools |
| Formula dependencies hard to track | MEDIUM | Require explicit dependencies in spec |
| Template evolution creates complexity | MEDIUM | Strict versioning, deprecation strategy |

---

## SUCCESS CRITERIA

✅ **Phase 2A Complete when:**
- V2 template format specified
- JSON schema defined
- Migration tool created
- 5+ existing templates migrated to V2

✅ **Phase 2B Complete when:**
- TemplateValidator validates all aspects
- TemplateRegistry enables discovery
- 15+ validation tests pass
- Template versioning works end-to-end
- Documentation updated

---

## NEXT IMMEDIATE STEPS (This Session)

1. ✅ Create `TemplateFormatV2.md` — Full specification
2. ✅ Create `template-schema.json` — JSON Schema
3. ✅ Create `TemplateMigrator` class
4. ✅ Migrate `pipe_stress.yaml` to V2 format
5. ✅ Create `TemplateValidator` class with 10+ validation rules
6. ✅ Add 10+ unit tests
7. ✅ Update documentation

---

## ARCHITECTURAL OVERVIEW (Post-Hardening)

```
TemplateRegistry (Central Discovery)
    ↓
TemplateLoader (Load from filesystem + registry)
    ↓
TemplateValidator (Schema + semantic validation)
    ↓
CalcTemplate (Validated template with metadata)
    ↓
CalculationRunner (Execution)
```

---

**End of Analysis Document**

Next: Begin implementation of Template Format V2 specification.
