# Template Format V2 — Formal Specification

**Version:** 2.0.0  
**Status:** STABLE (Ready for Implementation)  
**Date:** 2026-05-08

---

## 1. OVERVIEW

Template Format V2 is a production-grade YAML specification for engineering calculation templates.

**Key Features:**
- **Engineering-first:** Supports dimensional analysis, units, references
- **Versioned:** Semantic versioning, migration paths
- **Validated:** JSON Schema, semantic validation
- **Discoverable:** Registry support, metadata-rich
- **Scalable:** Supports complex workflows, dependencies, grouping

**File Naming Convention:**
```
{category}/{template_id}.yaml       # New templates
{category}/{template_id}@{version}.yaml  # Versioned archives
```

Example:
```
mechanical/pipe_stress.yaml
mechanical/pipe_stress@1.0.0.yaml
piping/flanged_joint@2.1.0.yaml
```

---

## 2. METADATA SECTION

**Purpose:** Identify, describe, and manage the template lifecycle.

```yaml
metadata:
  # Identification
  id: "pipe_stress_analysis"              # Unique ID (kebab-case)
  name: "Pipe Stress Analysis"            # Human-readable name
  description: "Calculate hoop stress in pressurized pipe using Barlow's formula"
  
  # Organization
  category: "Mechanical/Piping"           # Hierarchical category
  subcategory: "Pressure Vessels"         # Optional subcategory
  tags: ["piping", "stress", "pressure", "ASME B31.8"]
  section: "Piping"                       # UI section (for dashboard)
  
  # Versioning
  version: "2.0.0"                        # Semantic version
  created_at: "2026-05-08T00:00:00Z"
  last_modified: "2026-05-08T12:30:00Z"
  created_by: "EnGHub Foundation"
  
  # Evolution
  deprecated: false
  deprecation_notice: null
  supersedes: []                          # List of template IDs this replaces
  deprecates: []                          # List of template IDs this deprecates
  migration_guide_url: null               # URL to migration instructions
  
  # References & Standards
  standard_references:                    # Which standards this template implements
    - standard: "ASME B31.8"
      section: "401"
      title: "Internal Pressure Design of Piping"
    - standard: "API 579"
      section: "5.1.2"
      title: "Fitness-for-Service Analysis"
      
  references:                             # Academic/technical references
    - title: "Barlow's Formula for Thin-Walled Cylinders"
      url: "https://..."
      year: 1910
      
  # Maintenance
  maintainer: "Piping Engineering Team"
  maintenance_status: "active"            # active, deprecated, archived
  support_url: "https://..."
```

---

## 3. VARIABLES SECTION

**Purpose:** Define all calculation variables (inputs, outputs, intermediates) with engineering metadata.

```yaml
variables:
  pressure:                               # Variable ID (snake_case)
    # Identification
    label: "Internal Pressure"
    description: "Internal gauge pressure at nominal operating conditions"
    engineering_meaning: |
      The absolute internal pressure measured from gauge at the design point.
      For gas pipelines, typically specified as gauge pressure at compressor outlet.
      For liquid service, use maximum anticipated pressure during operation.
    
    # Physical Properties
    unit: "MPa"                           # Pint-compatible unit
    dimension: "M L^-1 T^-2"              # SI dimension [M/L/T]
    symbolic_notation: "P"                # Mathematical symbol (e.g., σ, ε, P)
    
    # Data Type & Constraints
    type: "float"                         # float, int, string, enum
    required: true                        # Must be provided by user
    
    # Value Constraints
    default_value: null                   # Default if not provided
    example_value: 10.5                   # Example for documentation
    min_value: 0.0                        # Minimum allowed value (engineering constraint)
    max_value: 100.0                      # Maximum allowed value
    
    # UI/Documentation
    category: "input"                     # input, output, intermediate, constant
    section: "Pressure Data"              # UI section grouping
    help_text: "Enter absolute gauge pressure at design conditions"
    
  outer_diameter:
    label: "Outer Diameter"
    description: "Nominal outer diameter of the pipe"
    engineering_meaning: |
      The nominal OD as specified in pipe standards (e.g., ASME B36.10M).
      For seamless tubes, equals the outside diameter.
      For couplings and fittings, use the ID of the coupling.
    unit: "mm"
    dimension: "L"
    symbolic_notation: "OD"
    type: "float"
    required: true
    min_value: 6.35                       # Smallest commercial pipe
    max_value: 2000.0                     # Practical engineering limit
    example_value: 101.6
    category: "input"
    section: "Pipe Geometry"
    
  wall_thickness:
    label: "Wall Thickness"
    description: "Nominal wall thickness of pipe"
    engineering_meaning: |
      The minimum wall thickness after manufacturing tolerance.
      Use the nominal thickness from pipe schedule, minus required minimum
      per ASME B31.1 or B31.8 (usually 12.5% or specific minimum).
    unit: "mm"
    dimension: "L"
    symbolic_notation: "t"
    type: "float"
    required: true
    min_value: 0.5
    max_value: 200.0
    example_value: 3.4
    category: "input"
    section: "Pipe Geometry"
    
  yield_strength:
    label: "Yield Strength"
    description: "Material yield strength at design temperature"
    engineering_meaning: |
      The minimum yield strength (typically 0.2% offset) per material specification.
      Must be at the design temperature (elevated temperature derating applies).
      For B31.8, this is the SMYS (Specified Minimum Yield Strength).
    unit: "MPa"
    dimension: "M L^-1 T^-2"
    symbolic_notation: "σ_y"
    type: "float"
    required: true
    default_value: 450.0
    min_value: 200.0
    max_value: 1000.0
    example_value: 450.0
    category: "input"
    section: "Material Properties"
    
  hoop_stress:
    label: "Hoop Stress"
    description: "Maximum circumferential stress in pipe wall"
    engineering_meaning: |
      The maximum tensile stress in the circumferential direction, calculated
      using Barlow's formula. This is the dominant stress component for internal pressure.
      For combined loadings (bending + pressure), use this as the hoop component.
    unit: "MPa"
    dimension: "M L^-1 T^-2"
    symbolic_notation: "σ_h"
    type: "float"
    required: false
    category: "output"
    section: "Stress Results"
    
  safety_factor:
    label: "Safety Factor"
    description: "Ratio of yield strength to hoop stress"
    engineering_meaning: |
      Simple safety factor = σ_y / σ_h
      Per ASME B31.8, design factor = 0.72 (SF = 1.389)
      Per ASME B31.1, design factor = 0.90 (SF = 1.111)
      This value should exceed 1.0 for safe operation.
    unit: "dimensionless"
    dimension: "1"                        # Dimensionless
    symbolic_notation: "SF"
    type: "float"
    required: false
    category: "output"
    section: "Stress Results"
```

---

## 4. FORMULAS SECTION

**Purpose:** Define mathematical formulas with dependencies and documentation.

```yaml
formulas:
  hoop_stress:
    # Formula Definition
    expression: "(P * (OD - 2*t)) / (2*t)"    # SymPy-compatible expression
    description: "Barlow's formula for thin-walled cylinders"
    
    # Variable Mapping (formula symbols → variable IDs)
    variable_mapping:
      P: "pressure"
      OD: "outer_diameter"
      t: "wall_thickness"
    
    # Dependencies (explicit, for execution order)
    depends_on: ["pressure", "outer_diameter", "wall_thickness"]
    
    # Documentation
    explanation: |
      Barlow's formula calculates hoop stress in thin-walled cylinders under internal pressure.
      Valid when: t << OD (typically t/OD < 0.1)
      
      Derivation:
      - Consider thin ring of pipe of length dL
      - Internal force = P * OD * dL
      - This force must equal stress * wall area = σ_h * 2t * dL
      - Solving: σ_h = P * OD / (2t)
      
      Simplified here by using (OD - 2t) ≈ ID for more precision.
    
    # References
    reference: "ASME B31.8, Section 401"
    reference_url: "https://..."
    year: "1910"
    original_author: "L.E. Barlow"
    
    # Validation
    dimension_check: true                 # Verify dimensional consistency
    unit_system: "SI"
    range_validation:
      output_min: 0.0
      output_max: 1000.0                  # Reasonable engineering limit
      
  safety_factor:
    expression: "σ_y / σ_h"
    description: "Safety factor as ratio of yield to hoop stress"
    variable_mapping:
      σ_y: "yield_strength"
      σ_h: "hoop_stress"                  # References another output!
    depends_on: ["hoop_stress", "yield_strength"]
    explanation: |
      Simple safety factor (or "design margin") is the ratio of material
      strength to applied stress. For SF > 1, the material will not yield
      under pure tensile loading from hoop stress alone.
      
      Note: This is a simplified metric. ASME codes define safety differently
      using design factors (fraction of yield). For ASME B31.8:
      Design Factor = 0.72, which implies SF = 1.389
    reference: "Basic mechanics of materials"
    dimension_check: true
```

---

## 5. VALIDATION SECTION

**Purpose:** Define multi-level validation rules for inputs, engineering constraints, and outputs.

```yaml
validation:
  # Level 1: Input Constraints (automatic type/range checking)
  inputs:
    - variable: "pressure"
      rules:
        - type: "positive"                # value > 0
          message: "Pressure must be positive"
        - type: "range"
          min: 0.1
          max: 100.0
          message: "Pressure outside typical engineering range"
          
    - variable: "outer_diameter"
      rules:
        - type: "positive"
        - type: "range"
          min: 6.35
          max: 2000.0
          
    - variable: "wall_thickness"
      rules:
        - type: "positive"
        - type: "range"
          min: 0.5
          max: 200.0
          
  # Level 2: Cross-Variable Engineering Constraints
  engineering_constraints:
    - description: "Wall thickness must be less than half OD"
      condition: "t < OD / 2"
      variables: ["outer_diameter", "wall_thickness"]
      message: "Wall thickness cannot exceed half the outer diameter"
      severity: "error"                   # error, warning
      
    - description: "Thin-wall assumption validity"
      condition: "t / OD < 0.1"
      variables: ["outer_diameter", "wall_thickness"]
      message: "Wall thickness ratio suggests thick-wall formula may be needed"
      severity: "warning"                 # Barlow's formula assumes thin walls
      
    - description: "Reasonable pressure-diameter ratio"
      condition: "P <= OD * 10"
      variables: ["pressure", "outer_diameter"]
      message: "High pressure-to-diameter ratio; verify material strength"
      severity: "warning"
      
  # Level 3: Output Constraints (post-calculation)
  outputs:
    - variable: "hoop_stress"
      rules:
        - type: "positive"
          message: "Hoop stress should be positive"
          
        - type: "range"
          min: 0.1
          max: 1000.0
          message: "Hoop stress outside typical range (might indicate input error)"
          severity: "warning"
          
    - variable: "safety_factor"
      rules:
        - type: "minimum"
          min: 1.0
          message: "Safety factor must exceed 1.0"
          severity: "error"
          
        - type: "range"
          min: 1.0
          max: 10.0
          message: "Unusually high safety factor; verify design intent"
          severity: "warning"
```

---

## 6. CAPABILITIES SECTION (Optional)

**Purpose:** Declare template capabilities and limitations.

```yaml
capabilities:
  # What this template can do
  supported_features:
    - "thin-wall approximation"
    - "single formula evaluation"
    - "safety factor calculation"
    
  # What this template cannot do
  limitations:
    - "Does not account for bending moments (combined loading)"
    - "Does not account for corrosion allowance (use adjusted thickness)"
    - "Does not account for temperature derating (use adjusted yield strength)"
    - "Assumes uniform pressure and wall thickness"
    
  # When to use / not use
  applicability:
    applicable_conditions:
      - "Seamless or welded pipe under internal pressure"
      - "Thin-walled cylinders (t/OD < 0.1)"
      - "Temperature range: -50°C to +100°C (adjust yield strength otherwise)"
      - "Static loading (not fatigue)"
    
    inapplicable_conditions:
      - "Thick-walled cylinders (t/OD ≥ 0.1)"
      - "Combined bending + pressure loading"
      - "Elevated temperature service (>100°C)"
      - "Fatigue loading"
      - "Stress concentrations (fittings, welds)"
      
  # Recommendations
  recommendations:
    - "Always apply location factor and design factor per ASME B31.8"
    - "For critical designs, use FEA (finite element analysis)"
    - "Consider impact on wall thickness from corrosion allowance"
    - "Consult with stress analyst for complex loading scenarios"
```

---

## 7. EXAMPLES SECTION (Optional)

**Purpose:** Provide realistic, documented examples.

```yaml
examples:
  - name: "Small Bore Hydrogen Pipe"
    description: "Common utility piping for hydrogen distribution"
    inputs:
      pressure: 20.0                      # MPa
      outer_diameter: 50.8                # mm (2" nominal)
      wall_thickness: 3.4                 # mm (schedule 40)
      yield_strength: 450.0               # MPa (Grade B)
    expected_outputs:
      hoop_stress: 142.3                  # MPa
      safety_factor: 3.16
    notes: "High safety factor due to conservative design"
    
  - name: "Large Diameter Gas Transmission Main"
    description: "Trunk line transmission pipeline"
    inputs:
      pressure: 72.0                      # MPa (1000 psi)
      outer_diameter: 609.6               # mm (24" nominal)
      wall_thickness: 9.5                 # mm (≈3/8")
      yield_strength: 448.0               # MPa (X65 grade)
    expected_outputs:
      hoop_stress: 343.7                  # MPa
      safety_factor: 1.30
    notes: |
      Typical design per ASME B31.8 with 0.72 design factor.
      This example shows more realistic SF ≈ 1.39 (1/0.72)
```

---

## 8. COMPLETE EXAMPLE

```yaml
metadata:
  id: "pipe_stress_analysis"
  name: "Pipe Stress Analysis"
  description: "Calculate hoop stress in pressurized pipe using Barlow's formula"
  category: "Mechanical/Piping"
  version: "2.0.0"
  created_at: "2026-05-08T00:00:00Z"
  standard_references:
    - standard: "ASME B31.8"
      section: "401"

variables:
  pressure:
    label: "Internal Pressure"
    description: "Internal gauge pressure at nominal operating conditions"
    engineering_meaning: "Absolute internal pressure measured from gauge at design point"
    unit: "MPa"
    dimension: "M L^-1 T^-2"
    symbolic_notation: "P"
    type: "float"
    required: true
    min_value: 0.0
    max_value: 100.0
    category: "input"
    section: "Pressure Data"
    
  outer_diameter:
    label: "Outer Diameter"
    description: "Nominal outer diameter of the pipe"
    engineering_meaning: "OD per ASME B36.10M or equivalent standard"
    unit: "mm"
    dimension: "L"
    symbolic_notation: "OD"
    type: "float"
    required: true
    min_value: 6.35
    max_value: 2000.0
    category: "input"
    section: "Pipe Geometry"
    
  wall_thickness:
    label: "Wall Thickness"
    description: "Nominal wall thickness of pipe"
    engineering_meaning: "Minimum wall thickness after manufacturing tolerance"
    unit: "mm"
    dimension: "L"
    symbolic_notation: "t"
    type: "float"
    required: true
    min_value: 0.5
    max_value: 200.0
    category: "input"
    section: "Pipe Geometry"
    
  yield_strength:
    label: "Yield Strength"
    description: "Material yield strength at design temperature"
    engineering_meaning: "SMYS per material specification, at design temperature"
    unit: "MPa"
    dimension: "M L^-1 T^-2"
    symbolic_notation: "σ_y"
    type: "float"
    required: true
    default_value: 450.0
    category: "input"
    section: "Material Properties"
    
  hoop_stress:
    label: "Hoop Stress"
    description: "Maximum circumferential stress in pipe wall"
    engineering_meaning: "Dominant tensile stress from internal pressure"
    unit: "MPa"
    dimension: "M L^-1 T^-2"
    symbolic_notation: "σ_h"
    type: "float"
    category: "output"
    section: "Stress Results"
    
  safety_factor:
    label: "Safety Factor"
    description: "Ratio of yield strength to hoop stress"
    engineering_meaning: "Margin of safety = σ_y / σ_h"
    unit: "dimensionless"
    dimension: "1"
    symbolic_notation: "SF"
    type: "float"
    category: "output"
    section: "Stress Results"

formulas:
  hoop_stress:
    expression: "(P * (OD - 2*t)) / (2*t)"
    description: "Barlow's formula for thin-walled cylinders"
    variable_mapping:
      P: "pressure"
      OD: "outer_diameter"
      t: "wall_thickness"
    depends_on: ["pressure", "outer_diameter", "wall_thickness"]
    reference: "ASME B31.8, Section 401"
    dimension_check: true
    
  safety_factor:
    expression: "σ_y / σ_h"
    description: "Safety factor as ratio of yield to hoop stress"
    variable_mapping:
      σ_y: "yield_strength"
      σ_h: "hoop_stress"
    depends_on: ["hoop_stress", "yield_strength"]
    reference: "Basic mechanics"
    dimension_check: true

validation:
  inputs:
    - variable: "pressure"
      rules:
        - type: "positive"
    - variable: "outer_diameter"
      rules:
        - type: "positive"
    - variable: "wall_thickness"
      rules:
        - type: "positive"
        
  engineering_constraints:
    - description: "Wall thickness must be less than half OD"
      condition: "t < OD / 2"
      variables: ["outer_diameter", "wall_thickness"]
      severity: "error"
      
  outputs:
    - variable: "safety_factor"
      rules:
        - type: "minimum"
          min: 1.0
          severity: "error"
```

---

## 9. MIGRATION FROM V1 TO V2

**Automatic Migration Rules:**

```
V1                      →    V2

metadata.*              →    metadata.*
inputs[*]               →    variables[*] (category: "input")
outputs[*]              →    variables[*] (category: "output")
formulas.*              →    formulas.* (+ depends_on)
validation_rules.*      →    validation.inputs
  OR                         validation.engineering_constraints
```

**Mapping Example:**

```yaml
# V1
inputs:
  - name: "pressure"
    description: "..."
    unit: "MPa"

# V2
variables:
  pressure:
    label: "Pressure"
    description: "..."
    unit: "MPa"
    category: "input"            # NEW
    dimension: "M L^-1 T^-2"     # NEW
    engineering_meaning: "..."    # NEW
```

---

## 10. JSON SCHEMA VALIDATION

See `template-schema.json` for complete JSON Schema V7 definition used by validators.

---

## 11. CONFORMANCE TESTING

All V2 templates must pass:

```
1. Schema validation (JSON Schema)
2. Semantic validation:
   - All variables referenced in formulas exist
   - All formulas have explicit dependencies
   - No circular dependencies
3. Engineering validation:
   - Dimensional consistency checks
   - Unit compatibility
4. Documentation validation:
   - No missing required fields
   - Example calculations work
```

---

**End of Template Format V2 Specification**
