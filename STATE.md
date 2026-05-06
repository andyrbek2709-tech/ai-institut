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
- **Миграции БД:** последняя — `024_api_metrics` (система мониторинга для rollout). Предыдущая — `023_email_case_insensitive_rls_helpers`.
- **Архитектурные документы:** `/core/system-orchestrator.md` (650+ строк: роль оркестратора, события, триггеры, логика блокировок, дедлайны, масштабируемость) и `/infra/api-contract.md` (1600+ строк: сущности, endpoints, payload примеры, WebSocket, валидация) — готовы для реализации backend.
- **Orchestrator Service:** `services/orchestrator/` — v1.0 реализована (Redis Streams consumer group, 5 event handlers, state machine, Supabase integration, graceful shutdown, retry mechanism). Готова к интеграции с API.
- **Бэклог:** см. `enghub-main/TASKS.md` — приоритеты T1-T28

## Последние изменения (новые сверху)

### 2026-05-06 23:59 UTC — FRONTEND: Build fix — удалены серверные пакеты из dependencies 🔧

**Исправлена ошибка сборки фронтенда на Railway:**

**Проблема:**
- Railway deployment fail: `npm run build` падала с ошибками
- В `enghub-main/package.json` были серверные пакеты, несовместимые с браузером:
  - `ioredis` (Redis Node.js client) — только для серверной части
  - `livekit-server-sdk` (серверный SDK) — не нужен во фронтенде
  - `pdf-parse` (Node.js PDF парсер) — не работает в браузере
  - `loader-utils` (потенциальная несовместимость)

**Решение:**
- ✅ Удалены 4 пакета из dependencies в `enghub-main/package.json`
- ✅ Коммит `c70c306` запущен в GitHub
- ✅ Railway автоматически переберет сборку

**Статус:**
- 🟠 GitHub Actions workflow запущена (status: queued)
- ⏳ Ожидание завершения Railway build (обычно 2-5 минут)

**Next:** Проверить результаты Railway build и обновить эту запись
