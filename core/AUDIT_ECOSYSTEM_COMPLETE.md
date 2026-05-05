# 🔍 ПОЛНЫЙ АУДИТ ЭКОСИСТЕМЫ EngHub

**Дата аудита:** 2026-05-05  
**Статус:** ✅ ЗАВЕРШЕНО — ничего не удалено, только анализ  
**Автор:** Claude Code (Архитектурный аудит)

---

## 📋 ОГЛАВЛЕНИЕ

1. [Структура репозиториев](#1-структура-репозиториев)
2. [Все сервисы и инфраструктура](#2-все-сервисы-и-инфраструктура)
3. [Модули и продукты](#3-модули-и-продукты)
4. [Карта связей](#4-карта-связей)
5. [Критичные точки](#5-критичные-точки)
6. [Риски удаления](#6-риски-удаления)
7. [Рекомендации](#7-рекомендации)

---

## 1. СТРУКТУРА РЕПОЗИТОРИЕВ

### 1.1 Главный репозиторий

| Параметр | Значение |
|----------|----------|
| **Имя** | `ai-institut` |
| **GitHub** | `https://github.com/andyrbek2709-tech/ai-institut` |
| **Ветка** | `main` |
| **Email коммитов** | `andyrbek2709@gmail.com` |
| **Статус** | Активный, production |
| **Локация** | `D:\ai-institut` |
| **Git remotes** | `origin` → GitHub |
| **Worktrees** | Только основной (без дополнительных) |

### 1.2 Внутренние подпроекты (в одном репо)

Все следующие проекты **находятся ВНУТРИ** репозитория `ai-institut`:

#### EngHub (основной фронтенд + API)
```
enghub-main/
├── src/                    # React 18 + TypeScript фронтенд
├── api/                    # Vercel serverless функции (18+ файлов)
├── public/                 # статические файлы (cable-calc.html и др.)
├── package.json
└── vercel.json            # конфиг Vercel
```

#### AdIntakeBot (Telegram-бот)
```
ad-intake-bot/
├── src/
│   ├── bot/               # диалоговая логика
│   ├── services/          # OpenAI, Telegram, Supabase, Whisper
│   └── index.js           # точка входа
├── supabase/              # миграции БД для бота
├── scripts/               # dump, sync-supabase, export
├── railway.json           # конфиг Railway
├── package.json
└── .env                   # переменные окружения (не в git)
```

#### cable-calc (инженерные расчёты)
```
enghub-main/api/cable-calc/
├── calc.py                # основной расчётный движок
├── parse.py               # парсинг PDF/Excel/Word
├── reverse.py             # обратный расчёт
├── report-xlsx.py         # экспорт в Excel
└── parsers/               # парсеры (PDF vision, Excel, Word)
```

#### android-voicebot (нативное приложение)
```
android-voicebot/
├── gradle/ gradlew       # сборка
├── app/                  # Kotlin исходники (TODO: не закоммичены)
└── .github/workflows/    # CI/CD GitHub Actions
```

### 1.3 Отдельные репозитории (НЕ в ai-institut)

#### Nurmak (рабочий аналог для грузоперевозок)
| Параметр | Значение |
|----------|----------|
| **Локация** | `C:\Users\Admin\.claude\projects\d--Nurmak` |
| **Статус** | Рабочий аналог, reference для AdIntakeBot |
| **Связь** | Архитектурный паттерн для бота |

---

## 2. ВСЕ СЕРВИСЫ И ИНФРАСТРУКТУРА

### 2.1 Production сервисы (настоящее время)

#### Vercel (Хостинг фронтенда + API)

| Параметр | Значение |
|----------|----------|
| **Project ID** | `prj_ZDihCpWH1AmIEPRebnOI7ST6d6nv` |
| **Project Name** | `enghub` |
| **Team ID** | `team_o0boJNeRGftH6Cbi9byd0dbF` |
| **Team Name** | `andyrbek2709-techs-projects` |
| **Root Directory** | `enghub-main/` |
| **Live URL** | `https://enghub-three.vercel.app/` |
| **Статус** | ✅ ГОТОВ, production |

**API endpoints** в Vercel:
- `/api/orchestrator` — AI Copilot оркестратор
- `/api/cable-calc/calc.py` (maxDuration: 60s)
- `/api/cable-calc/parse.py` (maxDuration: 60s, Vision)
- `/api/cable-calc/reverse.py` (maxDuration: 60s)
- `/api/cable-calc/report-xlsx.py`
- `/api/spec-export.js`
- `/api/meeting-token.js` (LiveKit)
- `/api/livekit-token.legacy.js` (legacy, сохранён для отката)
- `/api/telegram.js` — pull-команды для бота EngHub
- `/api/storage-sign-url.js`, `/api/storage-delete.js`
- `/api/weekly-digest` (cron: 0 8 * * 1)
- `/api/transcribe.js` — Whisper
- `/api/normative-docs.js`
- `/api/notifications-create.js`
- `/api/activity-log.js`
- `/api/catalog-parse.js`
- `/api/admin-users.js`, `/api/_admin.js`

#### Supabase (БД + Auth + Storage + Functions)

**Проект EngHub:**

| Параметр | Значение |
|----------|----------|
| **Project ID** | `jbdljdwlfimvmqybzynv` |
| **URL** | `https://jbdljdwlfimvmqybzynv.supabase.co` |
| **Database** | PostgreSQL (RLS включён) |
| **Статус** | ✅ production, в активном использовании |

**Таблицы** (18+ основных):
- `app_users`, `app_teams`, `app_departments` (юзеры и организация)
- `projects`, `tasks` (основной workflow)
- `drawings`, `revisions`, `reviews` (документооборот)
- `transmittals`, `transmittal_items` (отправки)
- `specifications` (спецификации AGSK)
- `messages`, `meetings` (коммуникации)
- `task_history`, `revisions` (аудит)
- `normative_chunks`, `normative_docs` (RAG)
- `time_entries` (табель)

**Миграции:**
- 023 совокупно (последняя: `023_email_case_insensitive_rls_helpers`)
- Хроника: `001_rag_setup` → `023`
- Все в: `supabase/migrations/`

**Supabase Functions** (Edge Functions):
- `supabase/functions/vectorize-doc/index.ts` (OpenAI embeddings)
- `supabase/functions/search-normative/index.ts` (pgvector поиск)

**Проект AdIntakeBot** (отдельный):

| Параметр | Значение |
|----------|----------|
| **Project ID** | `pbxzxwskhuzaojphkeet` |
| **URL** | `https://pbxzxwskhuzaojphkeet.supabase.co` |
| **Таблицы** | `conversations`, `history`, `knowledge_items` + миграции 001–007 |
| **Статус** | ✅ production, только для бота |
| **ВАЖНО** | ≠ jbdljdwlfimvmqybzynv (EngHub) — отдельный проект! |

#### Railway (Хостинг AdIntakeBot)

| Параметр | Значение |
|----------|----------|
| **Project** | `kind-comfort` |
| **Service** | `ai-Institut` (или `ai-institut`) |
| **URL** | `https://ai-institut-production.up.railway.app` |
| **Webhook** | `WEBHOOK_DOMAIN` для Telegram |
| **Health Check** | `/health` (healthcheckPath) |
| **Статус** | ✅ production, бот активен |

#### LiveKit Cloud (видеоконференции)

| Параметр | Значение |
|----------|----------|
| **API Key** | `LIVEKIT_API_KEY` (Vercel env) |
| **API Secret** | `LIVEKIT_API_SECRET` (Vercel env) |
| **URL** | `LIVEKIT_URL` (Vercel env) |
| **Компонент** | `@livekit/components-react` |
| **Статус** | ✅ production, используется в ConferenceRoom |

#### OpenAI (LLM + Embeddings + Whisper)

| Параметр | Значение |
|----------|----------|
| **API Key** | `OPENAI_API_KEY` |
| **Модели** | `gpt-4o-mini` (ad-intake-bot), `text-embedding-3-small` (RAG) |
| **Сервисы** | Embeddings (RAG), Whisper (STT), vision (cable-calc parse) |
| **Статус** | ✅ production |

#### DeepSeek (альтернативный LLM для бота)

| Параметр | Значение |
|----------|----------|
| **Base URL** | `https://api.deepseek.com` |
| **API Key** | `LLM_API_KEY` (Railway env) |
| **Модель** | `deepseek-chat` или `deepseek-v4-flash` |
| **Статус** | ✅ production, используется в ad-intake-bot как fallback |

#### Anthropic Claude (AI Copilot оркестратор)

| Параметр | Значение |
|----------|----------|
| **API Key** | `ANTHROPIC_API_KEY` (Vercel env) |
| **Модель** | Claude (версия не указана, likely 3.5/4) |
| **Сервисы** | `/api/orchestrator`, RAG assistant, проверки compliance |
| **Статус** | ✅ production, в основном AI workflow |

#### Telegram Bot API

| Параметр | Значение |
|----------|----------|
| **Bot Token** | `BOT_TOKEN` (Railway env для ad-intake-bot) |
| **Сервис** | AdIntakeBot (intake заявок) |
| **Также** | Telegram бот для EngHub (pull-команды через `/api/telegram.js`) |
| **Статус** | ✅ production |

#### Telegram TDLib (native client)

| Параметр | Значение |
|----------|----------|
| **Используется** | android-voicebot (TDLib wrapper) |
| **Тип** | Нативный Telegram клиент (не Bot API) |
| **Статус** | ⏳ TODO: исходники Kotlin не закоммичены |

### 2.2 Внешние сервисы (опционально)

#### amoCRM (CRM интеграция)
- **Env vars:** `AMOCRM_SUBDOMAIN`, `AMOCRM_ACCESS_TOKEN`, `AMOCRM_PIPELINE_ID`
- **Статус:** Опциональна (если настроена)

#### CRM Webhook (n8n, Bitrix24)
- **Env vars:** `CRM_WEBHOOK_URL`, `BITRIX24_INCOMING_WEBHOOK`
- **Статус:** Опциональна

#### GitHub Actions (CI/CD)
- **Workflow:** `.github/workflows/build-voice-bot-apk.yml`
- **Триггер:** push в `android-voicebot/**` или manual
- **Статус:** Настроен, но no-op (исходники не закоммичены)

---

## 3. МОДУЛИ И ПРОДУКТЫ

### 3.1 Основные продукты

#### EngHub (основной)

**Назначение:** Внутренняя инженерная платформа управления проектами

**Компоненты:**
- React 18 + TypeScript фронтенд
- Vercel serverless API
- Supabase PostgreSQL + RLS + Realtime
- LiveKit видеоконференции
- AI Copilot (Claude + RAG)

**Ключевой функционал:**
- Управление проектами и задачами
- Документооборот (чертежи, ревизии, замечания, трансмитталы)
- Совещания + realtime чат
- Спецификации (AGSK)
- Аналитика ГИПа (Gantt, RACI, budget, risks)
- Telegram уведомления

**URL:** `https://enghub-three.vercel.app`

**Статус:** ✅ production (QA passed, cable-calc v3 READY)

#### AdIntakeBot (вспомогательный)

**Назначение:** Telegram-бот для приёма заявок от клиентов рекламного агентства

**Компоненты:**
- Node.js Express сервер
- Telegram Bot API
- OpenAI (GPT-4o-mini, Whisper, embeddings)
- DeepSeek (альтернативный LLM)
- Supabase (отдельный проект `pbxzxwskhuzaojphkeet`)
- Railway хостинг

**Ключевой функционал:**
- Voice + text + файлы (заявки)
- Диалог с GPT-4o-mini
- Знаниевая база (RAG через pgvector)
- Уведомления менеджеру в Telegram
- Экспорт в CRM (n8n, Bitrix24, amoCRM)
- Analytics (`/stats`)

**URL:** `https://ai-institut-production.up.railway.app`

**Статус:** ✅ production (отдельное приложение)

#### cable-calc (инженерный инструмент)

**Назначение:** Расчёт кабельных линий по МЭК, ПУЭ, ТКЗ

**Компоненты:**
- Python движок (calc.py)
- Парсеры (PDF vision, Excel, Word)
- Обратный расчёт (reverse.py)
- Экспорт Excel (report-xlsx.py)
- React UI (cable-calc.html)

**Ключевой функционал:**
- Подбор сечения
- Проверка сечения
- Расчёт максимальной нагрузки
- Парсинг готовых таблиц из документов
- Экспорт результатов

**URL:** `/cable-calc.html` в EngHub

**Статус:** ✅ production (QA round 3 PASS, всё готово)

#### android-voicebot (мобильное приложение)

**Назначение:** Нативное Android приложение для голосовой отправки в Telegram

**Компоненты:**
- Kotlin + Android 8.0+
- SpeechRecognizer (фоновое слушание)
- TDLib (native Telegram client)
- Gradle + GitHub Actions CI

**Ключевой функционал:**
- Триггер-фраза «отправь в телеграм»
- Непрерывное слушание
- Отправка в Saved Messages или выбранный чат

**URL:** Релизы → GitHub Releases (APK)

**Статус:** ⏳ TODO: Kotlin исходники не закоммичены (только CI workflow)

---

## 4. КАРТА СВЯЗЕЙ

```
┌────────────────────────────────────────────────────────┐
│                 GitHub / Git Main                       │
│              andyrbek2709-tech/ai-institut             │
└──────┬───────────────────────────────────────────────┬─┘
       │                                                 │
    ┌──▼──────────────┐     ┌──────────────────┐    ┌──▼─────────────┐
    │   EngHub (FE)   │     │ AdIntakeBot      │    │ cable-calc     │
    │  enghub-main/   │────▶│  ad-intake-bot/  │    │ (inside FE)    │
    └──┬──────────────┘     └──────┬───────────┘    └────────────────┘
       │                           │
    ┌──▼───────────────────────┐   │
    │ Vercel                   │   │ ┌──────────────────────────────┐
    │ prj_ZDihCpWH1AmIEPRebnOI │   │ │ Railway                      │
    │ team_o0boJNeRGftH6Cbi9   │   │ │ kind-comfort / ai-institut   │
    │ https://enghub-three...  │   │ │ https://ai-institut-prod... │
    └──┬───────────────────────┘   │ └──────────────────────────────┘
       │                           │
    ┌──▼───────────────────────────▼──────┐
    │ Supabase (EngHub)                    │
    │ jbdljdwlfimvmqybzynv                 │
    │ ├─ auth, RLS, Realtime               │
    │ ├─ projects, tasks, drawings...      │
    │ ├─ Functions (vectorize, search)     │
    │ └─ Storage (PDFs, Excel)             │
    └────────────────────────────────────┘
         │                       │
    ┌────▼──────┐   ┌───────────▼──────────┐
    │ OpenAI    │   │ Supabase (AdIntakeBot) │
    │ API       │   │ pbxzxwskhuzaojphkeet  │
    │ · gpt-4o  │   │ ├─ conversations      │
    │ · whisper │   │ ├─ history            │
    │ · vision  │   │ └─ knowledge_items    │
    │ · embed3  │   └───────┬───────────────┘
    └────┬──────┘           │
         │      ┌───────────▼──────────┐
         │      │ OpenAI + DeepSeek    │
         │      │ (ad-intake-bot)      │
         │      │ · gpt-4o-mini        │
         │      │ · deepseek-chat      │
         │      │ · whisper            │
         │      │ · embeddings         │
         │      └──────────────────────┘
         │
    ┌────▼──────────────────────┐
    │ Telegram                   │
    │ ├─ Bot API (ad-intake)     │
    │ └─ TDLib (android-voicebot)│
    └────────────────────────────┘

    ┌──────────────────────────────┐
    │ LiveKit Cloud                │
    │ (video meetings in EngHub)   │
    └──────────────────────────────┘

    ┌──────────────────────────────┐
    │ Anthropic Claude             │
    │ (AI Copilot orchestrator)    │
    └──────────────────────────────┘
```

### 4.1 Поток данных

**EngHub → AdIntakeBot:**
- ❌ Нет прямого потока (отдельные системы)
- ✅ Возможна интеграция через webhook (опционально)

**EngHub → Telegram:**
- `/api/telegram.js` → pull-команды
- Опциональные уведомления (если настроены)

**AdIntakeBot → CRM:**
- webhook (n8n, Bitrix24, amoCRM)
- Опционально

**EngHub ↔ Supabase:**
- Двусторонняя, RLS
- Auth, Realtime, Storage

**AdIntakeBot ↔ Supabase (pbxzxwskhuzaojphkeet):**
- Двусторонняя, отдельный проект
- Conversations, history, knowledge_items

**cable-calc → EngHub:**
- Встроен как модуль (`enghub-main/api/cable-calc/`)
- Дополнительно доступен как `/cable-calc.html`

---

## 5. КРИТИЧНЫЕ ТОЧКИ

### 5.1 Точки отказа (single points of failure)

| № | Точка отказа | Последствие | Восстановление |
|---|--------------|-----------|------------------|
| 1 | GitHub `ai-institut` repo удален | Все исходники потеряны | Необходимо восстановление из бэкапа или clone |
| 2 | Vercel проект `prj_ZDihCpWH1AmIEPRebnOI` удален | EngHub офлайн + потеря истории деплоев | Перестройка Vercel проекта, переподключение |
| 3 | Supabase `jbdljdwlfimvmqybzynv` удален | EngHub полностью без данных | Восстановление из бэкапа Supabase (7 дней по умолчанию) |
| 4 | Supabase `pbxzxwskhuzaojphkeet` удален | AdIntakeBot без данных (отдельный проект!) | Восстановление из бэкапа (7 дней) + переподключение Railway |
| 5 | Railway сервис `ai-institut` остановлен | AdIntakeBot офлайн | Перезапуск через Railway console |
| 6 | OpenAI API key скомпрометирован | Леки в LLM, затраты | Смена ключа в Vercel + Railway env |
| 7 | ANTHROPIC_API_KEY скомпрометирован | AI Copilot не работает | Смена ключа в Vercel |
| 8 | BOT_TOKEN (Telegram) скомпрометирован | Бот takeover | Смена токена в @BotFather + Railway env |
| 9 | LiveKit credentials утечка | Видеовстречи перехватываются | Смена credentials в Vercel |

### 5.2 Скрытые зависимости

**EngHub зависит от:**
- Vercel (deployment, serverless functions)
- Supabase (БД, auth, realtime, storage)
- OpenAI (RAG embeddings, vision для cable-calc)
- Anthropic (AI Copilot)
- LiveKit (видеоконференции)
- Telegram (опциональные уведомления)

**AdIntakeBot зависит от:**
- Railway (хостинг)
- Supabase `pbxzxwskhuzaojphkeet` (БД)
- Telegram Bot API
- OpenAI (LLM, Whisper)
- DeepSeek (альтернативный LLM)

**cable-calc зависит от:**
- Python (движок)
- OpenAI Vision (парсинг PDF)
- pdfplumber, openpyxl, python-docx (парсеры)

### 5.3 Критичные файлы и папки

**НЕЛЬЗЯ удалять ни при каких условиях:**

```
d:\ai-institut/
├── .git/                                   # ← История + source of truth
├── enghub-main/
│   ├── src/                               # ← React код (весь UI)
│   ├── api/                               # ← Все 18+ serverless функций
│   │   └── cable-calc/                   # ← Расчётный движок (Python)
│   ├── public/                            # ← cable-calc.html, agenda.html
│   └── vercel.json                        # ← Конфиг Vercel
│
├── ad-intake-bot/
│   ├── src/                               # ← Код бота
│   ├── supabase/migrations/               # ← SQL миграции (001–007)
│   ├── supabase/bundle_ad_intake_bot_schema.sql
│   ├── railway.json                       # ← Конфиг Railway
│   └── package.json
│
├── supabase/
│   ├── migrations/                        # ← 023 SQL миграции для EngHub
│   └── functions/                         # ← Edge functions
│
├── package.json                           # ← Root dependencies
├── STATE.md                               # ← Live journal (источник правды)
├── CLAUDE.md                              # ← Правила проекта
└── final-readme.md                        # ← Актуальная документация
```

---

## 6. РИСКИ УДАЛЕНИЯ

### 6.1 Удаления, которые ПОТЕРЯЮТ критичные данные

| Путь | Что потеряется | Восстановимо? | Срок восстановления |
|------|-----------------|---------------|---------------------|
| `enghub-main/src/` | Весь React код | git восстановление | Немедленно (git history) |
| `enghub-main/api/` | Все API endpoints | git восстановление | Немедленно |
| `ad-intake-bot/src/` | Код бота | git восстановление | Немедленно |
| `supabase/migrations/` | Schema EngHub | git восстановление | Немедленно, но нужна переприменить на БД |
| `ad-intake-bot/supabase/migrations/` | Schema AdIntakeBot | git восстановление | Немедленно |
| `.git/` directory | **ВСЯ ИСТОРИЯ** | ❌ НЕ восстановима | **НЕВОЗМОЖНО** |
| Supabase `jbdljdwlfimvmqybzynv` проект | **ВСЕ ДАННЫЕ EngHub** | Бэкап (7 дней) | 7 дней макс |
| Supabase `pbxzxwskhuzaojphkeet` проект | **ВСЕ ДАННЫЕ AdIntakeBot** | Бэкап (7 дней) | 7 дней макс |
| Vercel проект `prj_ZDihCpWH1AmIEPRebnOI` | История деплоев, конфиг | Частично (git) | Можно переделать |
| Railway сервис `ai-institut` | Конфиг, история логов | Частично (env vars) | Можно переделать |

### 6.2 Каскадные отказы

```
Удаление GitHub repo ai-institut
  ↓
Потеря всех исходников + истории
  ↓
  ├─ Нельзя перестроить EngHub (FE + API)
  ├─ Нельзя перестроить AdIntakeBot
  ├─ Нельзя перестроить cable-calc
  └─ Потеря миграций для Supabase

Удаление Supabase jbdljdwlfimvmqybzynv
  ↓
EngHub полностью без данных
  ├─ Projects, tasks, drawings, reviews...
  ├─ User accounts + auth
  ├─ Realtime subscriptions
  ├─ RAG vectorized docs
  └─ Хранилище (PDFs, Excel)

Удаление Supabase pbxzxwskhuzaojphkeet
  ↓
AdIntakeBot потеряет историю всех заявок
  ├─ Conversations
  ├─ Knowledge base
  └─ Analytics data

Удаление Vercel проекта
  ↓
EngHub офлайн (сайт не доступен)
  ├─ API endpoints не работают
  └─ Нужна переконфигурация
```

---

## 7. РЕКОМЕНДАЦИИ

### 7.1 Что объединять

✅ **ОСТАВИТЬ ОБЪЕДИНЁННЫМ:**

1. **EngHub + cable-calc** — правильно встроены вместе
   - cable-calc = часть инженерного инструментария EngHub
   - API endpoints в Vercel рядом с другим API
   - UI интегрирован в `/public/cable-calc.html`
   - ✅ Хорошая архитектура

2. **EngHub фронтенд + API в одном Vercel проекте**
   - Единая точка deployment
   - Одни env vars
   - Shared functions
   - ✅ Правильно

### 7.2 Что оставить отдельным

✅ **ОТДЕЛЬНЫЕ ПРАВИЛЬНО:**

1. **AdIntakeBot в отдельном репозитории (но внутри `ai-institut`)**
   - Отдельная Railway deployment
   - Отдельный Supabase проект (`pbxzxwskhuzaojphkeet`)
   - Отдельная ответственность (бот vs платформа)
   - ✅ Правильно

2. **android-voicebot как отдельный модуль**
   - Отдельная сборка (Gradle + GitHub Actions)
   - Отдельная платформа (Android)
   - ✅ Правильно

3. **Supabase проекты (два отдельных)**
   - EngHub (`jbdljdwlfimvmqybzynv`) — production
   - AdIntakeBot (`pbxzxwskhuzaojphkeet`) — отдельный
   - ✅ Правильное разделение

### 7.3 Что можно улучшить

⚠️ **РЕКОМЕНДАЦИИ:**

| №  | Что | Почему | Как |
|----|-----|--------|-----|
| 1  | **Backup automation** | Supabase бэкап только 7 дней | Настроить автоматический дамп в Cloud Storage (S3/GCS) |
| 2  | **Secrets rotation** | OPENAI_API_KEY, BOT_TOKEN могут быть скомпрометированы | Настроить ротацию каждые 90 дней |
| 3  | **API monitoring** | Нет Sentry / APM для cable-calc parse timeouts | Добавить Sentry в Vercel |
| 4  | **Database replicas** | Single Supabase instance | Рассмотреть read replicas для analytics |
| 5  | **Disaster recovery plan** | Нет описанного плана восстановления | Задокументировать процедуру восстановления |
| 6  | **Android-voicebot** | Исходники не закоммичены | Добавить Kotlin исходники в репо + потестировать CI |
| 7  | **Git hooks** | No pre-commit checks | Добавить husky для проверки миграций перед push |
| 8  | **Schema audit** | RLS-политики неполные (T3 задача из TASKS.md) | Завершить RLS-аудит и миграции 019–023 |

### 7.4 Архитектура идеальна для:

✅ **Текущей структуры:**
- Единый GitHub репозиторий (monorepo) — правильно
- Несколько заинтересованных проектов — управляемо
- Разделённые Supabase проекты — безопасно
- Разные хостинги (Vercel, Railway) — гибко

---

## 📊 ИТОГОВАЯ ТАБЛИЦА

| Категория | Кол-во | Статус |
|-----------|--------|--------|
| **Репозитории** | 2 (1 основной + Nurmak reference) | ✅ production |
| **Подпроекты в ai-institut** | 4 (EngHub, AdIntakeBot, cable-calc, android-voicebot) | ✅ 3 ready, ⏳ 1 TODO |
| **Vercel проекты** | 1 (`enghub`) | ✅ production |
| **Supabase проекты** | 2 (EngHub, AdIntakeBot) | ✅ production |
| **Railway проекты** | 1 (`kind-comfort` service `ai-institut`) | ✅ production |
| **External API services** | 6 (OpenAI, DeepSeek, LiveKit, Anthropic, Telegram, GitHub) | ✅ integrated |
| **API endpoints** | 18+ | ✅ production |
| **Database tables** | 25+ | ✅ production |
| **Supabase migrations** | 23 (EngHub) + 7 (AdIntakeBot) | ✅ production |
| **Edge functions** | 2 | ✅ production |
| **Critical files at risk** | 0 (если не удалять) | ✅ safe |

---

## 🎯 ВЫВОДЫ

1. **Экосистема хорошо структурирована** — разумное разделение ответственности
2. **Три продукта в production** — EngHub, AdIntakeBot, cable-calc
3. **Один модуль в работе** — android-voicebot (CI готов, исходники TODO)
4. **Все критичные данные в Supabase** — с 7-дневным бэкапом (недостаточно!)
5. **Зависимостей от внешних сервисов** — много, но управляемо
6. **Нет явных architectural problems** — можно только улучшать

### ⚠️ ГЛАВНЫЕ РИСКИ:

- 🔴 **Потеря GitHub репо** = потеря всей истории + исходников
- 🔴 **Потеря Supabase проектов** = потеря всех данных (восстановление только 7 дней)
- 🟡 **Компрометация API ключей** = утечка + остановка сервисов
- 🟡 **Отказ LiveKit / Telegram** = потеря одного feature, но платформа работает

### ✅ ЛУЧШИЕ ПРАКТИКИ:

- ✅ Используется git для версионирования
- ✅ Разделены Supabase проекты по назначению
- ✅ Разные хостинги для разных целей
- ✅ Secrets в env vars (не в коде)
- ✅ Миграции версионированы в git

---

**Конец аудита. Ничего не удалено. Только анализ.**

Дата: 2026-05-05  
Статус: ✅ ЗАВЕРШЕНО
