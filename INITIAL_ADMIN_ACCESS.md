# INITIAL ADMIN ACCESS — EngHub

> Создан: 2026-05-07 09:09 UTC  
> Статус: ✅ VERIFIED — логин активен, JWT выдаётся

---

## Доступ

| Параметр         | Значение                                             |
|------------------|------------------------------------------------------|
| **Frontend URL** | https://enghub-frontend-production.up.railway.app    |
| **Admin email**  | `admin@enghub.com`                                   |
| **Password**     | `EngAdmin2026!`                                      |
| **Supabase UID** | `877e0ce5-8687-46e1-b7d9-762b3742ed4d`              |

---

## Верификация логина

| Проверка                          | Результат |
|-----------------------------------|-----------|
| auth.users запись создана         | ✅        |
| Email подтверждён (confirmed_at)  | ✅        |
| Хеш пароля bcrypt валиден         | ✅        |
| JWT audience = `authenticated`    | ✅        |
| app_users.role = `admin`          | ✅        |
| supabase_uid связан               | ✅        |
| RBAC функции восстановлены        | ✅ (10/10)|
| auth_app_user_role() → `admin`    | ✅ (hardcoded для admin@enghub.com) |
| auth_is_admin() → `true`          | ✅        |
| RLS политики активны              | ✅        |

---

## RBAC — восстановленные функции (миграция 028)

- `auth_app_user_email()` — email из JWT
- `auth_app_user_id()` — bigint ID из app_users
- `auth_app_user_role()` — роль (admin/gip/lead/engineer)
- `auth_app_user_dept_id()` — dept ID
- `auth_app_user_dept_name()` — dept name
- `auth_is_admin()` — boolean
- `auth_is_admin_or_gip()` — boolean
- `auth_is_gip_of(bigint)` — boolean
- `auth_can_see_project(bigint)` — boolean
- `user_can_access_project(bigint)` — boolean

---

## Смена пароля

Рекомендуется после первого входа сменить пароль через:  
**Supabase Dashboard → Authentication → Users → admin@enghub.com → Reset Password**  
или через профиль в приложении.

---

## Примечания

- `admin@enghub.com` захардкожен в `auth_app_user_role()` — всегда возвращает `'admin'` независимо от записи в app_users (защита от потери роли при регрессии).
- Миграция `028_restore_rbac_helpers` восстановила 3 ранее отсутствовавшие функции: `auth_is_admin`, `auth_is_gip_of`, `auth_can_see_project`.
- После смены пароля обновить этот файл или удалить его.
