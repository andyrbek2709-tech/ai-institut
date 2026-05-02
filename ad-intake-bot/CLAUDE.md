# AdIntakeBot — правила проекта

## Что это

Telegram-бот для рекламного агентства: принимает заявки от клиентов через voice + text + файлы, ведёт диалог GPT-4o-mini, сохраняет в Supabase, форвардит менеджеру.

## Reference

Каркас построен на базе **D:\Nurmak** (рабочий аналог для грузоперевозок).
При расширении — сначала смотрим, как сделано там, потом адаптируем.

## Конвенции

- **Email коммитов:** `andyrbek2709@gmail.com`
- **Имя коммитов:** `Andrey`
- **Ветка по умолчанию:** `main`
- **Коммитить через:** `git -c user.email=andyrbek2709@gmail.com -c user.name=Andrey commit -m "..."`
- **Стиль коммитов:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`)
- **Push:** автономно через PAT, когда репо будет создан на GitHub. Текущий PAT настроен на `ai-institut` — для нового репо нужен либо новый PAT, либо расширение scope существующего. См. STATE.md → TODO.

## Состояние

Текущее состояние всегда в `STATE.md` (что сделано, что в работе, что блокирует).
Обновлять после каждого крупного шага.

## Структура

См. README.md → раздел «Структура».
- `src/bot/` — диалоговая логика (handlers + prompts)
- `src/services/` — внешние интеграции (OpenAI, Whisper, Supabase)
- `src/utils/` — утилиты (in-memory state)
- `supabase/migrations/` — SQL-миграции

## Принципы

- **Минимум компонентов.** Никаких RAG / Redis / multi-agent. MVP.
- **Один вопрос за раз** в диалоге. Не давить на клиента.
- **Voice-first дружелюбно** — клиенту удобно наговорить, мы поймём.
- **Файлы — first-class.** Макет/фото/ТЗ привязываются к заявке.

## Master-board

Доска задач — общая на все проекты, на EngHub:
https://enghub-three.vercel.app/agenda.html
Карточки AdIntakeBot добавляются туда (поле `project: "AdIntakeBot"`), отдельную доску в этом репо НЕ держим.

## Безопасность

- Никаких секретов в репо. Только `.env.example`.
- `MANAGER_CHAT_ID` — единственная авторизация для команд `/new`, `/active`, `/today`, кнопок Принять/Отклонить.
- Supabase — service_role key, RLS включён.
