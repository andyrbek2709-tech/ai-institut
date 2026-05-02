# AdIntakeBot — состояние

_Последнее обновление: 2026-05-01_

## Что сделано

- ✅ Каркас на базе Nurmak: `src/index.js`, `src/bot/handlers.js`, `src/bot/prompts.js`, `src/services/{openai,whisper,supabase}.js`, `src/utils/state.js`
- ✅ System prompt + function schema адаптированы под рекламный бриф (`service_type`, `description`, `size`, `quantity`, `deadline`, `budget`, `contact`, `files`, `notes`)
- ✅ Supabase-схема: `conversations` + `orders` + RLS (`supabase/migrations/001_init.sql`)
- ✅ Конфиги Railway (`railway.json`, `Procfile`)
- ✅ `.env.example`, `.gitignore`, `README.md`, `CLAUDE.md`
- ✅ Поддержка фото и документов (приём, привязка к диалогу, форвард менеджеру)
- ✅ Менеджерские команды + Принять/Отклонить с обратной связью клиенту

## Что нужно от пользователя для запуска

1. **Telegram Bot Token** — создать у [@BotFather](https://t.me/BotFather) (`/newbot` → имя → юзернейм)
2. **Manager Chat ID** — `/start` у [@userinfobot](https://t.me/userinfobot), скопировать число
3. **GitHub-репо `ad-intake-bot`** + расширение PAT scope (текущий PAT — на `ai-institut`)

## Что сделает Claude после получения токена + ID

1. Создаст Supabase-проект (или использует существующий — спросит)
2. Применит миграцию `001_init.sql`
3. Задеплоит на Railway, заведёт env-переменные
4. Зарегистрирует webhook
5. Smoke-тест: `/start`, голосовое, фото, текст, подтверждение → проверка что бриф ушёл в Supabase и в чат менеджера
6. Отдаст URL живого бота

## TODO / блокеры

- 🔧 **Git init нужно сделать с Windows-стороны.** Песочница не смогла надёжно записать `.git/config` через Linux-маунт (заполнялся нулями). Поэтому в репо лежит `initial.bundle` — готовый коммит «feat: initial scaffold based on Nurmak». На Windows-стороне:
  ```powershell
  cd D:\AdIntakeBot
  # удалить мусорные .git_broken_* директории, если остались
  Remove-Item -Recurse -Force .git_broken_*  
  git init -b main
  git config user.email andyrbek2709@gmail.com
  git config user.name Andrey
  git fetch initial.bundle main:main
  git checkout main
  Remove-Item initial.bundle
  ```
  Альтернативно, если бандл не нужен — просто:
  ```powershell
  cd D:\AdIntakeBot
  Remove-Item -Recurse -Force .git_broken_*, initial.bundle
  git init -b main
  git config user.email andyrbek2709@gmail.com
  git config user.name Andrey
  git add -A
  git commit -m "feat: initial scaffold based on Nurmak"
  ```
- 🔒 **PAT для GitHub.** Текущий PAT работает только на `ai-institut`. Для пуша в новый репо `ad-intake-bot` нужен либо новый PAT, либо расширение scope. Команды после создания репо:
  ```powershell
  cd D:\AdIntakeBot
  git remote add origin https://andyrbek2709:<PAT>@github.com/<user>/ad-intake-bot.git
  git push -u origin main
  ```
- ⏳ **Supabase project** — пока не создан. Варианты: завести новый или подключить существующий, заодно вынести в env `
---

## 2026-05-02 — DEPLOYED to Railway

**URL:** https://ai-institut-production.up.railway.app
**Webhook:** /webhook/<TOKEN> registered, /health = OK
**Repo path:** монорепо, deploy from `andyrbek2709-tech/ai-institut` → Root Directory = `/ad-intake-bot`
**Supabase:** существующий проект `jbdljdwlfimvmqybzynv` (общий с EngHub), миграция `001_init.sql` применена (orders + conversations + RLS)
**Smoke test:** ✅ sendMessage в чат менеджера 463076251 — message_id=5, ok=true
**Bot:** @Android_Telegram_bot, ID 8738465001
**Railway project:** kind-comfort
**Domain port:** 8080 (Railway default, не 3000)

### Что делать дальше
- Юзер пишет /start в @Android_Telegram_bot, проходит диалог
- Менеджер (chat 463076251) ловит карточку с Принять/Отклонить
- При проблемах: View logs на Railway, или getWebhookInfo

### Будущее (когда будет время)
- Расширить PAT на отдельный репо `ad-intake-bot` или сделать его основным деплоем
- Сейчас архитектура «бот живёт подпапкой ai-institut» — нормально для MVP
