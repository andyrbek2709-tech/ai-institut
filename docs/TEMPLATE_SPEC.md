# Template Specification

## YAML Structure

All templates are YAML files in `services/calculation-engine/templates/`.

### Metadata (Required)
```yaml
metadata:
  name: "Display Name"
  description: "Brief description"
  category: "Category/Subcategory"
  version: "X.Y.Z"
  author: "Author Name"
```

### Inputs (Required)
```yaml
inputs:
  - name: "variable_name"           # Snake case
    description: "What is this"     # Human description
    unit: "MPa"                     # Pint-compatible unit
    type: "float"                   # Default: float
    min_value: 0                    # Optional
    max_value: 100                  # Optional
    required: true                  # Optional, default true
    default_value: 42               # Optional
```

### Outputs (Required)
```yaml
outputs:
  - name: "result_variable"
    description: "What this means"
    unit: "MPa"
    type: "float"
```

### Formulas (Required)
```yaml
formulas:
  hoop_stress: "(pressure * (od - 2 * wt)) / (2 * wt)"
  safety_factor: "yield_strength / hoop_stress"
```

### Validation Rules (Optional)
```yaml
validation_rules:
  pressure: "positive"              # value > 0
  wall_thickness: "positive"        # value > 0
  diameter: "range:10-5000"         # 10 ≤ value ≤ 5000
```

## Best Practices

1. **Naming:** Snake case for variables
2. **Units:** Use Pint-compatible strings (MPa, mm, etc.)
3. **Formulas:** SymPy-compatible expressions
4. **Validation:** Always validate physical limits

## Unit Examples
- Pressure: MPa, psi, bar, kPa
- Length: mm, m, inch, foot
- Stress: MPa, ksi
- Force: N, kN, lbf

See `docs/TEMPLATE_SPEC.md` for full specification.
