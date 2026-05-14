# 🚀 EngHub - МАСТЕР-СТЕЙТ ПРОЕКТА

**Обновлено:** 14.05.2026 07:30
**Фаза:** Аудит и планирование исправлений
**Статус:** ⚠️ Критические проблемы обнаружены

---

## 📍 Резюме

**Что работаем:** Инженерная платформа EngHub (управление проектами, задачи, задания)
**Где:** https://github.com/andyrbek2709-tech/ai-institut
**Стек:** React/TypeScript (Frontend) + Supabase (Backend) + Redis (Orchestrator)
**Деплой:** Railway

---

## 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### Проблема 1: Нарушение изоляции проектов
**Статус:** ❌ Не исправлено
**Приоритет:** P0 - Критический

**Что не так:**
- Все роли (ГИП, Начальник, Инженер, Ведущий инженер, Наблюдатель) видят проекты ВСЕХ ГИПов
- ГИП1 (ID: 4) видит проекты ГИП2 (ID: 9)
- Нет фильтрации по назначениям (project_assignments)

**Должно быть:**
- ГИП1 видит только свои проекты
- ГИП2 видит только свои проекты
- Начальники/Инженеры видят только назначенные проекты

**Решение:**
- Выполнить SQL миграцию `enghub-main/supabase/migrations/2026-05-14_t31_rls_isolation_fix.sql`
- Создать назначения для существующих проектов
- Тестировать через `test_enghub_permissions.py`

---

### Проблема 2: Таблица project_assignments пуста
**Статус:** ❌ Не исправлено
**Приоритет:** P0 - Критический

**Что не так:**
- Назначения на проекты не созданы (0 записей)
- Система не знает кто работает над чем

**Решение:**
- Выполнить INSERT запросы для назначения ГИПов на свои проекты
- Включить в миграцию автоматическое создание назначений

---

### Проблема 3: Поле deadline не nullable
**Статус:** ❌ Не исправлено
**Приоритет:** P1 - Высокий

**Что не так:**
- ГИП не может создать проект (deadline constraint error)

**Решение:**
- Сделать поле nullable или установить default NULL

---

## ✅ ЧТО СОЗДАНО И ЗАПУШЕНО

### GitHub Commit: 8ce092a
**URL:** https://github.com/andyrbek2709-tech/ai-institut/commit/8ce092a
**Дата:** 14.05.2026
**Файлы:**
- ✅ `enghub-main/supabase/migrations/2026-05-14_t31_rls_isolation_fix.sql` - SQL миграция (19.7 KB)
- ✅ `enghub-main/scripts/test_enghub_permissions.py` - Тест прав доступа (29.8 KB)
- ✅ `enghub-main/scripts/test_enghub_workflow.py` - Тест рабочего процесса (23.5 KB)
- ✅ `enghub-main/docs/enghub-final-audit-report.md` - Финальный отчет аудита
- ✅ `enghub-main/docs/enghub-fixes-plan.md` - План исправлений (18.8 KB)
- ✅ `enghub-main/docs/enghub-test-report.md` - Отчет о тестах
- ✅ `enghub-main/docs/enghub-workflow-test-report.md` - Отчет о workflow
- ✅ `ORCHESTRATOR_STATE.md` - Состояние оркестратора

---

### Тестовые скрипты

#### test_enghub_permissions.py
**Что тестирует:**
- Все таблицы созданы и доступны
- Права доступа для каждой роли (admin, gip, lead, engineer)
- Изоляция проектов (ГИП1 не видит проекты ГИП2)
- Создание проектов только ГИПами
- Наличие назначений на проекты

**Как запустить:**
```bash
cd /tmp/ai-institut/enghub-main/scripts/
python3 test_enghub_permissions.py
```

**Результат:**
- JSON отчет: `/tmp/enghub-test-report.json`
- Markdown отчет: `/tmp/enghub-test-report.md`

---

#### test_enghub_workflow.py
**Что тестирует:**
- Создание проекта ГИПом
- Назначение начальника отдела
- Назначение инженера
- Создание задания
- Передача задания между ролями
- Визуализация рабочего процесса

**Как запустить:**
```bash
cd /tmp/ai-institut/enghub-main/scripts/
python3 test_enghub_workflow.py
```

**Результат:**
- Отчет: `/tmp/enghub-workflow-test-report.md`
- Mermaid диаграмма: `/tmp/enghub-workflow-flowchart.md`

---

## 📋 ПЛАН ИСПРАВЛЕНИЙ

### День 1 (СРОЧНО - ~30 минут)

**Задача 1: Исправить RLS изоляцию**
1. Открыть Supabase Dashboard → SQL Editor
2. Выполнить файл: `enghub-main/supabase/migrations/2026-05-14_t31_rls_isolation_fix.sql`
3. Проверить, что проект_assignments создана

**Задача 2: Создать назначения для проектов**
1. В SQL Editor выполнить:
```sql
-- Назначаем ГИПов на свои проекты
INSERT INTO project_assignments (project_id, user_id, role, assigned_by, is_active)
SELECT p.id, au.id, 'gip', au.id, TRUE
FROM projects p
JOIN app_users au ON au.supabase_uid = p.gip_id::text
WHERE NOT EXISTS (
  SELECT 1 FROM project_assignments pa
  WHERE pa.project_id = p.id AND pa.user_id = au.id AND pa.role = 'gip'
);
```

**Задача 3: Исправить поле deadline**
```sql
ALTER TABLE projects ALTER COLUMN deadline DROP NOT NULL;
-- или
ALTER TABLE projects ALTER COLUMN deadline SET DEFAULT NULL;
```

**Задача 4: Повторно запустить тесты**
```bash
python3 test_enghub_permissions.py
python3 test_enghub_workflow.py
```

**Критерий успеха:**
- ✅ ГИП1 видит только свои 3 проекта
- ✅ ГИП2 видит только свой 1 проект
- ✅ Тесты проходят без ошибок
- ✅ ГИП может создавать проекты

---

### День 2 (ОПЦИОНАЛЬНО - ~25 минут)

**Задача 5: Создать функции для удобного назначения**
```sql
CREATE FUNCTION assign_user_to_project(
  project_id INTEGER,
  user_id INTEGER,
  role TEXT,
  assigned_by INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO project_assignments (project_id, user_id, role, assigned_by, is_active)
  VALUES (project_id, user_id, role, assigned_by, TRUE);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Задача 6: Исправить RLS для project_assignments**
- Разрешить создание назначений только ГИПам и admin
- Разрешить редактирование назначений

---

## 🤖 СИСТЕМНЫЙ ОРКЕСТРАТОР

### Реализовано ✅
- **State Machine:** Переходы задач (CREATED → IN_PROGRESS → REVIEW_LEAD → REVIEW_GIP → APPROVED)
- **11 Event Handlers:** task-created, task-submitted, task-approved, deadline-approaching, etc.
- **Main Loop:** Redis Streams + Event Loop + Retry Logic
- **Notifications:** IN-APP, EMAIL, TELEGRAM

### Не реализовано ❌
- **Heartbeat Checker:** Нет фоновых проверок блокировок/дедлайнов
- **Эскалация:** Нет авто-уведомлений (Lead > 24h, ГИП > 48h)
- **Auto-unblock:** Зависимые задачи не разблокируются при утверждении
- **Cron Jobs:** Нет фоновых задач

### Что нужно сделать 🔧
1. Создать `services/scheduler.ts` (heartbeat checker)
2. Реализовать разблокировку в `task-approved.ts`
3. Создать `handlers/escalation-checker.ts`
4. Добавить в cron scheduler

**Документация:**
- `core/system-orchestrator.md` (923 строки) - Полная документация
- `ORCHESTRATOR_STATE.md` - Состояние + улучшения + тестовый план

---

## 📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ

### Тест прав доступа (test_enghub_permissions.py)
**Результат:** ⚠️ Частичный успех

**Что работает:**
- ✅ Все таблицы созданы (8/8)
- ✅ API функционирует корректно
- ✅ Аутентификация работает
- ✅ Инженер не может создавать проекты (RLS работает)

**Что не работает:**
- ❌ **ГИП1 видит 4 проекта вместо 3** (видит проекты ГИП2)
- ❌ **ГИП2 видит 4 проекта вместо 1** (видит проекты ГИП1)
- ❌ **project_assignments пуста** (0 записей)
- ❌ **Изоляция проектов нарушена**

---

### Тест рабочего процесса (test_enghub_workflow.py)
**Результат:** ⚠️ Не завершен

**Сделано:**
- ✅ Созданы тестовые данные
- ✅ Визуализирован рабочий процесс
- ⏸️ Остановлено из-за отсутствия назначений

**Нужно:**
- Выполнить SQL миграцию
- Создать назначения
- Повторно запустить тест

---

## 🔗 ССЫЛКИ И ФАЙЛЫ

### GitHub
- **Репозиторий:** https://github.com/andyrbek2709-tech/ai-institut
- **Commit:** 8ce092a (последний)
- **Пат:** [удален для безопасности]

### Ключевые файлы
**SQL и миграции:**
- `enghub-main/supabase/migrations/2026-05-14_t31_rls_isolation_fix.sql` - Исправление RLS

**Тесты:**
- `enghub-main/scripts/test_enghub_permissions.py` - Тест прав доступа
- `enghub-main/scripts/test_enghub_workflow.py` - Тест рабочего процесса

**Документация:**
- `enghub-main/docs/enghub-final-audit-report.md` - Финальный отчет
- `enghub-main/docs/enghub-fixes-plan.md` - План исправлений
- `core/system-orchestrator.md` - Документация оркестратора
- `ORCHESTRATOR_STATE.md` - Состояние оркестратора

### Supabase
- **URL:** https://inachjylaqelysiwtsux.supabase.co
- **Frontend:** https://enghub-frontend-production.up.railway.app/
- **Dashboard:** https://supabase.com/dashboard/project/inachjylaqelysiwtsux

---

## 🎯 КРИТЕРИИ УСПЕХА

Система исправлена когда:
- ✅ ГИП1 видит только свои 3 проекта
- ✅ ГИП2 видит только свой 1 проект
- ✅ Начальник видит только назначенные проекты
- ✅ Инженер видит только назначенные проекты
- ✅ ГИП может создавать проекты
- ✅ Назначения созданы для всех проектов
- ✅ Уведомления работают
- ✅ Оркестратор обрабатывает события

---

## 📝 ЗАПИСИ ИЗМЕНЕНИЙ

### 2026-05-14 07:30
- ✅ Создан PROJECT_MASTER_STATE.md
- ✅ Сохранена информация в memory
- ✅ Изучен системный оркестратор
- ✅ Создан план проверок для оркестратора
- ✅ Все изменения запушены в GitHub (commit 8ce092a)

### 2026-05-14 07:00
- ✅ Выполнено полное тестирование прав доступа
- ✅ Обнаружена критическая проблема (изоляция проектов)
- ✅ Созданы тестовые скрипты (permissions + workflow)
- ✅ Созданы SQL миграции для исправления RLS
- ✅ Созданы планы исправлений

### 2026-05-14 06:30
- ✅ Начата работа над правами доступа
- ✅ Исследована база данных Supabase
- ✅ Изучен текущий код (RLS политики)

---

## 🔄 КАК ПРОДОЛЖИТЬ В НОВОЙ СЕССИИ

### Шаг 1: Прочитать мастер-стейт
```
Откройте: /tmp/ai-institut/PROJECT_MASTER_STATE.md
Или скажите: "прочитай PROJECT_MASTER_STATE.md"
```

### Шаг 2: Загрузить из памяти
```
Я автоматически загрузлю все memory записи:
- Структура проекта
- Текущий статус
- Модельное переключение (vision → gpt-4o, code → glm-4.7)
```

### Шаг 3: Запустить тесты для проверки
```bash
cd /tmp/ai-institut/enghub-main/scripts/
python3 test_enghub_permissions.py
```

### Шаг 4: Выполнить исправления
- Открыть Supabase Dashboard → SQL Editor
- Выполнить миграцию
- Создать назначения
- Повторно запустить тесты

### Шаг 5: Протестировать оркестратор
- Открыть: `/tmp/ai-institut/ORCHESTRATOR_STATE.md`
- Прочитать: `core/system-orchestrator.md`
- Создать scheduler.ts
- Реализовать auto-unblock

---

## 📞 КОНТАКТЫ

**Разработчик:** Andrey Korobeynikov
**Email:** andyrbek2709@gmail.com
**GitHub:** https://github.com/andyrbek2709-tech
**Telegram:** skorokhod.a@nipicer.kz

---

**Конец состояния проекта - последняя сессия: 14.05.2026 07:30**
