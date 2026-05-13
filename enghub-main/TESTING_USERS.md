# Тестовые учётки EngHub

> Обновлено 2026-05-14. Только реальные записи в `auth.users` (7 штук).
> Остальные 50 учёток из старого файла **не существуют** в БД — удалены из этого документа.

## Все активные пользователи

| Email | Пароль | Роль | Полное имя |
|---|---|---|---|
| admin@enghub.com | EngAdmin2026! | admin | Admin |
| skorokhod.a@nipicer.kz | 123456 | gip | Скороход Андрей Дмитриевич |
| dmitry.orlov@enghub.com | 123456 | gip | Dmitry Orlov |
| sidorov@enghub.com | 123456 | lead | Сидоров Иван Сергеевич |
| engineer2@enghub.com | 123456 | lead_engineer | Алексей Смирнов |
| engineer1@enghub.com | 123456 | engineer | Иван Петров |
| nikolaev@enghub.com | 123456 | observer | Nikolaev |

## Рекомендованные учётки для QA-прогона

- **Admin:** `admin@enghub.com` / `EngAdmin2026!`
- **GIP:** `skorokhod.a@nipicer.kz` / `123456`
- **Lead:** `sidorov@enghub.com` / `123456`
- **Engineer:** `engineer1@enghub.com` / `123456`

> Пароли для не-admin сброшены через SQL 2026-05-13: `crypt('123456', gen_salt('bf'))` в `auth.users`.
