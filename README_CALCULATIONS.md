# EnGHub Calculation Platform - Foundation Phase

**Status:** ✅ Foundation Phase v0.1.0 Complete

Production-grade calculation platform foundation with modular backend and modern React frontend.

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend Setup

```bash
cd services/calculation-engine

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -e .

# Run server
python app/main.py
# Server runs at http://localhost:8000
```

### Frontend Setup

```bash
cd apps/calculations-platform

# Install dependencies
npm install

# Run dev server
npm run dev
# Frontend runs at http://localhost:5173
```

### Test the App

1. Open browser: http://localhost:5173
2. Select "Pipe Stress Analysis" template
3. Fill in example values:
   - Pressure: 10
   - Outer Diameter: 100
   - Wall Thickness: 5
   - Yield Strength: 450
4. Click "Calculate"
5. See results

## Project Structure

```
.
├── services/
│   └── calculation-engine/        # FastAPI backend
│       ├── app/
│       │   ├── api/               # Endpoints
│       │   ├── engine/            # Calculation engine
│       │   ├── templates/         # Template loader
│       │   ├── units/             # Unit conversion
│       │   ├── validators/        # Validation
│       │   ├── schemas/           # Pydantic schemas
│       │   └── core/              # Configuration
│       └── templates/             # YAML templates
│           └── pipe_stress.yaml
│
├── apps/
│   └── calculations-platform/     # React frontend
│       ├── src/
│       │   ├── components/        # React components
│       │   ├── api/               # API client
│       │   └── index.css          # Tailwind
│       └── index.html
│
└── docs/
    ├── ARCHITECTURE.md
    └── TEMPLATE_SPEC.md
```

## API Documentation

### Endpoints

- `GET /templates/` — List all templates
- `GET /templates/{id}` — Get template definition
- `POST /calculations/calculate` — Execute calculation
- `POST /calculations/validate` — Validate inputs
- `GET /health` — Health check

### Example Calculation

```bash
curl -X POST http://localhost:8000/calculations/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "pipe_stress",
    "variables": {
      "pressure": 10,
      "outer_diameter": 100,
      "wall_thickness": 5,
      "yield_strength": 450
    }
  }'
```

## Creating New Templates

1. Create YAML file in `services/calculation-engine/templates/`
2. Define metadata, inputs, outputs, formulas
3. Restart backend
4. Template auto-discovered

See `docs/TEMPLATE_SPEC.md` for full specification.

## Key Features

✅ **Production-Grade**
- Type-safe (TypeScript + Pydantic)
- Proper error handling
- Input validation

✅ **Modular**
- Independent backend engine
- Clean API boundary
- Template-driven calculations

✅ **SaaS-Ready UI**
- Modern React frontend
- Responsive design
- Real-time results

## What's NOT Included

- ❌ Database persistence (Phase 2)
- ❌ User authentication (Phase 2)
- ❌ PDF export (Phase 2)
- ❌ AI/OCR (Phase 4)

## Technology Stack

### Backend
- FastAPI, Pydantic, SymPy, Pint

### Frontend
- React, Vite, TypeScript, Tailwind, Axios

## Architecture

See `docs/ARCHITECTURE.md` for full details.

## License

Private - EnGHub Project
