# RLS Governance Model — EngHub

> Эталонный документ политик Row-Level Security.
> Обновлять при каждом изменении политик или ролевой модели.
> Дата создания: 2026-05-08

---

## 1. Ролевая иерархия

```
admin
  └── gip (ГИП — главный инженер проекта)
        └── lead (руководитель отдела)
              └── engineer (инженер)
```

| Роль | Рус. название | Область ответственности |
|------|---------------|------------------------|
| `admin` | Администратор | Управление организацией, пользователями, архивами, аудит |
| `gip` | ГИП | Создание и ведение проектов, все задачи, координация отделов |
| `lead` | Руководитель отдела | Задачи отдела, чертежи, замечания, протоколы |
| `engineer` | Инженер | Обновление назначенных задач, загрузка файлов, комментарии |

---

## 2. Модель идентификации в RLS

Supabase использует **email-based lookup** через helper-функции:

```sql
auth_app_user_email()   -- email из JWT claims
auth_app_user_id()      -- app_users.id по email
auth_app_user_role()    -- app_users.role по email
auth_is_admin_or_gip()  -- role IN ('admin','gip')
auth_is_admin()         -- role = 'admin'
auth_app_user_dept_name() -- departments.name через dept_id
auth_is_gip_of(project_id) -- gip_id = current user
```

> Все функции созданы миграцией `028_restore_rbac_helpers`.
> Путь JWT → app_users: JWT.email → app_users.email → app_users.role

---

## 3. RBAC-матрица по таблицам

### 3.1 projects

| Действие | admin | gip (свой проект) | gip (чужой) | lead | engineer |
|----------|-------|-------------------|-------------|------|----------|
| SELECT | ✅ | ✅ | ✅ | ✅ если задача в отделе | ✅ если назначена задача |
| INSERT | ✅ | ✅ | ✅ | ❌ | ❌ |
| UPDATE | ✅ | ✅ | ❌ | ❌ | ❌ |
| DELETE | ✅ | ❌ | ❌ | ❌ | ❌ |
| Archive (UPDATE archived=true) | ✅ | ✅ (свой) | ❌ | ❌ | ❌ |

**Политики:**
- `projects_insert`: `auth_is_admin_or_gip()`
- `projects_update`: `auth_is_admin() OR (role='gip' AND gip_id=auth_app_user_id())`
- `projects_delete`: `auth_is_admin()` (hard delete только admin)

### 3.2 tasks

| Действие | admin | gip | lead (свой отдел) | engineer (назначен) |
|----------|-------|-----|-------------------|---------------------|
| SELECT | ✅ | ✅ | ✅ | ✅ |
| INSERT | ✅ | ✅ | ✅ | ❌ |
| UPDATE | ✅ | ✅ | ✅ | ✅ |
| DELETE | ✅ | ✅ | ❌ | ❌ |

**Политики:**
- `tasks_insert_gip`: `auth_is_admin_or_gip()`
- `tasks_insert_lead`: `role='lead' AND dept=auth_app_user_dept_name()`
- `tasks_update_gip`: `auth_is_admin_or_gip()`
- `tasks_update_lead`: `role='lead' AND dept=auth_app_user_dept_name()`
- `tasks_update_engineer`: `role='engineer' AND assigned_to=auth_app_user_id()`
- `tasks_delete_gip`: `auth_is_admin_or_gip()`

### 3.3 drawings

| Действие | admin | gip | lead | engineer |
|----------|-------|-----|------|----------|
| SELECT | ✅ | ✅ | ✅ | ✅ |
| INSERT | ✅ | ✅ | ✅ | ✅ |
| UPDATE | ✅ | ✅ | ✅ | ✅ |
| DELETE | ✅ | ✅ | ✅ | ❌ |

### 3.4 reviews (замечания)

| Действие | admin | gip | lead | engineer (автор/исполнитель) |
|----------|-------|-----|------|------------------------------|
| SELECT | ✅ | ✅ | ✅ | ✅ |
| INSERT | ✅ | ✅ | ✅ | ✅ |
| UPDATE | ✅ | ✅ | ✅ | ✅ (только свои) |
| DELETE | ✅ | ✅ | ❌ | ✅ (только свои) |

### 3.5 transmittals

| Действие | admin | gip | lead | engineer |
|----------|-------|-----|------|----------|
| SELECT | ✅ | ✅ | ✅ | ✅ (если назначен в проекте) |
| INSERT | ✅ | ✅ | ✅ | ❌ |
| UPDATE | ✅ | ✅ | ✅ | ❌ |
| DELETE | ✅ | ✅ | ❌ | ❌ |

### 3.6 app_users

| Действие | admin | gip | lead | engineer (себя) |
|----------|-------|-----|------|-----------------|
| SELECT | ✅ | ✅ | ✅ | ✅ |
| INSERT | через service_role API | — | — | — |
| UPDATE (любой) | ✅ | ✅ | ❌ | ❌ |
| UPDATE (себя, без смены роли/отдела) | ✅ | ✅ | ✅ | ✅ |
| DELETE | через service_role API | — | — | — |

> Создание/удаление пользователей идёт через API server с service_role (обходит RLS).

### 3.7 departments

| Действие | admin | gip | lead | engineer |
|----------|-------|-----|------|----------|
| SELECT | ✅ | ✅ | ✅ | ✅ |
| INSERT/UPDATE/DELETE | ✅ (user-JWT) + service_role | ❌ | ❌ | ❌ |

### 3.8 Остальные таблицы (сводка)

| Таблица | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| revisions | all auth | all auth | — | admin/gip |
| review_comments | all auth | all auth | admin/gip + автор | admin/gip + автор |
| transmittal_items | all auth | admin/gip/lead | — | admin/gip/lead |
| notifications | admin/gip + own | all auth | own + admin/gip | own + admin/gip |
| messages | all auth | all auth | admin/gip + own | admin/gip + own |
| meetings | all auth | admin/gip/lead | admin/gip/lead | admin/gip |
| time_entries | all auth | all auth | admin/gip + own | admin/gip + own |
| project_documents | all auth | admin/gip/lead/engineer | — | admin/gip + own |
| task_attachments | all auth | admin/gip/lead/engineer | — | admin/gip + own |
| ai_actions | admin/gip + own | all auth (own) | admin/gip + own | admin/gip |
| video_meetings | all auth | all auth | admin/gip + created_by | admin/gip + created_by |
| specifications | all auth | admin/gip/lead | admin/gip/lead | admin/gip |
| spec_items | all auth | admin/gip/lead | admin/gip/lead | admin/gip |
| raci | all auth | admin/gip | admin/gip | admin/gip |
| audit_logs | admin only (ALL) | service_role | — | — |
| organization_settings | all auth (read) | admin only | admin only | — |

---

## 4. Ownership model (архивирование проектов)

```
GIP создаёт проект  →  gip_id = GIP.id
GIP может:
  - обновлять проект (UPDATE archived=true для архивирования)
  - создавать задачи внутри проекта
Admin может:
  - восстановить из архива (UPDATE archived=false через API)
  - удалить навсегда (DELETE через API)
```

**Архив lifecycle:**
```
active → archived (GIP: patch projects?id=N {archived: true, archived_at: now()})
archived → active (admin: POST /api/admin/projects/:id/restore)
archived → deleted (admin: DELETE /api/admin/projects/:id)
```

---

## 5. Admin operations via service_role

Следующие операции выполняются через API server с service_role ключом (обходят RLS):

| Операция | Endpoint |
|----------|----------|
| Создать пользователя | `POST /api/admin-users` action=create |
| Обновить роль/отдел | `POST /api/admin-users` action=update_role |
| Сбросить пароль | `POST /api/admin-users` action=reset_password |
| Отключить пользователя | `POST /api/admin-users` action=disable |
| Удалить пользователя | `POST /api/admin-users` action=delete |
| CRUD отделов | `GET/POST/PATCH/DELETE /api/admin/departments` |
| Настройки организации | `GET/PATCH /api/admin/organization` |
| Восстановить проект из архива | `POST /api/admin/projects/:id/restore` |
| Удалить проект из архива | `DELETE /api/admin/projects/:id` |
| Просмотр audit logs | `GET /api/admin/audit-logs` |

---

## 6. JWT → Role flow

```
User login via Supabase Auth
       ↓
Supabase JS client stores session (autoRefreshToken: true)
       ↓
app_users table lookup (email = JWT.email)
       ↓
auth_app_user_role() → 'admin'|'gip'|'lead'|'engineer'
       ↓
RLS policies evaluated per request
```

**Критично:** Роль берётся из `app_users.role` по email, НЕ из JWT custom claims. Изменение роли в `app_users` вступает в силу на следующем запросе — токен не нужно перевыпускать.

---

## 7. Миграции

| Миграция | Что делает |
|----------|-----------|
| `000_core_schema_sequences` | Последовательности |
| `001_core_schema_tables` | Основные таблицы |
| `002_core_rls_and_indexes` | Базовые RLS (только SELECT) |
| `019_seed_default_departments` | Начальные отделы |
| `028_restore_rbac_helpers` | Helper functions (auth_is_admin_or_gip, etc.) |
| `admin_domain_foundation` | audit_logs, organization_settings, их RLS |
| `020_rls_governance_fix` | **INSERT/UPDATE/DELETE для всех операционных таблиц** |

---

## 8. Проверка (smoke test)

```sql
-- Проверить политики для таблицы projects
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename='projects'
ORDER BY cmd;

-- Тест: GIP может создать проект (выполнить как GIP user)
-- Ожидаем: строка создана без ошибки
INSERT INTO projects(name, code, status, gip_id, progress, archived)
VALUES ('Test', 'TST-001', 'active', 1, 0, false);
```

---

## 9. Что НЕЛЬЗЯ делать

- ❌ Отключать RLS глобально (`ALTER TABLE x DISABLE ROW LEVEL SECURITY`)
- ❌ Использовать service_role в фронтенде
- ❌ Ослаблять RBAC — добавлять "authenticated" write-политики на критичные таблицы
- ❌ Хранить роль пользователя только в JWT без синхронизации с app_users
