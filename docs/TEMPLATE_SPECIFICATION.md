# Template Specification

## Overview

Templates define calculation logic in YAML format. Each template declares:
- Input variables (with validation rules)
- Formula (SymPy expression)
- Output variables
- Metadata (name, category, description)

## File Format

**Location:** `services/calculation-engine/src/templates/data/<template_id>.yaml`

**Naming:** Use snake_case for template IDs
- `pipe_stress.yaml` → template_id: `pipe_stress`
- `beam_deflection.yaml` → template_id: `beam_deflection`

## Schema

```yaml
# Required
name: "Human-Readable Name"
category: "category_slug"
description: "What this calculation does"
variables:
  - name: var_name
    ...
formula: "sympy_expression"
outputs:
  - output_name

# Optional
normative_reference: "Standard reference (e.g., ASME B31.4)"
tags:
  - tag1
  - tag2
```

## Variables

Each variable definition:

```yaml
- name: pressure              # Required: variable identifier
  label: "Pressure"           # Required: UI label
  description: "..."          # Required: detailed description
  unit: "MPa"                 # Required: unit of measurement
  data_type: "float"          # Required: float|int|string
  required: true              # Optional: default true
  min_value: 0                # Optional: numeric minimum
  max_value: 1000             # Optional: numeric maximum
  default_value: 10           # Optional: default value
  choices: [a, b, c]          # Optional: categorical values
```

### Data Types

**float**
- Used for: pressure, stress, length, temperature, etc.
- Validation: numeric range, min/max bounds
- Example: `10.5`, `1e-3`

**int**
- Used for: counts, iterations, indices
- Validation: integer conversion, min/max bounds
- Example: `42`, `100`

**string**
- Used for: material grades, codes, selections
- Validation: in choices list
- Example: `"ASTM A36"`, `"Pipe Type A"`

## Formula

SymPy-compatible mathematical expression.

**Variables** reference input variable names:
```yaml
formula: "(pressure * (diameter - 2*thickness)) / (2 * thickness)"
```

**Supported Functions:**
- `sin()`, `cos()`, `tan()`
- `sqrt()`, `exp()`, `log()`
- `pi`, `E`, `oo` (infinity)
- All SymPy functions

**Examples:**
```yaml
# Hoop stress
formula: "(P * (D - 2*t)) / (2 * t)"

# Beam deflection
formula: "(F * L**3) / (48 * E * I)"

# Thermal expansion
formula: "L0 * alpha * (T - T0)"
```

## Outputs

List of output variable names. Currently supports single output:

```yaml
outputs:
  - result
```

Future versions will support multiple outputs per formula.

## Complete Example

```yaml
name: "Pipe Stress Analysis"
category: "pressure"
description: "Calculate hoop stress in pressurized pipe using Barlow's formula"
normative_reference: "ASME B31.4, API 5L"
tags:
  - pipeline
  - pressure
  - stress
  - mechanical

variables:
  - name: "pressure"
    label: "Internal Pressure"
    description: "Design pressure inside the pipe"
    unit: "MPa"
    data_type: "float"
    required: true
    min_value: 0
    max_value: 1000

  - name: "diameter"
    label: "Outer Diameter"
    description: "External pipe diameter"
    unit: "mm"
    data_type: "float"
    required: true
    min_value: 1
    max_value: 10000

  - name: "thickness"
    label: "Wall Thickness"
    description: "Pipe wall thickness"
    unit: "mm"
    data_type: "float"
    required: true
    min_value: 0.1
    max_value: 500

  - name: "safety_factor"
    label: "Safety Factor"
    description: "Design safety factor"
    unit: ""
    data_type: "float"
    required: false
    min_value: 1.0
    max_value: 10.0
    default_value: 1.5

formula: "(pressure * (diameter - 2*thickness)) / (2 * thickness)"
outputs:
  - "result"
```

## Categories

Standard categories (extensible):

- `pressure` — pressure calculations
- `stress` — stress analysis
- `deflection` — beam deflection
- `thermal` — thermal expansion
- `hydraulic` — hydraulic calculations
- `structural` — structural analysis
- `welding` — weld calculations
- `material` — material properties

## Units

Standard units (Pint compatible):

**Pressure:** `Pa`, `MPa`, `GPa`, `bar`, `atm`, `psi`  
**Length:** `mm`, `cm`, `m`, `inch`, `ft`  
**Stress:** `Pa`, `MPa`, `GPa`, `psi`, `ksi`  
**Temperature:** `kelvin`, `celsius`, `fahrenheit`  
**Force:** `N`, `kN`, `lbf`  
**Angle:** `degree`, `radian`  

## Validation Rules

**Applied automatically by Validator:**

1. **Required fields** — all `required: true` variables must be provided
2. **Type conversion** — values cast to declared type
3. **Range bounds** — min_value ≤ value ≤ max_value
4. **Categorical** — value in choices list (if defined)
5. **Formula syntax** — SymPy can parse and evaluate

## Best Practices

1. **Name clarity** — use descriptive variable names
   - ✅ `internal_pressure`, `outer_diameter`, `wall_thickness`
   - ❌ `p`, `d`, `t`

2. **Unit consistency** — use SI units as default
   - Pressure: MPa (not bar, psi)
   - Length: mm (not cm, inch)
   - Temperature: kelvin (not celsius)

3. **Documentation** — provide normative references
   - Include relevant standards (ASME, API, ISO, GOST)
   - Link to calculation basis

4. **Bounds checking** — set realistic min/max values
   - Prevents nonsensical inputs
   - Catches data entry errors

5. **Default values** — provide sensible defaults for optional fields
   - Safety factors: 1.5-2.0
   - Common pressures: 10-50 MPa

6. **Tags** — categorize for discoverability
   - Discipline: pipeline, structural, thermal
   - Industry: oil-gas, chemical, civil
   - Type: stress, deflection, capacity

## Testing Templates

Manual test:
```bash
curl -X POST http://localhost:8000/api/v1/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "pipe_stress",
    "inputs": [
      {"name": "pressure", "value": 10},
      {"name": "diameter", "value": 500},
      {"name": "thickness", "value": 5}
    ]
  }'
```

## Migration from Legacy

Legacy calculations (274 existing) can be converted to templates:

1. Identify formula
2. Define input variables with bounds
3. Create YAML template
4. Test against known results
5. Deploy

---

*Foundation Phase v1.0.0*
