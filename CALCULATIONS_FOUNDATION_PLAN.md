# CALCULATIONS PLATFORM — FOUNDATION IMPLEMENTATION PLAN

**Phase:** FOUNDATION (Weeks 1-3)  
**Start Date:** 2026-05-13  
**End Date:** 2026-06-03  
**Status:** Ready for execution

---

## PHASE OVERVIEW

**Goal:** Create production-grade foundation for engineering calculations platform.

**Not Included:** Migration of 274 existing calculations (Phase 2).

**Deliverables:**
1. Python FastAPI calculation engine
2. Frontend React app skeleton
3. Database schema + migrations
4. Demo template (pipe_stress)
5. End-to-end working example

---

## WEEK 1: Backend + Database Foundation

### Day 1-2: Project Setup

**1.1 Create calculation-engine service**

```bash
cd services/
mkdir calculation-engine
cd calculation-engine
```

**Structure:**
```
services/calculation-engine/
├── src/
│    ├── __init__.py
│    ├── app.py                    # FastAPI app
│    ├── config.py                 # Config (env, constants)
│    ├── engine/
│    │    ├── __init__.py
│    │    ├── evaluator.py         # Formula evaluation
│    │    ├── validator.py         # Input validation
│    │    ├── runner.py            # Calculation runner
│    │    └── schemas.py           # Pydantic models
│    ├── units/
│    │    ├── __init__.py
│    │    └── converter.py         # Pint-based conversion
│    ├── templates/
│    │    ├── __init__.py
│    │    ├── loader.py            # Template loading
│    │    └── pipe_stress.yaml     # Demo template
│    ├── routes/
│    │    ├── __init__.py
│    │    ├── calculations.py      # /api/calculate
│    │    ├── templates.py         # /api/templates
│    │    └── health.py            # /health
│    └── db/
│        ├── __init__.py
│        ├── client.py             # Supabase client
│        └── models.py             # ORM models (if needed)
├── tests/
├── pyproject.toml                 # Dependencies
├── .env.example                   # Example env vars
└── README.md
```

**1.2 Create pyproject.toml**

```toml
[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"

[project]
name = "calculation-engine"
version = "0.1.0"
description = "Engineering calculations platform engine"

[project.dependencies]
fastapi = "^0.104.0"
pydantic = "^2.5.0"
pydantic-settings = "^2.1.0"
uvicorn = "^0.24.0"
sympy = "^1.12"
pint = "^0.23"
supabase = "^2.2.0"
python-dotenv = "^1.0.0"
```

**1.3 Create app.py skeleton**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Calculation Engine", version="0.1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
from .routes import calculations, templates, health
app.include_router(health.router)
app.include_router(calculations.router, prefix="/api")
app.include_router(templates.router, prefix="/api")

@app.get("/")
def root():
    return {"service": "calculation-engine", "version": "0.1.0"}
```

**Checkpoint:** ✓ Project structure created, app boots

---

### Day 3-4: Engine Core

**2.1 Create schemas.py (Pydantic models)**

```python
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class CalculationInput(BaseModel):
    id: str
    name: str
    unit: Optional[str] = None
    defaultValue: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    hint: Optional[str] = None

class CalculationTemplate(BaseModel):
    id: str
    category: str
    name: str
    description: str
    normativeReference: str
    inputs: list[CalculationInput]
    formula: str  # e.g., "Q = G * c * dT"
    
class CalculateRequest(BaseModel):
    templateId: str
    inputs: Dict[str, float]

class CalculateResponse(BaseModel):
    templateId: str
    results: Dict[str, Any]
    report: list[Dict[str, Any]]
```

**2.2 Create evaluator.py (SymPy-based)**

```python
from sympy import sympify, symbols
from sympy.parsing.sympy_parser import parse_expr

class Evaluator:
    """Evaluates formulas using SymPy"""
    
    def evaluate(self, formula: str, values: Dict[str, float]) -> float:
        """
        Evaluate formula with given values
        
        Example:
            formula = "Q = G * c * dT"
            values = {"G": 1.0, "c": 4.18, "dT": 10}
            result = 41.8
        """
        # Remove "Q = " prefix
        expr_str = formula.split("=", 1)[1].strip()
        
        # Parse and evaluate
        expr = parse_expr(expr_str)
        result = expr.subs(values)
        
        return float(result)
```

**2.3 Create validator.py**

```python
class Validator:
    """Validates calculation inputs"""
    
    def validate(self, inputs: Dict[str, float], template: Dict) -> list[str]:
        """Validate inputs against template rules"""
        errors = []
        
        for inp_spec in template["inputs"]:
            input_id = inp_spec["id"]
            value = inputs.get(input_id)
            
            if value is None:
                errors.append(f"{input_id}: required")
            elif inp_spec.get("min") and value < inp_spec["min"]:
                errors.append(f"{input_id}: must be ≥ {inp_spec['min']}")
            elif inp_spec.get("max") and value > inp_spec["max"]:
                errors.append(f"{input_id}: must be ≤ {inp_spec['max']}")
        
        return errors
```

**2.4 Create runner.py**

```python
from .evaluator import Evaluator
from .validator import Validator

class CalculationRunner:
    """Orchestrates calculation execution"""
    
    def __init__(self):
        self.evaluator = Evaluator()
        self.validator = Validator()
    
    def run(self, template: Dict, inputs: Dict[str, float]):
        """
        Run calculation:
        1. Validate inputs
        2. Evaluate formula
        3. Generate report
        """
        # Validate
        errors = self.validator.validate(inputs, template)
        if errors:
            return {"success": False, "errors": errors}
        
        # Evaluate
        result_value = self.evaluator.evaluate(template["formula"], inputs)
        
        # Build report
        report = self._build_report(template, inputs, result_value)
        
        return {
            "success": True,
            "results": {
                "value": result_value,
                "unit": template.get("outputUnit")
            },
            "report": report
        }
    
    def _build_report(self, template, inputs, result):
        return [
            {"title": "Исходные данные", "text": str(inputs)},
            {"title": "Результат", "text": f"{result} {template.get('outputUnit')}"}
        ]
```

**Checkpoint:** ✓ Engine core (evaluate, validate, run) works

---

### Day 5: Database + Routes

**3.1 Create database migrations**

```sql
-- supabase/migrations/XXXXX_calculations_foundation.sql

CREATE TABLE IF NOT EXISTS calculation_templates (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  formula TEXT NOT NULL,
  normative_reference TEXT,
  inputs JSONB NOT NULL,
  output_unit TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calculation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  template_id TEXT REFERENCES calculation_templates(id),
  inputs JSONB NOT NULL,
  results JSONB NOT NULL,
  report JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE calculation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read templates"
  ON calculation_templates FOR SELECT
  USING (true);
```

**3.2 Create routes/calculations.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from ..engine.runner import CalculationRunner
from ..engine.schemas import CalculateRequest, CalculateResponse

router = APIRouter()
runner = CalculationRunner()

# Demo: Load template from YAML (Week 2: load from DB)
TEMPLATES = {
    "pipe_stress": {
        "formula": "stress = F / A",
        "inputs": [
            {"id": "F", "name": "Force", "unit": "N", "min": 0},
            {"id": "A", "name": "Area", "unit": "mm²", "min": 0}
        ],
        "outputUnit": "MPa"
    }
}

@router.post("/calculate")
async def calculate(req: CalculateRequest) -> CalculateResponse:
    """Execute calculation"""
    template = TEMPLATES.get(req.templateId)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    result = runner.run(template, req.inputs)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["errors"])
    
    return CalculateResponse(
        templateId=req.templateId,
        results=result["results"],
        report=result["report"]
    )
```

**Checkpoint:** ✓ `/api/calculate` endpoint works

---

## WEEK 2: Frontend + Template System

### Day 1-2: Frontend Skeleton

**1.1 Create React app (in separate directory)**

```bash
cd apps/calculations-platform/
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install react-router-dom zustand @hookform/react @tanstack/react-query
```

**1.2 Create app structure**

```
apps/calculations-platform/frontend/
├── src/
│    ├── main.tsx
│    ├── App.tsx
│    ├── pages/
│    │    ├── Home.tsx
│    │    ├── CalculationPage.tsx
│    │    └── TemplateList.tsx
│    ├── components/
│    │    ├── CalculationForm.tsx
│    │    ├── ResultsDisplay.tsx
│    │    └── ReportViewer.tsx
│    ├── hooks/
│    │    ├── useCalculation.ts
│    │    └── useTemplates.ts
│    ├── store/
│    │    └── calculationStore.ts
│    └── api/
│        └── client.ts
├── vite.config.ts
└── package.json
```

**1.3 Create API client**

```typescript
// src/api/client.ts
export const api = {
  async calculate(templateId: string, inputs: Record<string, number>) {
    const response = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId, inputs })
    });
    return response.json();
  },
  
  async getTemplates() {
    const response = await fetch('/api/templates');
    return response.json();
  }
};
```

**1.4 Create Zustand store**

```typescript
// src/store/calculationStore.ts
import { create } from 'zustand';

export const useCalculationStore = create((set) => ({
  currentTemplate: null,
  results: null,
  setTemplate: (t) => set({ currentTemplate: t }),
  setResults: (r) => set({ results: r })
}));
```

**Checkpoint:** ✓ Frontend boots, can navigate pages

---

### Day 3: Demo Template (pipe_stress)

**2.1 Create template YAML**

```yaml
# services/calculation-engine/templates/pipe_stress.yaml

id: pipe_stress
category: mechanical
name: "Pipe Stress Analysis (Hoop Stress)"
description: "Calculate hoop stress in pressurized pipe"
normativeReference: "ASME B31.1, ASME B31.8"

inputs:
  - id: P
    name: "Internal Pressure"
    unit: "MPa"
    defaultValue: 5.0
    min: 0.1
    max: 100
    hint: "Gauge pressure inside pipe"
  
  - id: D
    name: "Outer Diameter"
    unit: "mm"
    defaultValue: 100
    min: 10
    max: 10000
    hint: "Pipe outer diameter"
  
  - id: t
    name: "Wall Thickness"
    unit: "mm"
    defaultValue: 5
    min: 0.5
    max: 100
    hint: "Pipe wall thickness"
  
  - id: E
    name: "Longitudinal Weld Joint Efficiency"
    unit: ""
    defaultValue: 1.0
    min: 0.5
    max: 1.0
    hint: "0.5-1.0 depending on weld type"

formula: "σ_h = (P * (D - 2*t)) / (2 * t * E)"
outputUnit: "MPa"

report:
  - title: "Formula"
    formulaLatex: "\\sigma_h = \\frac{P \\cdot (D - 2t)}{2 \\cdot t \\cdot E}"
  
  - title: "Where"
    text: |
      σ_h — hoop stress (MPa)
      P — internal pressure (MPa)
      D — outer diameter (mm)
      t — wall thickness (mm)
      E — weld joint efficiency (0.5-1.0)
  
  - title: "Safety Criterion"
    text: |
      For steel pipes: σ_h ≤ 110 MPa (typical minimum)
      For design: select t such that σ_h < σ_allowable
```

**2.2 Update runner to load YAML**

```python
import yaml
from pathlib import Path

class CalculationRunner:
    def __init__(self):
        self.templates = self._load_templates()
    
    def _load_templates(self):
        templates_dir = Path(__file__).parent.parent / "templates"
        templates = {}
        for yaml_file in templates_dir.glob("*.yaml"):
            with open(yaml_file) as f:
                template = yaml.safe_load(f)
                templates[template["id"]] = template
        return templates
    
    def run(self, template_id: str, inputs: Dict[str, float]):
        template = self.templates.get(template_id)
        if not template:
            raise ValueError(f"Template '{template_id}' not found")
        # ... rest of run logic
```

**2.3 Update frontend to call real API**

```typescript
// src/pages/CalculationPage.tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';

export function CalculationPage({ templateId }: { templateId: string }) {
  const [template, setTemplate] = useState(null);
  const [inputs, setInputs] = useState({});
  const [results, setResults] = useState(null);

  useEffect(() => {
    api.getTemplate(templateId).then(setTemplate);
  }, [templateId]);

  const handleCalculate = async () => {
    const res = await api.calculate(templateId, inputs);
    setResults(res);
  };

  return (
    <div>
      {template && (
        <>
          <h1>{template.name}</h1>
          <form>
            {template.inputs.map(inp => (
              <input
                key={inp.id}
                placeholder={inp.name}
                value={inputs[inp.id] || ''}
                onChange={(e) => setInputs({
                  ...inputs,
                  [inp.id]: parseFloat(e.target.value)
                })}
              />
            ))}
          </form>
          <button onClick={handleCalculate}>Calculate</button>
          {results && <div>{JSON.stringify(results)}</div>}
        </>
      )}
    </div>
  );
}
```

**Checkpoint:** ✓ Demo template (pipe_stress) fully functional end-to-end

---

### Day 4-5: Polish + Docs

**3.1 Add DOCX export**

```python
# services/calculation-engine/src/export/docx_export.py

from docx import Document
from docx.shared import Pt, Inches, RGBColor

class DocxExporter:
    def export(self, template, inputs, results, report):
        doc = Document()
        
        doc.add_heading(template["name"], level=1)
        doc.add_paragraph(f"Category: {template['category']}")
        doc.add_paragraph(f"Reference: {template['normativeReference']}")
        
        doc.add_heading("Inputs", level=2)
        for inp_id, value in inputs.items():
            inp = next(i for i in template["inputs"] if i["id"] == inp_id)
            doc.add_paragraph(f"{inp['name']}: {value} {inp.get('unit', '')}")
        
        doc.add_heading("Results", level=2)
        for key, val in results.items():
            doc.add_paragraph(f"{key}: {val}")
        
        return doc
```

**3.2 Create comprehensive README**

```markdown
# Calculation Engine

## Quick Start

```bash
cd services/calculation-engine
poetry install
poetry run uvicorn src.app:app --reload
```

## Demo Request

```bash
curl -X POST http://localhost:8000/api/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "pipe_stress",
    "inputs": {"P": 5, "D": 100, "t": 5, "E": 1.0}
  }'
```

## Architecture

- **evaluator.py** — Formula evaluation (SymPy)
- **validator.py** — Input validation
- **runner.py** — Orchestration
- **templates/** — YAML template definitions

## Adding New Template

1. Create `templates/my_template.yaml`
2. Define formula, inputs, output
3. Restart service
4. Test via API

No code changes needed!
```

**Checkpoint:** ✓ DOCX export works, documentation complete

---

## WEEK 3: Integration + Testing

### Day 1-2: Database Integration

**1.1 Save results to database**

```python
# src/routes/calculations.py

@router.post("/calculate")
async def calculate(req: CalculateRequest, user_id: str = Depends(get_current_user)):
    # ... existing calculate logic ...
    
    # Save to DB
    supabase.table("calculation_results").insert({
        "user_id": user_id,
        "template_id": req.templateId,
        "inputs": req.inputs,
        "results": result["results"],
        "report": result["report"]
    }).execute()
    
    return CalculateResponse(...)
```

**1.2 Retrieve calculation history**

```python
@router.get("/history/{user_id}")
async def get_history(user_id: str):
    """Get user's calculation history"""
    results = supabase.table("calculation_results") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("created_at", desc=True) \
        .execute()
    return results.data
```

**Checkpoint:** ✓ Results persisted to DB

---

### Day 3: Testing

**2.1 Create test suite**

```python
# tests/test_engine.py

import pytest
from src.engine.runner import CalculationRunner

def test_pipe_stress_calculation():
    runner = CalculationRunner()
    result = runner.run("pipe_stress", {
        "P": 5.0,
        "D": 100,
        "t": 5,
        "E": 1.0
    })
    
    assert result["success"]
    assert "results" in result
    assert result["results"]["value"] > 0

def test_validation_fails_on_invalid_input():
    runner = CalculationRunner()
    result = runner.run("pipe_stress", {
        "P": -5,  # Invalid: negative pressure
        "D": 100,
        "t": 5,
        "E": 1.0
    })
    
    assert not result["success"]
    assert len(result["errors"]) > 0
```

**2.2 Run tests**

```bash
poetry run pytest tests/ -v
```

**Checkpoint:** ✓ All tests passing

---

### Day 4-5: Documentation + Deployment

**3.1 Create architecture documentation**

```markdown
# Calculation Engine Architecture

## System Design

```
Request → Validation → Evaluation → Report → Response
           ↓
         Database (audit)
```

## Template Format

YAML-based templates:
- `id` — unique identifier
- `category` — grouping
- `formula` — evaluated using SymPy
- `inputs` — with validation rules
- `report` — structure for results display

## Adding New Calculation

No backend changes needed!

1. Create `templates/my_calc.yaml`
2. Define formula (SymPy-compatible)
3. Define inputs with validation
4. Optionally add report structure

Engine automatically:
- Validates inputs
- Evaluates formula
- Generates report
- Saves to database

## Performance

- Single calculation: <50ms
- Report generation: <20ms
- Database insert: <10ms
- **Total: <100ms per calculation**
```

**3.2 Prepare for Railway deployment**

```dockerfile
# services/calculation-engine/Dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY pyproject.toml poetry.lock ./
RUN pip install poetry && poetry install --no-dev

COPY src/ ./src/
COPY templates/ ./templates/

CMD ["poetry", "run", "uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Checkpoint:** ✓ Ready for production deployment

---

## DELIVERABLES CHECKLIST

### Backend ✓
- [ ] FastAPI app structure
- [ ] Engine core (evaluator, validator, runner)
- [ ] Routes (calculate, templates, health)
- [ ] YAML template system
- [ ] Database integration
- [ ] Dockerfile for deployment

### Frontend ✓
- [ ] React app skeleton
- [ ] Template list page
- [ ] Calculation page
- [ ] Results display
- [ ] API client integration

### Database ✓
- [ ] `calculation_templates` table
- [ ] `calculation_results` table
- [ ] Migration files
- [ ] RLS policies

### Demo ✓
- [ ] `pipe_stress` template (YAML)
- [ ] End-to-end working calculation
- [ ] DOCX export
- [ ] Results saved to DB

### Documentation ✓
- [ ] README (Backend)
- [ ] README (Frontend)
- [ ] Architecture docs
- [ ] API documentation
- [ ] Template creation guide

### Testing ✓
- [ ] Unit tests (engine)
- [ ] Integration tests
- [ ] All tests passing

---

## SUCCESS CRITERIA

**Foundation Phase is COMPLETE when:**

1. ✅ Backend: `/api/calculate` returns results in <100ms
2. ✅ Frontend: Can load template and display results
3. ✅ Database: Results are persisted and retrievable
4. ✅ Demo: `pipe_stress` calculation works end-to-end
5. ✅ Docs: New developer can add template in 30 minutes
6. ✅ Tests: 100% of engine logic covered by tests
7. ✅ Deployment: Both services deploy to Railway without errors

---

## ESTIMATED EFFORT

| Component | Hours | Notes |
|-----------|-------|-------|
| Backend setup + core | 20 | Most complex |
| Frontend skeleton | 10 | Quick, straightforward |
| Demo template | 8 | Includes YAML + docs |
| Testing + docs | 12 | Comprehensive |
| **Total** | **50** | ~2 weeks (25h/week) |

---

## WHAT'S NOT INCLUDED

- [ ] Migration of 274 existing calculations (Phase 2)
- [ ] AI template generation (Phase 3)
- [ ] Advanced reporting (charts, tables)
- [ ] Multi-user collaboration
- [ ] Units conversion (Pint integration)
- [ ] Symbolic math visualization

These are Phase 2-3 features.

---

**Ready to begin Foundation Phase? ✅**

Next: Create calculation-engine service structure (Day 1).
