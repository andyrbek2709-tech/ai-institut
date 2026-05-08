# Calculations Platform — Architecture Overview

**Phase:** Foundation (Weeks 1-3)  
**Status:** Architecture Complete  
**Date:** 2026-05-08

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (React)                       │
│  Port 5173 • Vite • TypeScript • Tailwind • Zustand     │
│  ├─ Layout (Sidebar navigation)                          │
│  ├─ CategoriesPage (browse categories)                   │
│  ├─ TemplatesPage (list & search templates)             │
│  └─ CalculationPage (input → results)                    │
└──────────────────────┬──────────────────────────────────┘
                       │ /api/v1 (HTTP)
┌──────────────────────▼──────────────────────────────────┐
│                Backend (FastAPI)                         │
│  Port 8000 • Python 3.11+ • Production-ready            │
├─────────────────────────────────────────────────────────┤
│ API Layer                                                │
│  ├─ GET /health                                          │
│  ├─ GET /templates                                       │
│  ├─ GET /templates/{template_id}                         │
│  ├─ POST /calculate                                      │
│  └─ POST /calculate/validate                             │
├─────────────────────────────────────────────────────────┤
│ Engine Layer                                             │
│  ├─ Evaluator (SymPy formula evaluation)                │
│  ├─ Validator (input validation)                         │
│  ├─ UnitConverter (Pint unit system)                     │
│  └─ Runner (orchestration)                               │
├─────────────────────────────────────────────────────────┤
│ Template System                                          │
│  ├─ TemplateRegistry (in-memory storage)                │
│  └─ TemplateLoader (YAML parsing)                        │
└─────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
.
├── apps/
│   └── calculations-platform/              # React Frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── Layout.tsx
│       │   │   └── Sidebar.tsx
│       │   ├── pages/
│       │   │   ├── CategoriesPage.tsx
│       │   │   ├── TemplatesPage.tsx
│       │   │   └── CalculationPage.tsx
│       │   ├── stores/
│       │   │   └── calculation.ts (Zustand)
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   └── index.css (Tailwind)
│       ├── index.html
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── package.json
│       └── tailwind.config.ts
│
├── services/
│   └── calculation-engine/                 # FastAPI Backend
│       ├── src/
│       │   ├── api/
│       │   │   └── endpoints/
│       │   │       ├── templates.py
│       │   │       └── calculations.py
│       │   ├── engine/
│       │   │   ├── evaluator.py
│       │   │   ├── validator.py
│       │   │   ├── runner.py
│       │   │   └── unit_converter.py
│       │   ├── schemas/
│       │   │   └── models.py (Pydantic)
│       │   ├── templates/
│       │   │   ├── loader.py
│       │   │   ├── registry.py
│       │   │   └── data/
│       │   │       └── pipe_stress.yaml
│       │   ├── core/
│       │   │   └── container.py (DI)
│       │   ├── app.py
│       │   ├── config.py
│       │   └── __init__.py
│       ├── tests/
│       ├── requirements.txt
│       ├── pyproject.toml
│       ├── .env
│       └── README.md
│
└── docs/
    ├── CALCULATIONS_ARCHITECTURE.md
    ├── CALCULATIONS_ENGINE.md
    ├── TEMPLATE_SPEC.md
    └── API_REFERENCE.md
```

---

## Data Flow

### Calculation Execution

1. **User Input** (Frontend)
   - User selects template
   - Enters input values
   - Clicks "Calculate"

2. **API Request** (Frontend → Backend)
   ```json
   POST /api/v1/calculate
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

3. **Backend Processing**
   - Load template from registry
   - Validate inputs against template variables
   - Convert units if needed
   - Evaluate formula (SymPy)
   - Build results

4. **API Response** (Backend → Frontend)
   ```json
   {
     "template_id": "pipe_stress",
     "status": "success",
     "results": {"result": 495.0},
     "warnings": [],
     "metadata": {...}
   }
   ```

5. **Display Results** (Frontend)
   - Show results in calculation panel
   - Update Zustand store
   - Display normative reference

---

## Key Design Principles

### Backend

1. **Modular Architecture**
   - Clear separation of concerns
   - Engine components are independent
   - Easy to extend

2. **Production-Ready**
   - Type hints throughout (Python 3.11+)
   - Pydantic for validation
   - FastAPI for async handling
   - CORS enabled

3. **Template-Driven**
   - YAML-based template format
   - In-memory registry
   - Easy to add new calculations

4. **Robust Validation**
   - Input validation at API boundary
   - Type checking (Pydantic)
   - Formula validation (SymPy)
   - Unit compatibility (Pint)

### Frontend

1. **SaaS-Quality UI**
   - Tailwind CSS styling
   - Clean, professional layout
   - Responsive design

2. **State Management**
   - Zustand for simple state
   - Easy to track calculation history
   - Extensible for future features

3. **Component-Based**
   - Layout wrapper
   - Reusable pages
   - Clean composition

---

## API Endpoints (v1)

### Templates

**GET /api/v1/templates**
- List all templates
- Response: `{count: int, templates: [...]}`

**GET /api/v1/templates/categories**
- List all categories
- Response: `{categories: [{name, count}, ...]}`

**GET /api/v1/templates/{template_id}**
- Get template details
- Response: Full template with all variables

### Calculations

**POST /api/v1/calculate**
- Execute calculation
- Request: `{template_id, inputs, unit_system}`
- Response: `{status, results, warnings, metadata}`

**POST /api/v1/calculate/validate**
- Validate inputs without executing
- Request: `{template_id, inputs}`
- Response: `{valid, errors, warnings}`

### Health

**GET /api/v1/health**
- Service health check
- Response: `{status: "ok", version: "1.0.0"}`

---

## Template Specification

**Format:** YAML

**Required Fields:**
- `name`: Template name
- `category`: Category slug
- `description`: Human-readable description
- `variables`: List of input variables
- `formula`: SymPy-compatible formula
- `outputs`: List of output variable names

**Variable Definition:**
```yaml
- name: pressure
  label: Internal Pressure
  description: Design pressure inside the pipe
  unit: MPa
  data_type: float
  required: true
  min_value: 0
  max_value: 1000
```

---

## Demo Template: Pipe Stress Analysis

**Location:** `services/calculation-engine/src/templates/data/pipe_stress.yaml`

**Formula:** Barlow's formula for hoop stress
```
σ = (P × (D - 2t)) / (2 × t)
```

**Variables:**
- Pressure (0-1000 MPa)
- Diameter (1-10000 mm)
- Thickness (0.1-500 mm)
- Safety factor (1-10)

**Reference:** ASME B31.4, API 5L

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React | 18.3+ |
| | TypeScript | 5.3+ |
| | Vite | 5.0+ |
| | Tailwind CSS | 3.4+ |
| | Zustand | 4.4+ |
| **Backend** | Python | 3.11+ |
| | FastAPI | 0.104+ |
| | Pydantic | 2.5+ |
| | SymPy | 1.12+ |
| | Pint | 0.23+ |
| **DevOps** | Docker | - |

---

## Next Steps (Phase 2+)

- [ ] Database integration (PostgreSQL)
- [ ] Calculation history storage
- [ ] User authentication
- [ ] Advanced template editor
- [ ] PDF report generation
- [ ] Migration of 274 existing calculations
- [ ] AI template generation
- [ ] OCR/PDF parsing
