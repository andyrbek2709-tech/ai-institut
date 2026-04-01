# EngHub — Инженерная платформа (v7.3)

Веб-платформа для управления инженерными проектами проектного института.  
Стек: React 18 + TypeScript, Vercel, Supabase (PostgreSQL + pgvector), Claude AI (Anthropic).

---

## 🚀 Реализованные возможности

### Ядро платформы
- **4 роли**: Администратор → ГИП → Руководитель отдела → Инженер
- **Проекты**: создание, архивирование, прогресс (% выполнения), фильтрация по статусу
- **Канбан задач**: 6 статусов (`todo → inprogress → review_lead → review_gip → revision → done`)
- **Система ревизий**: клонирование задач R0 → R1 → R2 с историей замечаний
- **Задания смежникам (Assignments)**: матрица увязки, Accept/Reject, Inbox для нач. отделов
- **Конференц-зал**: чат внутри проекта через Supabase Realtime

### Модуль чертежей
- **Реестр чертежей**: создание, статусы (draft / in_work / review / issued / cancelled)
- **Ревизии**: выпуск ревизии, журнал R0→R1→R2, связь с задачами
- **Замечания (Reviews)**: открытие/закрытие/отклонение, severity (critical/major/minor)
- **Трансмитталы**: создание, добавление позиций чертёж+ревизия, статусы (draft/issued/delivered)
- **PDF-экспорт трансмитталов**: кнопка 🖨 → A4 landscape HTML с таблицей чертежей

### AI Copilot (оркестратор)
- **RAG-режим**: поиск по нормативной базе знаний (pgvector + Claude Haiku)
- **Task Manager**: создание задач через естественный язык
- **Project Insights Agent**: "Как дела по проекту?" → Claude анализирует живые данные, выдаёт риски
- **Smart Decompose Agent**: "Составь план задач для ОВ" → Claude генерирует список → action `create_tasks`
- **Compliance Check Agent**: "Нормоконтроль ОВ-001" → RAG + Claude → чеклист замечаний → `create_review`
- **Generate Report Agent**: "Сформируй еженедельный отчёт" → Claude пишет статус-отчёт
- **Ролевой доступ**: ГИП/Lead — все агенты; Инженер — `project_insights` + `compliance_check`
- **Blocked-ответы**: `reason_code` + `next_step` при блокировке действия

### Нормативная база знаний (RAG)
- Загрузка PDF/DOCX документов, автоматическая векторизация через Edge Function
- Семантический поиск через OpenAI Embeddings + `search_normative()` (pgvector cosine)
- Статус индексации документов, параллельная синхронизация (3 документа одновременно)

### Инженерные расчёты
- 90+ шаблонов по дисциплинам: ТХ, ТТ, ЭО, ВК, ПБ, ОВ, КЖ/КМ, Г, КИПиА
- Поиск по названию/дисциплине, счётчик шаблонов по категории
- Умный конвертер единиц (12 типов: длина, давление, температура, мощность и др.)
- Экспорт расчёта в DOCX

### Новые модули (v7.x)
- **Gantt-диаграмма** (вкладка 📊): таймлайн задач, группировка по отделам, цвет по статусу, линия «Сегодня», просроченные выделены красным
- **Протоколы совещаний** (вкладка 🗒): создание (тема, дата, участники, повестка, решения), список, **PDF-экспорт** каждого протокола (кнопка 🖨 → A4 portrait)
- **Учёт рабочего времени / Табель** (вкладка ⏱): запись часов по задаче, сводка по сотрудникам для ГИП/Lead, таблица всех записей

### Экспорт данных
- **Excel (.xls)**: 4 листа — Задачи, Чертежи, Замечания, Проект
- **PDF протокола**: A4 portrait, повестка + решения + подписи Председатель/Секретарь
- **PDF трансмиттала**: A4 landscape, таблица чертежей + подписи Выдал/Принял

### Realtime-уведомления
- Supabase `postgres_changes` подписки: задачи (UPDATE), замечания (INSERT/UPDATE), трансмитталы (UPDATE → issued)
- Toast-уведомления в реальном времени

### UX
- Тёмная/светлая тема (CSS-переменные)
- Мобильная адаптация: CopilotPanel `min(400px, 100vw)` + `position: fixed`, Kanban/modal/tab фиксы
- Ролевые плейсхолдеры в Copilot

---

## 📋 Дорожная карта (запланировано)

### Ближайший приоритет

| # | Фича | Описание |
|---|------|----------|
| 1 | **Telegram-бот уведомлений** | Уведомления о приближении дедлайнов задач/чертежей через Telegram Bot API |
| 2 | **Глобальный поиск** | Поиск одновременно по задачам, чертежам, протоколам совещаний — через строку в topbar |
| 3 | **GGE-модуль** | Учёт прохождения государственной экспертизы: загрузка замечаний ГГЭ, статус устранения, история |
| 4 | **Декомпозиция App.tsx** | Вынести Gantt, Meetings, Timelog в отдельные компоненты (tech debt — файл ~2200 строк) |

### Средний горизонт

| # | Фича | Описание |
|---|------|----------|
| 5 | **Ведомость чертежей** | Реестр с учётом форматов (А0/А1/А3), количества листов, веса комплекта |
| 6 | **KPI-дашборд** | Метрики по проекту: скорость задач, % выпущенных чертежей, burndown, velocity |
| 7 | **Канбан-фильтры** | Фильтрация задач по исполнителю, дисциплине, дедлайну |
| 8 | **Уведомления по email** | Альтернатива Telegram — через Supabase Email или Resend |
| 9 | **Пагинация** | Lazy-load для задач/чертежей при большом количестве записей |

### Долгий горизонт

| # | Фича | Описание |
|---|------|----------|
| 10 | **Мобильное приложение** | PWA с офлайн-режимом или React Native |
| 11 | **Интеграция с AutoCAD/Revit** | Импорт ведомости из файла DWG/IFC через парсер |
| 12 | **Шаблоны проектов** | Создание проекта из готового шаблона (нефтехимия, энергетика, ПГС) |
| 13 | **Двухфакторная аутентификация** | TOTP через Supabase Auth |

---

## 🗄️ База данных — миграции

| Файл | Статус | Содержимое |
|------|--------|-----------|
| `001_rag_setup.sql` | ✅ применена | pgvector, `normative_chunks`, `search_normative()` |
| `002_drawings.sql` | ✅ применена | таблица `drawings` |
| `003_tasks_drawing_link.sql` | ✅ применена | `tasks.drawing_id` → `drawings` |
| `004_revisions.sql` | ✅ применена | таблица `revisions` |
| `005_reviews.sql` | ✅ применена | таблица `reviews` |
| `006_transmittals.sql` | ✅ применена | таблица `transmittals` |
| `007_transmittal_items.sql` | ✅ применена | таблица `transmittal_items` |
| `008_schema_hardening.sql` | ✅ применена | составные индексы + CHECK-ограничения по доменным статусам |
| `009_meetings_timelog.sql` | ⚠️ **требует применения в Supabase SQL Editor** | таблицы `meetings` и `time_entries` |

> **Важно для `009`:** открыть [Supabase Dashboard → SQL Editor](https://supabase.com/dashboard), вставить текст файла `supabase/migrations/009_meetings_timelog.sql` целиком и выполнить.

---

## 🏗️ Архитектура

```
/
├── vercel.json                          # Конфигурация деплоя
├── supabase/
│   ├── functions/vectorize-doc/index.ts # Edge Function: PDF/DOCX → pgvector
│   └── migrations/001–009_*.sql        # SQL-миграции
└── enghub-main/
    ├── api/orchestrator.js              # Vercel serverless: AI-агенты + RAG
    └── src/
        ├── api/supabase.ts              # API-хелперы (env-vars)
        ├── components/
        │   ├── ui.tsx                   # Базовые UI-компоненты (Field, Modal, getInp)
        │   ├── Notifications.tsx        # Toast-уведомления
        │   ├── CopilotPanel.tsx         # AI Copilot интерфейс
        │   ├── TransmittalsTab.tsx      # Реестр трансмитталов
        │   ├── ReviewsTab.tsx           # Замечания
        │   ├── RevisionsTab.tsx         # Ревизии
        │   └── AssignmentsTab.tsx       # Задания смежникам
        ├── copilot/
        │   └── validateApplyAction.ts   # Единый валидатор apply-действий
        ├── calculations/                # Движок расчётов (90+ шаблонов)
        ├── pages/LoginPage.tsx
        ├── pages/AdminPanel.tsx
        ├── pages/ConferenceRoom.tsx
        ├── App.tsx                      # Основной интерфейс (~2200 строк)
        ├── constants.ts
        ├── constants.test.ts            # Baseline unit-тесты
        └── styles.css
```

### Lifecycle задачи
```
todo → inprogress → review_lead → review_gip → done
                 ↘ revision ↗
```

### AI-агенты (orchestrator.js)
```
Пользователь → detectIntent() → handler → callClaude() → action или текст

project_insights  → fetch(tasks+drawings+reviews) → Claude → текстовый анализ
smart_decompose   → fetch(project.depts) → Claude JSON → create_tasks action
compliance_check  → regex(drawingCode) → search_normative → Claude → create_review actions
generate_report   → fetch(all project data) → Claude → текстовый отчёт
rag_assistant     → OpenAI embed → search_normative() → Claude → ответ
```

---

## 🔐 Переменные окружения

Файл `enghub-main/.env.local` (не коммитить):
```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
REACT_APP_SUPABASE_SERVICE_KEY=your-service-key
```

Vercel Dashboard → Settings → Environment Variables:

| Переменная | Описание |
|-----------|---------|
| `REACT_APP_SUPABASE_URL` | URL Supabase проекта |
| `REACT_APP_SUPABASE_ANON_KEY` | Публичный anon ключ |
| `REACT_APP_SUPABASE_SERVICE_KEY` | Service role ключ |
| `SUPABASE_URL` | URL для orchestrator |
| `SUPABASE_SERVICE_KEY` | Service role для orchestrator |
| `OPENAI_API_KEY` | Для эмбеддингов (text-embedding-3-small) |
| `ANTHROPIC_API_KEY` | Для AI-агентов (Claude Haiku) |

---

## 🔧 Разработка и деплой

```bash
# Локальный запуск
cd enghub-main
npm install
npm start

# Сборка
npm run build

# Тесты
CI=true npm test -- --watch=false

# Деплой (автоматически через Vercel)
git push origin main
```

---

## 📝 История версий

### v7.3 — PDF-экспорт протоколов и трансмитталов *(2026-04-01)*
- ✅ `exportMeetingPdf(m)` — A4 portrait: тема, дата, участники, повестка, решения, строки Председатель/Секретарь
- ✅ `exportTransmittalPdf(tr)` — A4 landscape: таблица чертежей (код/название/дисциплина/ревизия/примечание), строки Выдал/Принял
- ✅ Кнопка 🖨 на каждой карточке протокола и трансмиттала
- ✅ HTML-to-print подход (Blob URL + `window.print()`), нулевые новые зависимости
- Файлы: `App.tsx`, `TransmittalsTab.tsx`

### v7.2 — Gantt, Протоколы, Табель *(2026-04-01)*
- ✅ Gantt-диаграмма (вкладка 📊): CSS timeline bars, группировка по отделу, цвет по статусу, линия Today, просроченные = красный
- ✅ Протоколы совещаний (вкладка 🗒): создание + список, поля: тема/дата/участники/повестка/решения
- ✅ Учёт рабочего времени (вкладка ⏱): ввод часов, сводка по сотрудникам (ГИП/Lead), таблица записей
- ✅ SQL-миграция `009_meetings_timelog.sql`: таблицы `meetings` и `time_entries`
- Файлы: `App.tsx`, `supabase/migrations/009_meetings_timelog.sql`

### v7.1 — Realtime, Excel 4 листа, Mobile *(2026-04-01)*
- ✅ Realtime подписки на `reviews` (INSERT/UPDATE) и `transmittals` (UPDATE → issued)
- ✅ Excel-экспорт: 4 листа — Задачи, Чертежи, Замечания, Проект
- ✅ CopilotPanel: `position: fixed`, `width: min(400px, 100vw)`
- ✅ Mobile CSS: Kanban, topbar, modal, tabs @480px
- Файлы: `App.tsx`, `CopilotPanel.tsx`, `styles.css`

### v7.0 — AI-агенты нового поколения *(2026-04-01)*
- ✅ `callClaude()` — общий хелпер Claude Haiku в orchestrator
- ✅ `handleProjectInsights` — анализ живых данных проекта через Claude
- ✅ `handleSmartDecompose` — генерация задач Claude → `create_tasks` action
- ✅ `handleComplianceCheck` — нормоконтроль RAG+Claude → `create_review` actions
- ✅ `handleGenerateReport` — недельный отчёт через Claude
- ✅ `ROLE_ALLOWED_INTENTS`: ГИП/Lead — все 4 агента; Инженер — 2 агента
- ✅ Ролевые плейсхолдеры Copilot и русские метки агентов
- Файлы: `orchestrator.js`, `CopilotPanel.tsx`

### v6.x — Stabilization, Refactor, Copilot Hardening, Data Hardening *(2026-03-31 – 2026-04-01)*
- ✅ **A — Stabilization**: DOM-зависимость в transmittals убрана → controlled state `transmittalDraftLinks`
- ✅ **B — QA Coverage**: role-based QA matrix, regression checklist, scenario IDs (QA-GIP/LEAD/ENG/DATA), baseline unit-тесты (`constants.test.ts`)
- ✅ **C — Refactor**: декомпозиция `App.tsx` → `TransmittalsTab`, `ReviewsTab`, `RevisionsTab`, `AssignmentsTab`
- ✅ **D — Copilot Hardening**: `validateCopilotApply`, защита от двойного клика, `reason_code` + `next_step` в blocked-ответах
- ✅ **E — Data Hardening**: `008_schema_hardening.sql` — составные индексы + CHECK-ограничения
- ✅ **F — Release Readiness**: release notes, runbook, smoke checklist
- ✅ **Copilot Role Hardening (Phase 8)**: ролевые ограничения intent/action в orchestrator

### v6.4 — Нормативка: исправлена векторизация *(ранее)*
- ✅ Рефакторинг Edge Function `vectorize-doc`: DOCX через JSZip, улучшенный PDF-парсинг
- ✅ Параллельная индексация (3 документа), статус ошибки для сканов

### v6.3 — Конвертер единиц *(ранее)*
- ✅ 12 типов конвертеров (длина, давление, температура, мощность и др.)

### v6.2 — Каталог расчётов *(ранее)*
- ✅ Все 90+ расчётов в сайдбаре, поиск, счётчики по категории

### v6.1 — Семантический поиск *(ранее)*
- ✅ Поиск по нормативке через OpenAI Embeddings + pgvector cosine similarity

### v6.0 — RAG + Безопасность + Деплой *(ранее)*
- ✅ Vercel build fix (`vercel.json`), ключи в env vars, Edge Function vectorize-doc, SQL миграция 001

### v5.x — Редизайн и чат *(ранее)*
- ✅ Sidebar/Topbar/Breadcrumbs/pill-tabs, ConferenceRoom, reset sideTab

---

## 🧾 Agent Handover Log

#### [2026-04-01] v7.3 — PDF-экспорт
- Step: `exportMeetingPdf` (A4 portrait) + `exportTransmittalPdf` (A4 landscape), кнопки 🖨 на карточках
- Files: `App.tsx`, `TransmittalsTab.tsx`, `README.md`
- Validation: `npm run build` — успешно (+1.73 kB gzip)
- Next: Telegram-уведомления / Глобальный поиск / GGE-модуль / Декомпозиция App.tsx

#### [2026-04-01 16:00] v7.2 — Gantt + Meetings + Timelog
- Step: 3 новых вкладки в карточке проекта + SQL-миграция 009
- Files: `App.tsx`, `supabase/migrations/009_meetings_timelog.sql`, `README.md`
- Validation: `npm run build` — успешно
- Next: применить 009 в Supabase SQL Editor; PDF-экспорт протоколов

#### [2026-04-01 15:00] v7.1 — Realtime + Excel + Mobile
- Step: Realtime для reviews/transmittals, Excel 4 листа, мобильный CopilotPanel + CSS
- Files: `App.tsx`, `CopilotPanel.tsx`, `styles.css`, `README.md`
- Validation: `npm run build` — успешно

#### [2026-04-01 14:00] v7.0 — AI-агенты
- Step: 4 новых агента в orchestrator, callClaude(), ролевые ограничения, плейсхолдеры
- Files: `orchestrator.js`, `CopilotPanel.tsx`, `README.md`
- Validation: `npm run build` — успешно (313.71 kB JS)

#### [2026-04-01 12:35] Блок E.1 — Data Hardening
- Step: `008_schema_hardening.sql`, блокировка пустой позиции трансмиттала в UI
- Files: `supabase/migrations/008_schema_hardening.sql`, `App.tsx`, `README.md`
- Validation: `npm run build` — успешно

#### [2026-04-01 12:18] Блок D.2 — Copilot Hardening
- Step: `reason_code` + `next_step` в orchestrator blocked-ответах, идемпотентность apply в CopilotPanel
- Files: `orchestrator.js`, `CopilotPanel.tsx`, `README.md`
- Validation: `npm run build` + тесты — успешно

#### [2026-04-01 12:00] Блок D.1 — validateCopilotApply
- Step: единый валидатор apply-действий, защита от двойного клика, unit-тесты
- Files: `copilot/validateApplyAction.ts`, `copilot/validateApplyAction.test.ts`, `CopilotPanel.tsx`, `README.md`
- Validation: `npm run build` + `npm test` — успешно

#### [2026-03-31 21:52] Блок C.4 — AssignmentsTab
- Step: вынос Assignments из App.tsx в компонент
- Files: `AssignmentsTab.tsx`, `App.tsx`, `README.md`
- Validation: `npm run build` — успешно

#### [2026-03-31 21:41] Блок C.3 — RevisionsTab
- Files: `RevisionsTab.tsx`, `App.tsx`, `README.md` | Validation: build успешно

#### [2026-03-31 21:28] Блок C.2 — ReviewsTab
- Files: `ReviewsTab.tsx`, `App.tsx`, `README.md` | Validation: build успешно

#### [2026-03-31 21:17] Блок C.1 — TransmittalsTab
- Files: `TransmittalsTab.tsx`, `App.tsx`, `constants.test.ts`, `README.md` | Validation: build успешно

#### [2026-03-31 21:02] Блок B.2 — Unit tests baseline
- Step: `constants.test.ts` — 3 теста (workflow transitions, drawing status, role prompts)
- Files: `constants.test.ts`, `README.md` | Validation: `CI=true npm test` — 3/3 passed

#### [2026-03-31 20:51] Блок B.1 — QA Plan
- Step: Role-based QA matrix + regression checklist + scenario IDs

#### [2026-03-31 20:42] Блок A.2 — Stabilization Smoke
- Step: smoke-checklist зафиксирован как baseline

#### [2026-03-31 20:31] Блок A.1 — Transmittals DOM fix
- Step: controlled state `transmittalDraftLinks` вместо `document.getElementById`
- Files: `App.tsx`, `README.md` | Validation: build успешно

#### [2026-03-31 20:02] Phase 8 — Copilot Role Hardening
- Step: ролевые ограничения intent/action в orchestrator, role-aware Copilot UI
- Files: `orchestrator.js`, `CopilotPanel.tsx`, `README.md` | Validation: build успешно

---

## ✅ Протокол для следующего агента

1. `git pull origin main`
2. **Применить миграцию 009** в Supabase SQL Editor (если ещё не применена):  
   Вставить содержимое `supabase/migrations/009_meetings_timelog.sql` и выполнить
3. При реализации новой фичи: `npm run build` → тесты → commit → `git push origin main`
4. После каждого блока обновить `README.md` (секция Agent Handover Log)
5. Один логический блок = один atomic commit = один push

### Диагностика миграций
```sql
-- Проверить наличие таблиц
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('drawings','tasks','revisions','reviews',
    'transmittals','transmittal_items','meetings','time_entries')
ORDER BY table_name;
```

---

## 🌐 Ссылки

- **Live**: [https://enghub.vercel.app](https://enghub.vercel.app)
- **GitHub**: [andyrbek2709-tech/ai-site](https://github.com/andyrbek2709-tech/ai-site)
