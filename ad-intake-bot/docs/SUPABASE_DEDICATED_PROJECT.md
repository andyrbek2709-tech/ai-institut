# Отдельный Supabase только под Ad Intake Bot

Цель: бот и RAG хранятся в **своём** проекте (например `https://pbxzxwskhuzaojphkeet.supabase.co`), а не в общей БД EngHub.

**Краткая сводка прода (Railway, URL, пути `.env`, скрипты):** [`PRODUCTION_CURRENT.md`](PRODUCTION_CURRENT.md).

## 1. Схема (таблицы, RLS, pgvector)

1. Откройте **новый** проект в Supabase → **SQL Editor**.
2. Откройте файл репозитория **`supabase/bundle_ad_intake_bot_schema.sql`**, скопируйте **весь** текст, вставьте в редактор, нажмите **Run**.
3. Убедитесь, что ошибок нет. В **Table Editor** должны появиться: `conversations`, `orders`, `leads`, `knowledge_base`, `knowledge_items`.

Повторно весь бандл на уже созданные политики лучше не гонять — при необходимости правьте точечно или создавайте новый проект.

## 2. Переменные бота (Railway / локально)

В сервисе бота выставьте:

- **`SUPABASE_URL`** = `https://<ref>.supabase.co`
- **`SUPABASE_KEY`** = **service_role** (Settings → API → `service_role` secret)

Без смены этих переменных бот продолжит писать в старый проект.

**Автоподстановка в Railway** (из `.env` в `ad-intake-bot` или `D:\AdIntakeBot\.env`, формат `KEY=value`):

```bash
cd ad-intake-bot
npm run railway:sync-supabase
```

## 3. Копирование **данных** со старого Supabase (не обязательно)

Бандл создаёт **только пустую схему**. Чтобы перенести строки (диалоги, лиды, knowledge):

- либо **Database → Backups / SQL** в старом проекте и восстановление в новый (удобнее админам),
- либо экспорт CSV по таблицам и импорт в новый,
- либо `pg_dump` / `pg_restore` по connection string (**Settings → Database**) — для продвинутых.

Типичный запуск бота с нуля: **данные не переносят**, только схема.

## 4. Логи переписок (лид / chat_id)

См. **`docs/CONVERSATION_LOGS.md`**: команда менеджера **`/transcript`**, скрипты **`npm run dump:transcript`** и **`dump:last-conv`**.

## 5. Локальный дамп последнего диалога

При заполненном **`ad-intake-bot/.env`**:

```bash
cd ad-intake-bot
npm run dump:last-conv
```

## 6. Project ref

Ref в URL: `https://pbxzxwskhuzaojphkeet.supabase.co` → **`pbxzxwskhuzaojphkeet`**.
