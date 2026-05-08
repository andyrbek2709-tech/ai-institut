# Calculation Platform Architecture - Foundation Phase

**Status:** Foundation Phase v0.1.0

## Overview

This is a modular, production-grade calculation platform foundation with separation between backend engine and frontend UI. No AI, OCR, or advanced parsing — pure calculation and template infrastructure.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                  │
│          (Vite, TypeScript, Tailwind, Zustand)     │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP/REST
┌──────────────────────▼──────────────────────────────┐
│                  FastAPI Backend                    │
│  (Python, Pydantic, SymPy, Pint)                   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │   API    │  │  Engine  │  │Templates │          │
│  │ Handlers │  │ Executor │  │ Loader   │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │Validators│  │  Units   │  │ Reports  │          │
│  │ & Rules  │  │Converter │  │(Stubs)   │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                      │
└──────────────────┬───────────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │  YAML Templates     │
        │  Database (future)  │
        └─────────────────────┘
```

## Services

### services/calculation-engine/

**Purpose:** Core calculation engine and API.

**API Endpoints:**
- `GET /templates/` — List all templates
- `GET /templates/{id}` — Get template definition
- `POST /calculations/calculate` — Execute calculation
- `POST /calculations/validate` — Validate inputs

## Template System

### YAML Format Example
```yaml
metadata:
  name: "Pipe Stress Analysis"
  description: "Calculate stress using Barlow's formula"
  category: "Mechanical/Piping"
  version: "1.0.0"
  author: "Author Name"

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
    description: "Hoop stress"
    unit: "MPa"
    type: "float"

formulas:
  hoop_stress: "(pressure * (od - 2 * wt)) / (2 * wt)"

validation_rules:
  pressure: "positive"
```

## Technology Stack

### Backend
- **Framework:** FastAPI (async, OpenAPI)
- **Validation:** Pydantic v2
- **Math:** SymPy (symbolic computation)
- **Units:** Pint (unit conversion)

### Frontend
- **Framework:** React 18
- **Build:** Vite (instant HMR)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **HTTP:** Axios

## Deployment Strategy

### Development
- Backend: `python app/main.py` (port 8000)
- Frontend: `npm run dev` (port 5173)

### Production
- Backend: Railway container
- Frontend: Railway static build
