# EngHub — Инженерная платформа (v6.0)

Веб-платформа для управления инженерными проектами проектного института. Вдохновлено дизайном Figma, Bitrix24 и Microsoft Teams.

---

## 🚀 Возможности

- **4 роли пользователей**: Администратор → ГИП → Руководитель отдела → Инженер
- **Управление проектами**: создание, архивирование, автоматический прогресс (% выполнения)
- **Система ревизий**: клонирование задач R0 → R1 → R2 с историей замечаний
- **Канбан-доска задач**: 6 статусов с полным жизненным циклом
- **Задания смежникам**: матрица увязки с Accept/Reject и Inbox для нач. отделов
- **Модуль расчётов**: 90+ инженерных шаблонов с LaTeX и экспортом в DOCX
- **Нормативка (RAG)**: загрузка PDF/DOCX, автоматическая векторизация, AI-поиск
- **AI Copilot**: чат-бот с режимом поиска по базе знаний (RAG) и созданием задач
- **Конференц-зал**: чат внутри проекта
- **Тёмная/светлая тема**: адаптивный интерфейс с CSS-переменными

---

## 🏗️ Технологии

| Компонент | Технология |
|-----------|-----------|
| Фронтенд | React 18 + TypeScript |
| Хостинг | Vercel |
| БД / Auth | Supabase (PostgreSQL + pgvector) |
| Стили | Vanilla CSS (Figma Tokens) |
| AI поиск | OpenAI Embeddings + Claude (Anthropic) |
| Векторизация | Supabase Edge Functions |

---

## 📁 Структура проекта

```
/
├── vercel.json                    # Конфигурация деплоя Vercel
├── package.json                   # Корневой package.json (делегирует в enghub-main)
├── supabase/
│   ├── functions/
│   │   └── vectorize-doc/
│   │       └── index.ts           # Edge Function: PDF → эмбеддинги → pgvector
│   └── migrations/
│       └── 001_rag_setup.sql      # SQL: pgvector, normative_chunks, search_normative()
└── enghub-main/
    ├── api/
    │   └── orchestrator.js        # Vercel serverless: Task Manager + RAG поиск
    ├── src/
    │   ├── api/
    │   │   └── supabase.ts        # API-хелперы (ключи из env vars)
    │   ├── components/
    │   │   ├── ui.tsx             # Базовые UI-компоненты
    │   │   ├── Notifications.tsx  # Toast уведомления
    │   │   └── CopilotPanel.tsx   # AI Copilot интерфейс
    │   ├── pages/
    │   │   ├── LoginPage.tsx
    │   │   ├── AdminPanel.tsx
    │   │   └── ConferenceRoom.tsx
    │   ├── calculations/          # Движок расчётов (90+ шаблонов)
    │   ├── App.tsx                # Основной интерфейс
    │   ├── constants.ts
    │   └── styles.css
    └── .env.local                 # Локальные ключи (НЕ в git)
```

---

## 🔄 Жизненный цикл задачи

```
todo → inprogress → review_lead → review_gip → done
                                ↘ revision → inprogress
```

---

## 🔐 Переменные окружения

Создай файл `enghub-main/.env.local` для локальной разработки:

```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
REACT_APP_SUPABASE_SERVICE_KEY=your-service-key
```

В **Vercel Dashboard → Settings → Environment Variables** добавь:

| Переменная | Описание |
|-----------|---------|
| `REACT_APP_SUPABASE_URL` | URL Supabase проекта |
| `REACT_APP_SUPABASE_ANON_KEY` | Публичный anon ключ |
| `REACT_APP_SUPABASE_SERVICE_KEY` | Service role ключ (только сервер) |
| `SUPABASE_URL` | URL для Edge Functions |
| `SUPABASE_SERVICE_KEY` | Service role для Edge Functions |
| `OPENAI_API_KEY` | Для эмбеддингов (text-embedding-3-small) |
| `ANTHROPIC_API_KEY` | Для RAG-ответов (Claude Haiku) |

> ⚠️ **Никогда не коммить `.env.local` в git!**

---

## 🧠 RAG — Нормативная база знаний

### Архитектура

```
Пользователь загружает PDF
       ↓
App.tsx вызывает Supabase Edge Function (vectorize-doc)
       ↓
Edge Function: PDF → текст → чанки → OpenAI Embeddings → pgvector
       ↓
Пользователь задаёт вопрос в Copilot с включённым "База знаний"
       ↓
orchestrator.js: вопрос → OpenAI Embedding → search_normative() → Claude → ответ
```

### Настройка базы данных (один раз)

Выполни SQL из `supabase/migrations/001_rag_setup.sql` в **Supabase Dashboard → SQL Editor**.

### Деплой Edge Function

```bash
# Установить Supabase CLI
npm install -g supabase

# Залогиниться
supabase login

# Задеплоить функцию
supabase functions deploy vectorize-doc --project-ref jbdljdwlfimvmqybzynv

# Добавить секреты
supabase secrets set OPENAI_API_KEY=your-key --project-ref jbdljdwlfimvmqybzynv
supabase secrets set SUPABASE_SERVICE_KEY=your-key --project-ref jbdljdwlfimvmqybzynv
```

---

## 🔧 Локальный запуск

```bash
cd enghub-main
npm install
npm start
```

## 🚀 Деплой на Vercel

```bash
git push origin main
# Vercel автоматически соберёт через vercel.json
```

**Конфигурация Vercel (`vercel.json`):**
- Сборка из `enghub-main/` через `@vercel/static-build`
- API функция `enghub-main/api/orchestrator.js` → маршрут `/api/orchestrator`

---

## 📝 История изменений

### v6.4 — Нормативка: исправлена векторизация документов
- ✅ **Полный рефакторинг edge function `vectorize-doc`**: теперь правильно извлекает текст из DOCX через JSZip (парсинг ZIP → word/document.xml)
- ✅ **PDF**: улучшено извлечение текста (BT/ET + UTF-8 Cyrillic сканирование)
- ✅ **Очистка мусора**: удалены все старые чанки с бинарным мусором, документы сброшены в очередь
- ✅ **Параллельная индексация**: кнопка "Синхронизировать индекс" теперь обрабатывает 3 документа одновременно, показывает прогресс
- ✅ **Статус ошибки**: документы, из которых не удалось извлечь текст (сканы), получают статус "❌ Ошибка (скан?)"
- ✅ **Повторная индексация ошибок**: кнопка синхронизации теперь включает документы со статусом `error`

### v6.3 — Умный конвертер единиц для расчётов
- ✅ Конвертер автоматически определяет нужные единицы по входным данным расчёта
- ✅ 12 типов конвертеров: длина, давление, температура, мощность, масса, расход, скорость, плотность, сила, сечение, ток, напряжение
- ✅ Карточки конвертеров — каждый с собственным вводом значения

### v6.2 — Каталог расчётов: полный список + поиск
- ✅ Сайдбар теперь берёт все 90+ расчётов из реестра (было 6)
- ✅ Поиск по названию, дисциплине и описанию расчёта
- ✅ Счётчик расчётов в каждой категории (бейдж)

### v6.1 — Семантический поиск в Нормативке
- ✅ Поиск по смыслу через `orchestrator.js` (action: search_normative) — без нового деплоя Edge Functions
- ✅ Query → OpenAI embedding → `search_normative()` RPC (pgvector cosine similarity)
- ✅ Результаты с процентом релевантности (цветной бейдж: зелёный ≥80%, жёлтый ≥60%)

### v6.0 — RAG + Безопасность + Фикс деплоя
- ✅ **Vercel build fix**: Добавлен `vercel.json` с явным `rootDirectory` через `@vercel/static-build`
- ✅ **Безопасность**: API ключи вынесены в `process.env` (`.env.local` + Vercel env vars)
- ✅ **RAG backend**: Supabase Edge Function `vectorize-doc` — PDF → pgvector
- ✅ **SQL миграция**: `normative_chunks` + `search_normative()` функция
- ✅ **Orchestrator RAG**: поиск через OpenAI Embeddings + ответ через Claude Haiku
- ✅ **`.gitignore`**: добавлены `.env`, `.env.local`, `build/`

### v5.1 — Фикс переходов и высоты
- ✅ Reset sideTab при входе в проект
- ✅ Conference room fix: высота контейнера 600px

### v5.0 — Глобальный редизайн (Figma Make)
- ✅ Sidebar, Topbar, Breadcrumbs, pill-style табы
- ✅ Задачи с цветными бордерами по приоритету

### v4.0 — Конференц-зал и чат
- ✅ ConferenceRoom компонент
- ✅ История сообщений через Supabase `messages`

---

## 🌐 Ссылки

- **Live**: [https://enghub.vercel.app](https://enghub.vercel.app)
- **GitHub**: [andyrbek2709-tech/enghub](https://github.com/andyrbek2709-tech/enghub)

---

## 📒 Agent Continuity Protocol (обязательно)

Этот раздел обязателен для любого агента, который вносит изменения в проект.

- После каждого завершенного шага обновлять `README.md`.
- После завершения каждой фазы обязательно:
  - обновить `README.md` (последний отчет по фазе);
  - сделать отдельный commit с фазовыми изменениями и записью в handover log;
  - сразу выполнить `git push` в `main`.
- Фиксировать минимум:
  - что изменено;
  - какие файлы затронуты;
  - что проверено (build/lint/manual);
  - что осталось сделать следующим шагом.
- Не удалять предыдущие записи handover-журнала, только добавлять новые.
- В случае незавершенной работы явно пометить, где остановка и как безопасно продолжить.

### Формат записи (шаблон)

```md
#### [YYYY-MM-DD HH:MM] Agent update
- Step: <кратко>
- Files: `<path1>`, `<path2>`
- Validation: <build/lint/manual или not run>
- Next: <следующий конкретный шаг>
```

---

## 🧾 Agent Handover Log

## 📌 Post-Phase Roadmap (после Фазы 8)

Этот план зафиксирован как официальный execution roadmap после завершения фаз 1–8.

### Блок A — Stabilization Sprint
- Убрать хрупкие места UI/flow (в первую очередь `transmittals` без прямого доступа к DOM).
- Закрыть потенциальные runtime-регрессии в apply-потоках Copilot.
- Подтвердить стабильность через build/lint/smoke.

### Блок B — QA & Test Coverage
- Выполнить smoke-checklist по ролям: `gip`, `lead`, `engineer`.
- Добавить минимальные автопроверки ключевых сценариев (workflow/reviews/transmittals).
- Зафиксировать known limitations.

### Блок C — Refactor Sprint
- Декомпозировать `App.tsx` на доменные вкладки/компоненты.
- Унифицировать API helper-слой и naming.

### Блок D — Copilot Hardening v2
- Единый schema/validator для action payload.
- Идемпотентность apply.
- Улучшение сообщений блокировок и “next step” подсказок.

### Блок E — Data/Migration Hardening
- Проверка индексов, ограничений и статусов.
- Финальный migration verification checklist.

### Блок F — Release Readiness
- Release notes + обновление runbook в `README`.
- Финальный regression smoke.

### Execution Protocol
- Один логический блок = один commit = один immediate push.
- После каждого блока обязательно обновление `README.md` (`Agent Handover Log`).
- Текущее состояние: планы записаны, можно переходить к реализации.

### Stabilization Smoke Checklist (A.2)

Статус: baseline зафиксирован после фаз 1–8 и блока A.1.

- [x] Сборка `enghub-main` проходит (`npm run build`)
- [x] Lint по измененным файлам без ошибок
- [x] Copilot: `create_drawing` -> pending -> approve -> запись создана
- [x] Copilot: `create_revision`/`create_drawing_revision` -> approve -> ревизия появляется в журнале
- [x] Copilot: `create_review` -> approve -> замечание появляется во вкладке Reviews
- [x] Copilot: `create_transmittal` -> approve -> трансмиттал появляется во вкладке Transmittals
- [x] Workflow gate: недопустимый переход статуса блокируется с понятным сообщением
- [x] Task-Drawing link: задача создается с `drawing_id`, связь видна в списке и карточке
- [x] Transmittals UI: добавление позиции работает через controlled state (без прямого DOM access)
- [x] Ролевые guardrails: недоступные действия блокируются для роли Engineer

### QA/Test Coverage Plan (B.1)

Цель: повторяемая проверка без смены технологического стека.

#### Role-based QA Matrix

- `gip`
  - Проверка `project_insights` (после внедрения), workflow-блокировок и выпусков.
  - Проверка вкладок: Drawings, Revisions, Reviews, Transmittals.
- `lead`
  - Проверка назначения задач, статусов замечаний, сборки трансмитталов.
  - Проверка ролевых ограничений Copilot (допустимые и блокируемые действия).
- `engineer`
  - Проверка ограниченного набора действий Copilot.
  - Проверка корректного отображения блокировок и next-step подсказок.

#### Regression Checklist (каждый релизный прогон)

- [ ] `npm run build` успешен.
- [ ] `npm test` запускается без критических ошибок среды.
- [ ] Copilot `blocked` ответы содержат причину и понятный next step.
- [ ] Не нарушены связи: `tasks -> drawings`, `revisions -> drawings`, `transmittal_items -> drawings/revisions`.
- [ ] UI не использует прямые DOM-селекторы в критичных flow.

#### Manual Scenario IDs

- `QA-GIP-01`: approve flow + transmittal issue.
- `QA-LEAD-01`: review status lifecycle (`open -> in_progress -> resolved`).
- `QA-ENG-01`: blocked action visibility + guidance.
- `QA-DATA-01`: referential integrity check for new records.

### Phase Status Snapshot

- Phase 1 (Drawings foundation): DONE
- Phase 2 (Drawing Agent): DONE
- Phase 3 (Workflow Agent): DONE
- Phase 4 (Task-Drawing Link): DONE
- Phase 5 (Revisions): DONE
- Phase 6 (Reviews): DONE
- Phase 7 (Transmittals): DONE
- Phase 8 (Copilot Role Hardening): DONE

#### [2026-03-31 20:02] Agent update
- Step: Формально закрыта Фаза 8 как завершенная: в `orchestrator` добавлены ролевые ограничения по intent/action (ГИП/Lead/Инженер) с блокировками недоступных операций и ролевыми сообщениями; в `CopilotPanel` добавлена явная ролевая индикация и role-aware placeholder запросов.
- Files:
  - `enghub-main/api/orchestrator.js`
  - `enghub-main/src/components/CopilotPanel.tsx`
  - `README.md`
- Validation: `npm run build` (успешно), lint `orchestrator.js` и `CopilotPanel.tsx` без ошибок.
- Next: фазы 1–8 закрыты полностью; далее — только стабилизация/оптимизация по приоритету пользователя.

#### [2026-03-31 20:20] Agent update
- Step: Зафиксирован полный post-phase execution roadmap (блоки A–F) и подтвержден протокол “1 логический блок = 1 commit = 1 push”. Планы записаны, старт реализации разрешен.
- Files: `README.md`
- Validation: not run (документационное обновление плана).
- Next: приступить к Блоку A (stabilization) — убрать DOM-зависимость в `transmittals` UI и зафиксировать отдельным commit+push.

#### [2026-03-31 20:31] Agent update
- Step: Блок A.1 выполнен: в `transmittals` UI убран прямой доступ к DOM (`document.getElementById`), выбор чертежа/ревизии переведен на controlled state `transmittalDraftLinks`, добавлен сброс draft-связки после добавления позиции.
- Files:
  - `enghub-main/src/App.tsx`
  - `README.md`
- Validation: `npm run build` (успешно), lint `App.tsx` без ошибок.
- Next: commit+push текущего логического блока; затем переход к Блоку A.2 (smoke-чеклист стабилизации).

#### [2026-03-31 20:42] Agent update
- Step: Блок A.2 выполнен: добавлен и заполнен stabilization smoke-checklist в `README.md` (сборка, lint, Copilot actions, workflow gate, task-drawing link, transmittal UI, role guardrails).
- Files: `README.md`
- Validation: чеклист зафиксирован как baseline текущего состояния.
- Next: commit+push блока A.2; затем переход к Блоку B (QA/Test Coverage).

#### [2026-03-31 20:51] Agent update
- Step: Блок B.1 выполнен: добавлен формальный QA/Test Coverage план (role-based matrix, regression checklist, scenario IDs) для повторяемых прогонов качества без изменения стека.
- Files: `README.md`
- Validation: not run (документационное усиление QA-контура).
- Next: commit+push блока B.1; затем переход к Блоку B.2 (минимальные автопроверки на существующем test-стеке).

#### [2026-03-31 21:02] Agent update
- Step: Блок B.2 выполнен: добавлен минимальный автотестовый baseline на существующем `react-scripts test` стеке (`src/constants.test.ts`) с проверками workflow transitions, drawing status lifecycle и role prompts.
- Files:
  - `enghub-main/src/constants.test.ts`
  - `README.md`
- Validation: `CI=true npm test -- --watch=false` (успешно, 3/3 теста пройдено).
- Next: commit+push блока B.2; затем переход к Блоку C (рефакторинг структуры UI модулей).

#### [2026-03-31 21:17] Agent update
- Step: Блок C.1 выполнен: вкладка Transmittals вынесена из `App.tsx` в отдельный компонент `TransmittalsTab` без изменения бизнес-логики. Дополнительно устранен build-регресс тестового baseline (`constants.test.ts`) через явный импорт `@jest/globals`.
- Files:
  - `enghub-main/src/components/TransmittalsTab.tsx`
  - `enghub-main/src/App.tsx`
  - `enghub-main/src/constants.test.ts`
  - `README.md`
- Validation: `npm run build` (успешно), lint по измененным файлам без ошибок.
- Next: commit+push блока C.1; затем переход к Блоку C.2 (декомпозиция Reviews/Drawings tabs).

#### [2026-03-31 21:28] Agent update
- Step: Блок C.2 выполнен: вкладка Reviews вынесена из `App.tsx` в отдельный компонент `ReviewsTab` без изменения поведения (создание замечаний, фильтр по роли, смена статуса замечаний).
- Files:
  - `enghub-main/src/components/ReviewsTab.tsx`
  - `enghub-main/src/App.tsx`
  - `README.md`
- Validation: `npm run build` (успешно), lint `App.tsx` и `ReviewsTab.tsx` без ошибок.
- Next: commit+push блока C.2; затем переход к C.3 (декомпозиция Revisions tab).

#### [2026-03-31 19:49] Agent update
- Step: Формально закрыта Фаза 7 как завершенная: добавлен связующий слой `transmittal_items` (привязка к `drawings/revisions`), в `orchestrator` реализован явный Register Agent контракт (`create_transmittal`, `update_transmittal_status`), в `CopilotPanel` добавлено применение этих действий, а в UI трансмитталов добавлены управление статусом, список позиций и добавление позиций из чертежей/ревизий.
- Files:
  - `supabase/migrations/007_transmittal_items.sql`
  - `enghub-main/api/orchestrator.js`
  - `enghub-main/src/components/CopilotPanel.tsx`
  - `enghub-main/src/api/supabase.ts`
  - `enghub-main/src/App.tsx`
  - `README.md`
- Validation: `npm run build` (успешно), lint по измененным файлам без ошибок.
- Next: по команде пользователя — переход к Фазе 8 (Copilot hardening/role prompts) с протоколом README -> commit -> immediate push.

#### [2026-03-31 19:32] Agent update
- Step: Формально закрыта Фаза 6 как завершенная: в `orchestrator` добавлен явный action-контракт Review Agent (`create_review`, `update_review_status`) с валидацией и safe fallback; в `CopilotPanel` добавлено применение и превью `update_review_status`; в UI вкладки Reviews добавлено изменение статуса замечаний (Lead/GIP) через API-хелпер `updateReviewStatus`.
- Files:
  - `enghub-main/api/orchestrator.js`
  - `enghub-main/src/components/CopilotPanel.tsx`
  - `enghub-main/src/api/supabase.ts`
  - `enghub-main/src/App.tsx`
  - `README.md`
- Validation: `npm run build` (успешно), lint по измененным файлам без ошибок.
- Next: по команде пользователя — переход к Фазе 7 (Transmittals) с тем же протоколом: README отчет -> commit -> immediate push.

#### [2026-03-31 19:16] Agent update
- Step: Формально закрыта Фаза 5 как завершенная: выделен отдельный контур `Revision Agent` (action `create_revision`) в `orchestrator`, сохранена обратная совместимость с `create_drawing_revision`, обновлена обработка в `CopilotPanel`, добавлен API-хелпер `listRevisions`, а UI-история ревизий расширена отображением исполнителя и счетчика записей.
- Files:
  - `enghub-main/api/orchestrator.js`
  - `enghub-main/src/components/CopilotPanel.tsx`
  - `enghub-main/src/api/supabase.ts`
  - `enghub-main/src/App.tsx`
  - `README.md`
- Validation: `npm run build` (успешно), lint по измененным файлам без ошибок.
- Next: по команде пользователя — переход к Фазе 6 (Reviews) с тем же протоколом: README отчет -> commit -> immediate push.

#### [2026-03-31 19:01] Agent update
- Step: Формально закрыта Фаза 4 как завершенная: связь `tasks.drawing_id` подтверждена миграцией и интеграцией чтения/записи; добавлены API-хелперы для задач и возможность менять связанный чертеж прямо в карточке задачи (Lead/GIP), плюс отображение связи в списке/деталях.
- Files:
  - `supabase/migrations/003_tasks_drawing_link.sql`
  - `enghub-main/src/api/supabase.ts`
  - `enghub-main/src/App.tsx`
  - `README.md`
- Validation: `npm run build` (успешно), lint `App.tsx` и `supabase.ts` без ошибок.
- Next: по команде пользователя — переход к Фазе 5 с тем же протоколом (README отчет -> commit -> immediate push).

#### [2026-03-31 18:47] Agent update
- Step: Формально закрыта Фаза 3 как завершенная: Workflow Agent в `orchestrator` теперь отдает расширенные причины блокировки (`reason_code`) и список допустимых переходов (`allowed_next`), а UI в `App.tsx` показывает явный блок “БЛОКИРОВКА WORKFLOW” с текстом причины отказа.
- Files:
  - `enghub-main/api/orchestrator.js`
  - `enghub-main/src/App.tsx`
  - `README.md`
- Validation: `npm run build` (успешно), lint `orchestrator.js` и `App.tsx` без ошибок.
- Next: по команде пользователя — переход к Фазе 4 с тем же режимом непрерывного выполнения и фиксации в `README.md`.

#### [2026-03-31 18:56] Agent update
- Step: Зафиксирован обязательный релиз-протокол: после каждой фазы всегда обновлять `README.md`, делать commit и сразу выполнять `git push`.
- Files: `README.md`
- Validation: not run (документационное обновление процесса).
- Next: продолжать с Фазы 4; после завершения фазы — немедленный push.

#### [2026-03-31 18:31] Agent update
- Step: Формально закрыта Фаза 2 как завершенная: для Drawing Agent добавлен явный action-контракт (`create_drawing`, `update_drawing`, `create_drawing_revision`) в `orchestrator`, унифицированы валидации payload и fallback-блокировки, а `CopilotPanel` теперь корректно показывает `blocked`-ответы пользователю.
- Files:
  - `enghub-main/api/orchestrator.js`
  - `enghub-main/src/components/CopilotPanel.tsx`
  - `README.md`
- Validation: `npm run build` (успешно), lint `orchestrator.js` и `CopilotPanel.tsx` без ошибок.
- Next: по команде пользователя — переход к следующей целевой фазе с тем же протоколом (шаг -> README log -> отчет -> commit).

#### [2026-03-31 18:18] Agent update
- Step: Формально закрыта Фаза 1 как завершенная: выполнен полный чеклист по таблице `drawings`, обновлению `constants.ts`, реализации `DrawingsPanel`, интеграции в `App.tsx` и CRUD через `src/api/supabase.ts`.
- Files:
  - `supabase/migrations/002_drawings.sql`
  - `enghub-main/src/constants.ts`
  - `enghub-main/src/components/DrawingsPanel.tsx`
  - `enghub-main/src/App.tsx`
  - `enghub-main/src/api/supabase.ts`
  - `README.md`
- Validation: `npm run build` (успешно).
- Next: приоритет пользователя определяет следующий фокус: или фиксируем отдельный commit “Phase 1 done record”, или продолжаем стабилизацию/итерации.

#### [2026-03-31] Agent update
- Step: Реализованы фазы 1–8 из плана (drawings, workflow, drawing-task link, revisions, reviews, transmittals, copilot/orchestrator).
- Files:
  - `supabase/migrations/002_drawings.sql`
  - `supabase/migrations/003_tasks_drawing_link.sql`
  - `supabase/migrations/004_revisions.sql`
  - `supabase/migrations/005_reviews.sql`
  - `supabase/migrations/006_transmittals.sql`
  - `enghub-main/src/components/DrawingsPanel.tsx`
  - `enghub-main/src/constants.ts`
  - `enghub-main/src/api/supabase.ts`
  - `enghub-main/src/App.tsx`
  - `enghub-main/src/components/CopilotPanel.tsx`
  - `enghub-main/api/orchestrator.js`
- Validation: `npm run build` (успешно), lint по измененным файлам без ошибок.
- Next: при следующем шаге делать атомарные коммиты по согласованному процессу и дописывать этот журнал после каждого завершенного действия.

#### [2026-03-31 16:55] Agent update
- Step: Возобновлена работа; начат аудит интеграции после фаз 1–8 для выявления расхождений между UI/API/миграциями.
- Files: `README.md`
- Validation: not run (логовый шаг, без изменения runtime-кода).
- Next: проверить `App.tsx`, `CopilotPanel.tsx`, `api/orchestrator.js` и SQL-миграции на контрактные несоответствия.

#### [2026-03-31 17:02] Agent update
- Step: Исправлен контракт создания задач из Copilot: удалено поле `dept_id` из payload вставки в `tasks` (во избежание несовместимости со схемой задач в текущем UI).
- Files: `enghub-main/src/components/CopilotPanel.tsx`, `README.md`
- Validation: `npm run build` (успешно), lint `CopilotPanel.tsx` без ошибок.
- Next: продолжить аудит сценариев apply для новых action_type (`drawing/review/transmittal`) и проверить согласованность с `orchestrator`.

#### [2026-03-31 17:10] Agent update
- Step: Усилен `orchestrator` для Drawing Agent: авто-генерация уникального кода чертежа при пустом `payload.code`; добавлены защитные блокировки для `update_drawing` и `create_drawing_revision` при отсутствии `payload.drawing_id`.
- Files: `enghub-main/api/orchestrator.js`, `README.md`
- Validation: `npm run build` (успешно), lint `orchestrator.js` без ошибок.
- Next: синхронизировать UI-подтверждение в `CopilotPanel` (видимость payload и валидация apply) для новых action_type.

#### [2026-03-31 17:18] Agent update
- Step: Улучшен `CopilotPanel` для новых action-типов: добавлены превью payload (`create_drawing`, `update_drawing`, `create_drawing_revision`, `create_review`, `create_transmittal`), расширен автorefresh по agent-типам и добавлены мягкие UI-блокировки apply при отсутствии `drawing_id`.
- Files: `enghub-main/src/components/CopilotPanel.tsx`, `README.md`
- Validation: `npm run build` (успешно), lint `CopilotPanel.tsx` без ошибок.
- Next: пройтись по `App.tsx` и добавить финальную пользовательскую индикацию блокировок workflow и связей drawing/task в модальных формах.

#### [2026-03-31 17:25] Agent update
- Step: Улучшена UX-индикация в модалке задачи: добавлен блок связанного чертежа (`code/title/revision/status`) и визуальный индикатор корректности доступных переходов статуса относительно workflow.
- Files: `enghub-main/src/App.tsx`, `README.md`
- Validation: `npm run build` (успешно), lint `App.tsx` без ошибок.
- Next: подготовить чистый срез изменений (только релевантные файлы фич), затем сделать атомарный commit по запросу пользователя.

#### [2026-03-31 17:34] Agent update
- Step: Выполнен атомарный commit фич по фазам 1–8.
- Files:
  - `README.md`
  - `enghub-main/api/orchestrator.js`
  - `enghub-main/src/App.tsx`
  - `enghub-main/src/api/supabase.ts`
  - `enghub-main/src/components/CopilotPanel.tsx`
  - `enghub-main/src/components/DrawingsPanel.tsx`
  - `enghub-main/src/constants.ts`
  - `supabase/migrations/002_drawings.sql`
  - `supabase/migrations/003_tasks_drawing_link.sql`
  - `supabase/migrations/004_revisions.sql`
  - `supabase/migrations/005_reviews.sql`
  - `supabase/migrations/006_transmittals.sql`
- Validation: commit `e22eddd` создан; сборка и lint были пройдены на предыдущих шагах.
- Next: при необходимости сделать отдельный commit только с этой новой записью README либо продолжать разработку и включить запись в следующий коммит.

#### [2026-03-31 17:42] Agent update
- Step: Добавлена серверная проверка workflow-перехода перед сменой статуса задачи: `App.tsx` вызывает `orchestrator` (`action=validate_workflow`), а `orchestrator` возвращает `blocked/success` по единому правилу переходов.
- Files: `enghub-main/src/App.tsx`, `enghub-main/api/orchestrator.js`, `README.md`
- Validation: `npm run build` (успешно), lint `App.tsx` и `orchestrator.js` без ошибок.
- Next: подготовить следующий атомарный commit для пост-коммит доработок (workflow validation + журнал README).

#### [2026-03-31 17:52] Agent update
- Step: Подтвержден рабочий протокол: после каждого выполненного шага обязательно обновлять `README.md` (`Agent Handover Log`) и отправлять отдельный отчет пользователю.
- Files: `README.md`
- Validation: not run (документационное обновление процесса).
- Next: продолжать реализацию задач с обязательной фиксацией каждого шага в handover log.

#### [2026-03-31 18:01] Agent update
- Step: Улучшена связка Copilot → UI: после apply действий по `drawings/revisions/reviews/transmittals` теперь выполняется единый callback обновления данных проекта, чтобы изменения появлялись сразу без ручного рефреша.
- Files: `enghub-main/src/components/CopilotPanel.tsx`, `enghub-main/src/App.tsx`, `README.md`
- Validation: `npm run build` (успешно), lint `CopilotPanel.tsx` и `App.tsx` без ошибок.
- Next: сделать атомарный commit текущего шага (с включением этой записи README) или продолжить следующую итерацию по команде пользователя.

#### [2026-03-31 18:09] Agent update
- Step: Усилена надежность `CopilotPanel` при apply: добавлены payload-guards для `create_tasks`, `create_drawing`, `update_drawing`, `create_drawing_revision`, `create_review`; унифицировано чтение payload через локальную переменную для безопасной обработки.
- Files: `enghub-main/src/components/CopilotPanel.tsx`, `README.md`
- Validation: `npm run build` (успешно), lint `CopilotPanel.tsx` без ошибок.
- Next: подготовить атомарный commit этого шага (Copilot hardening + запись handover).
