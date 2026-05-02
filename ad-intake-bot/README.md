# Ad Intake Bot

Telegram-бот для рекламного агентства: собирает брифы на заказы (наружка, баннеры, дизайн, видео, печать и т.д.) через текст, голос и файлы. GPT-4o-mini ведёт диалог, Whisper транскрибирует голосовые. Готовые заявки сохраняются в Supabase и пересылаются менеджеру.

Каркас построен на основе `D:\Nurmak`.

## Стек

- Node.js 20+ (ESM)
- Telegraf — Telegram Bot API
- OpenAI GPT-4o-mini + Whisper-1
- Supabase (Postgres) для conversations + orders
- Express для webhook на Railway

## Структура

```
src/
  index.js              # Express + Telegraf, webhook/long-polling
  bot/
    handlers.js         # /start, text, voice, file, callbacks (accept/reject)
    prompts.js          # System prompt + save_order function schema
  services/
    openai.js           # chat completion с tool calling
    whisper.js          # транскрибация voice/audio
    supabase.js         # CRUD conversations + orders
  utils/
    state.js            # in-memory диалоговый контекст (TTL 60 мин)

supabase/migrations/
  001_init.sql          # таблицы conversations + orders + RLS
```

## Запуск локально

1. `cp .env.example .env` и заполнить:
   - `BOT_TOKEN` — у [@BotFather](https://t.me/BotFather)
   - `OPENAI_API_KEY` — на [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - `SUPABASE_URL` + `SUPABASE_KEY` — Supabase Dashboard → Settings → API → service_role
   - `MANAGER_CHAT_ID` — `/start` у [@userinfobot](https://t.me/userinfobot), скопировать ID
   - `WEBHOOK_DOMAIN` — оставить пустым для long-polling в локалке

2. `npm install`

3. Применить миграцию: открыть Supabase → SQL Editor → вставить содержимое `supabase/migrations/001_init.sql` → Run

4. `npm start` (или `npm run dev` для авто-перезапуска)

## Деплой на Railway

1. Создать проект на [railway.app](https://railway.app), привязать GitHub-репо `ad-intake-bot`
2. Добавить env-переменные из `.env.example`. `WEBHOOK_DOMAIN` поставить вида `https://<service>.up.railway.app` (Railway → Settings → Networking → Generate Domain)
3. `PORT` Railway проставит сам
4. После первого деплоя бот сам вызовет `setWebhook` — проверить логи

## Команды бота

Клиент:
- `/start` — начать новый заказ
- `/reset` — сбросить текущий диалог
- `/help` — справка

Менеджер (только из чата с `MANAGER_CHAT_ID`):
- `/new` — список новых заявок
- `/active` — заявки в работе
- `/today` — все заявки за сегодня
- Кнопки `Принять / Отклонить` под каждой новой заявкой

## Поля брифа

Обязательные: `service_type`, `description`, `deadline`, `contact`
Опциональные: `size`, `quantity`, `budget`, `files[]`, `notes`

## Что дальше

См. [STATE.md](STATE.md) — текущий статус и TODO.
