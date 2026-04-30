# EngHub — текущее состояние

> Источник правды между сессиями. Открыл проект → прочитал. Сделал что-то значимое → дописал сверху → закоммитил вместе с правкой.

## Что это

Внутренняя инженерная платформа проектного института: проекты, задачи (Kanban + workflow), чертежи с ревизиями, замечания, трансмитталы, спецификации, совещания, табель, дашборды, AI Copilot. Роли: `admin / gip / lead / engineer`.

## Стек и инфраструктура

- **Frontend:** React 18 + TypeScript (CRA), styling — inline + theme prop, без Tailwind
- **Backend:** Vercel serverless functions (`enghub-main/api/*.js`, CommonJS)
- **БД:** Supabase (Postgres + Auth + Realtime + Storage), RLS включена везде
- **Видео:** LiveKit Cloud
- **Repo:** `andyrbek2709-tech/ai-institut`, ветка `main`, Root Directory `enghub-main`
- **Локальный путь:** `D:\ai-institut`
- **Vercel project:** `enghub` (team `andyrbek2709-techs-projects`, id `prj_ZDihCpWH1AmIEPRebnOI7ST6d6nv`)
- **Supabase project:** `jbdljdwlfimvmqybzynv`
- **Live:** https://enghub-three.vercel.app
- **Env (Vercel):** `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` (без префикса REACT_APP_)
- **Миграции:** последняя — `020_admin_bootstrap` (после `019b_project_storage_stats_invoker`)
- **Бэклог задач:** `enghub-main/TASKS.md`

## Тестовые юзеры

| Роль | Email | Пароль |
|---|---|---|
| admin | admin@enghub.com | задаётся через AdminPanel (RLS-bootstrap миграция 020) |
| gip | skorokhod.a@nipicer.kz | Test1234! (либо через ResetPassword) |
| lead (ОВиК) | pravdukhin.a@nipicer.kz | Test1234! |
| engineer (ОВиК) | troshin.m@nipicer.kz | Test1234! |

Несуществующие в БД и НЕ использовать: `gip@nipicer.kz`, `lead@nipicer.kz`.

## Безопасность (cutover завершён 2026-04-30)

- `service_role` вынесен из фронта в `/api/admin/*` (9 endpoints, JWT verify + role-check)
- Vercel ENV `SUPABASE_SERVICE_KEY` — новый `sb_secret_lZOw8…` (rotated 2026-04-30)
- Старый legacy JWT валиден до **2026-05-02** — потом нажать «Disable JWT-based API keys» на Supabase `/settings/api-keys/legacy`
- RLS hardened: миграции `019_rls_hardening`, `019b_project_storage_stats_invoker`, `020_admin_bootstrap` на проде

## Доска

Колонки **Идеи / Триаж / Решено / В работе / Сделано / Не делаем** — `enghub-main/public/agenda.html`. Live: https://enghub-three.vercel.app/agenda.html

## Известные открытые задачи

- **JWT-DISABLE** — отключить legacy JWT в Supabase, плановая дата 2026-05-02
- **T30f** — версионность документов (отложено, ждёт сигнала)
- **T30g** — лимиты на файлы (отложено, ждёт сигнала)
- Полный бэклог — `enghub-main/TASKS.md`

## Журнал (новые сверху, последние ~7 дней)

### 2026-04-30 — Чистка проекта
Удалены устаревшие планы/отчёты в корне `enghub-main/` (BUG_FIX_PLAN, IMPLEMENTATION_STATUS, APPLY_SECURITY_FIX, QA_REPORT, TEST_REPORT_STEP2_TO_12 — всё уже выполнено). STATE.md и CLAUDE.md переписаны компактно. agenda.html — убраны битые ссылки на удалённые документы.

### 2026-04-30 — Hotfix admin password reset
`src/api/http.ts`: `getAccessToken()` теперь читает `localStorage.enghub_token` (где живёт реальный токен после `signIn`), потом fallback на supabase-js. Раньше `apiFetch` слал пустой Authorization → AdminPanel «🔑 Пароль» падал с «Authorization Bearer token is required». Verified: bundle `main.2ff00481.js` (deploy `dpl_9vsZ4myEkaVf2iPGiBNiZWT1YvWH`, commit `5952359`), Supabase `auth.users.encrypted_password` для skorokhod.a@nipicer.kz реально обновился.

### 2026-04-30 — Закрыт ESLINT-DEBT
Убран workaround `DISABLE_ESLINT_PLUGIN=true` из Vercel env. Добавлен `eslint-plugin-react-hooks ^4.6.2`, `.eslintrc.json` минимальный (`rules-of-hooks: error`, `exhaustive-deps: off`), без `extends:react-app`. Локальный smoke `CI=true` → Compiled successfully. Vercel deploy `dpl_9CXTzp7PCgzWZ5cojCX3z1wigTGL` (sha `a82c353`) → READY.

### 2026-04-30 — Hotfix admin RLS (миграция 020)
Профиль `admin@enghub.com` в `app_users` отсутствовал → `auth_app_user_role()` возвращал NULL → admin не видел проекты/задачи. Миграция: INSERT профиля + спец-кейс для admin@enghub.com вынесен НАРУЖУ SELECT. До: 0 проектов/0 задач. После: 17/16.

### 2026-04-30 — Security cutover + ротация service_role
Service-роль убрана из фронта (`src/api/supabase.ts`, `App.tsx`, `ActivityFeed.tsx`), 9 admin-операций перенесены в `/api/admin/*`. Каждый endpoint валидирует JWT + role. Создан новый `sb_secret_lZOw8…`, Vercel ENV обновлён. Smoke на проде (engineer/lead/gip) — все логинятся, RLS работает, POST к `/api/admin-users` от Lead → 403 (корректный role-check).

### 2026-04-30 — RLS hardening (019, 019b)
Включена RLS на `meetings`, `time_entries`, `task_templates`, `review_comments`. Удалены permissive «Enable * for all users» на `ai_actions`, `raci_all`. `activity_log_insert` требует `user_can_access_project()`. VIEW `project_storage_stats` пересоздан как `security_invoker`. `search_path = public` на всех publish-функциях. `revoke execute … from anon` на 12 security-definer auth-helpers.

### 2026-04-30 — VOICE-01 закрыт
Путь D (нативный APK с TDLib) зафиксирован на `voice-bot.html` как «ВЫБРАН». Добавлен CI workflow `.github/workflows/build-voice-bot-apk.yml` — на push в `android-voicebot/**` собирает APK и публикует Release. Каталог `android-voicebot/` со спекой Kotlin-приложения. Меню навигации добавлено в шапки воркспейс-страниц.

### 2026-04-29 — Дашборды + ActivityFeed + конвейер
DD-15 LeadDashboard, DD-16 EngineerDashboard, DD-07 ActivityFeed (вкладка проекта), CONV Stage 4a (статус `awaiting_input`) / 4b (запрос данных у смежного отдела) / 4c (UI истории задачи с эмодзи). Multi-project dashboards: `loadDashboardTasks()` тянет задачи по всем проектам пользователя. KPI skeleton от race condition.

### 2026-04-28 — RLS изоляция ГИПов + триггеры task_history + LiveKit
B1: убраны 2 сломанных триггера `task_history` (ссылались на колонку `field`, которой нет). B3: SECURITY DEFINER `is_meeting_participant()` сломал бесконечную рекурсию в RLS на `video_meeting_*`. B4: `projects.gip_id NOT NULL`, 4 helper-функции, RLS на 9 таблиц, фронт `createProject` обновлён. B6: системный rolePrompt больше не светится в user-facing AI Copilot.

## Жёсткие правила работы с проектом

1. Все коммиты с email `andyrbek2709@gmail.com` (НЕ `andreyfuture27@gmail.com`).
2. Push в `andyrbek2709-tech/ai-institut@main` — через PAT, автономно из dispatch task. Не давать пользователю git-команды на копи-паст.
3. Cowork mount при коммитах усекает файлы — все правки делать через клон в `/tmp` с PAT.
4. «Готово» = pushed + Vercel READY + browser-smoked end-to-end (не раньше).
5. Перед сменой Vercel env / ротацией Supabase ключей — спросить пользователя.
6. Standalone репо `andyrbek2709-tech/enghub` не используется (не подключён к Vercel) — путать не надо.
