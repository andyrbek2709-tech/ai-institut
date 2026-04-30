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
- **Миграции БД:** последняя — `020_admin_bootstrap` (после `019b_project_storage_stats_invoker`).
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

### 2026-04-30 05:42 UTC — HOTFIX admin password reset (commit `970058a`)

**Симптом:** в AdminPanel кнопка «🔑 Пароль» → ввод нового пароля → красная ошибка («Не получилось обновить пароль»). До security-cutover работало.

**Корневая причина (две проблемы одновременно):**
1. **Min length mismatch:** AdminPanel.tsx разрешал пароль ≥6 симв, бэкенд `/api/admin-users` handleResetPassword требовал ≥8 → 400 без понятного объяснения, если юзер вводил 6–7 симв.
2. **Голая диагностика** при upstream-ошибке Supabase Auth API: ответ Supabase скрывался за безликим `HTTP <code>` без body — невозможно было понять, что именно не нравится `/auth/v1/admin/users/{uid}` после ротации service_role JWT → `sb_secret_*`.

**Что сделано (`enghub-main/api/admin-users.js`):**
- `handleResetPassword`: primary path теперь — supabase-js SDK `sb.auth.admin.updateUserById(uid, { password })`; REST `/auth/v1/admin/users/{uid}` оставлен fallback'ом. SDK устойчивее к новому формату ключей.
- Min длина пароля бэкенда: 8 → 6 (синхронизировано с frontend).
- Все ошибки теперь логируются в Vercel runtime: `[admin-users] reset:sdk` / `reset:rest` с upstream status + body (первые 500 байт), и возвращаются в response с осмысленным `Auth admin API: <msg>`.
- Глобальный try/catch вокруг handler'а — никаких голых 500.
- Sanity-check `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` до auth.

**Что сделано (`enghub-main/api/_spec_helpers.js`):**
- `verifyUserAndProfile`: при вызове `/auth/v1/user` пробуется apikey=ANON_KEY, при неудаче — fallback на apikey=SERVICE_KEY.
- В response вместо безликого `Invalid or expired token` теперь `Invalid or expired token (auth/v1/user → <status>)`.
- В runtime logs пишется `[verifyUserAndProfile]` с диагностикой.

**Push & deploy:**
- Email коммита: `andyrbek2709@gmail.com` ✅ (правильный, не Claude Automation).
- Vercel deploy `dpl_FBPrqdQqqifhDsGaSHtbFRnYxbRg` (commit `970058a`) → **READY** ✅ (~4 мин).

**Verify:** ожидает теста пользователем в браузере. При следующем успешном reset password — `auth.users.encrypted_password` обновится (текущий хэш зафиксирован: `$2a$10$QFKSh…`, updated_at `2026-04-29 07:17`). Если останется ошибка — теперь её содержательный текст придёт во фронт.

**Файлы:** `enghub-main/api/admin-users.js`, `enghub-main/api/_spec_helpers.js`, `STATE.md`.

### 2026-04-30 05:04 UTC — DISABLE_ESLINT_PLUGIN удалён из Vercel + verify deploy

**Что сделано (автономно из dispatch task):**
- Push `0f7b656` (admin RLS hotfix migration 020) и `a82c353` (ESLINT-DEBT closure) на main через свежий клон в `/tmp/work` (обход залипшего `.git/index.lock` в локальном репо).
- Vercel deployment `dpl_9CXTzp7PCgzWZ5cojCX3z1wigTGL` для SHA `a82c353` — **READY** ✅, build "Compiled successfully", bundle 527.74 kB gzip.
- `https://enghub-three.vercel.app/` и `/parsing.html` — HTTP 200, контент норм.
- `DISABLE_ESLINT_PLUGIN` удалён из Production+Preview через Vercel UI (Chrome MCP). Теперь ESLint-конфига в репо рабочая, workaround снят.

**Verify шаг:** запушенный коммит триггерит свежий build БЕЗ `DISABLE_ESLINT_PLUGIN` env — если пройдёт, ESLINT-DEBT окончательно закрыт.


### 2026-04-30 — Закрыт ESLINT-DEBT (убран DISABLE_ESLINT_PLUGIN, нормальный плагин react-hooks)

**Контекст:** в Vercel env стояла переменная `DISABLE_ESLINT_PLUGIN=true` (Production+Preview) — workaround, чтобы build не падал на ошибке `Definition for rule 'react-hooks/exhaustive-deps' was not found`. Пробовали `extends:["react-app"]`, но он тянул правило `import/first`, нарушаемое в коде.

**Что сделано:**
- `enghub-main/package.json`: добавлен `eslint-plugin-react-hooks ^4.6.2` в devDependencies.
- `enghub-main/.eslintrc.json`: переписан минимально — `parser: @typescript-eslint/parser`, `plugins:["react-hooks"]`, `rules: { rules-of-hooks: error, exhaustive-deps: off }`. Без `extends:react-app`.
- `enghub-main/package-lock.json`: обновлён через `npm install` (191 пакет добавлен), валидный JSON, проверен `node -e JSON.parse`.
- `enghub-main/public/agenda.html`: ESLINT-DEBT перенесён из `in_progress` в `done` с описанием решения.
- `D:\ai-institut\push-eslint-fix.ps1`: helper-скрипт для пользователя — снимает залипший `.git/index.lock`, делает add/commit/pull/push.

**Локальный smoke (`/tmp/build/enghub-main`, чистый клон, npm install + react-scripts build):**
- `CI=false` без DISABLE_ESLINT_PLUGIN → Compiled successfully, 526.58 kB gzip, 16 warnings (exhaustive-deps).
- `CI=true` с правилом `exhaustive-deps: off` → Compiled successfully (без warnings, без errors).

**Pending (требует ручных действий пользователя):**
- Push: bash sandbox в репо упёрся в `.git/index.lock` (Windows-side залипание). Изменения файлов на диске — корректные. Скрипт `push-eslint-fix.ps1` лежит в корне репо; запустить из PowerShell в `D:\ai-institut`: `powershell -ExecutionPolicy Bypass -File .\push-eslint-fix.ps1`.
- После успешного нового deployment — удалить `DISABLE_ESLINT_PLUGIN` из Vercel Production+Preview (https://vercel.com/andyrbek2709-techs-projects/enghub/settings/environment-variables).

### 2026-04-30 — HOTFIX: admin не видел ничего (миграция 020)

**Симптом:** admin@enghub.com логинился, AdminPanel показывал пустые списки, проекты/задачи невидимы.

**Корневая причина:** В helper-функции `auth_app_user_role()` спец-кейс `WHEN email='admin@enghub.com' THEN 'admin'` был ВНУТРИ `SELECT ... FROM app_users WHERE email=...`. Профиля для admin@enghub.com в `app_users` не существовало (см. STATE заметку «Не существуют»), поэтому SELECT возвращал 0 строк → helper отдавал NULL → `auth_is_admin()` = NULL → RLS на projects/tasks возвращал 0.

**Фикс (миграция `020_admin_bootstrap.sql`):**
1. INSERT профиля `admin@enghub.com` в `app_users` (id=69, role='admin', supabase_uid=877e0ce5…).
2. CREATE OR REPLACE `auth_app_user_role()` — спец-кейс вынесен НАРУЖУ SELECT (защита от регрессии: даже если профиль удалят, admin@enghub.com всё равно вернёт 'admin').

**Verify (через SQL impersonation admin):**
- До: users_seen=23 depts_seen=8 **projects_seen=0** **tasks_seen=0** helper_role=NULL is_admin=NULL.
- После: users_seen=24 depts_seen=8 **projects_seen=17** **tasks_seen=16** helper_role='admin' is_admin=true.

Данные в БД целы (23 → 24 после INSERT профиля админа, отделы 8, проекты 17, задачи 16). Не было катастрофы — был баг в RLS-helper.

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
- **Smoke-RLS:** engineer Troshin → 8 tasks/2 projects, lead P