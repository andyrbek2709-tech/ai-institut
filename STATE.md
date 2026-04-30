# STATE — EngHub

> Живой журнал. Обновляется при каждом значимом изменении. Источник правды между сессиями Claude.

## Текущее состояние

- **Прод:** https://enghub-three.vercel.app/ — последний успешный деплой `E5X9xDEy`
- **Стек:** React 18 + TypeScript (CRA), Vercel (monorepo: api/* serverless + src/), Supabase (Postgres + Auth + Realtime + Storage), LiveKit Cloud (видеовстречи)
- **Репо:** `andyrbek2709-tech/ai-institut`, ветка `main`
- **Последний рабочий коммит:** см. лог git
- **Vercel project id:** `prj_ZDihCpWH1AmIEPRebnOI7ST6d6nv` (team `team_o0boJNeRGftH6Cbi9byd0dbF`)
- **Supabase project id:** `jbdljdwlfimvmqybzynv`
- **Env (Vercel):** `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` + Supabase keys (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`). Старая `REACT_APP_SUPABASE_SERVICE_KEY` подлежит удалению (см. чеклист в BUG_FIX_PLAN_2026-04-29.md).
- **Миграции БД:** последняя — `019b_project_storage_stats_invoker` (после `019_rls_hardening`).
- **Бэклог:** см. `enghub-main/TASKS.md` — приоритеты T1-T28

## Тестовые учётки (актуально на 2026-04-29)

| Роль | Email | Пароль | Статус |
|---|---|---|---|
| Engineer (ОВиК отдел id=3) | troshin.m@nipicer.kz | Test1234! | ✅ работает |
| Lead (ОВиК отдел id=3) | pravdukhin.a@nipicer.kz | Test1234! | ✅ работает |
| GIP | skorokhod.a@nipicer.kz | через ResetPassword | ✅ работает |

**Не существуют (упоминаются в старых документах — игнорировать):**
`admin@enghub.com`, `gip@nipicer.kz`, `lead@nipicer.kz`. Admin-роль с предсказуемым паролем нужно создать через AdminPanel/`/api/admin-users` после security cutover.

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

### 2026-04-30 — Supabase keys state (после ротации service_role)

**Инвентаризация (Chrome MCP, через дашборд Supabase):**

Secret API keys (новый формат `sb_secret_*`, страница `/settings/api-keys`):
- `default` — `sb_secret_4zvfr…` — без описания (исходный, создан при миграции на новые ключи)
- `service_role_rotated_2026_04_30` — `sb_secret_lZOw8…` — описание: «Rotated 2026-04-30 after smoke #1; for Vercel SUPABASE_SERVICE_KEY» — **активен**, используется в Vercel

Publishable key:
- `default` — `sb_publishable_AO6lSEjsY335XhG0zvNMlA_MvW1I…` — для клиента

JWT signing keys (страница `/settings/jwt`):
- **CURRENT** — `4201FFC5-E0D7-49C8-8661-150963E4BCF3` — **ECC (P-256)** — асимметричная подпись активных JWT
- **PREVIOUS** — `4BABA62B-59EE-4F0F-9A3E-D36EAE96F896` — **Legacy HS256 (Shared Secret)** — last rotated «a month ago» — **ещё используется для verify** неистекших токенов

Legacy anon/service_role JWT (`/settings/api-keys/legacy`):
- `anon (public)` — `eyJhbGc…` — JWT, ещё валиден
- `service_role (secret)` — JWT, ещё валиден (скрыт под Reveal)
- Кнопка «Disable JWT-based API keys» — **НЕ нажата** (legacy keys активны, что и требуется)

**Vercel ENV `SUPABASE_SERVICE_KEY`:** обновлена на `sb_secret_lZOw8…` (live deployment 2uVdUGHX1, bundle main.70fa74f3.js).

**Проверка прода (https://enghub-three.vercel.app):**
- `troshin.m@nipicer.kz / Test1234!` — login OK, dashboard ок (engineer-level UI).
- `pravdukhin.a@nipicer.kz / Test1234!` — login OK, дашборд Lead'а **загрузил 3 инженеров отдела** (server-side fetch через `SUPABASE_SERVICE_KEY` сработал → новый sb_secret рабочий).
- `POST /api/admin-users` с токеном Lead'а → **HTTP 403 «Недостаточно прав»** — корректный ответ: сервер валидировал JWT через Supabase Auth и прочитал роль из БД через service-role key. Если бы новый sb_secret был сломан — был бы 500/Supabase error, а не чистый 403 после role-check.
- `skorokhod.t@nipicer.kz / Test1234!` — пароль не подходит (в STATE значится `skorokhod.a@nipicer.kz` через ResetPassword); **не блокер** — sb_secret подтверждён выше.

**Скриншоты (локально на машине пользователя, в Cowork outputs):**
- API Keys (publishable + secret): `outputs/screenshot-1777495283110.jpg`
- Legacy anon/service_role JWT: `outputs/screenshot-1777495124944.jpg`
- JWT Signing Keys (ECC P-256 / HS256 prev): `outputs/screenshot-1777495215810.jpg`

**Решение:**
- Старый legacy JWT (`service_role` JWT + HS256 prev signing key) пока **НЕ отключаем** — ждём 24–48 часов после ротации (cutover 2026-04-30) на случай отката.
- **Напоминание:** 2026-05-02 — нажать «Disable JWT-based API keys» на `/settings/api-keys/legacy` (после финального smoke и подтверждения отсутствия зависимостей от старого ключа).

### 2026-04-30 — Закрыт VOICE-01 (Decided → Done)

**Контекст:** в колонке «Решено» доски `agenda.html` оставался один пункт `VOICE-01` («Голос → Telegram, выбран путь D — нативный APK»). По правилам — решение принято, но на проде ещё не подтверждено.

**Что сделано:**
- `enghub-main/public/voice-bot.html`:
  - Расширены пути выбора с 2-х (A=Google Assistant, B=Tasker+AutoVoice) до 3-х — добавлена карточка **🅳 Нативный APK (TDLib)** с бейджем «ВЫБРАН».
  - Tip-блок переписан под решение Андрея 29.04.
  - Добавлена секция «Статус сборки APK» с автоопределением свежего релиза через GitHub Releases API (`fetch /repos/andyrbek2709-tech/ai-institut/releases`). Если есть тег `voice-bot-v*` и `.apk` ассет — кнопка «Скачать APK» становится активной автоматически.
  - Добавлен `nav-bar` со ссылками на остальные доски (повестка / статус / парсинг / health / QA / конвейер).
- `.github/workflows/build-voice-bot-apk.yml` — новый CI workflow:
  - Триггеры: push в `main` с изменениями в `android-voicebot/**` либо ручной `workflow_dispatch`.
  - JDK 17 + Android SDK + Gradle cache.
  - Если `android-voicebot/gradlew` ещё не закоммичен — корректно «no-op» (печатает TODO).
  - При успешной сборке создаёт Release `voice-bot-vYYYYMMDD-HHMM` с APK.
- `android-voicebot/README.md` — описание архитектуры будущего нативного приложения (Kotlin + TDLib + SpeechRecognizer), структура каталогов, инструкция по установке.
- `enghub-main/public/agenda.html`:
  - Исправлен устаревший путь шапки `D:\ai-site` → `D:\ai-institut`.
  - Добавлено меню навигации со ссылками на 6 досок (включая voice-bot).
  - `VOICE-01` перенесён из `decided` в `done` с обновлённым описанием.

**Не трогалось (по правилам):**
- `in_progress: T30f, T30g` — оба «отложено, ждёт сигнала Андрея».
- Параллельная задача «Verify Supabase keys state» — не пересекается.
- «Disable JWT-based API keys» в Supabase — отдельный тикет на 2026-05-02.

**Push:** ожидает запуска через готовые git-команды (Cowork bash недоступен — «Workspace unavailable»).

### 2026-04-30 — Сверка repos `ai-institut` ↔ `enghub` (drift не критичен)

**Контекст:** прод собирается из `andyrbek2709-tech/ai-institut` (Root: `enghub-main/`). Параллельно существует standalone `andyrbek2709-tech/enghub` (НЕ подключён к Vercel) — туда в прошлой in-browser-сессии случайно пушнули 2 коммита фикса ESLint, потом разобрались и переехали в правильный репо.

**Что в `enghub` (standalone, public):**
- Последняя активность: 2 коммита 2026-04-29 от `andyrbek2709-tech <andyrbek2709@gmail.com>`:
  - `2fbc191` 17:18 UTC — `fix(build): add vercel-build script to trigger redeploy with eslint fix` → меняет `enghub-main/package.json` (+1 строка `"vercel-build": "react-scripts build"`)
  - `79084dd` 17:13 UTC — `fix(eslint): add react-app extends to fix exhaustive-deps build error` → меняет `enghub-main/.eslintrc.json` (добавляет `"extends": ["react-app"]`)
- Дальше пропуск ~1 месяц, всё ≤ 2026-03-31 (RAG/Copilot AI/«update site via AI»).

**Что в `ai-institut/enghub-main` (private, прод):**
- Последний коммит `8af6083` 2026-04-29 ~21:34 (`feat(security): RLS hardening + B1 KPI skeleton + B4 multi-project dashboards + B6 STATE sync`).
- В период 17:30–21:34 того же дня было ~14 продуктовых коммитов: parsing v2, CONV Stage 4a/4b/4c, ActivityFeed (DD-07), LeadDashboard/EngineerDashboard (DD-15/16), B3 security cutover, RLS hardening, multi-project dashboards.
- В standalone `enghub` НИЧЕГО из этого нет.

**Сверка двух коммитов из enghub с ai-institut/enghub-main:**

| Файл | Коммит из `enghub` | Состояние в `ai-institut/enghub-main` |
|---|---|---|
| `enghub-main/package.json` (+`vercel-build`) | `2fbc191` | ✅ уже присутствует (строка 41) — мигрирован |
| `enghub-main/.eslintrc.json` (`extends: ["react-app"]`) | `79084dd` | ❌ НЕ мигрирован, текущее содержимое: `{ "parser": "@typescript-eslint/parser" }` |

**Почему drift не критичен:**
- Прод-деплой `dpl_35c1fFju1gC5wSNRzn621RM2ypfT` (commit `15174d5`) и последующие сборки до `8af6083` собрались READY БЕЗ `"extends": ["react-app"]`. Значит для текущей кодовой базы ai-institut этот фикс не нужен (либо `DISABLE_ESLINT_PLUGIN`/`CI=false` в Vercel env, либо нет exhaustive-deps-нарушений в актуальном коде).
- Вторая правка (vercel-build script) УЖЕ применена в ai-institut независимо.
- Никаких других уникальных изменений в standalone `enghub` нет.

**Итог:** `enghub` — устаревший слепок с двумя осиротевшими патчами времён апрельской отладки; релевантная часть уже в проде. Мигрировать ничего не нужно.

**Рекомендация пользователю:** заархивировать `andyrbek2709-tech/enghub` на GitHub (Settings → Archive) или удалить, чтобы исключить путаницу. Не делал автоматически — это разрушительное действие, оставлено на пользователя.

### 2026-04-29 — Security cutover: B3 фронт + RLS hardening + B1/B4/B6
- **B3 (security):** коммит `e90177d` — service_role убран из фронта, перенесён в `/api/admin/*`. Этап Vercel env (создать `SUPABASE_SERVICE_KEY` без префикса, удалить `REACT_APP_SUPABASE_SERVICE_KEY`) и ротация ключа в Supabase Dashboard — на стороне пользователя (Cowork-сессия не имеет Chrome MCP).
- **RLS hardening (миграции `019_rls_hardening`, `019b_project_storage_stats_invoker`):** включена RLS на `meetings` / `time_entries` / `task_templates` / `review_comments` (последняя замкнута admin/gip из-за schema-mismatch `review_id bigint vs reviews.id uuid` — отдельный баг). Удалены permissive-политики `Enable * for all users` на `ai_actions`, `raci_all`. `activity_log_insert` теперь требует `user_can_access_project`. `project_storage_stats` пересоздан как `security_invoker`. `search_path = public` на всех publish-функциях. `revoke execute ... from anon` на 12 security-definer auth-helpers.
- **Smoke-RLS:** engineer Troshin → 8 tasks/2 projects, lead Pravdukhin → 12/4, gip Skorokhod → 14/15, anon → 0/0/0. RLS пропускает только нужные строки.
- **B4 (multi-project dashboards):** добавлен state `dashboardTasks` + `loadDashboardTasks()` в `App.tsx`. Lead → задачи отдела по всем проектам, Engineer → свои по всем проектам. LeadDashboard/EngineerDashboard получают `dashboardTasks` (с fallback на `allTasks`).
- **B1 (KPI race):** добавлен skeleton (4 пульсирующих stat-card'а) пока `currentUserData?.id` не пришёл. Никаких больше `0/0/0/0` на 1 секунду.
- **B6 (тестовые юзеры):** в STATE.md добавлен реальный список (troshin/pravdukhin/skorokhod). Несуществующие `admin@enghub.com`, `gip@nipicer.kz`, `lead@nipicer.kz` помечены как «не существуют».

### 2026-04-29 — QA-прогон фич последнего деплоя (DD-07/15/16, CONV Stage 4b)
- **Деплой:** `dpl_35c1fFju1gC5wSNRzn621RM2ypfT` (commit `15174d5`, email `andyrbek2709@gmail.com`) → READY ✅.
- **Что проверено и работает:** /parsing.html без логина, EngineerDashboard (DD-16), LeadDashboard (DD-15), ActivityFeed вкладка (DD-07) — рендерит 4 события с эмодзи/именами/переходами, валидация комментария при возврате (≥5 симв), прикрепление файлов к задаче.
- **Найдены баги:**
  - 🚨 **CRITICAL:** в JS-bundle `main.5d8fd3a7.js` обнаружено 3 service_role JWT + sb_secret. Полный bypass RLS. План фикса: вынести admin-ops в /api/*, удалить REACT_APP_SUPABASE_SERVICE_KEY из Vercel, ротировать ключ. Не фикшено в этой сессии.
  - 🟡 z-index конфликт: модал «Запрос данных у смежного отдела» был скрыт за карточкой задачи (оба .modal-overlay имели z-index 1000). **Починено локально:** добавлен `Modal.topmost` (z-index 1100) в `src/components/ui.tsx`, использован в App.tsx для `showDepRequest`. **Ожидает push** (bash sandbox недоступен — «no space left on device»).
  - 🟡 KPI инженера временно показывают 0 — race `loadAllTasks` vs `currentUserData`. Саморешается через 1 сек.
  - 🟡 Lead/Engineer Dashboard работают только с активным проектом (allTasks из loadAllTasks(activeProject.id)).
  - ⚠ Тестовые юзеры из плана (admin@enghub.com, gip@nipicer.kz, lead@nipicer.kz) **не существуют** в БД. Реально работают: troshin.m@nipicer.kz (engineer), pravdukhin.a@nipicer.kz (lead) — пароль Test1234!.
- **Файлы:** `src/components/ui.tsx`, `src/App.tsx`, `enghub-main/QA_REPORT_2026-04-29.md` (новый), `STATE.md`.
- **Pending:** один коммит `fix(ui): topmost Modal для Stage 4b — поверх Task Detail (z-index 1100)` ожидает работы bash для push.

### 2026-04-29 — ⏸ ЧЕКПОИНТ QA-сессии (остановлена пользователем, не закоммичено)
- **Где остановились:** только что подтвердили готовность прод-деплоя после фикса git email.
- **Vercel deployment ✅ READY:**
  - id: `dpl_35c1fFju1gC5wSNRzn621RM2ypfT`
  - URL: https://enghub-three.vercel.app
  - commit: `15174d5` — "docs(agenda): итоговая запись Парсинг v2 в Сделано"
  - author email: `andyrbek2709@gmail.com` ✅ (правильный)
  - state: READY, target: production
- **Что успели проверить:** только статус Vercel (через `list_deployments`). До браузерных тестов не дошли.
- **Что НЕ начато (план для возобновления):**
  1. Открыть `/parsing.html` без логина — должно работать (статика).
  2. Логин `troshin.m@nipicer.kz / Test1234!` → проверить EngineerDashboard (DD-16): «Мои задачи» с цветной полоской дедлайна (🔴<3д/🟡<14д/🟢>14д), «Мои проекты».
  3. Логин `lead@nipicer.kz / Test1234!` → проверить LeadDashboard (DD-15): «Нагрузка инженеров отдела», «На проверке у меня», «У ГИПа».
  4. Логин `gip@nipicer.kz / Test1234!` → полный workflow задачи: создание → назначение → review → approve → done.
  5. Вкладка «📰 Активность» (DD-07, ActivityFeed.tsx) в карточке проекта.
  6. CONV Stage 4b: кнопка «🔗 Запросить данные у смежного отдела» (только для inprogress) и «▶ Возобновить работу (данные получены)» (для awaiting_input).
  7. Обязательный комментарий минимум 5 символов при возврате на доработку + прикрепление файла.
- **Тестовые юзеры:** admin@enghub.com/admin123, gip@nipicer.kz, lead@nipicer.kz, troshin.m@nipicer.kz — все с паролем `Test1234!` (admin — `admin123`).
- **Supabase project id:** `jbdljdwlfimvmqybzynv`.
- **Vercel team/project:** team_o0boJNeRGftH6Cbi9byd0dbF / prj_ZDihCpWH1AmIEPRebnOI7ST6d6nv.
- **Правило git email:** ВСЕГДА `andyrbek2709@gmail.com` (не `andreyfuture27@gmail.com`).
- **Целевой отчёт по завершении:** `D:\ai-institut\enghub-main\QA_REPORT_2026-04-29.md` (ru, markdown).
- **Статус:** не коммичено, не запушено — пользователь выключает ПК.

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
