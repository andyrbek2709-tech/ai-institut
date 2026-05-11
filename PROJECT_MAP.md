# 🗺️ PROJECT MAP — EngHub Ecosystem

**Дата создания:** 2026-05-05 | **Статус:** ✅ STABLE

---

## 🎯 QUICK NAVIGATION

| Что | Где | Зачем |
|-----|-----|-------|
| **Как всё устроено?** | [`core/AUDIT_ECOSYSTEM_COMPLETE.md`](core/AUDIT_ECOSYSTEM_COMPLETE.md) | Полный аудит всех сервисов, зависимостей, рисков |
| **Где что находится?** | [`core/ECOSYSTEM_QUICK_REFERENCE.md`](core/ECOSYSTEM_QUICK_REFERENCE.md) | URL, env vars, project IDs, deploy checklists |
| **Какие риски?** | [`core/DEPENDENCIES_AND_RISKS.md`](core/DEPENDENCIES_AND_RISKS.md) | Матрица зависимостей, каскадные отказы, recovery планы |
| **Правила проекта?** | [`CLAUDE.md`](CLAUDE.md) | Как работать с этим проектом |
| **Текущее состояние?** | [`core/STATE.md`](core/STATE.md) | Live journal — актуальная информация |
| **Как всё связано?** | [`flows/system-connections.md`](flows/system-connections.md) | Карта связей между сервисами |

---

## 📦 МОДУЛИ ПРОЕКТА

### 1️⃣ **EngHub** (основной)
```
Папка: enghub-main/
Технология: React 18 + TypeScript (CRA) + Vercel serverless
Deployment: Vercel (prj_ZDihCpWH1AmIEPRebnOI7ST6d6nv)
URL: https://enghub-three.vercel.app
БД: Supabase jbdljdwlfimvmqybzynv
Статус: ✅ PRODUCTION (cable-calc QA v3 PASS)
```

**Что внутри:**
- `src/` — React компоненты (Task boards, Projects, Drawings, etc.)
- `api/` — 18+ serverless endpoints (Vercel functions)
- `public/` — static files (cable-calc.html, agenda.html, etc.)

**Модули в EngHub:**
- **cable-calc** — инженерные расчёты (Python engine + UI)
- **AI Copilot** — интеллектуальный помощник (Claude + RAG)
- **Telegram Bot** — pull-команды и уведомления

---

### 2️⃣ **AdIntakeBot** (вспомогательный)
```
Папка: ad-intake-bot/
Технология: Node.js + Express + Telegram Bot API
Deployment: Railway (kind-comfort / ai-institut)
URL: https://ai-institut-production.up.railway.app
БД: Supabase pbxzxwskhuzaojphkeet (отдельный проект!)
Статус: ✅ PRODUCTION
```

**Что внутри:**
- `src/bot/` — диалоговая логика
- `src/services/` — OpenAI, Telegram, Supabase, Whisper
- `supabase/migrations/` — SQL миграции (001–007)
- `scripts/` — dump, export, sync tools

---

### 3️⃣ **cable-calc** (встроенный в EngHub)
```
Папка: enghub-main/api/cable-calc/
Технология: Python + OpenAI Vision
Deployment: Vercel (в составе EngHub API)
API endpoints: /api/cable-calc/{calc,parse,reverse,report-xlsx}
UI: /cable-calc.html
Статус: ✅ PRODUCTION (QA v3 PASS — все формулы корректны)
```

**Что внутри:**
- `calc.py` — расчётный движок (МЭК 60364-5-52, ПУЭ)
- `parse.py` — парсинг PDF/Excel/Word (Vision)
- `reverse.py` — обратный расчёт
- `report-xlsx.py` — экспорт результатов

---

### 4️⃣ **android-voicebot** (в работе)
```
Папка: android-voicebot/
Технология: Kotlin + Android 8.0+ + TDLib
Deployment: GitHub Actions CI/CD (APK releases)
Статус: ⏳ TODO — исходники не закоммичены, только CI workflow
```

**Что нужно:**
- Закоммитить Kotlin исходники (`app/`, `build.gradle.kts`)
- Потестировать CI build
- Настроить GitHub Releases

---

## 🏛️ ИНФРАСТРУКТУРА

### Vercel (EngHub deployment)
```
Project:   enghub
Project ID: prj_ZDihCpWH1AmIEPRebnOI7ST6d6nv
Team ID:   team_o0boJNeRGftH6Cbi9byd0dbF
Root dir:  enghub-main/
URL:       https://enghub-three.vercel.app
Features:  Serverless functions, edge caching, cron jobs
```
[→ Подробнее в ECOSYSTEM_QUICK_REFERENCE](core/ECOSYSTEM_QUICK_REFERENCE.md#-production-urls)

### Railway (AdIntakeBot deployment)
```
Project:  kind-comfort
Service:  ai-institut
URL:      https://ai-institut-production.up.railway.app
Health:   /health
Features: Webhook, environment variables, auto-deploy from git
```

### Supabase (Two separate projects)

**EngHub:**
```
Project ID: jbdljdwlfimvmqybzynv
URL:        https://jbdljdwlfimvmqybzynv.supabase.co
Migrations: supabase/migrations/ (001–023)
Functions:  supabase/functions/ (vectorize-doc, search-normative)
Features:   Auth, RLS, Realtime, Storage, pgvector
```

**AdIntakeBot (separate!):**
```
Project ID: pbxzxwskhuzaojphkeet
URL:        https://pbxzxwskhuzaojphkeet.supabase.co
Migrations: ad-intake-bot/supabase/migrations/ (001–007)
Features:   Auth, RLS, pgvector for knowledge_items
```

### External APIs
- **OpenAI**: GPT-4o-mini, Whisper, text-embedding-3-small, vision
- **Anthropic Claude**: AI Copilot orchestrator
- **DeepSeek**: Fallback LLM for AdIntakeBot
- **LiveKit Cloud**: Video conferencing
- **Telegram**: Bot API

---

## 📂 DIRECTORY STRUCTURE

```
d:\ai-institut/
│
├── 📁 core/                          ← ARCHITECTURE & DOCUMENTATION
│   ├── AUDIT_ECOSYSTEM_COMPLETE.md   ← Полный аудит (500+ lines)
│   ├── DEPENDENCIES_AND_RISKS.md     ← Матрица рисков
│   ├── ECOSYSTEM_QUICK_REFERENCE.md  ← Быстрая справка
│   ├── AUDIT_SUMMARY.md              ← Итоги аудита
│   ├── STATE.md                      ← Live journal
│   └── README.md                     ← Unified documentation
│
├── 📁 flows/                         ← PROCESSES & WORKFLOWS
│   ├── system-connections.md         ← EngHub ↔ AdBot ↔ cable-calc
│   └── system-audit.md               ← Workflow audit from production
│
├── 📁 modules/                       ← INTERNAL MODULES
│   └── (резервный каталог для future modules)
│
├── 📁 infra/                         ← INFRASTRUCTURE CONFIGS
│   └── (vercel.json refs, railway.json refs)
│
├── 📁 memory/                        ← PROJECT INSIGHTS & HANDOVER
│   └── project_handover_report.md    ← Insights & decisions
│
├── 📁 ops/                           ← OPERATIONAL RUNBOOKS
│   └── (future: deployment checklists, troubleshooting)
│
├── 📁 tools/                         ← UTILITY SCRIPTS
│   ├── build-telegram-logo.mjs
│   ├── dump-last-conversation.mjs
│   ├── export-conversation-by-lead.mjs
│   └── sync-supabase-to-railway.mjs
│
├── 📁 archive/                       ← OLD STUFF (DO NOT DELETE)
│   ├── docs/                         ← Old documentation
│   ├── data/                         ← Test datasets
│   └── legacy/                       ← Legacy code references
│
├── 📁 enghub-main/                   ← 🚀 MAIN PROJECT
│   ├── src/                          ← React 18 + TypeScript
│   ├── api/                          ← Vercel serverless functions
│   │   └── cable-calc/               ← Python engine (DO NOT MOVE)
│   ├── public/                       ← Static files
│   ├── vercel.json                   ← 🔒 DEPLOY CONFIG
│   └── package.json
│
├── 📁 ad-intake-bot/                 ← 📱 BOT PROJECT
│   ├── src/                          ← Node.js code
│   ├── supabase/                     ← Migrations & schema
│   ├── scripts/                      ← Utility scripts (copy → tools/)
│   ├── railway.json                  ← 🔒 DEPLOY CONFIG
│   ├── .env.example                  ← 🔒 ENV TEMPLATE
│   └── package.json
│
├── 📁 supabase/                      ← 🔒 DATABASE CONFIGS
│   ├── migrations/                   ← SQL migrations (001–023)
│   └── functions/                    ← Edge Functions
│
├── 📁 android-voicebot/              ← 📲 VOICE BOT
│   ├── .github/workflows/            ← CI/CD (ready)
│   ├── gradle/ gradlew               ← Build config
│   └── app/                          ← Kotlin sources (TODO)
│
├── CLAUDE.md                         ← 🎯 PROJECT RULES (обновленный)
├── PROJECT_MAP.md                    ← 📍 THIS FILE
├── MEMORY.md                         ← Memory index
├── .gitignore                        ← ✅ No .env files
└── package.json                      ← Root (monorepo)
```

---

## 🔗 SYSTEM CONNECTIONS

Краткие связи (подробнее в [`flows/system-connections.md`](flows/system-connections.md)):

```
┌─────────────────────────────────────────┐
│         GitHub (ai-institut)            │
│   Единый monorepo, branch main          │
└──────────────┬──────────────────────────┘
               │
     ┌─────────┴─────────┬──────────┬────────────┐
     │                   │          │            │
┌────▼────┐    ┌─────────▼──┐  ┌──▼────┐  ┌───▼─────────┐
│ EngHub  │    │ AdIntakeBot │  │Cable  │  │ Android     │
│ (Vercel)│    │ (Railway)   │  │Calc   │  │ VoiceBot    │
└────┬────┘    └──────┬──────┘  └──┬────┘  └─────────────┘
     │                │             │
     │     ┌──────────┴───┐     ┌───┴─────┐
     │     │               │     │ Inside  │
┌────▼─────▼──┐    ┌──────▼────▼──────┐  │ EngHub
│ Supabase-1  │    │ Supabase-2       │  │ API
│ (EngHub)    │    │ (AdIntakeBot)    │  │
│ jbdljdwl... │    │ pbxzxwskh...     │  │
└─────────────┘    └──────────────────┘  │
                                          │
                   ┌──────────────────────┘
                   │
              ┌────▼─────────┐
              │ OpenAI API   │
              │ (embeddings, │
              │  vision,     │
              │  whisper)    │
              └──────────────┘
```

---

## 🚀 DEPLOYMENT TARGETS

| Модуль | Хостинг | Trigger | Status |
|--------|---------|---------|--------|
| **EngHub** | Vercel | Push to `main` | ✅ Auto |
| **AdIntakeBot** | Railway | Push to `main` | ✅ Auto |
| **cable-calc** | Vercel (part of EngHub) | Push to `main` | ✅ Auto |
| **Migrations** | Manual (Supabase console) | Manual | ⚠️ N/A |

---

## 📚 КОРПУС ЗНАНИЙ (Knowledge Corpus)

> ~150 markdown-документов в корне репо — техническая документация, нормативные методологии, архитектурные решения. Сгруппированы для AGSK retrieval и навигации (Phase 1 плана federated-wondering-hinton).

### 🤖 AGSK — RAG-инфраструктура и интеграция
Якорь: [`AGSK_INTEGRATION_README.md`](./AGSK_INTEGRATION_README.md) · Поиск: `discipline filter, hybrid retrieval, citations`

- [`AGSK_RAG_INTEGRATION_RESEARCH.md`](./AGSK_RAG_INTEGRATION_RESEARCH.md) — исследование RAG-подходов
- [`AGSK_RAG_CODE_SNIPPETS.md`](./AGSK_RAG_CODE_SNIPPETS.md) — фрагменты кода интеграции
- [`AGSK_FINAL_TECHNICAL_SPECIFICATION.md`](./AGSK_FINAL_TECHNICAL_SPECIFICATION.md) — финальная спецификация
- [`AGSK_QUICK_START.md`](./AGSK_QUICK_START.md) — быстрый старт
- [`AGSK_RETRIEVAL_VALIDATION_REPORT.md`](./AGSK_RETRIEVAL_VALIDATION_REPORT.md) — валидация retrieval
- [`AGSK_EVALUATION_DATASET.md`](./AGSK_EVALUATION_DATASET.md) — eval dataset (100 кейсов, см. ниже)
- [`AGSK_HARDENING_REPORT.md`](./AGSK_HARDENING_REPORT.md) — упрочнение системы
- [`AGSK_AUTH_FIX_SUMMARY.md`](./AGSK_AUTH_FIX_SUMMARY.md), [`AGSK_AUTH_FIX_TEST_PLAN.md`](./AGSK_AUTH_FIX_TEST_PLAN.md) — фиксы аутентификации
- [`AGSK_DEPLOYMENT_CHECKLIST.md`](./AGSK_DEPLOYMENT_CHECKLIST.md) — деплой
- [`AGSK_WEEK2_VALIDATION_REPORT.md`](./AGSK_WEEK2_VALIDATION_REPORT.md), [`AGSK_WEEK4_VALIDATION_REPORT.md`](./AGSK_WEEK4_VALIDATION_REPORT.md), [`AGSK_WEEK5_STANDARDS_CORPUS_REPORT.md`](./AGSK_WEEK5_STANDARDS_CORPUS_REPORT.md) — weekly reports

### 📐 РАСЧЁТЫ (CALCULATIONS) — методологии и формулы
Якорь: [`CALCULATIONS_PLATFORM_AUDIT.md`](./CALCULATIONS_PLATFORM_AUDIT.md)

- [`CALCULATIONS_LIST.md`](./CALCULATIONS_LIST.md), [`CALCULATIONS_FOUNDATION_PLAN.md`](./CALCULATIONS_FOUNDATION_PLAN.md), [`CALCULATIONS_IMPLEMENTATION_PLAN.md`](./CALCULATIONS_IMPLEMENTATION_PLAN.md)
- [`CALCULATIONS_STANDARDS_INDEX.md`](./CALCULATIONS_STANDARDS_INDEX.md), [`CALCULATION_EXAMPLES_AND_FORMULAS.md`](./CALCULATION_EXAMPLES_AND_FORMULAS.md)
- [`README_CALCULATIONS.md`](./README_CALCULATIONS.md)

### 🌡️ ТЕПЛО / 💧 ВОДА / ⚡ ЭЛЕКТРИКА — дисциплинарные методологии
Используются дисциплинарными клонами ChatGPT 4.0 (см. `services/api-server/src/routes/orchestrator.ts` → `DISCIPLINE_CLONES`)

**Тепло (Тепловик-клон, discipline=mechanical):**
- [`THERMAL_ENGINEERING_STANDARDS.md`](./THERMAL_ENGINEERING_STANDARDS.md), [`THERMAL_METHODS_STANDARDS.md`](./THERMAL_METHODS_STANDARDS.md)
- [`THERMAL_CALCULATIONS_INDEX.md`](./THERMAL_CALCULATIONS_INDEX.md), [`THERMAL_CALCULATIONS_QUICK_GUIDE.md`](./THERMAL_CALCULATIONS_QUICK_GUIDE.md)

**Вода/Канализация (ВК-клон, discipline=pipeline):**
- [`WATER_SUPPLY_SEWERAGE_STANDARDS.md`](./WATER_SUPPLY_SEWERAGE_STANDARDS.md), [`WATER_SUPPLY_RESOURCES_INDEX.md`](./WATER_SUPPLY_RESOURCES_INDEX.md)
- [`WATER_SUPPLY_QUICKSTART.md`](./WATER_SUPPLY_QUICKSTART.md), [`WATER_SUPPLY_EXAMPLES.md`](./WATER_SUPPLY_EXAMPLES.md)

**Электрика (Электрик-клон, discipline=electrical):**
- [`ELECTRICAL_ENGINEERING_METHODS.md`](./ELECTRICAL_ENGINEERING_METHODS.md)

**Промбезопасность/ПБ (ПБ-клон, discipline=fire_safety):**
- [`INDUSTRIAL_SAFETY_STANDARDS.md`](./INDUSTRIAL_SAFETY_STANDARDS.md), [`INDUSTRIAL_SAFETY_QUICK_REFERENCE.md`](./INDUSTRIAL_SAFETY_QUICK_REFERENCE.md)

**Геодезия:**
- [`GEODESIC_STANDARDS_AND_METHODOLOGIES.md`](./GEODESIC_STANDARDS_AND_METHODOLOGIES.md)

### 📸 OCR — конвейер парсинга нормативных PDF
Якорь: [`OCR_PILOT_QUICK_START.md`](./OCR_PILOT_QUICK_START.md)

- Архитектура: [`OCR_PILOT_ARCHITECTURE.md`](./OCR_PILOT_ARCHITECTURE.md), [`OCR_ARCHITECTURE_REVIEW_SUMMARY.md`](./OCR_ARCHITECTURE_REVIEW_SUMMARY.md), [`OCR_ARCHITECTURE_HARDENING.md`](./OCR_ARCHITECTURE_HARDENING.md)
- Lineage: [`OCR_LINEAGE_ARCHITECTURE.md`](./OCR_LINEAGE_ARCHITECTURE.md), [`OCR_AUDIT_ARCHITECTURE.md`](./OCR_AUDIT_ARCHITECTURE.md), [`OCR_CALIBRATION_ARCHITECTURE.md`](./OCR_CALIBRATION_ARCHITECTURE.md)
- Детерминизм: [`OCR_DETERMINISM_BOUNDARY.md`](./OCR_DETERMINISM_BOUNDARY.md), [`OCR_DETERMINISM_RISKS.md`](./OCR_DETERMINISM_RISKS.md), [`OCR_REPRODUCIBILITY_FRAMEWORK.md`](./OCR_REPRODUCIBILITY_FRAMEWORK.md)
- Валидация: [`OCR_VALIDATION_STRATEGY.md`](./OCR_VALIDATION_STRATEGY.md), [`OCR_CONFIDENCE_MODEL.md`](./OCR_CONFIDENCE_MODEL.md), [`OCR_FAILURE_TAXONOMY.md`](./OCR_FAILURE_TAXONOMY.md)
- Roadmap/Gates: [`OCR_PILOT_ROADMAP.md`](./OCR_PILOT_ROADMAP.md), [`OCR_RELEASE_GATE.md`](./OCR_RELEASE_GATE.md), [`OCR_REVIEW_GOVERNANCE.md`](./OCR_REVIEW_GOVERNANCE.md)

### 🔒 GROUND TRUTH & LINEAGE — детерминизм и трассируемость данных
- [`GROUND_TRUTH_GOVERNANCE.md`](./GROUND_TRUTH_GOVERNANCE.md), [`GROUND_TRUTH_LINEAGE.md`](./GROUND_TRUTH_LINEAGE.md), [`GROUND_TRUTH_RELEASE_GATE.md`](./GROUND_TRUTH_RELEASE_GATE.md)
- [`EXTRACTION_LINEAGE_ARCHITECTURE.md`](./EXTRACTION_LINEAGE_ARCHITECTURE.md), [`LINEAGE_SCALING_ANALYSIS.md`](./LINEAGE_SCALING_ANALYSIS.md)
- [`TRACEABILITY_REPORT.md`](./TRACEABILITY_REPORT.md), [`TRACEABILITY_CONSISTENCY_REVIEW.md`](./TRACEABILITY_CONSISTENCY_REVIEW.md)
- [`FORENSIC_AUDIT_REPORT.md`](./FORENSIC_AUDIT_REPORT.md), [`FORENSIC_AUDIT_COMPLETION.md`](./FORENSIC_AUDIT_COMPLETION.md)

### 🎯 DETERMINISM — воспроизводимость расчётов и парсинга
- [`DETERMINISM_CORE_REPORT.md`](./DETERMINISM_CORE_REPORT.md), [`DETERMINISM_EXECUTION_ANALYSIS.md`](./DETERMINISM_EXECUTION_ANALYSIS.md), [`DETERMINISM_REVALIDATION_RESULTS.md`](./DETERMINISM_REVALIDATION_RESULTS.md)
- [`OPERATIONAL_DETERMINISM_PROOF.md`](./OPERATIONAL_DETERMINISM_PROOF.md), [`FINAL_DETERMINISM_VERDICT.md`](./FINAL_DETERMINISM_VERDICT.md)
- [`DETERMINISTIC_IDENTITY_REVIEW.md`](./DETERMINISTIC_IDENTITY_REVIEW.md), [`DETERMINISTIC_INGESTION_REPORT.md`](./DETERMINISTIC_INGESTION_REPORT.md)
- [`PARSER_DETERMINISM_CONTRACT.md`](./PARSER_DETERMINISM_CONTRACT.md), [`PDF_DETERMINISM_REPORT.md`](./PDF_DETERMINISM_REPORT.md)

### 🧬 SEMANTIC IDENTITY & NORMALIZATION
- [`SEMANTIC_IDENTITY_ARCHITECTURE.md`](./SEMANTIC_IDENTITY_ARCHITECTURE.md), [`SEMANTIC_IDENTITY_LINEAGE.md`](./SEMANTIC_IDENTITY_LINEAGE.md), [`SEMANTIC_IDENTITY_REVIEW_CONTRACT.md`](./SEMANTIC_IDENTITY_REVIEW_CONTRACT.md), [`SEMANTIC_IDENTITY_REVIEW_GATE.md`](./SEMANTIC_IDENTITY_REVIEW_GATE.md)
- [`SEMANTIC_EQUIVALENCE_ARCHITECTURE.md`](./SEMANTIC_EQUIVALENCE_ARCHITECTURE.md), [`SEMANTIC_ALIASING_STANDARD.md`](./SEMANTIC_ALIASING_STANDARD.md), [`SEMANTIC_VERSIONING_STANDARD.md`](./SEMANTIC_VERSIONING_STANDARD.md)
- [`SEMANTIC_SPLIT_MERGE_GOVERNANCE.md`](./SEMANTIC_SPLIT_MERGE_GOVERNANCE.md), [`SEMANTIC_FRAGMENTATION_REPORT.md`](./SEMANTIC_FRAGMENTATION_REPORT.md), [`SEMANTIC_GOVERNANCE_SIMULATION.md`](./SEMANTIC_GOVERNANCE_SIMULATION.md)
- [`UNIT_NORMALIZATION_STANDARD.md`](./UNIT_NORMALIZATION_STANDARD.md), [`DIMENSIONAL_SEMANTICS_STANDARD.md`](./DIMENSIONAL_SEMANTICS_STANDARD.md), [`FORMULA_NORMALIZATION_STANDARD.md`](./FORMULA_NORMALIZATION_STANDARD.md), [`FORMULA_SEMANTIC_MODEL.md`](./FORMULA_SEMANTIC_MODEL.md), [`FORMULA_TRUTH_VALIDATION.md`](./FORMULA_TRUTH_VALIDATION.md)
- [`TABLE_NORMALIZATION_STANDARD.md`](./TABLE_NORMALIZATION_STANDARD.md), [`TABLE_TRUTH_VALIDATION.md`](./TABLE_TRUTH_VALIDATION.md)
- [`SECTION_GRAMMAR_ARCHITECTURE.md`](./SECTION_GRAMMAR_ARCHITECTURE.md), [`ENGINEERING_DOMAIN_SEMANTICS.md`](./ENGINEERING_DOMAIN_SEMANTICS.md)
- [`NORMALIZATION_LINEAGE_MODEL.md`](./NORMALIZATION_LINEAGE_MODEL.md), [`NORMALIZATION_EXAMPLES_SHOWCASE.md`](./NORMALIZATION_EXAMPLES_SHOWCASE.md)

### 🔐 AUTH & ARCHITECTURE
- [`AUTH_ARCHITECTURE.md`](./AUTH_ARCHITECTURE.md), [`AUTH_LIFECYCLE_FLOW.md`](./AUTH_LIFECYCLE_FLOW.md), [`AUTH_FAILURE_RECOVERY.md`](./AUTH_FAILURE_RECOVERY.md)
- [`FINAL_AUTH_NORMALIZATION_REPORT.md`](./FINAL_AUTH_NORMALIZATION_REPORT.md), [`FINAL_AUTH_RECOVERY_REPORT.md`](./FINAL_AUTH_RECOVERY_REPORT.md)
- [`ARCHITECTURE_ISOLATION_REPORT.md`](./ARCHITECTURE_ISOLATION_REPORT.md), [`ISOLATION_TEST_PLAN.md`](./ISOLATION_TEST_PLAN.md), [`ISOLATION_VERIFICATION_CHECKLIST.md`](./ISOLATION_VERIFICATION_CHECKLIST.md)
- [`ADMIN_DOMAIN_IMPLEMENTATION_REPORT.md`](./ADMIN_DOMAIN_IMPLEMENTATION_REPORT.md), [`INITIAL_ADMIN_ACCESS.md`](./INITIAL_ADMIN_ACCESS.md)
- [`RLS_GOVERNANCE_MODEL.md`](./RLS_GOVERNANCE_MODEL.md), [`FINAL_RLS_OPERATIONAL_RECOVERY_REPORT.md`](./FINAL_RLS_OPERATIONAL_RECOVERY_REPORT.md)

### 📋 ZADANIE NA PROEKTIROVANIE & ANALYZE (Phase 2 фичи)
Якорь: STATE.md (журнал) + миграция `enghub-main/supabase/migrations/028_project_assignments.sql`

Связанный код:
- Backend: `services/api-server/src/routes/assignment.ts` (POST `/api/assignment/analyze`)
- Frontend: `enghub-main/src/components/AssignmentTab.tsx` (кнопка «🤖 Анализ ТЗ»)
- Маппинг дисциплин RU→EN: `services/api-server/src/utils/disciplines.ts`

### 🏗️ PHASE / STAGE / ETAP REPORTS (этапы проекта)
- PHASE 2: [`PHASE_2_STAGE_1_IMPLEMENTATION_REPORT.md`](./PHASE_2_STAGE_1_IMPLEMENTATION_REPORT.md), [`PHASE_2_STAGE_1_EXECUTION_GRAPH_REPORT.md`](./PHASE_2_STAGE_1_EXECUTION_GRAPH_REPORT.md), [`PHASE_2_STAGE_2_ARCHITECTURE_IMPACT.md`](./PHASE_2_STAGE_2_ARCHITECTURE_IMPACT.md), [`PHASE_2_STAGE_2_RESEARCH.md`](./PHASE_2_STAGE_2_RESEARCH.md), [`PHASE_2_STAGE_2_SECURITY_THREAT_MODEL.md`](./PHASE_2_STAGE_2_SECURITY_THREAT_MODEL.md), [`PHASE_2_TEMPLATE_SYSTEM_ANALYSIS.md`](./PHASE_2_TEMPLATE_SYSTEM_ANALYSIS.md)
- STAGE 1: [`STAGE_1_ARCHITECTURE_REVIEW.md`](./STAGE_1_ARCHITECTURE_REVIEW.md), [`STAGE_1_IMPLEMENTATION_COMPLETE.md`](./STAGE_1_IMPLEMENTATION_COMPLETE.md), [`STAGE_1_DELIVERABLE_EXAMPLES.md`](./STAGE_1_DELIVERABLE_EXAMPLES.md), [`STAGE_1_REVIEW_VERDICT.md`](./STAGE_1_REVIEW_VERDICT.md)
- STAGE 2: [`STAGE_2_BOOTSTRAP_SUMMARY.md`](./STAGE_2_BOOTSTRAP_SUMMARY.md), [`REQUIRED_FIXES_FOR_STAGE_2.md`](./REQUIRED_FIXES_FOR_STAGE_2.md)
- ETAP 2: [`ETAP_2_DESIGN_SUMMARY.md`](./ETAP_2_DESIGN_SUMMARY.md), [`ETAP_2_ENGINEERING_VALIDATION_DESIGN.md`](./ETAP_2_ENGINEERING_VALIDATION_DESIGN.md), [`ETAP_2_INTEGRATION_PLAN.md`](./ETAP_2_INTEGRATION_PLAN.md), [`ETAP_2_INTEGRATION_REPORT.md`](./ETAP_2_INTEGRATION_REPORT.md), [`ETAP_2_QUICK_START.md`](./ETAP_2_QUICK_START.md)

### 🛡️ GOVERNANCE & RESILIENCE
- [`GOVERNANCE_BOTTLENECK_REPORT.md`](./GOVERNANCE_BOTTLENECK_REPORT.md), [`GOVERNANCE_FAILURE_SCENARIOS.md`](./GOVERNANCE_FAILURE_SCENARIOS.md), [`GOVERNANCE_RESILIENCE_ARCHITECTURE.md`](./GOVERNANCE_RESILIENCE_ARCHITECTURE.md)
- [`DEPLOYMENT_GOVERNANCE.md`](./DEPLOYMENT_GOVERNANCE.md), [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md)
- [`OPERATIONAL_READINESS_GATE.md`](./OPERATIONAL_READINESS_GATE.md), [`REVALIDATION_GATE_SUMMARY.md`](./REVALIDATION_GATE_SUMMARY.md), [`REVALIDATION_REVIEW_VERDICT.md`](./REVALIDATION_REVIEW_VERDICT.md)
- [`PRODUCTION_STABILIZATION_FINAL_REPORT.md`](./PRODUCTION_STABILIZATION_FINAL_REPORT.md), [`REFACTORING_COMPLETION_VERDICT.md`](./REFACTORING_COMPLETION_VERDICT.md)

### 🧪 PILOT PROGRAM
- [`PILOT_PROGRAM_README.md`](./PILOT_PROGRAM_README.md), [`PILOT_PROGRAM_SPECIFICATION.md`](./PILOT_PROGRAM_SPECIFICATION.md), [`PILOT_PHASE_SESSION_SUMMARY.md`](./PILOT_PHASE_SESSION_SUMMARY.md)

### 📦 SOIL / SOIL CONSTANTS
- [`SOIL_LOOSENING_COEFFICIENTS_REFERENCE.md`](./SOIL_LOOSENING_COEFFICIENTS_REFERENCE.md)

---

> **Как пользоваться:** ChatGPT 4.0 (см. `services/api-server/src/routes/orchestrator.ts`) при включённом RAG ищет по всем этим документам через AGSK. Группировка нужна (а) для людей-навигаторов, (б) для будущего расширения метаданных корпуса (теги дисциплин). Anchor-документы в начале каждой группы — наиболее «свежие» / обзорные.

---

## 🔐 CRITICAL FILES (DO NOT TOUCH)

```
✋ НИКОГДА НЕ УДАЛЯТЬ:
├── enghub-main/api/                  (API endpoints)
├── enghub-main/src/                  (React code)
├── ad-intake-bot/src/                (Bot code)
├── supabase/migrations/              (Database schema history)
├── .git/                             (Git history)
├── enghub-main/vercel.json           (Vercel config)
├── ad-intake-bot/railway.json        (Railway config)
└── .env, .env.example                (Secrets template)
```

---

## 📖 HOW TO USE THIS MAP

### Если ты новый в проекте:
1. Прочитай **Project Map** (этот файл) — 5 минут
2. Открой [`core/ECOSYSTEM_QUICK_REFERENCE.md`](core/ECOSYSTEM_QUICK_REFERENCE.md) — найди нужные URL/IDs
3. Если нужны детали — [`core/AUDIT_ECOSYSTEM_COMPLETE.md`](core/AUDIT_ECOSYSTEM_COMPLETE.md)

### Если ты работаешь на EngHub:
1. `enghub-main/` — исходники
2. Commit → push → Vercel автоматически
3. Проверь [`core/ECOSYSTEM_QUICK_REFERENCE.md`](core/ECOSYSTEM_QUICK_REFERENCE.md) для env vars

### Если ты работаешь на AdIntakeBot:
1. `ad-intake-bot/` — исходники
2. Commit → push → Railway автоматически
3. Если меняешь БД — обнови `supabase/migrations/` и apply вручную

### Если тебе нужны все зависимости:
1. [`core/DEPENDENCIES_AND_RISKS.md`](core/DEPENDENCIES_AND_RISKS.md) — матрица
2. [`flows/system-connections.md`](flows/system-connections.md) — как всё связано

### Если проект упал:
1. [`core/ECOSYSTEM_QUICK_REFERENCE.md`](core/ECOSYSTEM_QUICK_REFERENCE.md) → Troubleshooting
2. [`core/DEPENDENCIES_AND_RISKS.md`](core/DEPENDENCIES_AND_RISKS.md) → Recovery plans

---

## ✅ STRUCTURE VERIFICATION

- [x] Основные модули не трогали
- [x] Все .env и конфиги на месте
- [x] Git history сохранена
- [x] Deploy configs нетронуты
- [x] Дублирующие документы удалены
- [x] Структура очищена
- [x] Навигация понятна

---

**Последнее обновление:** 2026-05-05  
**Версия структуры:** 1.0  
**Статус:** ✅ READY FOR PRODUCTION
