# Ad Intake Bot

Telegram-бот для рекламного агентства: брифы (наружка, баннеры, SMM, печать и т.д.) через **текст**, **голос** (Whisper + отраслевой `prompt`), **фото** (Vision), **PDF** (извлечение текста, подсказка при скане), **шаблоны** `/templates`. Диалог ведёт **GPT-4o-mini** с tool-calling; заявки в **Supabase**, лиды и кнопки — **мини-CRM** в Telegram; опционально **КП**, **оценка вилки цены** после заявки, **экспорт в CRM** (webhook и/или amoCRM).

## Стек

- Node.js 20+ (ESM)
- Telegraf, Express (webhook на Railway)
- OpenAI GPT-4o-mini, Whisper-1, Vision
- `franc-min` — ускоренный детект ru/kk/en на длинных фразах
- `pdf-parse` — текст из цифровых PDF
- Supabase (Postgres): conversations, orders, leads, knowledge_base

## Структура `src/`

| Путь | Назначение |
|------|------------|
| `index.js` | `getMe()` → tenant, Express/webhook или long-polling |
| `config/tenants.js` | `TENANTS_JSON`: username бота → `manager_chat_id` |
| `bot/handlers.js` | Сообщения, финализация, менеджер, КП, CRM, шаблоны |
| `bot/templatesCatalog.js` | Шаблоны заказов + callback `tpl:*` |
| `bot/prompts.js`, `scenarios.js`, … | Промпты и сценарии |
| `services/openai.js` | Чат, `detectLang`, `estimatePriceHint`, КП |
| `services/whisper.js` | Транскрипция + отраслевой prompt |
| `services/supabase.js` | БД + `getAnalyticsSnapshot()` |
| `services/crmExport.js` | Webhook JSON + amoCRM + `exportLeadToAllIntegrations` |
| `services/fileExtract.js` | PDF → текст |
| `services/leads.js` | Лиды, scoring |

## Запуск локально

1. `cp .env.example .env` — обязательно: `BOT_TOKEN`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, `MANAGER_CHAT_ID`.
2. Опционально: `TENANTS_JSON`, `CRM_WEBHOOK_URL`, `AMOCRM_*`, `WEBHOOK_DOMAIN` (пусто = long-polling).
3. `npm install` → `npm start` (или `npm run dev`).

Миграции: Supabase SQL Editor → файлы в `supabase/migrations/`.

## Команды

**Клиент:** `/start`, `/reset`, `/help`, **`/templates`** (шаблоны).

**Менеджер** (чат из `MANAGER_CHAT_ID` или из `TENANTS_JSON` для данного бота):  
`/new`, `/active`, `/today`, `/leads`, `/reply`, `/assist`, `/proposal`, **`/stats`**, `/teach`, `/knowledge`, кнопки по лидам и КП.

## Деплой (Railway)

Сервис Node, env из `.env.example`, публичный URL в `WEBHOOK_DOMAIN` — бот сам вызовет `setWebhook`.

## Поля брифа

Обязательные для финала: `type`, `size`, `deadline`, `contact` (см. `orderSchema.js`). Плюс извлечённые сценарием поля.

## Статус и журнал

См. [STATE.md](STATE.md) в каталоге бота и корневой [STATE.md](../STATE.md) репозитория.
