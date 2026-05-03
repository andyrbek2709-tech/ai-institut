# Ad Intake Bot — Telegram-бот приёма заявок (рекламное агентство)

Бот для **приёма брифов** от клиентов агентства (в продакшене — бренд **vformate**): диалог на **русском и казахском** (и других языках по желанию клиента), текст, **голос** (Whisper), **фото** (Vision), **PDF** (извлечение текста), опционально **шаблоны заказов** (`/templates`). Ответы ведёт **LLM** (конфигурируемый провайдер, см. `services/openai.js`) с function-calling; данные — **Supabase**; для менеджеров — **мини-CRM в Telegram** (лиды, статусы, ответы клиенту).

**Актуальный прод (Railway + отдельный Supabase, логи, синхронизация env):** **[`docs/PRODUCTION_CURRENT.md`](docs/PRODUCTION_CURRENT.md)** — сюда сведено то, что нельзя потерять при смене ПК.

**Полная структура каталогов, потоки запуска, все переменные окружения и привязка к файлам:** **[`BOT_REFERENCE.md`](BOT_REFERENCE.md)** — один справочник «как всё устроено».

**Логи диалогов (лид / chat_id, голос как текст):** **[`docs/CONVERSATION_LOGS.md`](docs/CONVERSATION_LOGS.md)** — `/transcript`, скрипты `npm run dump:transcript` / `dump:last-conv`.

**Кому отдавать документ:** **`README.md`** (обзор) + **`BOT_REFERENCE.md`** (детали) + **`STATE.md`** (журнал по датам).

---

## Репозиторий и деплой

| Что | Где |
|-----|-----|
| Код в монорепо | `andyrbek2709-tech/ai-institut`, каталог **`ad-intake-bot/`** |
| Прод (типично) | **Railway**: сервис Node, root = `ad-intake-bot`, публичный URL в **`WEBHOOK_DOMAIN`** → `setWebhook` |
| База | **Supabase** (Postgres): диалоги, заказы, лиды, knowledge / RAG — см. **`docs/SUPABASE_DEDICATED_PROJECT.md`** и **`supabase/bundle_ad_intake_bot_schema.sql`** для нового пустого проекта |

Локально: Node **20+**, `cp .env.example .env`, заполнить секреты (имена переменных — в `.env.example`), `npm install` → `npm start` или `npm run dev`. Миграции SQL — в **`supabase/migrations/`** (применять в Supabase в нужном порядке для вашего проекта).

---

## Что уже реализовано (функционал)

### Клиент (личка с ботом)

- **`/start`** — логотип (компактный PNG для чата, см. `assets/README.md` и `npm run build:telegram-logo`) + короткая подпись; затем текст приветствия **kk + ru** (одинаковая структура: приветствие «компания в …», блок про язык и оформление заказа). Строка про шаблоны **в приветствии не дублируется** — шаблоны доступны через **`/help`** и команду **`/templates`**.
- **`/reset`** — сброс контекста и активной беседы в БД (пустая история); приветствие kk+ru без фото.
- **`/help`** — команды и подсказки.
- Сбор брифа по сценариям (тип услуги, размеры, срок, контакт, файлы и т.д.), многоязычность, подтверждение заявки («да» / финал).
- **Голос** → транскрипция; **фото** → анализ под бриф; **документы/PDF** — извлечение текста где возможно.
- Несколько услуг в одном обращении (очередь услуг), одна заявка по итогу — по логике `handlers.js` / intake helpers.

### Менеджеры (рабочий чат и/или whitelist)

- Уведомления о новой заявке с кнопками (**взять в работу**, **уточнить**, закрыть / отклонить и т.д.), лиды в таблице **`leads`**, скоринг, статусы.
- Команды: **`/leads`**, **`/stats`**, **`/reply`**, relay после «Уточнить», напоминание если лид долго в **`new`** (env **`MANAGER_LEAD_ACTION_NUDGE_MS`**).
- Reply-клавиатура быстрых команд **`/leads`** … после **`/start`**/**`/help`** в рабочем чате (для пользователей из **`MANAGER_TELEGRAM_USER_IDS`**), где настроено.
- Экспорт в внешнюю CRM (webhook / amoCRM) — при наличии env, см. `services/crmExport.js`.

### Технические исправления, важные для UX

- После **`/reset`** пустая активная беседа **не** подтягивает старый диалог из лида при следующем **`/start`** (гидратация в `handlers.js`).
- Логотип в Telegram: учёт масштабирования клиентом (широкий холст, trim), см. скрипт сборки и `src/config/agency.js`.
- У превью в **`/start`** отключено развёртывание ссылок в тексте (**`link_preview_options`**) там, где задано в коде.

### Бренд и копирайт

- Имя агентства и пути к лого: **`src/config/agency.js`** (`AGENCY_NAME`, `resolveAgencyLogoPath`, тексты приветствий и подписи к фото).

---

## Стек

- **Node.js** (ESM), **Telegraf**, **Express** (webhook).
- **OpenAI API** (чат, при необходимости Vision / Whisper — см. актуальный код `openai.js`, `whisper.js`).
- **Supabase** (`@supabase/supabase-js`).
- **`pdf-parse`**, **`franc-min`** (подсказка языка), прочее — см. **`package.json`**.

---

## Структура `src/` (кратко)

| Путь | Назначение |
|------|------------|
| `index.js` | Запуск: tenant, Express + webhook или long-polling |
| `config/agency.js` | Бренд vformate, тексты `/start`, пути к лого |
| `config/tenants.js` | `TENANTS_JSON`: бот → чат менеджера |
| `config/roles.js` | Менеджеры: `MANAGER_TELEGRAM_USER_IDS` |
| `bot/handlers.js` | Основная логика сообщений, /start, лиды, relay, финализация |
| `bot/prompts.js`, `scenarios.js`, `questions.js`, `orderSchema.js` | Промпты, сценарии, вопросы, схема заказа |
| `bot/templatesCatalog.js` | Шаблоны заказов, callback `tpl:*` |
| `bot/managerLeadNudge.js` | Напоминание менеджеру по «висящему» лиду |
| `services/openai.js` | LLM, детект языка, извлечение данных, КП и т.д. |
| `services/leads.js` | CRUD лидов, история, скоринг |
| `services/supabase.js` | БД |
| `services/crmExport.js` | Внешние CRM |
| `scripts/build-telegram-logo.mjs` | Сборка компактного лого для чата (devDependency **sharp**) |

---

## Переменные окружения

Полный список с комментариями — **`/.env.example`**. Обязательные для работы: **`BOT_TOKEN`**, **`OPENAI_API_KEY`** (или настройки альтернативного LLM, если вы их ввели), **`SUPABASE_URL`**, **`SUPABASE_KEY`**, **`MANAGER_CHAT_ID`**. Остальное — по необходимости (CRM, webhook, лого, тенанты, nudge).

Секреты в README не копировать.

---

## Что сейчас «в документации», а не в коде

- Живой журнал правок по дням — **`STATE.md`** (в этой папке). Там же исторические заметки про деплой, smoke-тесты, старые фиксы; при расхождении с кодом **приоритет у кода**, журнал стоит обновить.
- Корневой **`../STATE.md`** монорепо — общий след по EngHub и этому боту; для вопросов только про бота достаточно **`ad-intake-bot/README.md`** + **`ad-intake-bot/STATE.md`**.

---

## Полезные команды

```bash
npm install
npm start              # прод-режим
npm run dev            # watch
npm run build:telegram-logo   # пересобрать vformate-logo-telegram.png из vformate-logo.png (нужен sharp из devDependencies)
```

---

## Контакты продукта

Логика и тексты заточены под **рекламное агентство** (вывески, полиграфия, наружка и т.д.). Сайт заказчика для справки: [vformate.kz](https://vformate.kz/).
