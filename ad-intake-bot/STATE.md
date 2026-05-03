# AdIntakeBot — состояние

_Последнее обновление: 2026-05-03_

## 2026-05-03 — лого для чата (холст 400×48)

- `vformate-logo-telegram.png` — широкий холст, чтобы в ленте не раздувалось по высоте; `npm run build:telegram-logo`; `/start` с `link_preview_options.is_disabled`.

## 2026-05-03 — /start: лого + kk/ru «в формате»

- Сначала фото `assets/vformate-logo.png` с короткой подписью, затем текст kk+ru («Бұл/Эта компания — в формате»); без английского блока.

## 2026-05-03 — брендинг vformate

- Логотип `assets/vformate-logo.png` в приветствии `/start`, конфиг `src/config/agency.js`, правки `prompts.js` и строк в уведомлении лида / help / reset.

## 2026-05-03 — /reset + лиды UI

- Пустая активная беседа не тянет историю из лида; `/reset` снова kk+ru; менеджеру клавиатура быстрых команд `/leads`.

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

## 2026-05-03 — FIX: relay менеджера + LLM после «Уточнить»

- **Напоминание менеджеру:** если лид остаётся `new` ~5 мин — одно сообщение в чат менеджеров (env `MANAGER_LEAD_ACTION_NUDGE_MS`, `0` = выкл); флаг в `leads.data`.
- **Файлы в уведомлении лида:** вместо сырой ссылки на `api.telegram.org` — отправка как фото/документ в Telegram; подсказка по голосу без активного «Уточнить».
- **Ранний запрос логотипа/макета:** обновлены `questions.js` (шаг `design`) и `prompts.js`, чтобы бот явно предлагал прислать файл на этапе макета, а не «забывал» до конца.
- **Доп. фикс по файлам:** если менеджер запросил «пришлите логотип/файл/макет», следующий файл клиента теперь пересылается напрямую менеджеру (как вложение через `copyMessage`) без Vision-анализа и без лишних уточняющих сообщений клиенту.
- **Relay-перефраз:** усилены правила `polishRelayForClient`, чтобы не терялись ключевые слова запроса (логотип/файл/срок).

- **Симптом:** транскрипт голоса менеджера уходил клиенту дословно («скажи клиенту…»); после ответа клиента (в т.ч. голосом) — «Что-то пошло не так».
- **Причины:** (1) не было перефразирования под клиента; (2) в `conversations.history` роль `manager` попадала в `chat.completions` как невалидная роль.
- **Исправление:** `polishRelayForClient` в relay и `/reply`; `normalizeDialogForLlm` перед вызовом LLM; подсказка в UI «Уточнить».
- **Файлы:** `src/services/openai.js`, `src/bot/handlers.js`.

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

---

## 2026-05-02 — HOTFIX: бот игнорировал текст/голос от менеджера

**Симптом:** `/start` отвечал, но «вывеска», голосовые и фото — молчали.

**Причина:** `handleText/handleVoice/handleFile` имели guard
`if (chat.id === MANAGER_CHAT_ID) return` — задумывалось как защита от
случайных LLM-вызовов в чате менеджера, но менеджер у нас и есть
единственный тестировщик (chat 463076251 = MANAGER_CHAT_ID), поэтому всё,
кроме команд, дропалось.

**Fix:** убрал guard'ы из text/voice/file. Менеджерские маршруты
(`/new`, `/active`, `/today`, callback_query) остались в порядке —
они роутятся ДО `bot.on('text')`.

**Commit:** `8cfcea9` `fix(ad-intake-bot): handle text/voice/files for manager too`
**Verified:** POST синтетического update'а на `/webhook/<TOKEN>` → 200,
тело ответа `sendChatAction:typing` для chat 463076251. Никаких
последующих ошибок в `getWebhookInfo`. Бот реально отвечает.

---

## 2026-05-02 — FEAT: автоопределение языка (ru/kk/en) + бейдж в карточке

**Что сделано:**
- `/start` многоязычный (RU+KK+EN, без кнопок выбора)
- Автодетект через `gpt-4o-mini` (дешевый промт, 1 токен ответ) на каждой текстовой реплике клиента — это позволяет ловить и переключение языка по ходу диалога
- В `prompts.js` system-prompt параметризован: подставляется «русский / казахский / English»
- `whisper.js` принимает `language` хинт, когда язык уже известен
- Supabase: новые колонки `conversations.lang` и `orders.lang` (миграция `002_add_lang.sql`, применена через MCP)
- Менеджеру в карточке заявки первая строка теперь содержит бейдж: `🆕 Новая заявка №xxxx [🇰🇿 KZ]` (или RU / EN)
- Флаг-эмодзи (🇷🇺 / 🇰🇿 / 🇬🇧) префиксится в ответ бота **только при смене языка** — чтобы не загромождать диалог
- Финальное подтверждение `✅ Заявка №xxxx принята!` локализовано (ru/kk/en)

**Commit:** `f453a28` `feat(ad-intake-bot): auto language detection (ru/kk/en) with flag prefix`
**Push:** в `andyrbek2709-tech/ai-institut`, ветка `main`. Railway автодеплой из `main`.
**Локально:** D:\AdIntakeBot — синхронизирован с repo (handlers/prompts/openai/whisper/supabase/state + migration).
**Smoke-тест:** из песочницы Railway/api.telegram.org в allowlist нет → нужен реальный тест от пользователя.

---

## 2026-05-02 — FEAT: переписан system prompt — менеджер рекламного агентства

**Что сделано:**
- `src/bot/prompts.js` → SYSTEM_PROMPT_BASE полностью переписан
- Новая роль: «менеджер рекламного агентства», не анкета
- Принцип: сначала ПОНЯТЬ (отразить что услышал) → потом СПРАШИВАТЬ
- Логика для вывесок: место → размер → содержание → макет → срок → контакт
- Реакция на изображения обязательна: комментарий + уточняющий вопрос
- Контакт: переспрашивать мягко если непонятно («лучше телефон или Telegram?»)
- Многоязычность сохранена — блок `{LANG_NAME}` поднят в начало промта (КРИТИЧНО)
- `SAVE_ORDER_FUNCTION` schema НЕ изменена (поля те же)
- `handlers.js` / `openai.js` / `whisper.js` — без изменений (один промт на всех)

**Commit:** `4733875` `feat(ad-intake-bot): rewrite system prompt — conversational manager with sign-shop logic`
**Push:** в `andyrbek2709-tech/ai-institut`, ветка `main` (Railway автодеплой).
**Verified:** `/health` = OK, Telegram `sendMessage` chat 463076251 → `ok:true, message_id=40`. Пользователю отправлено уведомление: «🤖 Промт обновлён, бот перезапущен на Railway. Можно тестировать».

---

## 2026-05-02 — FEAT: формальная структурированная экстракция (orderSchema + extractData + mergeData)

**Что сделано:**
- `src/bot/orderSchema.js` — каноническая схема ORDER_SCHEMA (type/location/size/needs_measurement/content/design/lighting/where_use/shape/material/quantity/sizes/print_type/paper_type/item/deadline/budget/contact/description/files), helpers `makeEmptyOrder`, `normalizeToSchema` (service_type→type), `REQUIRED_FIELDS = [type,size,deadline,contact]`.
- `src/bot/extractPrompt.js` — `EXTRACT_SYSTEM` (мультиязычный ru/kk/en, выдаёт ТОЛЬКО JSON-delta) + `buildExtractUserMessage(currentData, userMessage)`.
- `src/services/openai.js` — добавлены `extractData(userMessage, currentData, lang)` и `mergeData(existing, delta)` (правила: null→skip, files→append+dedup, boolean→overwrite, longer string wins) + `missingRequiredFields()`. `extractPartialBrief` оставлен как legacy-источник для совместимости.
- `src/bot/handlers.js` — после каждого text/voice/file: `extractData → mergeData` → `entry.orderData`. Файлы из `handleFile` подмешиваются как `{files:[url], design:"есть макет"}`. В `processUserMessage` логируем входящее сообщение, delta и итоговый orderData. В `finalizeOrder` валидация обязательных полей (type/size/deadline) — если пусто, задаём вопрос на нужном языке через `getQuestion(lang, step)` вместо сохранения. orderData также пишется в `orders.json_data.order_data` и в `conversations.metadata.order`.
- `src/services/supabase.js` — `upsertConversation` принимает опциональный `metadata`; есть graceful fallback если колонки ещё нет (повторяет insert/update без metadata).
- `supabase/migrations/003_add_metadata.sql` — `ALTER TABLE conversations ADD COLUMN metadata JSONB`. Применена через MCP к проекту `jbdljdwlfimvmqybzynv`. Индекс GIN на metadata.

**Существующая логика (НЕ ломалось):** scenarios.js, questions.js, prompts.js, classifyServiceTypeLLM, extractPartialBrief, branching по service_type, многоязычность ru/kk/en — всё работает как раньше; новые extractData/mergeData параллельно собирают формальный JSON.

**Sanity-tests** (мердж локально через node, без openai-deps): files dedup, null→skip, boolean overwrite, longer-string-wins, missing-required — все ок.

**Принципы:** «не задавать промежуточных вопросов сверх существующих сценариев» — финальная валидация только в момент save_order; обычный диалог идёт через `nextStepFor + getQuestion` как и раньше.

---

## 2026-05-02 — FEAT: in-Telegram CRM (leads + score + действия + /leads + /reply)

**Что сделано:**
- `supabase/migrations/004_leads.sql` — новая таблица `leads` (id BIGSERIAL, conversation_id UUID, order_id UUID, telegram_user_id/chat_id BIGINT, status, lead_score 0-100, assigned_to, data JSONB), индексы по status/assigned/created/score, RLS включён, политика `service_role_all`. Применена через Supabase MCP к проекту `jbdljdwlfimvmqybzynv`.
- `src/services/leads.js` — `calcLeadScore` (полнота +30, дедлайн <7д +20 / 7-30д +10, бюджет +15, качественный контакт +10, файлы +10), `scoreBadge` (🔥/🟡/🔵), CRUD: createLead/getLeadById/updateLead/getLeadsByStatus/getLeadsByTier/getLeadsSummary, `appendConversationMessage`.
- `src/bot/handlers.js`:
  - `finalizeOrder` теперь после INSERT в orders создаёт лида (orderId связан, score рассчитан).
  - `notifyManager` — новые inline-кнопки: 🎯 Взять в работу / 💬 Уточнить / ✓ Закрыть / ✗ Отклонить. Заголовок: «🆕 Новый лид #ID [LANG] 🔥/🟡/🔵 (score)».
  - `handleLeadCallback` — обрабатывает `lead:take/clarify/close/reject/open`. take ставит in_progress + assigned_to. clarify открывает ForceReply, перехватывается в `handleText`, сообщение менеджера форвардится клиенту с префиксом «Менеджер:» (локализовано ru/kk/en) и логируется в conversation.history.
  - Новая команда `/leads` (только менеджер): без аргументов — сводка (всего/активных, по статусам, по tier). `/leads new|in_progress|closed|rejected` — список с кнопкой [Открыть]. `/leads hot|warm|cold` — фильтр по score. `/leads <ID>` — детали лида + последние 10 сообщений диалога + кнопки действий.
  - Новая команда `/reply N <текст>` — менеджер пишет клиенту по лиду N. Если статус был new — переводится в in_progress.
  - Старые `accept`/`reject` callbacks сохранены как fallback.
- Многоязычность ru/kk/en сохранена для клиентских сообщений (close/reject/manager-reply prefix). Менеджерские тексты — на русском.

**Принципы соблюдены:** никакого веб-приложения, всё через Telegram. Существующие таблицы orders/conversations не затронуты. Команды менеджера авторизуются по `MANAGER_CHAT_ID`.

