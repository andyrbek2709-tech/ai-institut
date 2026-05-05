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
