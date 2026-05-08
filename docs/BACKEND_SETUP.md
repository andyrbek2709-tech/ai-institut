# Backend Setup Guide

## Installation

```bash
cd services/calculation-engine
pip install -r requirements.txt
```

## Configuration

**File:** `.env`

```env
DATABASE_URL=postgresql://localhost/calculations
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=true
CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]
DEFAULT_TEMPERATURE_UNIT=kelvin
DEFAULT_PRESSURE_UNIT=pascal
```

## Running Locally

```bash
python src/app.py
```

Server runs on `http://localhost:8000`

### With Uvicorn directly

```bash
uvicorn src.app:app --reload --host 0.0.0.0 --port 8000
```

## API Documentation

Swagger UI: `http://localhost:8000/docs`
ReDoc: `http://localhost:8000/redoc`

## Project Structure

```
src/
├── app.py                  # FastAPI application
├── config.py              # Configuration
├── api/
│   └── endpoints/
│       ├── templates.py   # Template endpoints
│       └── calculations.py # Calculation endpoints
├── engine/
│   ├── evaluator.py      # Formula evaluation
│   ├── validator.py      # Input validation
│   ├── runner.py         # Orchestration
│   └── unit_converter.py # Unit conversions
├── schemas/
│   └── models.py         # Pydantic models
├── templates/
│   ├── loader.py         # YAML loading
│   ├── registry.py       # Template registry
│   └── data/             # Template files
├── core/
│   └── container.py      # Dependency injection
└── __init__.py
```

## Adding a New Template

1. Create YAML file in `src/templates/data/`

```yaml
name: "Template Name"
category: "category_slug"
description: "Description"
variables:
  - name: var_name
    label: "Human Name"
    description: "Description"
    unit: "unit"
    data_type: "float"
    required: true
    min_value: 0
    max_value: 1000
formula: "math_formula"
outputs:
  - "result"
normative_reference: "Standard reference"
tags: ["tag1", "tag2"]
```

2. Restart server — templates auto-load from directory

## Testing

```bash
pytest tests/
pytest tests/ -v  # verbose
pytest tests/ --cov=src  # coverage
```

## Code Quality

```bash
# Format
black src/

# Lint
ruff check src/

# Type check
mypy src/
```

## Production Deployment

### Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY src ./src
CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Environment Variables

Set in production:
```
DEBUG=false
DATABASE_URL=<production_db_url>
CORS_ORIGINS=["https://yourdomain.com"]
```

## Database

Currently configured for PostgreSQL, but not required for Foundation Phase.

For full setup:
```bash
createdb calculations
psql calculations < migrations/001_initial.sql
```

## Troubleshooting

**Port 8000 in use:**
```bash
lsof -i :8000  # find process
kill -9 <pid>  # kill it
```

**Import errors:**
```bash
pip install -e .  # install in editable mode
```

**Template not loading:**
- Check `src/templates/data/` directory exists
- Verify YAML syntax
- Check server logs for errors
