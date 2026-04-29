# BUG FIX PLAN — EngHub — 2026-04-29

> Единый план устранения багов, найденных QA-прогоном `QA_REPORT_2026-04-29.md`. Составлен на основе параллельного исследования (5 агентов: web/github/reddit/docs/codebase) + аудита кода.
>
> **Главное:** в production-bundle утекает `service_role` JWT — RLS полностью обходится. Это блокер. Остальное — после.

---

## TL;DR — что делаем

| # | Баг | Severity | План | Срок |
|---|---|---|---|---|
| **B3** | service_role в JS-bundle | 🚨 CRITICAL | Server-only admin, ротация ключа, миграция 9 endpoints | 1 день |
| **B2** | z-index модалок | 🟡 уже фикс | Push коммита + system-wide ModalStack | 30 мин |
| **B4** | Lead/Engineer dashboard видят только активный проект | 🟡 архитектурный | Отдельные `loadMyTasks()` / `loadDeptTasks()` без `project_id` | 2-3 ч |
| **B1** | Race condition KPI инженера | 🟡 минор | Skeleton до прихода `currentUserData` | 30 мин |
| **B5** | Stage 4b кнопка для `todo` | 🟢 спорно | Решение пользователя | — |
| **B6** | Тестовые юзеры в memory ≠ БД | 🟡 doc-баг | Пересинхрон CLAUDE.md/STATE.md | 15 мин |

---

## Часть 1. 🚨 SECURITY — service_role leak (B3)

### 1.1 Подтверждение проблемы (audit-факты)

**Где сейчас утекает `SERVICE_KEY` в клиент** (проверено grep'ом):

| Файл | Строки | Что делает |
|---|---|---|
| `src/api/supabase.ts` | 5, 13–17, 62–74, 186–193, 222–242 | Объявление `SERVICE_KEY`, фабрика `AdminH()`, `createAuthUser`, `updateUserPassword`, `createNotification`, `signProjectFileUrl`, `removeFromBucket` — **экспорт `SERVICE_KEY`** |
| `src/api/supabaseClient.ts` | 5, 26–37 | Создаёт `adminClient` с `SERVICE_KEY` через `@supabase/supabase-js` |
| `src/components/ActivityFeed.tsx` | 2, 44 | `fetch /rest/v1/activity_log` с `Bearer SERVICE_KEY` |
| `src/App.tsx` | 4 (импорт), 397, 400, 507, 527, 585, 592, 599, 610, 2034, 3072, 3203, 3214 | **14 точек** — подпись URL, загрузка/удаление файлов проектов и задач, прямые `notifications`/`activity_log` вставки |
| `src/pages/ConferenceRoom.legacy.tsx` | 238, ~1508–1628 | Чат + storage в legacy-версии (не активна, но в bundle) |

**Корень зла** — переменная `REACT_APP_SUPABASE_SERVICE_KEY` в Vercel env. Любая `REACT_APP_*` Create-React-App переменная на этапе `npm run build` инлайнится в `static/js/main.*.js`. Service-роль имеет атрибут `BYPASSRLS`, поэтому утекший ключ = публичный root к БД.

### 1.2 Что говорят источники (для аргументации перед заказчиком)

Из официальной [Supabase API Keys docs](https://supabase.com/docs/guides/api/api-keys):
> «Secret keys authorize access to your project's data via the built-in service_role Postgres role, which by design has full access to your project's data and uses the BYPASSRLS attribute, skipping any and all Row Level Security policies. … You cannot use a secret key in the browser… it will always reply with HTTP 401 Unauthorized.»

Из [Supabase admin troubleshooting](https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa):
> «Since this environment variable is only available server-side, this value will not be leaked to the client, and your database is still securely protected with RLS.»

Из [GitGuardian remediation guide](https://www.gitguardian.com/remediation/supabase-service-role-jwt):
> «Leaking a Supabase Service Role JWT can lead to potential data breaches, as attackers can exploit the token to retrieve, modify, or delete sensitive information.»

Из обсуждения на HN: ["11% of vibe-coded apps are leaking Supabase keys"](https://news.ycombinator.com/item?id=46662304) — это реальная массовая проблема, не паранойя.

### 1.3 Целевая архитектура

```
┌─────────────────────┐         ┌─────────────────────┐         ┌─────────────────┐
│ Browser (React)     │         │ Vercel /api/*       │         │ Supabase        │
│                     │         │ (Serverless)        │         │                 │
│ supabaseAnonClient  │  HTTPS  │                     │  HTTPS  │  Postgres + RLS │
│ + user JWT          ├────────►│ verifyUserAndProfile├────────►│  (anon role)    │
│                     │         │ (из _spec_helpers)  │         │                 │
│ ANON_KEY (publish)  │         │ + role check        │         │  Auth (admin)   │
│                     │         │                     │         │  Storage        │
│ ❌ НЕТ service_key  │         │ supabaseAdminClient │         │                 │
│                     │         │ SERVICE_KEY         │         │                 │
└─────────────────────┘         └─────────────────────┘         └─────────────────┘
       fetch /api/*                  service_role
                                    (BYPASSRLS)
```

**Ключевые принципы:**

1. Фронт работает только с `supabaseAnonClient` + `currentUser.access_token` (user JWT). RLS обязана пропускать всё, что юзер должен видеть.
2. Все admin-операции (auth/admin, чтение `activity_log`, подпись Storage URLs, создание `notifications`) — **только** через `/api/*`.
3. Каждый `/api/*` endpoint обязан вызывать `verifyUserAndProfile(token)` (уже есть в `api/_spec_helpers.js`) и проверять роль.
4. `REACT_APP_SUPABASE_SERVICE_KEY` удалён из Vercel env. Остаётся только `SUPABASE_SERVICE_KEY` (без префикса) — он доступен только на сервере.
5. Текущий ключ ротируется в Supabase Dashboard сразу после деплоя.

### 1.4 Список новых API endpoints

Все возвращают JSON, требуют `Authorization: Bearer <user_jwt>`, проверяют роль через `verifyUserAndProfile`.

| Endpoint | Метод | Роли | Действие | Заменяет |
|---|---|---|---|---|
| `/api/admin/users/create` | POST | admin | createAuthUser + INSERT app_users (atomic) | `createAuthUser` (supabase.ts:62) |
| `/api/admin/users/[uid]/password` | PUT | admin | updateUserPassword | `updateUserPassword` (supabase.ts:69) |
| `/api/admin/users/[id]/role` | PATCH | admin | UPDATE app_users + sync app_metadata | (нового нет, добавить) |
| `/api/activity-log` | GET | любой auth'd, проверка `project_id` доступности | SELECT activity_log WHERE project_id=? | `ActivityFeed.tsx:44` |
| `/api/notifications/create` | POST | любой auth'd (валидация payload) | INSERT notifications | `createNotification` (supabase.ts:186) |
| `/api/storage/sign-url` | POST | auth'd + RLS на доступ к файлу | подпись URL для project-files | `signProjectFileUrl` (supabase.ts:222) |
| `/api/storage/upload` | POST (multipart) | auth'd + RLS на проект/задачу | загрузка в bucket + INSERT в `project_documents` или `task_attachments` | App.tsx:585–610, 2034 |
| `/api/storage/delete` | DELETE | auth'd + ownership/role check | `removeFromBucket` + DELETE из таблицы | `removeFromBucket` (supabase.ts:236), App.tsx:527 |
| `/api/admin/storage/stats` | GET | admin/gip | агрегаты по бакету | App.tsx:3072, 3203, 3214 |

**Сигнатуры (псевдокод):**

```ts
// POST /api/admin/users/create
// body: { email: string, password: string, full_name: string, role: 'admin'|'gip'|'lead'|'engineer', dept_id?: number }
// returns: { id: number, supabase_uid: string, email: string }
// errors: 401 (no token) / 403 (not admin) / 409 (email exists)

// PATCH /api/admin/users/[id]/role
// body: { role, dept_id?: number | null }
// returns: { id, role, updated_at }
// side-effect: обновляет user.app_metadata.role в Supabase Auth (для RLS-claims)

// GET /api/activity-log?project_id=123&limit=30
// returns: ActivityEntry[]
// проверка: юзер участник проекта (через app_users.dept_id ↔ project.depts ИЛИ задачи в проекте, ИЛИ роль admin/gip)

// POST /api/notifications/create
// body: { user_id, project_id?, action_type, target_id?, message?, payload? }
// проверка: actor имеет право генерить такое уведомление; для system-событий — только internal вызовы (другие /api endpoints)

// POST /api/storage/sign-url
// body: { storage_path: string, expiresIn?: number }
// проверка: storage_path начинается с {projectId}/, юзер имеет доступ к этому projectId
// returns: { signed_url }

// POST /api/storage/upload  (multipart/form-data)
// fields: kind ('project_doc' | 'task_attachment'), project_id, doc_type? | task_id?, file
// проверка: доступ к проекту/задаче
// returns: { id, storage_path, name, size_bytes }

// DELETE /api/storage/delete
// body: { kind: 'project_doc'|'task_attachment', id: string, storage_path: string }
// проверка: ownership ИЛИ role in (admin, gip, lead-of-dept)
```

### 1.5 Карта рефакторинга (фронт)

| Было (фронт) | Станет (фронт) |
|---|---|
| `import { SERVICE_KEY } from './api/supabase'` | удалить импорт |
| `createAuthUser(email, pwd)` | `fetch('/api/admin/users/create', {method:'POST', body, auth})` |
| `updateUserPassword(uid, pwd)` | `fetch('/api/admin/users/' + uid + '/password', ...)` |
| `createNotification(payload)` | `fetch('/api/notifications/create', {method:'POST', body, auth})` |
| `signProjectFileUrl(path)` | `fetch('/api/storage/sign-url', {method:'POST', body:{storage_path:path}, auth})` |
| `uploadProjectDocument(...)` | `fetch('/api/storage/upload', multipart, auth)` |
| `uploadTaskAttachment(...)` | `fetch('/api/storage/upload', multipart, auth)` |
| `deleteProjectDocument(...)` | `fetch('/api/storage/delete', {method:'DELETE', body, auth})` |
| `deleteTaskAttachment(...)` | то же |
| `ActivityFeed.tsx:44` (прямой fetch с SERVICE_KEY) | `fetch('/api/activity-log?project_id=' + pid, {auth})` |
| `App.tsx:597–610` (вставка в `notifications` через AdminH) | `fetch('/api/notifications/create', ...)` |
| `App.tsx:3072,3203,3214` (storage stats) | `fetch('/api/admin/storage/stats', ...)` |
| `getSupabaseAdminClient()` (supabaseClient.ts) | **удалить функцию полностью** |
| `export { SERVICE_KEY }` (supabase.ts:193) | **удалить экспорт** |
| `const SERVICE_KEY = process.env.REACT_APP_SUPABASE_SERVICE_KEY` | **удалить** в `supabase.ts` и `supabaseClient.ts` |

Helper для фронта:

```ts
// src/api/http.ts (новый файл)
export const apiFetch = async (path: string, opts: RequestInit = {}) => {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  const headers = new Headers(opts.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && opts.body && !(opts.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const r = await fetch(path, { ...opts, headers });
  if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
  return r.json();
};
```

### 1.6 Скелет серверного admin-клиента и middleware

```js
// api/_admin.js (новый shared)
const { createClient } = require('@supabase/supabase-js');
const { verifyUserAndProfile, extractBearer } = require('./_spec_helpers');

const SURL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

let _admin;
function getAdmin() {
  if (!_admin) {
    _admin = createClient(SURL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

// Защита endpoint'а: вернуть {profile, adminHeaders} или ответить 401/403
async function requireAuth(req, res, opts = {}) {
  const token = extractBearer(req);
  const r = await verifyUserAndProfile(token);
  if (!r.ok) { res.status(r.status).json({ error: r.error }); return null; }
  if (opts.roles && !opts.roles.includes(String(r.user.role).toLowerCase())) {
    res.status(403).json({ error: 'Недостаточно прав' });
    return null;
  }
  return r;
}

module.exports = { getAdmin, requireAuth };
```

Пример endpoint:

```js
// api/admin/users/create.js
const { getAdmin, requireAuth } = require('../../_admin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const auth = await requireAuth(req, res, { roles: ['admin'] });
  if (!auth) return;

  const { email, password, full_name, role, dept_id } = req.body || {};
  if (!email || !password || !full_name || !role) {
    return res.status(400).json({ error: 'email/password/full_name/role обязательны' });
  }

  const admin = getAdmin();
  const { data: created, error: aErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (aErr) return res.status(400).json({ error: aErr.message });

  const { data: profile, error: pErr } = await admin
    .from('app_users')
    .insert({ email, full_name, role, dept_id, supabase_uid: created.user.id })
    .select('id, supabase_uid, email, role')
    .single();
  if (pErr) {
    // откат auth-юзера
    await admin.auth.admin.deleteUser(created.user.id).catch(() => null);
    return res.status(500).json({ error: pErr.message });
  }
  return res.json(profile);
};
```

### 1.7 Миграции RLS в Supabase

После того как фронт перестанет использовать SERVICE_KEY, RLS на anon/authenticated роли начнёт реально работать. Нужно:

```sql
-- 019_rls_hardening.sql

-- 1. Включить RLS на таблицах, где её нет / отключена
alter table app_users        enable row level security;
alter table projects         enable row level security;
alter table tasks            enable row level security;
alter table task_history     enable row level security;
alter table task_attachments enable row level security;
alter table project_documents enable row level security;
alter table reviews          enable row level security;
alter table revisions        enable row level security;
alter table transmittals     enable row level security;
alter table transmittal_items enable row level security;
alter table notifications    enable row level security;
alter table activity_log     enable row level security;
alter table meetings         enable row level security;
alter table review_comments  enable row level security;

-- 2. Helper: вернуть профиль текущего auth.uid()
create or replace function public.current_app_user()
returns app_users
language sql security definer set search_path = public as $$
  select * from app_users where supabase_uid = auth.uid() limit 1
$$;

-- 3. app_users — каждый видит себя; admin видит всех
create policy "self read app_users" on app_users
  for select using (supabase_uid = auth.uid());
create policy "admin read app_users" on app_users
  for select using ((select role from current_app_user()) = 'admin');
create policy "admin write app_users" on app_users
  for all using ((select role from current_app_user()) = 'admin')
  with check ((select role from current_app_user()) = 'admin');

-- 4. projects — admin/gip видят все; lead/engineer — только проекты, где есть задачи их отдела/на них
create policy "admin gip read projects" on projects
  for select using ((select role from current_app_user()) in ('admin','gip'));
create policy "member read projects" on projects
  for select using (exists (
    select 1 from tasks t, current_app_user() u
    where t.project_id = projects.id
      and (t.assigned_to = u.id or t.dept = (select name from departments where id = u.dept_id))
  ));

-- 5. tasks — admin/gip видят все; engineer видит свои; lead видит задачи отдела
create policy "tasks select" on tasks for select using (
  case (select role from current_app_user())
    when 'admin' then true
    when 'gip' then true
    when 'lead' then dept = (select name from departments where id = (select dept_id from current_app_user()))
    when 'engineer' then assigned_to = (select id from current_app_user())
    else false
  end
);
create policy "tasks insert" on tasks for insert with check (
  (select role from current_app_user()) in ('admin','gip','lead')
);
create policy "tasks update" on tasks for update using (
  case (select role from current_app_user())
    when 'admin' then true
    when 'gip' then true
    when 'lead' then dept = (select name from departments where id = (select dept_id from current_app_user()))
    when 'engineer' then assigned_to = (select id from current_app_user())
    else false
  end
);

-- 6. activity_log — read для всех участников проекта (через политику projects)
create policy "activity_log read" on activity_log for select using (
  exists (select 1 from projects p where p.id = activity_log.project_id)
);
-- writes — только service_role (через /api/notifications/create-внутренние вызовы)

-- 7. notifications — каждый видит свои
create policy "notifications self read" on notifications
  for select using (user_id = (select id from current_app_user()));
create policy "notifications self update" on notifications
  for update using (user_id = (select id from current_app_user()));

-- 8. storage.objects (project-files bucket)
-- читать может тот, кто видит проект; писать — assignee/lead/gip; удалять — owner/lead/gip
create policy "project-files read" on storage.objects for select using (
  bucket_id = 'project-files' and
  exists (
    select 1 from projects p where p.id::text = split_part(name, '/', 1)
  )
);
create policy "project-files write" on storage.objects for insert with check (
  bucket_id = 'project-files' and
  (select role from current_app_user()) in ('admin','gip','lead','engineer')
);
create policy "project-files delete" on storage.objects for delete using (
  bucket_id = 'project-files' and (
    owner = auth.uid() or
    (select role from current_app_user()) in ('admin','gip','lead')
  )
);

-- 9. project_documents / task_attachments — повторяем логику projects/tasks
-- (write только если есть доступ к родительскому объекту)
```

> **Важно:** перед применением — `select` на каждой таблице, чтобы убедиться, что новая RLS не ломает существующие auth'd-сценарии. Делать через Supabase branch (`create_branch`), катить миграцию там, прогонять smoke-test.

### 1.8 Чеклист для пользователя (Andrey)

После того как фронт мигрирован и задеплоен:

- [ ] **Vercel Dashboard** → Project Settings → Environment Variables:
  - [ ] **Удалить** `REACT_APP_SUPABASE_SERVICE_KEY` (все 3 окружения: production/preview/development).
  - [ ] Убедиться, что `SUPABASE_SERVICE_KEY` (без префикса) присутствует — серверные функции используют его.
  - [ ] Если есть `REACT_APP_SUPABASE_SERVICE_ROLE_KEY` или похожие варианты — тоже удалить.
- [ ] **Supabase Dashboard** → Settings → API Keys:
  - [ ] Если используются legacy-ключи: вкладка "Legacy anon, service_role JWT" → "Roll" → подтвердить → **сохранить новый ключ** в безопасном месте.
  - [ ] Если уже на новом формате (`sb_secret_*`, замечен в bundle): создать новый `sb_secret_*` → обновить `SUPABASE_SERVICE_KEY` в Vercel → **удалить старый** в Supabase.
  - [ ] Сразу после ротации перезапустить серверные функции (Vercel → Redeploy).
- [ ] **Smoke-test после ротации:**
  - [ ] Логин (троишин/правдухин) — работает.
  - [ ] Создание задачи — работает.
  - [ ] Загрузка файла к задаче — работает.
  - [ ] Просмотр Activity Feed — работает.
  - [ ] DevTools → Network → main.*.js — `grep service_role` и `grep sb_secret_` дают **ноль попаданий**.
- [ ] **Проверка через curl** (атака после ротации должна вернуть 401):
  ```bash
  curl -H "apikey: <OLD_LEAKED_KEY>" -H "Authorization: Bearer <OLD_LEAKED_KEY>" \
    "https://jbdljdwlfimvmqybzynv.supabase.co/rest/v1/app_users?select=*"
  # ожидаем: 401 invalid_jwt
  ```

### 1.9 Acceptance criteria (B3)

1. `grep -E "service_role|sb_secret_" build/static/js/main.*.js` — **0 совпадений**.
2. `grep "REACT_APP_SUPABASE_SERVICE_KEY" src/` — **0 совпадений**.
3. `grep "SERVICE_KEY" src/` — **0 совпадений** (или только в комментариях).
4. Все 9 endpoints из 1.4 деплоятся, отвечают 401 без токена и 403 на роль ниже требуемой.
5. Все CRUD-сценарии (создание задачи, загрузка файла, просмотр feed) работают на стороне юзера.
6. Curl с утекшим ключом возвращает 401 после ротации.
7. RLS-миграция применена, существующие auth-сессии не сломались.

### 1.10 План rollout (этапами, чтобы не упасть)

1. **Stage A — серверная инфра** (без удаления старого):
   1. Создать `api/_admin.js` (shared admin-клиент + `requireAuth`).
   2. Создать все 9 endpoints. Дописать unit-тесты (хотя бы happy path + 401 + 403).
   3. Деплой на Vercel preview, прогнать вручную через `curl`.
2. **Stage B — фронт-миграция** (фича-флаг или просто PR):
   1. Добавить `src/api/http.ts` (`apiFetch`).
   2. Заменить все 14+ вызовов с `SERVICE_KEY` на `apiFetch('/api/...')`.
   3. Удалить `getSupabaseAdminClient`, `export { SERVICE_KEY }`, `const SERVICE_KEY` из `supabase.ts` и `supabaseClient.ts`.
   4. Локальный билд, `grep` по bundle, должен быть чистый.
   5. Деплой preview → smoke-test.
3. **Stage C — RLS** (можно параллельно с Stage B):
   1. Создать Supabase branch.
   2. Применить `019_rls_hardening.sql`.
   3. Прогнать сценарии под каждой ролью (anon, engineer, lead, gip, admin).
   4. Merge branch → production.
4. **Stage D — production cutover:**
   1. Promote preview → production.
   2. Удалить `REACT_APP_SUPABASE_SERVICE_KEY` из Vercel env (production).
   3. Redeploy.
   4. Ротировать `service_role` в Supabase Dashboard.
   5. Curl-чек: старый ключ → 401.
5. **Stage E — постфактум:**
   1. Удалить `ConferenceRoom.legacy.tsx` или хотя бы выпилить из bundle (lazy import + tree-shaking).
   2. Записать инцидент в `STATE.md`.

---

## Часть 2. 🟡 Z-INDEX модалок (B2) — превратить в систему

**Текущий фикс:** `Modal.topmost` через inline `style={{zIndex:1100}}`. Работает, но архитектурно хрупко: каждый новый "модал поверх модала" = новая магическая константа.

**Правильное решение — ModalStack:**

```tsx
// src/components/ui.tsx
const MODAL_BASE_Z = 1000;
const ModalStackContext = createContext<{ depth: number }>({ depth: 0 });

export function Modal({ children, topmost, ...props }) {
  const parent = useContext(ModalStackContext);
  const depth = parent.depth + 1;
  const z = topmost ? Math.max(MODAL_BASE_Z + 100 * depth, MODAL_BASE_Z + 100) : MODAL_BASE_Z + 10 * depth;
  return (
    <ModalStackContext.Provider value={{ depth }}>
      <div className="modal-overlay" style={{ zIndex: z }}>{children}</div>
    </ModalStackContext.Provider>
  );
}
```

Каждый вложенный модал автоматически получает z-index выше родителя — без `topmost`-флагов.

**Acceptance:** открыть Task Detail → "Запросить данные у смежного отдела" → диалог поверх. Открыть TaskDetail внутри Confirm Dialog (если такой кейс есть) — тоже поверх.

---

## Часть 3. 🟡 Lead/Engineer Dashboard (B4) — глобальный режим

**Корень:** `loadAllTasks(activeProject.id)` — задачи всегда в контексте одного проекта. На дашбордах нужен глобальный обзор.

**Что сделать:**

1. Добавить новые загрузчики в `App.tsx`:
   ```ts
   const loadMyTasks = async (userId: number) =>
     get(`tasks?assigned_to=eq.${userId}&order=deadline.asc.nullsfirst`, token);

   const loadDeptTasks = async (deptName: string) =>
     get(`tasks?dept=eq.${encodeURIComponent(deptName)}&select=*,projects(name,code)&order=deadline.asc.nullsfirst`, token);
   ```
2. На EngineerDashboard:
   - Изначально — `loadMyTasks(currentUser.id)` без `project_id`.
   - Виджеты "Мои задачи" / "Мои проекты" агрегируют по этому массиву.
3. На LeadDashboard:
   - `loadDeptTasks(myDeptName)`.
   - Виджет "Нагрузка инженеров отдела" группирует по `assigned_to`.
   - Виджет "На проверке у меня" фильтрует по `status='review_lead' AND dept=myDept`.
4. В StateContext держать `dashboardTasks` отдельно от `tasks` (текущий проект).
5. Real-time подписка на изменения (Supabase Realtime channel `tasks` фильтр по dept/assigned_to).

**RLS:** уже описан в 1.7 — engineer видит свои, lead видит отдел. Без RLS под service_role это работало "случайно". После security-фикса нужно обязательно проверить, что RLS-политика отдаёт нужные строки.

**Acceptance:**
- Pravdukhin (Lead ЭС) логинится → видит "Нагрузка инженеров (3)" с реальными цифрами по всем проектам.
- Troshin (Engineer) логинится → видит все свои задачи независимо от активного проекта.

---

## Часть 4. 🟡 Race condition KPI (B1)

**Что есть:** KPI показывают `0/0/0/0` секунду, пока `currentUserData` не пришёл.

**Минимальный фикс (UX):**

```tsx
// перед рендером KPI
if (!currentUserData?.id) {
  return <KpiSkeleton />; // 4 серых полосы с pulse animation
}
```

**Чище — заблокировать загрузку дашборда до прихода профиля:**

```tsx
useEffect(() => {
  if (!currentUserData?.id) return;
  loadAllTasks(activeProject.id);
}, [activeProject?.id, currentUserData?.id]);
```

(Уже есть, но нужно убедиться, что `loadAllTasks` не запускается с `myId === ''`.)

**Acceptance:** при логине KPI либо показывают skeleton, либо сразу правильные числа. Никогда — `0/0/0/0` в течение 1 сек.

---

## Часть 5. 🟢 Stage 4b кнопка для `todo` (B5)

**Спорно:** в коде `selectedTask.status === "inprogress" || selectedTask.status === "todo"`, в требовании было только `inprogress`.

**Аргумент за оставить:** инженер может предвидеть нехватку данных и заранее запросить (когда задача ещё `todo`).

**Аргумент против:** требование явно говорит "только в работе".

**Решение:** оставить за пользователем. По умолчанию — **оставить**, как удобнее по жизни.

---

## Часть 6. 🟡 Тестовые юзеры в memory ≠ БД (B6)

В `STATE.md` упоминаются `admin@enghub.com / admin123`, `gip@nipicer.kz / Test1234!`, `lead@nipicer.kz / Test1234!`. В реальной БД работают только `troshin.m@nipicer.kz`, `pravdukhin.a@nipicer.kz`, и есть нерабочие `*@enghub-test.ru`.

**Что сделать:**

1. Запустить `select id, email, role, full_name from app_users order by role` через Supabase MCP, получить актуальный список.
2. Обновить `STATE.md` секцию "Тестовые юзеры":
   ```md
   ## Тестовые учётки

   | Роль | Email | Пароль | Заметка |
   |---|---|---|---|
   | Engineer (ЭС) | troshin.m@nipicer.kz | Test1234! | Реальный, работает |
   | Lead (ЭС) | pravdukhin.a@nipicer.kz | Test1234! | Реальный, работает |
   | Admin/GIP | _создать через AdminPanel_ | — | В БД нет admin'а с предсказуемым паролем |
   ```
3. Создать **через новый `/api/admin/users/create`** (после security-фикса) недостающих admin/gip с известными паролями. Записать в STATE.md.

---

## Часть 7. Приоритизация

### Очерёдность работ

1. **B3 (security)** — день/полтора. Делать ПЕРВЫМ — это блокер для всего.
2. **B2 (ModalStack)** — push готового фикса (10 мин) + рефакторинг на ModalStack (1 ч). Можно после B3.
3. **B4 (dashboards)** — 2-3 ч. После B3, потому что без RLS оно "работало случайно".
4. **B6 (юзеры)** — 15 мин. После B3 (создание юзеров через новый endpoint).
5. **B1 (KPI skeleton)** — 30 мин. В любой момент.
6. **B5 (Stage 4b todo)** — решение пользователя.

### Параллелизм

- Пока пишутся `/api/*` endpoints (B3, Stage A) — другой человек/сессия может писать ModalStack (B2) и dashboard'ы (B4).
- RLS-миграцию (Stage C) можно тестировать на Supabase branch параллельно с фронт-рефакторингом.

---

## Часть 8. Финальный чеклист

### Для меня (агента)

- [ ] B3 Stage A — создать `api/_admin.js` + 9 endpoints
- [ ] B3 Stage B — заменить 14+ вызовов SERVICE_KEY на `apiFetch`
- [ ] B3 Stage C — написать `019_rls_hardening.sql`
- [ ] B2 — push текущего fix + рефакторинг на ModalStack
- [ ] B4 — `loadMyTasks` / `loadDeptTasks` + переписать дашборды
- [ ] B1 — KpiSkeleton
- [ ] B6 — sync STATE.md с БД, создать недостающих юзеров
- [ ] Обновить `STATE.md` с записью «Security-rollout 2026-04-29 → 2026-04-30»

### Для Andrey

- [ ] Vercel: удалить `REACT_APP_SUPABASE_SERVICE_KEY` (3 окружения)
- [ ] Supabase: ротировать `service_role` ключ (legacy + sb_secret_*)
- [ ] Vercel: redeploy после ротации
- [ ] Smoke-test: логин, задача, файл, feed
- [ ] curl-проверка: старый ключ → 401
- [ ] Принять решение по B5 (оставить ли кнопку Stage 4b для `todo`)

---

## Источники (для аудита и обоснования)

### Официальная документация Supabase
- https://supabase.com/docs/guides/api/api-keys — описание service_role и его атрибута BYPASSRLS
- https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa — admin tasks server-side
- https://supabase.com/docs/guides/troubleshooting/rotating-anon-service-and-jwt-secrets-1Jq6yd — процедура ротации
- https://supabase.com/docs/guides/auth/jwts — JWT verification, JWKS endpoint
- https://supabase.com/docs/guides/database/postgres/row-level-security — RLS best practices
- https://supabase.com/docs/guides/auth/server-side/creating-a-client — пример server client в Next.js

### Инциденты и анти-паттерны
- https://news.ycombinator.com/item?id=46355345 — "Your Supabase is public if you turn off RLS"
- https://news.ycombinator.com/item?id=46662304 — "11% of vibe-coded apps are leaking Supabase keys"
- https://www.gitguardian.com/remediation/supabase-service-role-jwt — что делать при утечке
- https://www.pomerium.com/blog/when-ai-has-root-lessons-from-the-supabase-mcp-data-leak — постмортем MCP-инцидента
- https://dev.to/jordan_sterchele/why-your-supabase-data-is-exposed-and-you-dont-know-it-25fh — типовая ошибка с REACT_APP_*
- https://create-react-app.dev/docs/adding-custom-environment-variables/ — почему REACT_APP_* попадает в bundle

### Эталонные паттерны (split client)
- https://github.com/orgs/supabase/discussions/30739 — Service Role with Supabase in Next.js Backend
- https://github.com/orgs/supabase/discussions/13903 — RBAC and RLS патерны
- https://makerkit.dev/docs/next-supabase-turbo/data-fetching/supabase-clients — `getSupabaseServerAdminClient`
- https://github.com/vercel/nextjs-subscription-payments — реф (архивирован, но исторический)
- https://github.com/marmelab/ra-supabase — react-admin адаптер

---

**Конец плана.**
