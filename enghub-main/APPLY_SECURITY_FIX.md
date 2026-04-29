# Применить security-fix (B3) — инструкции для Andrey

> Из-за блокировки `.git/index.lock` в sandbox-среде, коммит подготовлен в виде git-bundle. Финальный push надо сделать вручную из PowerShell на твоей машине.

## Что внутри коммита

1. **9 серверных endpoint'ов** в `enghub-main/api/*` — все admin-операции теперь через них.
2. **Фронт переписан**: убран `SERVICE_KEY`/`AdminH`, ходим через `apiFetch('/api/...')`.
3. **STATE.md** обновлён, **`enghub-main/BUG_FIX_PLAN_2026-04-29.md`** содержит полный план.

## Шаг 1 — применить коммит локально

Bundle лежит в Cowork outputs:
**Путь к bundle:** `<твоя outputs-папка Claude>\security-fix.bundle`
(можно видеть его по ссылке ниже, скопируй в `D:\ai-institut\` или удобную папку).

```powershell
cd D:\ai-institut

# Проверить, на каком коммите ты сейчас
git log --oneline -3
# Должен быть 7bdc679 наверху (z-index fix). Если нет — git pull origin main

# Применить bundle
git fetch C:\Users\Admin\AppData\Roaming\Claude\local-agent-mode-sessions\750ac4f0-d300-4b34-9543-b342438d980f\cffb028f-10e3-4b71-a968-a645609b527d\local_69314a94-74e3-4488-87ec-4d6376a55ea0\outputs\security-fix.bundle main
# Получишь FETCH_HEAD с новым коммитом

# Слить в main
git merge --ff-only FETCH_HEAD
# Должно быть Fast-forward; HEAD теперь на новом коммите 15f3901

# Push на GitHub
git push origin main
```

> Если `git fetch <bundle> main` не находит ref — попробуй `git fetch <bundle> refs/heads/main:refs/heads/security-fix && git checkout main && git merge security-fix`.

## Шаг 2 — Vercel: убрать ключ из публичного env

1. https://vercel.com/dashboard → проект EngHub → **Settings** → **Environment Variables**.
2. Найти **`REACT_APP_SUPABASE_SERVICE_KEY`** во всех трёх средах (Production, Preview, Development) → **Delete**.
3. Убедиться, что **`SUPABASE_SERVICE_KEY`** (без `REACT_APP_`) присутствует — серверные функции его используют.
4. Если есть `REACT_APP_SUPABASE_SERVICE_ROLE_KEY` или похожие — удалить тоже.
5. Vercel сам перезапустит билд после push — но если хочешь форсировать: **Deployments** → последний → **Redeploy**.

## Шаг 3 — Supabase: ротировать service_role

1. https://supabase.com/dashboard/project/jbdljdwlfimvmqybzynv → **Settings** → **API Keys**.
2. Если используешь **legacy JWT keys** (старая вкладка):
   - "Legacy anon, service_role JWT" → **Roll** на service_role → подтвердить.
   - Скопировать новый JWT.
3. Если ты уже на **новых ключах** (`sb_secret_*` / `sb_publishable_*`) — bundle обнаружил их в JS:
   - **+ New secret key** → создать `sb_secret_*`.
   - **Скопировать**.
   - Перейти к старому ключу → **Revoke**.
4. В Vercel обновить `SUPABASE_SERVICE_KEY` на новый секрет.
5. **Redeploy** в Vercel (Deployments → Redeploy).

## Шаг 4 — Проверка

После redeploy:

```powershell
# (А) Старый утёкший ключ должен дать 401
curl.exe -s -o nul -w "%{http_code}`n" `
  -H "apikey: <УТЕКШИЙ_СТАРЫЙ_КЛЮЧ>" `
  -H "Authorization: Bearer <УТЕКШИЙ_СТАРЫЙ_КЛЮЧ>" `
  "https://jbdljdwlfimvmqybzynv.supabase.co/rest/v1/app_users?select=id&limit=1"
# Ожидаем: 401

# (Б) Bundle не должен содержать service_role
curl.exe -s "https://enghub-three.vercel.app/static/js/main.*.js" | findstr /C:"service_role"
# Ожидаем: пусто. (если main.*.js — поменялся, найди актуальный по DevTools → Network)
```

В браузере:
- Логин troshin.m@nipicer.kz / Test1234! — работает.
- Карточка задачи → "📰 Активность" — лента показывается (теперь через /api/activity-log).
- Создать новую задачу — уведомления приходят (через /api/notifications-create).
- AdminPanel: создать тестового юзера → должен создаваться через /api/admin-users.
- AdminPanel: сменить пароль юзера → через /api/admin-users action=reset_password.

## Если что-то сломалось

Откатить коммит:
```powershell
git revert HEAD
git push origin main
```
Это вернёт старое поведение (с дырой) — но временно работающее.

Затем посмотреть Vercel runtime logs (`vercel logs` или Dashboard → Functions → Logs) — большинство ошибок будут вида "401 Unauthorized" (если RLS не настроена правильно для новой схемы). В таком случае нужна миграция RLS — см. `enghub-main/BUG_FIX_PLAN_2026-04-29.md` раздел 1.7.

## Что осталось (B4, B1, B6)

В этой сессии я не успел:
- **B4** — multi-project дашборды (Lead/Engineer видят только активный проект). Решение в плане раздел 3.
- **B1** — KPI skeleton для устранения мерцания 0/0/0/0. Раздел 4.
- **B6** — sync тестовых юзеров с реальной БД. Раздел 6.

Эти баги не критичны — приоритет был на B3 security.
