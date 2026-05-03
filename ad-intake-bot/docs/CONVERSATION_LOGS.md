# Логи переписок (только проект бота в Supabase)

Рекламный бот пишет историю в **`conversations.history`** (JSONB: `role`, `content`, `ts`).  
**Голос клиента** после Whisper попадает в ту же цепочку как сообщение **`user`** с **текстом** — отдельного «сырого audio» в этой таблице нет.

Это **не** EngHub и не общие базы монорепо: используется только **`SUPABASE_URL` / `SUPABASE_KEY`** сервиса бота (например выделенный проект `pbxzxwskhuzaojphkeet`).

Сводка деплоя и переменных: **[`PRODUCTION_CURRENT.md`](PRODUCTION_CURRENT.md)**.

## 1. В Telegram (менеджер)

- **`/transcript <id лида>`** — полный лог по связке `leads` → `conversations`.
- **`/transcript chat <telegram_chat_id>`** — последняя беседа по `telegram_chat_id` клиента (приват с ботом).

Длинные логи режутся на несколько сообщений.

## 2. У себя в терминале (в т.ч. чтобы агент в Cursor прочитал вывод)

В **`ad-intake-bot/`** с файлом **`.env`** (те же ключи, что у бота):

```bash
npm run dump:transcript -- 42
npm run dump:transcript -- chat 123456789
```

После этого можно вставить вывод в чат с агентом: «вот лог, разберём».

## 3. Последняя беседа без лида

```bash
npm run dump:last-conv
```

См. также `scripts/dump-last-conversation.mjs`.

## 4. Разбор в Cursor без доступа к БД

Скопируйте сюда результат **`/transcript`** или скрипта — по тексту можно восстановить ветку диалога и ответы бота.
