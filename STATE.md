# STATE — EngHub

> Живой журнал. Обновляется при каждом значимом изменении. Источник правды между сессиями Claude.

## Текущее состояние

- **Прод:** https://enghub-three.vercel.app/ — последний успешный деплой `E5X9xDEy`
- **Стек:** React 18 + TypeScript (CRA), Vercel (monorepo: api/* serverless + src/), Supabase (Postgres + Auth + Realtime + Storage), LiveKit Cloud (видеовстречи)
- **Репо:** `andyrbek2709-tech/ai-institut`, ветка `main`
- **Последний рабочий коммит:** см. лог git
- **Vercel project id:** `prj_ZDihCpWH1AmIEPRebnOI7ST6d6nv` (team `team_o0boJNeRGftH6Cbi9byd0dbF`)
- **Supabase project id:** `jbdljdwlfimvmqybzynv`
- **Env (Vercel):** `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` + Supabase keys
- **Миграции БД:** до `018_video_meetings.sql` применены
- **Бэклог:** см. `enghub-main/TASKS.md` — приоритеты T1-T28

## Известные проблемы

### Блокеры (TASKS T1-T4)
- **T1.** Триггер `task_history` сломан: `column "field" of relation "task_history" does not exist` при INSERT в `tasks`. Без фикса задачи не создаются.
- **T2.** Возможный фантомный рассинхрон полей фронт/БД (`title/assignee_id` vs `name/assigned_to`) — проверить grep'ом.
- **T3.** RLS на таблице `tasks` под подозрением — нужен аудит политик.
- **T4.** LiveKit "Совещание" сразу выдаёт ошибку: "Не удалось создать или найти встречу" (даже сетевых запросов не делает).

### UX-блокеры из QA-обзора 2026-04-28 (TASKS T14-T16)
- **T14.** Мобильная версия: вкладки проекта уезжают в горизонтальный скролл без индикатора, прорабы на телефоне их не находят.
- **T15.** Нет ленты активности на дашборде — нельзя одним взглядом ответить "что изменилось с моего последнего входа".
- **T16.** Трансмиттал без поля "Получатель" + замечание без места в чертеже (лист/узел/ось) — это не полноценный документооборот.

### Важные баги (TASKS T5-T13, T17-T22)
- **T7.** `/api/orchestrator` возвращает 500, AI Copilot отдаёт мусор (`from_status/to_status` в user-facing response).
- **T8.** Multiple GoTrueClient instances detected — `createClient()` Supabase вызывается без синглтона.
- **T17-T19.** Tooltip на обрезанных именах проектов / иллюстрации в empty states / dropdown с деталями уведомлений.
- **T20-T22.** Статусная матрица задач непрозрачна / чертёж не показывает связанную задачу / нет аудита изменений проекта.

### Технический долг (TASKS T25-T27)
- **T25.** Polling каждую секунду — заменить на Supabase Realtime-подписки.
- **T26.** Технические строки ошибок видны пользователю — нужен error boundary + Sentry.
- **T27.** Нет offline-режима для работы инженеров на объектах.

### Прочее
- При прямой правке файлов через Cowork-маунт усекаются при коммите (наблюдалось на `supabase.ts`, `SpecificationsTab.tsx`, `specificationPayload.ts`). Все правки делать через клон `/tmp` или Cowork-dispatch → bash.
- Старая `ConferenceRoom.legacy.tsx` сохранена для отката LiveKit-видеовстреч.

## Следующие шаги

### Топ-3 для максимального эффекта (приоритет 1.5)
- [ ] T14 — Мобильная версия: фикс вкладок проекта на узких экранах (выпадающее меню или группировка).
- [ ] T15 — Лента активности на дашборде (агрегат `task_history` + `revisions` + `reviews` + `transmittals`).
- [ ] T16 — Получатель в трансмиттале + место в замечании (миграции + формы).

### Блокеры
- [ ] T1 — Починить триггер `task_history` в Supabase.
- [ ] T2 — grep на `title:` и `assignee_id` в `enghub-main/src/`, устранить если найдётся.
- [ ] T3 — Аудит RLS на `tasks`.
- [ ] T4 — Дебаг LiveKit endpoint, проверить env в Vercel.

### Дальше по списку
- См. полный TASKS.md, разделы "Приоритет 2" и "Приоритет 3".

## Последние изменения (новые сверху)

### 2026-04-28 03:15 — chore: внесён внешний QA-обзор в TASKS.md (T14-T28)
- **Что:** добавлены 15 новых задач от тестера-практика по категориям: разработка (3), дизайн/UX (4), инженерный процесс (5), повседневное использование (4). Топ-3 (моб. версия, лента активности, получатель в трансмиттале) выделены в приоритет 1.5.
- **Файлы:** `enghub-main/TASKS.md`, `STATE.md`.
- **Деплой:** не требуется, документация.
- **Почему:** чтобы дашборд `/status` сразу показывал актуальный набор проблем + список приоритетов; ночные сессии Claude видят TASKS.md в репо без cowork-маунта.

### 2026-04-28 — feat(status): дашборд `/status` интегрирован в owner-dashboard
- **Что:** в репо `owner-dashboard` (коммит `f93d9a0`) добавлена страница `apps/web/app/status/`, серверный эндпоинт `apps/web/app/api/state-md/route.ts` и пункт меню "Статус проектов". Подтягивает `STATE.md` из всех 7 репо через GitHub API раз в 5 мин.
- **Деплой:** ждёт настройки Vercel-проекта (Root Directory = `apps/web`, env `GITHUB_DASHBOARD_PAT`).

### 2026-04-27 18:42 — chore: добавлен STATE.md (память проекта)
- **Что:** введён единый протокол памяти через STATE.md в репо.

## Недавние коммиты (контекст до начала ведения STATE.md)

- `2b9e2df` fix: revert truncated specificationPayload.ts (orphan code at line 119) (2026-04-27 17:58)
- `b11e93b` fix: revert broken supabase.ts and SpecificationsTab.tsx from fd2e9ed (2026-04-27 17:24)
- `fd2e9ed` fix: add AbortSignal timeout to all API calls + implement pagination (2026-04-27 10:18)
