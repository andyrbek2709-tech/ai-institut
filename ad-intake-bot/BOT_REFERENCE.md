# Справочник бота (структура, как работает, настройки)

Один файл со всем, что относится к **работе** Telegram-бота приёма заявок рекламного агентства (бренд **vformate** в конфиге). Журнал правок по датам — в **`STATE.md`**. Краткий обзор для людей — в **`README.md`**.

**Актуальный прод (Railway, отдельный Supabase под бота, синхронизация env, логи):** [`docs/PRODUCTION_CURRENT.md`](docs/PRODUCTION_CURRENT.md).

---

## 1. Дерево каталога (важное)

```
ad-intake-bot/
├── package.json              # зависимости, scripts: start, dev, build:telegram-logo
├── .env.example              # шаблон переменных окружения (секреты не коммитить)
├── README.md                 # обзор и онбординг
├── BOT_REFERENCE.md          # этот файл
├── STATE.md                  # журнал изменений
├── assets/
│   ├── README.md             # логотипы и сборка vformate-logo-telegram.png
│   ├── vformate-logo.png     # исходник лого
│   └── vformate-logo-telegram.png  # сгенерированный компактный вариант для чата
├── scripts/
│   ├── build-telegram-logo.mjs     # sharp: trim + холст под Telegram (env см. assets/README)
│   ├── dump-last-conversation.mjs  # npm run dump:last-conv
│   └── export-conversation-by-lead.mjs  # npm run dump:transcript -- <lead_id> | chat <id>
├── supabase/migrations/      # SQL: схема conversations, orders, leads, …
└── src/
    ├── index.js              # точка входа: env, Telegraf, webhook или polling, followup
    ├── config/
    │   ├── agency.js         # AGENCY_NAME, тексты /start /reset, путь к лого, клавиатура менеджера
    │   ├── tenants.js        # TENANTS_JSON → manager_chat_id по @username бота
    │   └── roles.js          # MANAGER_TELEGRAM_USER_IDS
    ├── bot/
    │   ├── handlers.js       # основная логика: команды, текст, голос, файлы, лиды, relay, /transcript
    │   ├── prompts.js      # system prompt, локализация
    │   ├── scenarios.js    # ветвление по типу услуги
    │   ├── questions.js    # тексты вопросов по шагам
    │   ├── orderSchema.js  # поля заказа, обязательные поля
    │   ├── templatesCatalog.js   # /templates, callback tpl:*
    │   ├── intakeHelpers.js      # очередь услуг, merge брифа
    │   ├── managerLeadNudge.js   # таймер напоминания менеджеру по лиду new
    │   └── followup.js     # планировщик follow-up (если используется)
    ├── services/
    │   ├── openai.js         # LLM (чат, extract, vision, …), LLM_* env
    │   ├── whisper.js      # голос → текст (OPENAI_API_KEY)
    │   ├── supabase.js     # клиент БД
    │   ├── leads.js        # лиды, скоринг, история
    │   ├── crmExport.js    # webhook / amoCRM
    │   └── fileExtract.js  # PDF и пр.
    └── utils/
        └── state.js          # in-memory контекст диалогов по chat id
```

---

## 2. Запуск и жизненный цикл процесса

1. **`index.js`** проверяет обязательные переменные: `BOT_TOKEN`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, `MANAGER_CHAT_ID`. При отсутствии любой — `process.exit(1)`.
2. Создаётся **`Telegraf(BOT_TOKEN)`**, вызывается **`getMe()`**, в **`tenants.js`** сохраняется `@username` бота для мульти-тенанта.
3. **`registerHandlers(bot)`** (`handlers.js`) вешает команды и обработчики `text`, `voice`, `audio`, `photo`, `document`, `callback_query`.
4. **`startFollowupScheduler(bot)`** — фоновые напоминания (см. `followup.js`).
5. Режим работы:
   - Если задан **`WEBHOOK_DOMAIN`**: поднимается **Express** на **`PORT`** (по умолчанию 3000), маршруты **`GET /health`** → `OK`, **`POST /webhook/<BOT_TOKEN>`** → приём апдейтов; вызывается **`setWebhook(WEBHOOK_DOMAIN + /webhook/ + BOT_TOKEN)`**.
   - Если **`WEBHOOK_DOMAIN`** пусто: **`deleteWebhook`**, затем **`bot.launch()`** (long polling).

Остановка: `SIGTERM` / `SIGINT` → `bot.stop()`.

---

## 3. Потоки данных (упрощённо)

### Клиент (личка, не менеджер из whitelist)

- **`/start`**: при необходимости **`hydrateClientContextFromDb`** (восстановление из Supabase; пустая активная беседа не подмешивает историю лида). Сброс контекста в памяти → фото лого (если есть файл по **`resolveAgencyLogoPath`**) + подпись из **`buildStartPhotoCaption`**, второе сообщение — **`buildStartWelcomeBody`** (kk + ru).
- **Текст / голос / фото / документ**: нормализация для LLM, извлечение в **`orderData`**, сценарии **`scenarios.js`** / вопросы **`questions.js`**, ответ LLM через **`openai.js`**. Голос: **`whisper.js`** (ключ **`OPENAI_API_KEY`**).
- **Финал заявки**: запись в Supabase (**`orders`**, **`conversations`**), создание **лида**, **`notifyManager`** в чат менеджера (кнопки, скоринг), опционально **`exportLeadToAllIntegrations`**.

### Менеджер

- **Чат менеджера**: id из **`getManagerChatId()`** — либо **`MANAGER_CHAT_ID`**, либо значение из **`TENANTS_JSON`** для текущего бота.
- Команды **`/leads`**, **`/stats`**, **`/reply`**, **`/new`**, **`/active`**, **`/today`**, **`/assist`**, **`/proposal`**, **`/teach`**, **`/knowledge`** обёрнуты в **`ownerOnly`** — доступ из «рабочего» чата и/или по правилам ролей (см. код `handlers.js`).
- **`MANAGER_TELEGRAM_USER_IDS`**: если задан, менеджеры в **личке** с ботом не проходят клиентский intake; им показывается клавиатура быстрых команд и **`/leads`** и т.д.
- **Relay «Уточнить»**: одно сообщение менеджера уходит клиенту (через утилиты relay + полировка текста в **`openai.js`**).

### Лиды и напоминание

- Таблица **`leads`** (Supabase), сервис **`services/leads.js`**.
- **`managerLeadNudge.js`**: если лид в статусе **`new`** дольше интервала **`MANAGER_LEAD_ACTION_NUDGE_MS`** (мс), в чат менеджеров уходит одно напоминание (можно отключить `0`).

---

## 4. Переменные окружения (полный список по коду)

Секреты в репозиторий не класть. Имена ниже — то, что читает приложение.

### Обязательные при старте (`index.js`)

| Переменная | Назначение |
|------------|------------|
| **`BOT_TOKEN`** | Токен бота от @BotFather |
| **`OPENAI_API_KEY`** | Ключ OpenAI (обязателен для `index.js`; Whisper использует его явно) |
| **`SUPABASE_URL`** | URL проекта Supabase |
| **`SUPABASE_KEY`** | Service role key (серверный доступ к БД) |
| **`MANAGER_CHAT_ID`** | ID чата (группа/супергруппа или пользователь), куда уходят карточки заявок |

### LLM чата (`services/openai.js`)

| Переменная | По умолчанию / поведение |
|------------|---------------------------|
| **`LLM_API_KEY`** | Если задан — ключ для LLM; иначе **`OPENAI_API_KEY`** |
| **`LLM_BASE_URL`** | База API; по умолчанию **`https://api.deepseek.com`** |
| **`LLM_MODEL`** | Имя модели; по умолчанию **`deepseek-v4-flash`** |

### Менеджеры и тенанты

| Переменная | Назначение |
|------------|------------|
| **`MANAGER_TELEGRAM_USER_IDS`** | Список Telegram **user id** через запятую — whitelist менеджеров; личка с ботом для них = режим менеджера |
| **`TENANTS_JSON`** | JSON: `{"bot_username_without_at": {"manager_chat_id": "-100..."}}` — свой чат менеджера на бота |
| **`MANAGER_LEAD_ACTION_NUDGE_MS`** | Интервал напоминания о лиде `new` в мс; **`0`** — выключено |

### Бренд и лого (`config/agency.js`, скрипт лого)

| Переменная | Назначение |
|------------|------------|
| **`AGENCY_LOGO_PATH`** | Абсолютный путь к PNG/JPG; если задан и файл есть — подменяет встроенные `assets/*.png` |

Переменные **только для скрипта** `npm run build:telegram-logo` (не runtime бота):  
`TELEGRAM_LOGO_INNER_MAX_H`, `TELEGRAM_LOGO_REF_CHAT_W`, `TELEGRAM_LOGO_TARGET_SCREEN_H`, `TELEGRAM_LOGO_TRIM_THRESHOLD`, `TELEGRAM_LOGO_PAD_X`, `TELEGRAM_LOGO_PAD_Y` — см. **`assets/README.md`**.

### CRM (`services/crmExport.js`)

| Переменная | Назначение |
|------------|------------|
| **`CRM_WEBHOOK_URL`** или **`BITRIX24_INCOMING_WEBHOOK`** | POST JSON лида после уведомления |
| **`AMOCRM_SUBDOMAIN`**, **`AMOCRM_ACCESS_TOKEN`**, **`AMOCRM_PIPELINE_ID`** | amoCRM |
| **`AMOCRM_BASE_URL`** | Необязательно, если домен нестандартный |

### HTTP / деплой

| Переменная | Назначение |
|------------|------------|
| **`WEBHOOK_DOMAIN`** | Публичный origin без завершающего слэша (например `https://xxx.up.railway.app`). Пусто = long polling |
| **`PORT`** | Порт Express (Railway часто задаёт сам) |

Файл **`.env.example`** в корне бота — копировать в **`.env`** и заполнять; при добавлении новых переменных в код их стоит дублировать комментарием в **`.env.example`**.

---

## 5. Регистрация обработчиков (`registerHandlers`)

Порядок в **`handlers.js`** (фрагмент): `bot.start` → команды **`/new`**, **`/active`**, **`/today`**, **`/leads`**, **`/reply`**, **`/assist`**, **`/proposal`**, **`/stats`**, **`/templates`**, **`/teach`**, **`/knowledge`**, **`/help`**, **`/reset`** → затем **`bot.on('text'|'voice'|'audio'|'photo'|'document'|'callback_query')`**.

Команда **`/templates`** доступна и клиенту (каталог шаблонов).

---

## 6. База данных (ориентир)

Миграции в **`supabase/migrations/`** — источник правды по таблицам. Типично: **`conversations`** (история, статус, metadata), **`orders`**, **`leads`**, при необходимости **`knowledge_base`**. RLS и ключи — настраиваются в Supabase под вашу политику; бот использует **service role** через **`SUPABASE_KEY`**.

---

## 7. Константы бренда в коде

- **`src/config/agency.js`**: **`AGENCY_NAME`**, **`resolveAgencyLogoPath`**, **`buildStartPhotoCaption`**, **`buildStartWelcomeBody`**, **`buildResetWelcomeText`**, **`getManagerLeadsKeyboardMarkup`**, экспорт чисел для документации сборки лого.

Имя и тексты меняются там (или через **`AGENCY_LOGO_PATH`** для картинки).

---

## 8. Что читать дальше

| Файл | Зачем |
|------|--------|
| **`README.md`** | Коротко «что за проект» |
| **`STATE.md`** | Что меняли по датам |
| **`assets/README.md`** | Логотипы и сборка PNG |
| **`src/bot/prompts.js`** | Поведение LLM в диалоге |
| **`src/bot/orderSchema.js`** | Поля заказа и обязательность |
