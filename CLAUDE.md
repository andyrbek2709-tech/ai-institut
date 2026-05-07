# CLAUDE.md

Проект **EngHub** — внутренняя инженерная платформа проектного института.
Прочитай `STATE.md` — там вся актуальная картина (стек, тестовые юзеры, безопасность, открытые задачи, журнал).

## Жёсткие правила

1. **Старт сессии:** первым делом читать `STATE.md` (если нет — создать по шаблону).
2. **Email коммитов:** `andyrbek2709@gmail.com`. НЕ `andreyfuture27@gmail.com`.
3. **Push:** в `andyrbek2709-tech/ai-institut@main` — автономно через PAT (см. agent memory `secrets_github_pat.md`). Никогда не выдавать пользователю git-команды на копи-паст — клон в `/tmp`, edit, push.
4. **Cowork mount режет файлы при коммитах** — все правки только через клон в `/tmp` с PAT, не через прямую запись в смонтированный путь.
5. **«Готово»** говорим только после реального теста в браузере на проде: pushed + Railway READY + smoke end-to-end.
6. **Перед сменой Railway env / Supabase ключей** — спросить пользователя.
7. **STATE.md** — обновлять в одном коммите вместе с правкой. Новые записи сверху (новые впереди). **Каждое атомарное изменение — отдельная строка-буллет** в дневной записи. Подпроекты с собственным `STATE.md` (например `ad-intake-bot/STATE.md`) — дублировать туда только то, что касается этого подпроекта; полный след по репо — в корневом `STATE.md`. Секреты не писать (только имена env-переменных), персональные данные не писать, длинные диффы — ссылки на коммиты. Стиль: markdown, компактно, дата+время `YYYY-MM-DD HH:MM`. Если `STATE.md` противоречит коду — приоритет у кода, обновить `STATE.md`.
8. **VERCEL ДЕCOMMISSIONED** — Vercel не существует в архитектуре проекта. Никогда не деплоить на Vercel, не искать .vercel файлы, не использовать Vercel MCP для этого проекта. Railway = единственная production платформа.

## Layout

| Что | Куда |
|---|---|
| API Server | `https://api-server-production-8157.up.railway.app` (Railway, project ENGHUB) |
| Frontend | `https://enghub-frontend-production.up.railway.app` (Railway, root: `enghub-main/`) |
| GitHub | `andyrbek2709-tech/ai-institut`, ветка `main` |
| Локально | `D:\ai-institut` (фронт в `enghub-main/`) |
| Railway | project `ENGHUB`, team `andyrbek2709-techs-projects` |
| Supabase | project `inachjylaqelysiwtsux` |
| Standalone `andyrbek2709-tech/enghub` | НЕ использовать |

**Кратко:** открыл проект → прочитал `STATE.md` → сделал правку → дописал сверху в `STATE.md` → закоммитил вместе с правкой → запушил.
