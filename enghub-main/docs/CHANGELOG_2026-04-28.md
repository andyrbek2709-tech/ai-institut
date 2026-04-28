# EngHub — Журнал изменений 2026-04-28

**Один файл со всеми изменениями за сегодня по проекту EngHub.**
Файл написан в конце дня после волны фиксов и применения первой волны редизайна.

---

## Сводка одной строкой

13 коммитов · 8 миграций БД · закрыты блокеры B1–B5 · применена первая волна редизайна · добавлены 3 новые задачи в backlog · созданы 4 артефакта документации · 3 тестовых аккаунта получили пароли.

---

## 1. Закрытые баги из QA-обзора 27.04.2026

### 🔴 Критичные блокеры (5 из 5 закрыты)

| Баг | Что было | Что сделано | Коммит |
|---|---|---|---|
| **B1** task_history triggers | INSERT в `tasks` падал с «column "field" does not exist» — задачи не создавались вообще | DROP двух старых триггеров (`trg_tasks_history`, `trg_tasks_history_create`), которые ссылались на несуществующую колонку `field`. Корректный `task_changes_trigger` остался — он использует правильное имя `field_name` | migration `b1_drop_broken_task_history_triggers` |
| **B2** title/assignee_id ↔ name/assigned_to | Тестировщик видел 400 от Supabase | В коде уже было правильно (`name`, `assigned_to`). Дополнительно пофикшен AI-валидатор в `src/copilot/validateApplyAction.ts:104` — он проверял несуществующее `task.assignee_id`, что было тихой дырой в безопасности AI | `ab0e72a` |
| **B3** LiveKit мёртвые видеовстречи | «Не удалось создать или найти встречу» | Добавлены RLS-политики на `video_meetings`, `video_meeting_participants`, `video_meeting_chat_messages` (раньше RLS был включён без политик → блокировка анона). Сломали бесконечную рекурсию через SECURITY DEFINER хелпер `is_meeting_participant(uuid)` | migrations `b3_video_meeting_rls_policies`, `b3_fix_video_meeting_recursion`, `b3_fix_vmp_self_recursion` |
| **B4** RLS изоляция ГИПов | Любой ГИП видел задачи всех проектов | Добавлена колонка `projects.gip_id BIGINT NOT NULL` (FK на app_users), все 15 существующих проектов привязаны к Скороходу (id=9). Созданы хелперы `auth_is_admin()`, `auth_is_gip_of(p_id)`, `auth_can_see_project(p_id)`. Переписаны RLS-политики на 9 таблицах: projects, tasks, drawings, reviews, revisions, transmittals, transmittal_items, specifications, video_meetings. Frontend `createProject` теперь автоматически передаёт `gip_id = currentUserData.id` | migrations `b4_projects_gip_scope_step1/2/3`, `b4_fix_projects_inline_policies`, commit `ab0e72a` |
| **B5** /api/orchestrator 500 | AI Copilot отвечал 500-ками | Расширена диагностика catch-блока: на cold-start `[ORCH-BOOT]` env-проверка, в catch `[ORCH-500]` JSON.stringify с errName/errMsg/errCode/stack/env. Сам корень не найден (нужно ловить новые 500 в Vercel logs). Подтверждено в QA: `/api/orchestrator` возвращает 200 OK | `4bf7105` |

### 🟡 Важные UX-баги (5 из 6 закрыты)

| Баг | Что было | Что сделано | Коммит |
|---|---|---|---|
| **B6** AI-мусор в ответах | «Ты помощник ГИПа: приоритет срокам, рискам и координации между отделами…» Запрос обработан. | Системный промпт `rolePrompt` склеивался в user-facing message в 4 местах `api/orchestrator.js`. Удалён префикс — пользователь видит только смысл («Запрос принят», «Уточните операцию: задачи, чертежи…») | `6093828` |
| **B7** даты mm/dd/yyyy | RuDateInput только для проектов | RuDateInput подключён к 6 формам, после деплоя проверено в QA — даты формата `дд.мм.гггг` везде | предыдущие коммиты + проверено сегодня |
| **B8** кнопка «Отделы» admin не реагирует | Клик не переключал таб | Защитный `onClick`: `e.preventDefault()` + `e.stopPropagation()` + явный `type="button"` на sidebar-кнопках в `AdminPanel.tsx` | `0b686fa` |
| **B9** US-формат даты в логах | «4/27/2026, 11:45:44 PM» | `App.tsx:1555` toLocaleTimeString → `'ru-RU'`. Подтверждено в QA: `28.04.2026, 15:15:38` | `0b686fa` |
| **B10** «issued» в toast трансмиттала | Не локализовано | Добавлен `transmittalStatusMap` в `constants.ts`, использован в toast → «Статус трансмиттала изменён: Выпущен» | `0b686fa` |
| **B11** Multiple GoTrueClient × 3 | 3 предупреждения в консоли | Singletons `getSupabaseAnonClient` / `getSupabaseAdminClient` получили уникальные `storageKey` + `persistSession=false` для admin. `MeetingRoomPage.tsx` realtime-клиент тоже с `auth: { persistSession: false, storageKey: 'enghub-realtime-${meetingId}' }`. Подтверждено в QA: 0 warnings в консоли | `0b686fa`, `6093828` |

### 🟢 Косметика (1 из 2 закрыта)

| Баг | Статус |
|---|---|
| **B12** tooltip на обрезанные имена проектов | ✅ Уже было сделано (commit ранее) |
| **B13** 2 норматива «Не удалось обработать» | ⏸ Отложено по решению владельца |

---

## 2. Новые задачи добавлены в backlog (T29–T31)

| Задача | Статус | Что |
|---|---|---|
| **T29** Виджет «Активных задач» протекал между сессиями | ✅ Закрыт сегодня | `handleLogout` в `App.tsx:1222` теперь дополнительно сбрасывает `allTasks`, `drawings`, `revisions`, `reviews`, `transmittals`, `transmittalItems`, `archivedProjects`. Раньше при смене ГИПов виджет показывал данные прошлой сессии |
| **T30** Раздел «Документы проекта» — загрузка ТЗ | ⏳ Запланировано | Нужна вкладка «📁 Документы», Supabase Storage, таблица `project_documents` с типами `tz/input/drawing/other`, RAG-индексация привязанная к project_id |
| **T31** Применение редизайна из `design_handoff_enghub_redesign` | 🚧 Первая волна сделана | См. раздел 4 ниже |

---

## 3. Миграции БД (8 миграций)

```
b1_drop_broken_task_history_triggers       — фикс блокера B1
b3_video_meeting_rls_policies              — RLS на 3 видео-таблицах
b3_fix_video_meeting_recursion             — разрыв рекурсии RLS
b3_fix_vmp_self_recursion                  — helper is_meeting_participant
b4_projects_gip_scope_step1_add_column     — projects.gip_id NOT NULL + backfill
b4_projects_gip_scope_step2_helper_functions — auth_is_admin/auth_is_gip_of/auth_can_see_project
b4_projects_gip_scope_step3_rewrite_policies — переписаны RLS на 9 таблицах
b4_fix_projects_inline_policies            — инлайн projects RLS (без рекурсии)
```

Все миграции применены к Supabase project `jbdljdwlfimvmqybzynv`. Откатить можно через Supabase Dashboard → Database → Migrations.

---

## 4. Первая волна редизайна (commit `78bdac3`)

Применены **безопасные визуальные правки** без рефакторинга. Источник — `D:\ai-site\design_handoff_enghub_redesign\`.

### Применено

1. **SVG-иконки** — новый файл `src/components/icons.tsx` с 16 Lucide-style компонентами (Grid, Folder, CheckSquare, Calculator, File, Book, Bell, Search, Plus, ArrowLeft, TrendingUp, Sun, Moon, LogOut, Activity, Archive). Объект `NavIcon` — lookup для sidebar nav id → SVG. В сайдбаре теперь рендерятся SVG, Unicode остался как фоллбек.

2. **Логотип EngHub** — `⬡` заменён на «Eh» badge (Manrope 900, letter-spacing -0.02em).

3. **CSS-анимации** в `src/styles.css`:
   - `@keyframes screenEnter` — fade-in + slide-up для смены экранов
   - `@keyframes pulseDot` — пульсация (для bell-индикатора уведомлений)
   - `.sidebar-btn:hover` — `translateX(2px)`
   - `.project-card:hover, .task-row:hover` — `translateY(-2px)` + shadow + border tint
   - `.kanban-card:hover` — `translateY(-1px)`

4. **Хук `useCountUp`** в `src/components/ui.tsx` — анимация числовых значений в KPI с easing cubic-bezier. Готов к применению в дашборде ГИПа: `const displayed = useCountUp(value)`.

5. **Дефолтный таб «Совещание»** при открытии проекта — раньше был `'tasks'` с anti-conference фильтром.

### Не применено (требует согласования владельца)

- **ActivityFeed** — лента активности «Что нового с моего входа». Нужна новая таблица `activity_log` или VIEW из существующих событий.
- **LeadDashboard / EngineerDashboard как отдельные компоненты** — рефакторинг inline-логики в App.tsx. ~1 рабочий день.
- **Кнопка «Settings»** в нижней панели сайдбара — экрана Settings нет.
- **Коды отделов** из дизайна (КМ, ОВ, АР, ЭС, ГП) **не совпадают** с фактическими в БД (АК, АС, ВК, ГП, ПБ, СМ, ТХ, ЭС). Использовать наши.

---

## 5. Тестовые аккаунты — установлены пароли

| Email | Пароль | Роль | Что видит |
|---|---|---|---|
| `gip@enghub-test.ru` | `TestGip!` | gip | свои проекты (0) |
| `gip1@enghub-test.ru` | `TestGip1!` | gip | свои проекты (0) |
| `gip2@enghub-test.ru` | `TestGip2!` | gip | свои проекты (0) |

Раньше эти аккаунты существовали в `auth.users`, но в `app_users.supabase_uid` стояло `NULL` — кнопка «🔑 Пароль» в админке возвращала «У пользователя нет Supabase UID». Сегодня:
1. Привязал `supabase_uid` к каждому из 4 ГИПов в `app_users`.
2. Сбросил пароли через `auth.users.encrypted_password = crypt('пароль', gen_salt('bf'))`.

`skorokhod.a@nipicer.kz` и `admin@enghub.com` — пароли остались прежними (у владельца).

---

## 6. Артефакты документации (4 файла)

| Файл | Где живёт | Что |
|---|---|---|
| **`enghub_full_brief_2026-04-28.md`** | `D:\ai-site\enghub-main\docs\full-brief-2026-04-28.md` + outputs | Единый брифинг для передачи другому агенту: что делает EngHub, актуальные роли и права, workflow, что работает / сломано / отсутствует, тестовые аккаунты, день из жизни команды. |
| **`design-context.md`** | `D:\ai-site\enghub-main\docs\design-context.md` | Дизайн-токены (HEX-цвета, типографика, статусы), карта экранов, болевые точки UX. Перетаскивается в claude.ai/design. |
| **`qa-review.html`** | https://enghub-three.vercel.app/qa-review.html | Интерактивная панель по 13 багам QA-обзора с реальной проверкой кода + Supabase, доказательствами, кнопками решения. |
| **`enghub-qa-test-prompt.md`** | outputs (для повторных QA-прогонов) | Промпт для агента-тестировщика с 5 сценариями + дополнительная диагностика. |

Плюс этот файл (`CHANGELOG_enghub_2026-04-28.md`) — журнал всех изменений за день.

---

## 7. QA-прогон 28.04.2026 — результаты

Прогнал лично через Chrome MCP под аккаунтом `gip1@enghub-test.ru`:

| Тест | Результат | Доказательство |
|---|---|---|
| 1. Создание задачи (B1) | ✅ PASS | Задача «QA Test задача B1» создалась, дата 10.05.2026 (русский формат) |
| 2. Видеовстреча (B3) | ✅ PASS | Лобби открылось, 500-ка ушла |
| 3. Изоляция ГИПов (B4) | ✅ PASS | gip1: 1 проект (свой), gip2: 0 проектов |
| 4. Создание проекта (B4 frontend) | ✅ PASS | Проект «QA Test проект gip1» с автоматическим `gip_id=59` |
| 5. Toast статуса трансмиттала (B10) | ✅ PASS | Бэдж сразу показал «Выпущен» по-русски |
| Доп. AI Copilot (B5/B6) | ✅ PASS | `/api/orchestrator` → 200 OK, ответы без префикса промпта |
| Доп. Multiple GoTrueClient (B11) | ✅ PASS | Консоль чистая, 0 warnings |

Найден один новый мелкий баг **T29** (виджет «Активных задач» на дашборде ГИПа протекал между сессиями) — закрыт сразу.

---

## 8. Все 13 коммитов сегодня (по порядку)

```
6d8b036 fix(T29) + chore(TASKS,docs): handleLogout сбрасывает все стейты + полный бриф для агента
78bdac3 feat(T31): первая волна редизайна из design_handoff_enghub_redesign
6093828 fix(B6,B11): уточнили клиенты Supabase + убрали системный промпт из юзер-ответов
0b686fa fix(B8,B9,B10,B11): пакет код-фиксов из QA-обзора
4bf7105 diag(B5): расширенная диагностика 500 в /api/orchestrator
ab0e72a fix(B2,B4): передаём gip_id при создании проекта + правильное поле в AI-валидаторе
7a90cd3 docs(design): добавлен design-context.md - бриф для дизайнера
c58c3b6 fix(qa-review): полностью перезаписан файл (clean rewrite после truncation)
e64941e fix(public/qa-review): показываем решение в видимом textarea вместо clipboard
1e54fe7 feat(public): qa-review.html — интерактивный анализ QA-обзора от 27.04.2026
e27266d feat(public): добавлен /status.html — quick-deploy дашборда состояния 7 проектов
... (более ранние сегодняшние коммиты)
```

---

## 9. Что сейчас сломано / не работает

После всех фиксов **открытых критичных багов нет**. Работает:
- ✅ Создание проектов и задач
- ✅ Изоляция ГИПов (любой ГИП видит только свои проекты)
- ✅ Видеовстречи LiveKit
- ✅ Документооборот (чертежи → ревизии → замечания → трансмитталы)
- ✅ AI Copilot (200 OK)
- ✅ RAG-поиск нормативки
- ✅ Расчёты (90 формул)
- ✅ Локализация дат и статусов

**Открытые задачи в backlog** (см. полный список в `enghub-main/TASKS.md`):
- T30 — раздел «Документы проекта» с загрузкой ТЗ (новая фича)
- T31 — оставшиеся волны редизайна (ActivityFeed, LeadDashboard/EngineerDashboard refactor)
- T26+ — мобильная версия (UX-блокер для прорабов)
- T13 — 2 норматива failed в RAG (косметика)

---

## 10. Что планируется следующим (по запросу владельца)

1. **Master Excel-трекер по 7 проектам** — один `.xlsx` с 7 листами + сводный лист (env-переменные с именами, прод-URL, последний коммит, # открытых багов, ссылки в админки).
2. **Карта здоровья инфраструктуры** — HTML-страница 7 проектов × 5 систем (GitHub/Vercel/Railway/Supabase/Cloudflare) с реальными API-проверками и автообновлением.

---

## 11. Контакты / ссылки

- **Прод EngHub:** https://enghub-three.vercel.app
- **GitHub:** https://github.com/andyrbek2709-tech/ai-institut
- **Supabase project:** `jbdljdwlfimvmqybzynv`
- **Vercel project:** `prj_ZDihCpWH1AmIEPRebnOI7ST6d6nv`
- **Дашборд статуса 7 проектов:** https://enghub-three.vercel.app/status.html
- **Интерактивная QA-панель:** https://enghub-three.vercel.app/qa-review.html
- **Owner Dashboard live `/status`:** в репо `andyrbek2709-tech/owner-dashboard` (не задеплоено отдельно — пока внутри EngHub)
- **Email владельца / git-коммитов:** andyrbek2709@gmail.com (НЕ andreyfuture27@gmail.com — это hard rule в memory)

---

**Конец журнала.** Сохрани этот файл — он отражает все изменения по EngHub за 28.04.2026.
