# EngHub — Инженерная платформа (v8.3)

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
- **Совещание проекта**: обсуждение внутри проекта через Supabase Realtime

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

## 🛠 Стратегия разработки (v7.4+)

- **Документирование:** После реализации каждого блока (фичи или исправления техдолга) немедленно обновлять `README.md`.
- **Запись планов:** Все обсужденные с пользователем планы и следующие шаги фиксируются в секции `Agent Handover Log`.
- **Последовательность:** Реализация ведется последовательно, от критических техдолгов к новым фичам.

---

## 📋 Дорожная карта (запланировано)

### Ближайший приоритет (Критическое)

| # | Фича | Описание | Статус |
|---|------|----------|--------|
| 1 | **Декомпозиция App.tsx** | Выполнение техдолга: вынос Gantt, Meetings, Timelog в компоненты (файл ~2200 строк) | ⏳ Планируется |
| 2 | **Full RAG Backend** | Настройка автоматической векторизации через Edge Functions (устранение "⚙️ Обработка...") | ⏳ Планируется |
| 3 | **Telegram-бот** | Уведомления о дедлайнах и изменениях статусов через Telegram Bot API | ⏳ Планируется |
| 4 | **Глобальный поиск** | Поиск по всем сущностям (задачи, чертежи, протоколы) из topbar | ⏳ Планируется |

### Средний горизонт

| # | Фича | Описание | Статус |
|---|------|----------|--------|
| 5 | **GGE-модуль** | Учет замечаний государственной экспертизы и их устранения | ⏳ Планируется |
| 6 | **Ведомость чертежей** | Расширенный учет форматов (А0-А4) и веса комплекта | ⏳ Планируется |
| 7 | **KPI-дашборд** | Визуализация метрик (скорость, % выпуска, burndown) | ⏳ Планируется |
| 8 | **Канбан-фильтры** | Фильтрация по исполнителю, дисциплине, дедлайну | ⏳ Планируется |

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
| `010_recover_core_tables.sql` | 🆕 recovery | аварийное восстановление `drawings/revisions/reviews/transmittals/transmittal_items` в production |

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

## 🧾 Agent Handover Log

#### [2026-04-02] v8.3 — Исправление ConferenceRoom (экран + сообщения)
- **Баг 1**: Демонстрация экрана запускалась (getDisplayMedia уже был в main), но поток не отображался — отсутствовал `<video>` элемент. Добавлены `videoRef`, `useEffect` для привязки `screenStreamRef → videoRef.srcObject`, `<video>` в области чата.
- **Баг 2**: Сообщения другого пользователя не появлялись пока сам не напишешь / не войдёшь в зал. Добавлен `setInterval(loadMessages, 3000)` при `sideTab === 'conference'` + Supabase Realtime подписка на `messages`.
- **Деплой**: merge worktree `claude/dazzling-mahavira` → `main` → `git push origin main` (Vercel auto-deploy).
- Files: `ConferenceRoom.tsx`, `App.tsx`, `README.md`
- Next: исправить остальные блокеры из QA Sign-off: права ГИП на чертежи, Timelog persistence, видимость задач у инженера.

#### [2026-04-01 18:30] Production QA Sign-off (v8.2)
- Step: Выполнен полный smoke + QA цикл в production (ГИП, Lead, Инженер).
- Result: **BLOCKED**. Обнаружены критические баги в Meetings (отправка сообщений) и Timelog (сохранение данных).
- Files: `README.md`, `task.md`, `walkthrough.md`
- Next: Исправить Realtime-ошибки и проблемы с правами ГИП.

v8.1: Production data-recovery hardening (2026-04-01)
- ✅ Исправлен API helper табеля: переход на `time_entries` с fallback на `time_log` для обратной совместимости.
- ✅ Усилена отправка сообщений в совещании: явный `success/fail` и уведомления при ошибке записи в `messages`.
- ✅ Добавлена recovery-миграция `supabase/migrations/010_recover_core_tables.sql` для устранения production 404 по отсутствующим таблицам `drawings/revisions/reviews/transmittals/transmittal_items`.
- ⚠️ Для полного снятия блока QA нужно выполнить SQL миграцию `010` в целевом Supabase (SQL Editor), затем повторить smoke-тест.

v8.0: Conference UX/ordering fix (2026-04-01)
- ✅ Вкладка `Совещание` перенесена перед `Увязкой` в карточке проекта.
- ✅ Реализована отправка файлов в совещании: upload в Supabase Storage + отправка ссылки в чат (`type=file`).
- ✅ Добавлено реальное включение микрофона через `getUserMedia` и демонстрации экрана через `getDisplayMedia` (с корректным stop/cleanup).
- ✅ В чате совещания добавлен рендер ссылки на вложение (`Открыть файл`) из сообщения.
- ✅ Верификация: `npm run build` и `CI=true npm test -- --watch=false` — успешно.

v7.9: Stitch UI Migration Wave 4 (micro-interactions & density tuning) (2026-04-01)
- ✅ Добавлена системная кривая анимаций (`--ease-standard`) и единые переходы для интерактивных элементов.
- ✅ Улучшены `hover/focus/pressed` состояния кнопок, табов, topbar controls, filter chips, search input.
- ✅ Полировка визуальной иерархии: badge-капсулы, плотность `project-meta-bar`, `tab-strip`, `task-list-title` и колонок Kanban.
- ✅ Доработаны глубина и акцентность карточек/колонок для более “живого” инновационного восприятия интерфейса.
- ✅ Верификация: `npm run build` и `CI=true npm test -- --watch=false` — успешно.

v7.8: Stitch UI Migration Wave 3 (domain screens alignment) (2026-04-01)
- ✅ Доведены доменные экраны под Stitch-подход: `Tasks/Kanban`, `Drawings`, `Revisions`, `Reviews`, `Transmittals`, `Conference`.
- ✅ Для доменных блоков добавлены унифицированные контейнеры `panel-surface` и улучшенная структура колонок Kanban (`kanban-col-shell`, `kanban-empty`).
- ✅ Добавлены плавные входы экранов (`screen-fade`) на ключевых разделах, включая проектные вкладки и режим совещаний.
- ✅ Изменения выполнены без правок бизнес-логики/API, только UI-композиция и оформление.
- ✅ Верификация: `npm run build` и `CI=true npm test -- --watch=false` — успешно.

v7.7: Stitch UI Migration Wave 2 (layout/components polish) (2026-04-01)
- ✅ Усилен перенос дизайн-подхода Stitch: переработаны композиция и оформление shell/контента (не только палитра).
- ✅ Обновлены стили кнопок, вкладок, модальных окон, карточек и project meta bar (градиенты, depth, интерактивные состояния).
- ✅ Добавлены плавные переходы экранов (`screen-fade`) для основных разделов и доменных панелей.
- ✅ Визуально обновлены проектные переходы/контрольные элементы (`Dashboard`, `Project`, `Projects registry`) без изменения бизнес-логики.
- ✅ Верификация после изменений: `npm run build` и `CI=true npm test -- --watch=false` — успешно.

v7.6: Stitch UI Migration Wave 1 (2026-04-01)
- ✅ Приведены базовые дизайн-токены (`constants.ts`, `styles.css`) к Stitch-ориентированной палитре/типографике (Inter + Manrope), без изменения бизнес-логики.
- ✅ Переименован UI-нейминг `conference/chat` → «Совещание/Обсуждение» (при сохранении внутренних state/id для обратной совместимости).
- ✅ Унифицирован визуал ключевых экранов на текущих компонентах: `GanttChart`, `MeetingsPanel`, `TimelogPanel`, `CopilotPanel` (карточки/поверхности/тени/акценты).
- ✅ Выполнена верификация: `npm run build` и `CI=true npm test -- --watch=false` — успешно.
- ✅ Изменения опубликованы в `main` для серверной проверки (push на GitHub).

### Stitch → EngHub mapping (Wave 1)

| Stitch visual block | EngHub screen/component | Решение |
|---|---|---|
| Global shell (sidebar/topbar/content) | `src/App.tsx`, `src/styles.css`, `src/constants.ts` | Взято 1:1 по структуре, адаптировано по токенам без смены логики |
| Project workspace tabs | `src/App.tsx` (`tasks/drawings/revisions/reviews/transmittals/assignments/gantt/meetings/timelog/conference`) | Сохранён текущий workflow, визуал и лейблы приведены к новому стилю |
| Conference/Chat area | `src/pages/ConferenceRoom.tsx`, `src/App.tsx` (`sideTab='conference'`) | UI-нейминг адаптирован: «Совещание», внутренний ключ `conference` сохранён |
| Gantt timeline card | `src/components/GanttChart.tsx` | Карточный контейнер и поверхности выровнены под Stitch |
| Meetings list and form | `src/components/MeetingsPanel.tsx` | Карточки/форма переведены на единый surface + shadow стиль |
| Timelog summary/table/form | `src/components/TimelogPanel.tsx` | Сводка/таблица/форма унифицированы визуально |
| Copilot right panel | `src/components/CopilotPanel.tsx` | Акцент/шапка синхронизированы с дизайн-токенами |
| Domain deviations | Все перечисленные экраны | Лишнее не переносилось; доменные сущности EngHub сохранены |

v7.5: App.tsx Decomposition & RAG Backend (2026-04-01)
- ✅ Экстракция `GanttChart`, `MeetingsPanel` и `TimelogPanel` в отдельные компоненты.
- ✅ Создание `src/utils/export.ts` для централизованного экспорта.
- ✅ Улучшение RAG Backend: внедрена надежная экстракция текста из PDF (pdf-parse) и пакетная индексация.
- ✅ Подготовлено ТЗ для дизайнеров на русском и английском языках.

---

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

### v8.3 — Исправлены баги ConferenceRoom *(2026-04-02)*
- ✅ Демонстрация экрана: добавлен `videoRef` + `<video>` элемент → поток `screenStreamRef` теперь отображается в чате под сообщениями
- ✅ Real-time сообщения: поллинг каждые 3 сек при открытом табе «Совещание» — получатель видит новые сообщения без каких-либо действий
- ✅ Supabase Realtime подписка на `messages` (INSERT) как дополнительный канал доставки
- Файлы: `enghub-main/src/pages/ConferenceRoom.tsx`, `enghub-main/src/App.tsx`

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

- Step: Подтверждено применение миграции `009_meetings_timelog.sql` в production Supabase: по результату SQL-проверки присутствуют таблицы `meetings` и `time_entries`.
- Files: `README.md`
- Validation: SQL verification in Supabase SQL Editor (`information_schema.tables` -> `meetings`, `time_entries`).
- Next: выполнить manual role-based smoke (`QA-GIP-01`, `QA-LEAD-01`, `QA-ENG-01`, `QA-DATA-01`) и обновить final sign-off до `approved`.

#### [2026-04-01 14:05] Production sign-off update
- Step: Заполнен `Production Sign-off Report` в `README` с фактическими `pass/fail` по SQL-checks и `QA-*` сценариям. Текущий итоговый статус: `blocked` до применения миграции `009` и ручного e2e прогона.
- Files: `README.md`
- Validation: not run (документационное обновление статуса sign-off).
- Next: применить `009_meetings_timelog.sql`, выполнить `QA-GIP-01/LEAD-01/ENG-01/DATA-01`, затем обновить report до `approved`.

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

### Production Sign-off (current state)

- DB migration `009_meetings_timelog.sql`: **PASS** (tables `meetings` and `time_entries` confirmed in production Supabase).
- Automated quality gates: **PASS** (`npm run build`, `CI=true npm test -- --watch=false` on latest code).
- Manual role-based QA:
  - `QA-GIP-01`: **FAIL** (Drawings/Meetings blocked)
  - `QA-LEAD-01`: **PASS** (Reviews/Assignments work)
  - `QA-ENG-01`: **FAIL** (Tasks/Meetings/Timelog blocked)
  - `QA-DATA-01`: **FAIL** (Persistence issues)
- Final decision: **BLOCKED** due to functional failures in core modules.

---

## ✅ Production Sign-off Report (Final Run: 2026-04-01)

- Environment: `production (enghub-three.vercel.app)`
- Date: `2026-04-01`
- Operator: `Antigravity AI`
- Final decision: **BLOCKED**

### SQL checks

| Check | Result | Notes |
|---|---|---|
| Tables `drawings/tasks/revisions/reviews/transmittals/transmittal_items` exist | `PASS` | Доступны через UI (вкладки/реестры) |
| `008_schema_hardening.sql` constraints confirmed | `PASS` | UI валидация по ролям работает частично |
| Tables `meetings/time_entries` from migration `009` | `PASS` | Таблицы подгружаются, но имеют проблемы с записью/Realtime |

### QA scenarios

| Scenario | Result | Notes |
|---|---|---|
| `QA-GIP-01` | `FAIL` | **Критическое**: Отсутствует кнопка "+ Чертеж", Совещание не отправляет сообщения |
| `QA-LEAD-01` | `PASS` | Замечания и Увязка работают; "+ Чертеж" виден (в отличие от ГИП) |
| `QA-ENG-01` | `FAIL` | Задачи не видны (пусто), Совещание не работает, Табель не сохраняет данные |
| `QA-DATA-01` | `FAIL` | **Критическое**: Сообщения и записи времени (Timelog) не сохраняются/не отображаются |

### Final decision

- Decision: `BLOCKED`
- Blocking reasons:
  1. **Совещание (Meetings)**: Полная неработоспособность отправки сообщений (остаются в input, не уходят в Supabase).
  2. **Табель (Timelog)**: Фиктивный успех записи времени (toast есть, данных в списке нет).
  3. **Ролевые права ГИП**: ГИП лишен возможности создавать чертежи (кнопка скрыта), хотя это его основная функция.
  4. **Видимость задач**: Инженеры и LEAD видят пустые списки задач при наличии проектов.
- Required to move to `approved`:
  - Исправить Realtime/Auth в модуле `messages` (Supabase 400/409 errors).
  - Исправить сохранение/отображение в `time_entries`.
  - Восстановить права ГИП на создание чертежей в `App.tsx` или `DrawingsTab`.

---

## EngHub Production QA Walkthrough (2026-04-01)

Comprehensive QA sign-off for the EngHub platform on the production environment (`https://enghub-three.vercel.app/`).

### Summary of Results

| Role | Status | Critical Issues |
|---|---|---|
| **GIP (Chief Engineer)** | **FAIL** | Drawing creation button missing; Meeting messages fail to send. |
| **LEAD (Dept Head)** | **PASS** | Visibility of Reviews/Assignments and Drawing creation confirmed. |
| **ENGINEER (Engineer)** | **FAIL** | Tasks not visible; Timelog persistence failure; Meeting messages fail. |

**Final Decision: BLOCKED**

### Verification Evidence

1. **GIP Role Failures**: GIP role could not find the `+ Чертеж` button in Drawings, while LEAD could.
2. **Meeting/Chat Failures**: messages from GIP and Engineer stayed in input and did not persist.
3. **Timelog Persistence Issue (Engineer)**: success toast shown, but entry missing in list.
4. **Lead Role Success**: LEAD created a remark and it persisted after refresh.

### Required Fixes

1. **Supabase Realtime/Auth**: resolve 400/409 errors for writes to `messages`.
2. **Permissions**: restore GIP ability to create drawings (`App.tsx` role rendering).
3. **Timelog**: debug writes/reads for `time_entries`.
4. **Task Visibility**: ensure engineers can see assigned tasks.

---

## 🌐 Ссылки

- **Live**: [https://enghub-three.vercel.app](https://enghub-three.vercel.app)
- **GitHub**: [andyrbek2709-tech/ai-institut](https://github.com/andyrbek2709-tech/ai-institut)
