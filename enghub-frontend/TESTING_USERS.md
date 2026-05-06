# Тестовые учётки EngHub — единый пароль для не-admin: 123456

> Сгенерировано 2026-04-30 для ручного QA-прогона.
> Все аккаунты ниже имеют единый пароль **`123456`**, кроме `admin@enghub.com` (его пароль не изменён, нужно использовать существующий).
> Сброс выполнен напрямую в `auth.users.encrypted_password` через `crypt('123456', gen_salt('bf'))`.

## Admin (пароль НЕ менялся)

| Email | Full Name | Role | Dept |
|---|---|---|---|
| admin@enghub.com | Admin | admin | — |

## Боевые/реальные учётки (NIPICER) — пароль `123456`

| Email | Full Name | Role | Dept |
|---|---|---|---|
| skorokhod.a@nipicer.kz | Скороход Андрей Дмитриевич | gip | — |
| bordokina.o@nipicer.kz | Бордокина Ольга Анатольевна | lead | АК |
| pravdukhin.a@nipicer.kz | Правдухин Андрей Антальевич | lead | ЭС |
| shtylenko.s@nipicer.kz | Штыленко Сергей Александрович | lead | ГП |
| aseeva.t@nipicer.kz | Асеева Татьяна Александровна | engineer | ЭС |
| gritsenko.a@nipicer.kz | Гриценко Алла Евгеньевна | engineer | АК |
| dzugaeva.s@nipicer.kz | Дзугаева Светлана Казбековна | engineer | АК |
| izbechshuk.y@nipicer.kz | Избещук Юрий Николаевич | engineer | ГП |
| troshin.m@nipicer.kz | Трошин Максим Станиславович | engineer | ЭС |

## Демо-аккаунты EngHub-test — пароль `123456`

| Email | Full Name | Role |
|---|---|---|
| gip@enghub-test.ru | T-1.1 Соколов В.А. | gip |
| gip1@enghub-test.ru | Соколов В.А. | gip |
| gip2@enghub-test.ru | Иванов П.С. | gip |
| lead-ak@enghub-test.ru | — | lead AК |
| lead-es@enghub-test.ru | — | lead ЭС |
| lead-gp@enghub-test.ru | — | lead ГП |
| lead.km@enghub-test.ru | — | lead КМ |
| lead.vk@enghub-test.ru | — | lead ВК |
| eng-ak@enghub-test.ru | — | engineer АК |
| eng-ak2@enghub-test.ru | — | engineer АК |
| eng-es@enghub-test.ru | — | engineer ЭС |
| eng-gp@enghub-test.ru | — | engineer ГП |
| eng-vk@enghub-test.ru | — | engineer ВК |

## Сгенерированные dept-юзеры (enghub.local) — пароль `123456`

| Email | Role |
|---|---|
| gip_test@enghub.local | gip |
| lead_dept3@enghub.local | lead |
| lead_dept4@enghub.local | lead |
| lead_dept5@enghub.local | lead |
| lead_dept6@enghub.local | lead |
| lead_dept7@enghub.local | lead |
| lead_dept8@enghub.local | lead |
| lead_dept9@enghub.local | lead |
| lead_dept10@enghub.local | lead |
| eng1_dept3@enghub.local | engineer |
| eng2_dept3@enghub.local | engineer |
| eng1_dept4@enghub.local | engineer |
| eng2_dept4@enghub.local | engineer |
| eng1_dept5@enghub.local | engineer |
| eng2_dept5@enghub.local | engineer |
| eng1_dept6@enghub.local | engineer |
| eng2_dept6@enghub.local | engineer |
| eng1_dept7@enghub.local | engineer |
| eng2_dept7@enghub.local | engineer |
| eng1_dept8@enghub.local | engineer |
| eng2_dept8@enghub.local | engineer |
| eng1_dept9@enghub.local | engineer |
| eng2_dept9@enghub.local | engineer |
| eng1_dept10@enghub.local | engineer |
| eng2_dept10@enghub.local | engineer |

## Прочие

| Email | Role |
|---|---|
| gip@enghub.com | gip |
| engineer@enghub.com | engineer |
| lead1@enghub.com | lead |

## Рекомендованные учётки для QA-прогона

- **GIP:** `skorokhod.a@nipicer.kz` / `123456`
- **Lead ЭС:** `pravdukhin.a@nipicer.kz` / `123456`
- **Engineer ЭС:** `troshin.m@nipicer.kz` / `123456`
- **Lead АК:** `bordokina.o@nipicer.kz` / `123456` (для проверки межотдельного запроса данных)
- **Engineer АК:** `gritsenko.a@nipicer.kz` / `123456`
- **Admin:** `admin@enghub.com` / (текущий пароль admin)

Итого сброшено: **50 учёток**. Admin исключён.
