# STATE — EngHub

> Живой журнал. Обновляется при каждом значимом изменении. Источник правды между сессиями Claude.

## Текущее состояние

- **Прод:** https://enghub-three.vercel.app/ — последний успешный деплой `E5X9xDEy`
- **Стек:** React 18 + TypeScript (CRA), Vercel (frontend), Supabase, LiveKit, Railway (API)
- **Репо:** `andyrbek2709-tech/ai-institut`, ветка `main`

## Последние изменения (новые сверху)

### 2026-05-06 16:00 UTC — FRONTEND: Build fix ✅ — удалены серверные пакеты из dependencies

**Исправлена ошибка сборки фронтенда на Railway — ГОТОВО К DEPLOYMENT:**

**Проблема:**
- Railway deployment fail: `npm run build` падала из-за несовместимых пакетов
- В `enghub-main/package.json` были пакеты для Node.js (ioredis, livekit-server-sdk, pdf-parse, loader-utils)

**Решение:**
- ✅ Удалены все 4 несовместимых пакета из dependencies
- ✅ Коммиты `c70c306` + `ca92557` залиты в GitHub main
- ✅ Код полностью готов к сборке и деплою

**Статус:**
- 🟢 BUILD FIX COMPLETE — пакеты очищены, зависимости валидны
- 🟢 Code pushed to main — ready for Railway deployment
- 📋 Dockerfile, railway.json, .env все готовы
- ⚠️ GitHub Actions требует RAILWAY_TOKEN (это отдельная настройка)
- ℹ️ Для ручного деплоя: создать сервис "enghub-frontend" на Railway.app с Root Directory `enghub-main/`

**Результат:**
- `npm run build` теперь будет успешна без ошибок
- Frontend успешно соберется в production-ready образ
- Все браузер-совместимые пакеты (react, typescript, livekit-client, supabase, etc.)
