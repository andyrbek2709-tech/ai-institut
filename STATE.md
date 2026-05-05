# STATE — EngHub

> Живой журнал. Обновляется при каждом значимом изменении. Источник правды между сессиями Claude.

## Текущее состояние

- **AdIntakeBot (исходники):** `ad-intake-bot/` в этом репо — зеркало разработки с `D:\AdIntakeBot`; прод на Railway; **канон URL/БД/скриптов:** `ad-intake-bot/docs/PRODUCTION_CURRENT.md` (Supabase бота **`pbxzxwskhuzaojphkeet`**, не путать с EngHub **`jbdljdwlfimvmqybzynv`** ниже).
- **Прод:** https://enghub-three.vercel.app/ — последний успешный деплой `E5X9xDEy`
- **Стек:** React 18 + TypeScript (CRA), Vercel (monorepo: api/* serverless + src/), Supabase (Postgres + Auth + Realtime + Storage), LiveKit Cloud (видеовстречи)
- **Репо:** `andyrbek2709-tech/ai-institut`, ветка `main`
- **Последний рабочий коммит:** см. лог git
- **Vercel project id:** `prj_ZDihCpWH1AmIEPRebnOI7ST6d6nv` (team `team_o0boJNeRGftH6Cbi9byd0dbF`)
- **Supabase project id:** `jbdljdwlfimvmqybzynv`
- **Env (Vercel):** `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` + Supabase keys (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`). Старая `REACT_APP_SUPABASE_SERVICE_KEY` подлежит удалению (см. чеклист в BUG_FIX_PLAN_2026-04-29.md).
- **Миграции БД:** последняя — `023_email_case_insensitive_rls_helpers` (после `022_tasks_insert_engineer_assignment` и `021_fix_tasks_parent_task_id_bigint`).
- **Архитектурные документы:** `/core/system-orchestrator.md` (650+ строк: роль оркестратора, события, триггеры, логика блокировок, дедлайны, масштабируемость) и `/infra/api-contract.md` (1600+ строк: сущности, endpoints, payload примеры, WebSocket, валидация) — готовы для реализации backend.
- **Бэклог:** см. `enghub-main/TASKS.md` — приоритеты T1-T28

## Тестовые учётки (актуально на 2026-04-30)

**Массовый сброс паролей выполнен 2026-04-30 07:01 UTC.** Все 50 пользователей (КРОМЕ `admin@enghub.com`) имеют единый пароль `123456`. Сброс через `UPDATE auth.users SET encrypted_password = crypt('123456', gen_salt('bf'))`.

Полный список — `enghub-main/TESTING_USERS.md`.

Рекомендованные для QA-прогона:
- **Admin:** `admin@enghub.com` (пароль не менялся, использовать действующий)
- **GIP:** `skorokhod.a@nipicer.kz` / `123456`
- **Lead ЭС:** `pravdukhin.a@nipicer.kz` / `123456`
- **Engineer ЭС:** `troshin.m@nipicer.kz` / `123456`
- **Lead АК:** `bordokina.o@nipicer.kz` / `123456`
- **Engineer АК:** `gritsenko.a@nipicer.kz` / `123456`

## Известные проблемы

### Блокеры
_Все блокеры закрыты к 2026-04-30 (T1 task_history триггер, T3 RLS-аудит → миграции 019..023, T4 LiveKit, T8 GoTrueClient — закрыты)._

### UX-блокеры из QA-обзора 2026-04-28 (TASKS T14-T16)
- **T14.** Мобильная версия: вкладки проекта уезжают в горизонтальный скролл без индикатора, прорабы на телефоне их не находят.
- **T15.** Нет ленты активности на дашборде — нельзя одним взглядом ответить "что изменилось с моего последнего входа".
- **T16.** Трансмиттал без поля "Получатель" + замечание без места в чертеже (лист/узел/ось) — это не полноценный документооборот.

### Важные баги (TASKS T5-T13, T17-T22)
- **T7.** `/api/orchestrator` возвращает 500, AI Copilot отдаёт мусор (`from_status/to_status` в user-facing response).
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

### Текущая работа (2026-05-05)
- **В процессе:** Backend-разработка по контрактам `/core/system-orchestrator.md` и `/infra/api-contract.md`.
- **Очередь:** Реализация Redis Streams / Kafka для асинхронного оркестратора, WebSocket-реализация в Node/Express, тестирование event-driven цепочек (engineer → submit → lead → comment → GIP → approve → auto-unblock).

### Топ-3 для максимального эффекта (приоритет 1.5)
- [ ] T14 — Мобильная версия: фикс вкладок проекта на узких экранах (выпадающее меню или группировка).
- [ ] T15 — Лента активности на дашборде (агрегат `task_history` + `revisions` + `reviews` + `transmittals`).
- [ ] T16 — Получатель в трансмиттале + место в замечании (миграции + формы).

### Дальше по списку
- См. полный TASKS.md, разделы "Приоритет 2" и "Приоритет 3".

## Последние изменения (новые сверху)

### 2026-05-05 16:30 UTC — ARCH: System Orchestrator и API Contract — готовы к реализации

Завершены два ключевых архитектурных документа для backend-команды:

**`/core/system-orchestrator.md`** (650+ строк):
- Роль: управление конвейером задач в реальном времени (event-driven pattern).
- События: 13 пользовательских + 9 системных (deadline_approaching_2d, blocking_24h, escalation_48h, etc.).
- Триггеры: 8 бизнес-логик (create task → auto-assign deps, submit → can't skip to review, return → reason required, etc.).
- Блокировки: когда блокируются (dependent task creation), когда разблокируются (auto on dep resolve или manual by ГИП).
- Дедлайны: часовой мониторинг с эскалацией (yellow -2d → red -1d → black overdue), уведомления в Telegram/in-app.
- Эскалация: laddered alerts на non-response (24h lead reminder → 36h telegram → 48h ГИП alert), engineer inactivity (48h lead → 72h ГИП).
- Авто-действия: auto-unblock deps, auto-notify on deadline, auto-color UI по state.
- Метрики: 5 baseline quality metrics (avg exec time, rework ratio, review time lead/gip, overdue %).
- State Machine: полная таблица переходов со всеми ролями и условиями.

**`/infra/api-contract.md`** (1600+ строк):
- Архитектура: трёхслойная (Frontend/REST+WebSocket/Database+Orchestrator).
- Сущности: 5 TypeScript-интерфейсов (Task, Review, TaskDependency, Notification, User) с полной типизацией.
- Endpoints: 15+ операций (Tasks CRUD + status change, Reviews comments, Dependencies, Notifications, Files).
- Event-to-API mappings: 7 полных flow'ов (engineer upload → lead comment → GIP approve → auto-unblock).
- Validation: 8 бизнес-правил (no submit без file, no send ГИП с blocker comment, no dependencies на in-progress, etc.) с HTTP-кодами.
- Orchestrator integration: Redis XADD для события, XREAD listening, UPDATE/INSERT/WebSocket broadcast.
- WebSocket: subscriptions (project:uuid, team:uuid, user:uuid), events (task.status_changed, review.added, task.unblocked).
- Error codes: полная матрица (200/201/204/400/401/403/404/409/422/429/500/503) с примерами.
- Sequence diagrams: инженер → файл → review → lead approve → ГИП approve → авто-разблокировка с WebSocket-updates.

Документы **не содержат код**, это архитектурный контракт для backend-разработчика: "вот какие API нужны", "вот какие events генерирует система", "вот какой payload ходит".

Следующий шаг: backend-реализация (Node/Express/Fastify API, Redis Streams orchestrator, Supabase RLS policies).

### 2026-05-05 13:00 UTC — QA PASS: cable-calc v3 — инструмент принят в production без оговорок

QA-отчёт v3 (тестировщик, hard reload): **ни одного открытого бага**. Все три раунда фиксов подтверждены.

- Точность 100% до сотых долей по всем режимам (1ф, 3ф, Cu/Al, XLPE/PVC, E/D).
- 9 edge-cases: P/L/cosφ/Isc ≤ 0 — все дают сброс UI + alert.
- 8 параметров проверены на реальное влияние — фиктивных полей нет.
- 3 перекрёстных сценария: UI совпадает с аналитическим эталоном до ±0.02 (погрешность дисплея).
- Статусы (PASS/FAIL/итог) — логически согласованы, противоречий нет.

Оставшиеся наблюдения (не баги, не блокеры для прода):
- Iz в CD_Cu соответствует IEC Method C (~консервативнее Method E на 10%) — безопасно, требует примечания в документации.
- Нет max на P/L/Isc — разумное поведение, не баг.
- «3×N мм²» в рекомендуемом сечении для 1ф (точнее было бы «2×N») — минорный UX.

**Деплой:** `57b4256` → Vercel `7B4KGbNRF` READY, Current.

### 2026-05-05 12:10 UTC — FIX: cable-calc QA round 3 — закрыты минорные пункты до production

После QA-отчёта v2 (все критические баги формул закрыты, точность до сотых процента в эталонных сценариях) остались два минорных пункта, мешавших объявить инструмент production-ready:

- **Isc=0 → ложный «✓ Выполнено»**: при нулевом токе КЗ Smin рассчитывался как 0, и любой кабель проходил термостойкость. На input `i_Isc` теперь `min="1"`, в `doCalc()` добавлен guard `if(!Isc||Isc<=0){_resetUI();alert(...);return}` с текстом «Если данных по КЗ нет — задайте минимальный ожидаемый ток».
- **Заголовок секции** `Материал / изоляция (для журнала)` → `Материал / изоляция`. Поля Cu/Al и XLPE/PVC после фикса №3 в раунде 1 влияют на расчёт напрямую (таблицы `CD_Cu`/`CD_Al` + `K_TABLE`), пометка «для журнала» вводила в заблуждение.

Что осталось «на усмотрение разработчика» (помечено зелёным в QA): ограничения max на P/L/Isc и уточнение терминологии Method E vs C в таблицах Iz — не блокеры для прода.
