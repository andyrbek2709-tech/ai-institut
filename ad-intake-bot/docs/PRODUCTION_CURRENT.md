# Ad Intake Bot — актуальный прод (чтобы не потерять)

Один файл-«памятка»: куда смотрит бот, где схема, как подтянуть env и логи. **Секреты сюда не копировать** — только имена переменных и публичные URL.

## Где крутится бот

| Что | Значение |
|-----|----------|
| Хостинг | **Railway**, проект **kind-comfort**, сервис **ai-institut** |
| Публичный URL | `https://ai-institut-production.up.railway.app` (webhook: `WEBHOOK_DOMAIN` в переменных Railway) |
| Код в репо | `andyrbek2709-tech/ai-institut` → каталог **`ad-intake-bot/`** |

## Где база только этого бота

| Что | Значение |
|-----|----------|
| Supabase (отдельно от EngHub) | **`https://pbxzxwskhuzaojphkeet.supabase.co`** (ref: **`pbxzxwskhuzaojphkeet`**) |
| Railway | В переменных сервиса заданы **`SUPABASE_URL`** и **`SUPABASE_KEY`** (service_role) **именно этого** проекта |
| Раньше бот ходил в | `jbdljdwlfimvmqybzynv` — **для бота в Railway больше не используется**. Проект EngHub в Supabase **не трогаем** этими правками. |

Схему таблиц в новом проекте один раз поднимают файлом **`supabase/bundle_ad_intake_bot_schema.sql`** (SQL Editor → вставить весь файл → Run). Подробнее: **`docs/SUPABASE_DEDICATED_PROJECT.md`**.

## Локальные `.env` (не в git)

- Формат **строго** `KEY=value` (не строка вида `KEY - value`).
- Удобные пути: **`D:\AdIntakeBot\.env`**, **`D:\ai-institut\ad-intake-bot\.env`** (оба в `.gitignore` корня / пакета).
- Минимум для скриптов: `SUPABASE_URL`, `SUPABASE_KEY`; для самого бота см. **`.env.example`**.

Повторно записать URL и ключ из `.env` в Railway:

```bash
cd ad-intake-bot
npm run railway:sync-supabase
```

Скрипт: **`scripts/sync-supabase-to-railway.mjs`**.

## Логи переписок (голос = текст в `history`)

- В Telegram (менеджер): **`/transcript <id лида>`** или **`/transcript chat <telegram_chat_id>`**
- В терминале: **`npm run dump:transcript`**, **`npm run dump:last-conv`**
- Описание: **`docs/CONVERSATION_LOGS.md`**

## Безопасность

Если когда-либо секреты попали в **лог терминала** или в чат — имеет смысл **сгенерировать новый** service_role в Supabase и обновить **`SUPABASE_KEY`** в Railway (и локальный `.env`), при необходимости то же для **BOT_TOKEN** / **OPENAI_API_KEY**.

## См. также

- **`BOT_REFERENCE.md`** — структура кода и env по именам
- **`STATE.md`** — журнал изменений по датам
- **`docs/SUPABASE_DEDICATED_PROJECT.md`** — выделенный Supabase под бота
