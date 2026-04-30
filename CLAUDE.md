# CLAUDE.md

Проект **EngHub** — внутренняя инженерная платформа проектного института.
Прочитай `STATE.md` — там вся актуальная картина (стек, тестовые юзеры, безопасность, открытые задачи, журнал).

## Жёсткие правила

1. **Email коммитов:** `andyrbek2709@gmail.com`. НЕ `andreyfuture27@gmail.com`.
2. **Push:** в `andyrbek2709-tech/ai-institut@main` — автономно через PAT (см. agent memory `secrets_github_pat.md`). Никогда не выдавать пользователю git-команды на копи-паст — клон в `/tmp`, edit, push.
3. **Cowork mount режет файлы при коммитах** — все правки только через клон в `/tmp` с PAT, не через прямую запись в смонтированный путь.
4. **«Готово»** говорим только после реального теста в браузере на проде: pushed + Vercel READY + smoke end-to-end.
5. **Перед сменой Vercel env / Supabase ключей** — спросить пользователя.
6. **STATE.md** — обновлять в одном коммите вместе с правкой. Новые записи сверху, секреты не писать (только имена env-переменных).

## Layout

| Что | Куда |
|---|---|
| Прод | `https://enghub-three.vercel.app` |
| GitHub | `andyrbek2709-tech/ai-institut`, ветка `main` |
| Локально | `D:\ai-institut` (фронт в `enghub-main/`) |
| Vercel | project `enghub`, team `andyrbek2709-techs-projects`, Root Directory `enghub-main` |
| Supabase | project `jbdljdwlfimvmqybzynv` |
| Standalone `andyrbek2709-tech/enghub` | НЕ использовать — не подключён к Vercel |
