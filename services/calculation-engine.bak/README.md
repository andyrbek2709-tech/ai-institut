# Calculation Engine

Production calculation backend for EngHub.

## Architecture

- **Evaluator** - Formula evaluation using SymPy
- **Validator** - Input validation against template definitions
- **UnitConverter** - Unit conversions using Pint
- **Runner** - Orchestrates calculation execution
- **TemplateRegistry** - In-memory storage for templates
- **TemplateLoader** - Loads YAML templates

## Installation

```bash
pip install -r requirements.txt
```

## Running Locally

```bash
python src/app.py
```

Server runs on `http://localhost:8000`

## API Endpoints

### GET /api/v1/health
Health check.

### GET /api/v1/templates
List all templates.

### GET /api/v1/templates/categories
List categories.

### GET /api/v1/templates/{template_id}
Get template details.

### POST /api/v1/calculate
Execute calculation.

**Request:**
```json
{
  "template_id": "pipe_stress",
  "inputs": [
    {"name": "pressure", "value": 10, "unit": "MPa"},
    {"name": "diameter", "value": 500, "unit": "mm"},
    {"name": "thickness", "value": 5, "unit": "mm"}
  ],
  "unit_system": "SI"
}
```

**Response:**
```json
{
  "template_id": "pipe_stress",
  "status": "success",
  "results": {"result": 495.0},
  "warnings": [],
  "metadata": {...}
}
```

### POST /api/v1/calculate/validate
Validate inputs without executing.

## Templates

Templates are YAML-based, located in `src/templates/data/`.

**Format:**
```yaml
name: Template Name
category: category_name
description: Description
variables:
  - name: var_name
    label: Label
    unit: mm
    data_type: float
    required: true
    min_value: 0
    max_value: 1000
formula: "formula expression"
outputs:
  - result
normative_reference: "Standard reference"
tags: [tag1, tag2]
```

## Testing

```bash
pytest tests/
```

## Development

Code style: Black + Ruff
Type checking: mypy

```bash
black src/
ruff check src/
mypy src/
```
