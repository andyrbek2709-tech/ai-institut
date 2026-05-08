# ARCHITECTURE AUDIT: Engineering Calculations Platform

**Date:** 2026-05-08  
**Status:** PRE-IMPLEMENTATION ANALYSIS  
**Scope:** Current calculations system assessment + refactoring plan

---

## EXECUTIVE SUMMARY

**Current State:** ✓ Functional but monolithic
- **274 manually-coded calculations** in `enghub-main/src/calculations/registry.ts`
- **Embedded in EngHub frontend** - not a separate platform
- **No calculation engine** - calculations hardcoded in React
- **No template system** - each calculation is unique code

**Issues:**
1. **Lack of scalability** - adding 274 new calculations = massive code duplication
2. **No separation of concerns** - business logic mixed with UI
3. **No proper validation engine** - checks done ad-hoc
4. **No units system** - units are strings, no conversion standardization
5. **No AI-ready architecture** - template system needed for LLM generation
6. **Cannot be extended** - system designed for static calculations only

**Recommendation:** ✅ **Proceed with Foundation Phase**

---

## CURRENT SYSTEM ANALYSIS

### Frontend (enghub-main/src/calculations/)

**Files:**
- `registry.ts` (106,573 bytes) — **274 calculations**
- `CalculationView.tsx` (15,011 bytes) — React component
- `DocxExporter.ts` (5,435 bytes) — DOCX generation
- `types.ts` (1,047 bytes) — Type definitions

**Architecture:**
```
CalcTemplate (hardcoded in registry.ts)
  ↓
  ├─ inputs: CalcInput[]
  ├─ calculate: (inputs) → results + report
  └─ normativeReference: string
    ↓
CalculationView.tsx
  ├─ Unit converters (12 types hardcoded)
  ├─ Input validation (min/max)
  ├─ Report generation (LaTeX)
  └─ DOCX export
```

**Calculation Categories Found (sample):**
- `tx_*` — Thermal/Heat (ТХ)
- `tt_*` — Thermodynamics (ТТ)
- `pr_*` — Pressure (давление)
- etc. (274 total)

**Issues:**
- [ ] 274 calculations in ONE file (~107 KB)
- [ ] No validation engine - only min/max checks
- [ ] No units conversion system - hardcoded converters
- [ ] Formula display via raw LaTeX strings
- [ ] Report generation hardcoded in component

### Backend (services/api-server/)

**Relevant Directories:**
- `src/routes/` — API endpoints
- `src/services/` — Business logic
- `src/middleware/` — Auth, logging
- `src/config/` — Configuration

**Current Routes:**
- No dedicated `/api/calculations` endpoint
- Calculations are frontend-only
- No backend calculation engine

**Issues:**
- [ ] No backend calculation engine
- [ ] No calculation audit trail
- [ ] No calculation caching
- [ ] No multi-user calculation sessions

### Database (Supabase)

**Current Schema:** Primarily AGSK-related
- `normative_chunks` (RAG vectors)
- `standards_ingestion` (document tracking)
- `standards_search_cache`

**Missing:**
- [ ] `calculations` table
- [ ] `calculation_templates` table
- [ ] `calculation_results` table (audit)
- [ ] `calculation_sessions` table (multi-user)

---

## EXISTING CALCULATION STRUCTURE (Samples)

### Example 1: Simple Thermal Calculation
```typescript
tx_heat_balance: {
  id: "tx_heat_balance",
  cat: "ТХ",
  name: "Тепловая мощность (Нагрев/Охлаждение)",
  inputs: [
    { id: "G", name: "Массовый расход (G)", unit: "кг/с", ... },
    { id: "c", name: "Теплоемкость (c)", unit: "кДж/(кг·°C)", ... },
    { id: "dT", name: "Разность температур (ΔT)", unit: "°C", ... }
  ],
  calculate: (inputs) => {
    const Q_kW = G * c * dT;
    return {
      results: { Q: { value: Q_kW.toFixed(2), unit: "кВт", ... } },
      report: [{ title: "...", formulaLatex: "...", ... }]
    };
  }
}
```

**Structure Good For:**
- ✓ Simple calculations (addition, multiplication)
- ✓ Static formulas
- ✓ Pre-calculated coefficients

**Structure Bad For:**
- ✗ Complex multi-step calculations
- ✗ Iterative solutions
- ✗ Dynamic formula generation
- ✗ AI-generated calculations

---

## RISK ASSESSMENT

### HIGH RISKS (Must Address)

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Monolithic registry** | Adding calculations = code explosion | Move to template system + database |
| **Frontend-only logic** | Impossible to scale | Create Python calculation engine |
| **No audit trail** | Cannot verify calculations | Add calculation history to DB |
| **Hardcoded converters** | Units are opaque | Implement proper units module (Pint) |

### MEDIUM RISKS (Plan For)

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **No validation engine** | Garbage in = garbage out | Create validation layer in engine |
| **LaTeX rendering** | Cannot verify formulas | Use SymPy for symbolic computation |
| **Duplicate code** | 274 calculations = massive redundancy | Extract common patterns |

### LOW RISKS (Nice To Have)

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Migration overhead | Time spent refactoring | Gradual migration (not a blocker) |
| Breaking changes | Existing calcs break | Versioning system + tests |

---

## WHAT CAN BE REUSED

### ✅ Keep These Components

1. **CalcTemplate interface** (types.ts)
   - Can be enhanced but core structure sound
   - Already has: inputs, calculate(), results, report

2. **Unit converters** (CalculationView.tsx)
   - 12 converter definitions can be migrated
   - Will be replaced by Pint library eventually

3. **Report generation structure**
   - Results + steps structure works
   - LaTeX formula approach sound

4. **DOCX export** (DocxExporter.ts)
   - Already functional
   - Can be enhanced with new features

### ✅ 274 Calculation Logic

- Formulas are **correct** (math is math)
- Validation rules are **sound**
- Descriptions are **accurate**
- Can be **copied verbatim** into new templates

**Action:** Do NOT delete registry.ts. Extract calculations → migrate to templates.

---

## WHAT MUST BE REBUILT

### ❌ Frontend Monolith
- `registry.ts` (107 KB, single file)
- Must move to: Template database + API calls

### ❌ React Calculation Component
- `CalculationView.tsx` (assumes all calculations available)
- Must move to: Component library + category-based loading

### ❌ Hardcoded Converters
- 12 converters hardcoded in CalculationView
- Must move to: Pint + units database

### ❌ No Backend Engine
- Calculations are frontend-only
- Must create: FastAPI engine (Python)

---

## PROPOSED NEW ARCHITECTURE

### Directory Structure

```
enghub/
├── apps/
│    ├── web/
│    │    └── enghub-main/
│    └── calculations-platform/
│         ├── frontend/
│         └── README.md
│
├── services/
│    ├── api-server/ (existing)
│    │    └── routes/calculations.ts (NEW)
│    │
│    ├── calculation-engine/ (NEW)
│    │    ├── src/
│    │    │    ├── app.py (FastAPI)
│    │    │    ├── engine/
│    │    │    ├── validators/
│    │    │    ├── units/
│    │    │    └── templates/
│    │    └── pyproject.toml
│    │
│    ├── agsk-ingestion/ (existing)
│    ├── agsk-retrieval/ (existing)
│    └── orchestrator/ (existing)
│
├── shared/
│    ├── types/ (TS + Python)
│    └── schemas/
│
└── docs/
    ├── CALCULATIONS_ARCHITECTURE.md
    ├── TEMPLATE_SPEC.md
    └── ENGINE_API.md
```

---

## PHASE 1: FOUNDATION (2-3 weeks)

### Goals
- [ ] Calculation engine skeleton (Python/FastAPI)
- [ ] Template system foundation
- [ ] Demo template (pipe_stress)
- [ ] Frontend refactor (hook-based loading)

### Deliverables
1. **Backend:** FastAPI app + engine module structure
2. **Frontend:** React app skeleton with routing
3. **Database:** `calculation_templates`, `calculation_results` tables
4. **Demo:** Fully working pipe_stress calculation

### Not Included
- [ ] AI generation
- [ ] OCR / PDF parsing
- [ ] Multi-user sessions
- [ ] Advanced reporting
- [ ] 274 calculation migration

---

## PHASE 2: MIGRATION (3-4 weeks)

### Goals
- [ ] Migrate all 274 calculations to templates
- [ ] Backend validation system
- [ ] Units system (Pint integration)
- [ ] Calculation audit trail

### Deliverables
1. **All 274 calculations** as YAML/JSON templates
2. **Engine support** for complex formulas
3. **Database schemas** for results + audit
4. **Documentation** for each calculation

---

## PHASE 3: ADVANCED FEATURES (4-6 weeks)

### Goals
- [ ] AI template generation
- [ ] Advanced reporting (charts, tables)
- [ ] Multi-user collaboration
- [ ] Calculation caching + performance

### Deliverables
1. **API for template generation**
2. **Advanced DOCX/PDF reports**
3. **Sharing + permissions**
4. **Performance benchmarks**

---

## TECHNICAL DECISIONS (FOUNDATION)

### Backend Stack
- **Language:** Python 3.12+
- **Framework:** FastAPI
- **Math:** SymPy (formulas) + Pint (units)
- **Validation:** Pydantic

**Why?**
- Python excellent for numerical computation
- FastAPI: async, fast, well-documented
- SymPy: symbolic math (future visualization)
- Pint: standard units library

### Frontend Stack
- **Framework:** React 18+ (already using)
- **State:** Zustand (already using)
- **Forms:** React Hook Form (already available)
- **Styling:** Tailwind (already using)

### Database
- **Primary:** PostgreSQL (existing Supabase)
- **New Tables:** `calculation_templates`, `calculation_results`
- **No** separate database needed

### Communication
- **API:** REST (FastAPI)
- **Format:** JSON
- **Auth:** Supabase JWT (reuse existing)

---

## SUCCESS METRICS (FOUNDATION)

### Week 1
- [ ] Calculation engine skeleton deployed
- [ ] 1 demo template (pipe_stress) fully functional
- [ ] API endpoints working (`POST /calculate`, `GET /templates`)
- [ ] Frontend loads template from backend

### Week 2
- [ ] Validation engine working
- [ ] Units conversion working
- [ ] DOCX export from backend
- [ ] Database audit table populated

### Week 3
- [ ] Architecture documentation complete
- [ ] No warnings/errors in logs
- [ ] Can easily add new template
- [ ] Performance acceptable (<500ms per calc)

---

## RISKS & MITIGATIONS

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| **Python/FastAPI learning curve** | Low | Use proven patterns, documentation |
| **Units library complexity** | Low | Start with subset (10 units), expand |
| **Performance degradation** | Medium | Benchmark early, optimize before scaling |
| **Migration bugs** | Medium | Create test suite, validate each template |

---

## NEXT STEPS

### Immediate (Today)
1. ✅ Complete this audit
2. ✅ Get user approval to proceed
3. Create project memory with audit findings

### Week 1 Foundation Phase
1. Set up calculation-engine service (Python/FastAPI)
2. Create database tables
3. Build engine skeleton
4. Create demo template (pipe_stress)
5. Build frontend for single template

**Total estimated effort:** 40-50 engineer-hours for Foundation
**Team:** 1 Principal Architect + 1 Senior Fullstack

---

## DECISION REQUIRED

**Proceed with Foundation Phase?**

- ✅ YES: Start building calculation-engine (Python)
- ⚠️ HOLD: Need more analysis
- ❌ NO: Alternative approach

**If YES:**
- Week 1 starts immediately
- Focus: Engine skeleton + demo template
- No migration of 274 calcs yet (Phase 2)

---

**End of Audit**

Report prepared by: Senior Architect  
Confidence level: HIGH (existing code analyzed)  
Recommendation: **PROCEED WITH FOUNDATION**
