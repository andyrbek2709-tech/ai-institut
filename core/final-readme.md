# EngHub — Unified Final README

Актуальный сводный README по проекту EngHub, собранный из:
- `README.md`
- `enghub_functional_overview.md`
- `project_handover_report.md`
- `enghub-main/README.md`

Дата актуализации: `2026-04-15`

---

## 1) О проекте

**EngHub** — внутренняя инженерная платформа для управления проектами в проектном институте: задачи, чертежи, ревизии, замечания, трансмитталы, спецификации, совещания, табель, аналитика ГИПа, инженерные расчеты и AI Copilot с RAG.

Основная цель — перевести процессы из разрозненных Excel/чатов в единую ролевую систему с прозрачным workflow и данными, пригодными для контроля сроков и рисков.

---

## 2) Технологии

- **Frontend:** React 18 + TypeScript
- **Backend/API:** Vercel Serverless (`enghub-main/api/*`)
- **БД:** Supabase PostgreSQL + RLS + Realtime + Storage
- **AI:** Anthropic Claude (оркестратор), OpenAI embeddings (RAG)
- **RAG:** `pgvector` + семантический поиск
- **Инфра:** Vercel deployment, Supabase migrations/functions

---

## 3) Роли и права

- **ГИП (`gip`)** — полный контроль проекта, финальные проверки, аналитика, критические действия.
- **Руководитель отдела (`lead`)** — управление задачами отдела, ревью, увязки.
- **Инженер (`engineer`)** — работа по назначенным задачам, отчётность, выполнение.
- **Администратор (`admin`)** — управление пользователями и структурой.

AI-права ограничены по ролям: инженер не может выполнять опасные/административные apply-действия.

---

## 4) Ключевой функционал

### Управление проектами и задачами
- Проекты: создание, статусы, прогресс, фильтрация, архив.
- Канбан workflow:
  - `todo -> inprogress -> review_lead -> review_gip -> done`
  - ответвление: `revision`
- История изменений задач (`task_history`), шаблоны задач, DnD Kanban.

### Документооборот
- **Чертежи:** реестр, статусы, поиск, фильтры.
- **Ревизии:** выпуск и история `R0 -> R1 -> R2`.
- **Замечания:** severity `critical/major/minor`, треды обсуждений.
- **Трансмитталы:** выпуск комплектов с позициями и PDF-формами.
- **Спецификации (AGSK):** модуль с шаблонным экспортом Excel по ГОСТ.

### Совещания и коммуникации
- Realtime-чат в проекте.
- Протоколы совещаний + PDF-экспорт.
- Голосовые и screen-share сценарии (ConferenceRoom).
- Telegram-бот и уведомления (по текущей интеграции).

### Аналитика и планирование
- Gantt/Timeline.
- ГИП-дашборд (риски, S-curve, RACI, budget/time view, team load).
- Табель (`time_entries`) и сводки по сотрудникам/отделам.

### Инженерные расчёты
- 90+ расчетных шаблонов по дисциплинам.
- Конвертер единиц.
- Экспорт результатов в `.docx`.

### AI Copilot и RAG
- Оркестратор интентов/агентов:
  - `project_insights`
  - `smart_decompose`
  - `compliance_check`
  - `generate_report`
  - `rag_assistant`
- Поиск по нормативке через embeddings + `search_normative()` (pgvector).
- Защищенный apply-контур через `validateApplyAction`.

---

## 5) Структура репозитория (основное)

```text
/ (repo root)
├── final-readme.md                      # этот сводный документ
├── README.md                            # расширенный журнал/история
├── enghub_functional_overview.md
├── project_handover_report.md
├── supabase/
│   ├── migrations/*.sql
│   └── functions/vectorize-doc/index.ts
└── enghub-main/
    ├── api/
    │   ├── orchestrator.js
    │   ├── spec-export.js
    │   └── ...
    ├── src/
    │   ├── App.tsx
    │   ├── components/
    │   ├── pages/
    │   ├── api/supabase.ts
    │   └── copilot/validateApplyAction.ts
    ├── public/
    └── README.md
```

---

## 6) База данных и миграции

Базовые доменные таблицы:
- `projects`
- `tasks`
- `app_users`
- `drawings`
- `revisions`
- `reviews`
- `transmittals`
- `messages`
- `meetings`
- `time_entries`
- RAG и служебные таблицы миграций (`normative_*`, и др.)

Отдельно отмечалось обязательное применение миграций для production (например, `009_meetings_timelog.sql` в исторических этапах и последующих recovery-миграций).

---

## 7) Переменные окружения

Минимально необходимые:
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `REACT_APP_SUPABASE_SERVICE_KEY` (если используется в текущем контуре)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `OPENAI_API_KEY` (embeddings/RAG)
- `ANTHROPIC_API_KEY` (Copilot/агенты)

Дополнительно при включенных сценариях:
- `TELEGRAM_BOT_TOKEN`

---

## 8) Локальный запуск

```bash
cd enghub-main
npm install
npm start
```

Проверки:

```bash
npm run build
CI=true npm test -- --watch=false
```

---

## 9) Production и деплой

- Основной путь: push в `main` -> auto-deploy в Vercel.
- Исторически фиксировались кейсы `Deployment Blocked` по автору коммита (политики Vercel/GitHub identity). Для стабильности важно, чтобы коммиты/доступы соответствовали учеткам команды деплоя.

---

## 10) Текущее состояние (сводно)

По объединенному состоянию документов:
- Ключевые фазы функционального развития реализованы.
- Платформа содержит зрелый набор модулей для инженерного PM/документооборота.
- Периодически требовалась стабилизация production (миграции, Vercel-packaging, Realtime/UX фиксы).
- Самые частые зоны риска: экспорт спецификаций, conference realtime, согласованность данных после деплоя.

---

## 11) Рекомендации следующему разработчику

1. Перед работой синхронизировать `main` и проверить примененные SQL-миграции в целевой Supabase.
2. Любые изменения в `api/spec-export.js`, `ConferenceRoom.tsx`, `App.tsx` прогонять через build + smoke.
3. При изменении ролей и AI-action обязательно сверять `validateApplyAction` и UI-ограничения.
4. Документировать каждый логический блок изменений в основном `README.md` (handover/log).
5. Держать экспорт и шаблоны спецификаций в server-side контуре, не возвращая тяжелые Excel-зависимости во frontend.

---

## 12) Полезные ссылки

- Live: [https://enghub-three.vercel.app](https://enghub-three.vercel.app)
- Supabase Dashboard: [https://supabase.com/dashboard](https://supabase.com/dashboard)

---

Этот файл создан как единая, очищенная и актуализированная точка входа по проекту. Детальный журнал изменений и исторические нюансы сохраняются в `README.md` и профильных handover-документах.
