# 🔧 EngHub - План исправлений

**Дата:** 14.05.2026
**Статус:** Требует выполнения

---

## 📋 Обзор

Обнаружено **4 критические проблемы**, требующие немедленного исправления для нормальной работы системы.

---

## 🚨 КРИТИЧЕСКИЕ ПРИОРИТЕТ (СРОЧНО)

### Приоритет 1: Исправить RLS изоляцию проектов

**Проблема:** Все роли видят проекты всех ГИПов (нарушение безопасности)

**Текущее состояние:**
- ГИП1 (ID: 4) создал 3 проекта
- ГИП2 (ID: 9) создал 1 проект
- ВСЕ роли видят 4 проекта и тех и других

**Должно быть:**
- ГИП1 видит только свои 3 проекта
- ГИП2 видит только свой 1 проект
- Начальники видят только назначенные проекты
- Инженеры видят только назначенные проекты

**Исправление:**
Выполнить SQL в Supabase Dashboard → SQL Editor:

```sql
-- Шаг 1: Удалить существующие политики (если есть)
DROP POLICY IF EXISTS "Users can view projects" ON projects;

-- Шаг 2: Создать правильную политику изоляции
CREATE POLICY "Users can view their own or assigned projects"
ON projects FOR SELECT
USING (
  -- Создатель проекта (ГИП) видит свои проекты
  gip_id = (SELECT id FROM app_users WHERE supabase_uid = auth.uid()) OR
  -- Пользователи назначены на проект через project_assignments
  id IN (
    SELECT project_id
    FROM project_assignments pa
    JOIN app_users au ON pa.user_id = au.id
    WHERE au.supabase_uid = auth.uid()
      AND pa.is_active = TRUE
  ) OR
  -- Администратор видит все проекты
  (SELECT role FROM app_users WHERE supabase_uid = auth.uid()) = 'admin'
);

-- Шаг 3: Проверить, что политика применена
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'projects';
```

**Проверка:** Повторно запустить тест `test_enghub_permissions.py`

---

## ⚠️ ВЫСОКИЙ ПРИОРИТЕТ

### Приоритет 2: Создать назначения для существующих проектов

**Проблема:** Таблица `project_assignments` пуста, система не знает кто работает над чем

**Текущее состояние:**
- 4 проекта в базе
- 0 назначений
- Никто (кроме создателя) не может участвовать

**Должно быть:**
- Каждый ГИП назначен как GIP на свои проекты
- Начальники отделов назначены на проекты (если их отдел участвует)
- Инженеры назначены на проекты

**Исправление:**
Выполнить SQL в Supabase Dashboard → SQL Editor:

```sql
-- Шаг 1: Назначить ГИПов на свои проекты
INSERT INTO project_assignments (project_id, user_id, role, assigned_by, is_active, assigned_at)
SELECT DISTINCT
  p.id as project_id,
  au.id as user_id,
  'gip' as role,
  au.id as assigned_by,
  TRUE as is_active,
  NOW() as assigned_at
FROM projects p
JOIN app_users au ON au.supabase_uid = p.gip_id::text
WHERE NOT EXISTS (
  SELECT 1
  FROM project_assignments pa
  WHERE pa.project_id = p.id
    AND pa.user_id = au.id
    AND pa.role = 'gip'
    AND pa.is_active = TRUE
);

-- Шаг 2: Проверить назначения
SELECT
  pa.id,
  p.name as project_name,
  au.full_name as user_name,
  pa.role,
  pa.is_active,
  pa.assigned_at
FROM project_assignments pa
JOIN projects p ON pa.project_id = p.id
JOIN app_users au ON pa.user_id = au.id
ORDER BY p.id, pa.role;

-- Ожидаемый результат: 4 назначения (по 1 на каждый проект)
```

**Дополнительные назначения (опционально):**
```sql
-- Назначить начальников отделов на проекты (если отдел указан в depts)
-- Это пример для ручного назначения, можно автоматизировать через departments

-- Пример: Назначить Начальника QA (User ID: 2) на Проект ID: 1
INSERT INTO project_assignments (project_id, user_id, role, assigned_by, is_active, assigned_at)
VALUES (1, 2, 'lead', 4, TRUE, NOW());

-- Пример: Назначить Инженера (User ID: 5) на Проект ID: 1
INSERT INTO project_assignments (project_id, user_id, role, assigned_by, is_active, assigned_at)
VALUES (1, 5, 'engineer', 2, TRUE, NOW());
```

**Проверка:**
```sql
-- Сколько назначений создано
SELECT COUNT(*) as total_assignments FROM project_assignments WHERE is_active = TRUE;

-- Назначения по проектам
SELECT
  p.name as project_name,
  COUNT(*) as assignments_count,
  STRING_AGG(au.full_name, ', ') as assigned_users
FROM project_assignments pa
JOIN projects p ON pa.project_id = p.id
JOIN app_users au ON pa.user_id = au.id
WHERE pa.is_active = TRUE
GROUP BY p.id, p.name
ORDER BY p.id;
```

---

### Приоритет 3: Исправить поле deadline в projects

**Проблема:** ГИП не может создать проект - ошибка deadline constraint

**Текущее состояние:**
```bash
HTTP 400: null value in column "deadline" of relation "projects" violates not-null constraint
```

**Причина:** Поле `deadline` имеет NOT NULL ограничение, но API не передает значение

**Варианты исправления:**

**Вариант A: Сделать поле nullable** (рекомендуется)
```sql
ALTER TABLE projects ALTER COLUMN deadline DROP NOT NULL;
```

**Вариант B: Установить значение по умолчанию**
```sql
-- 30 дней от создания
ALTER TABLE projects ALTER COLUMN deadline SET DEFAULT (NOW() + INTERVAL '30 days');
```

**Вариант C: Обновить API/Backend** (требует изменений в коде приложения)
- Добавить проверку deadline в backend
- Требовать от пользователя указать deadline

**Рекомендация:** Вариант A (nullable) - быстрее всего и не ломает существующие данные

**Проверка:**
```sql
-- Проверить схему таблицы
\d projects

-- Или через API
-- Попробовать создать проект без deadline
```

---

## 🟡 СРЕДНИЙ ПРИОРИТЕТ

### Приоритет 4: Создать функции для удобного назначения

**Проблема:** Нет удобных функций для назначения пользователей на проекты

**Исправление:**
Выполнить SQL:

```sql
-- Функция 1: Назначить пользователя на проект
CREATE OR REPLACE FUNCTION assign_user_to_project(
  p_project_id INTEGER,
  p_user_id INTEGER,
  p_role VARCHAR, -- 'gip', 'lead', 'engineer'
  p_assigned_by INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Если assigned_by не указан, используем текущего пользователя
  IF p_assigned_by IS NULL THEN
    p_assigned_by := (SELECT id FROM app_users WHERE supabase_uid = auth.uid());
  END IF;

  -- Проверяем, что назначение еще не существует
  IF EXISTS (
    SELECT 1
    FROM project_assignments
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND role = p_role
      AND is_active = TRUE
  ) THEN
    RETURN FALSE; -- Уже назначен
  END IF;

  -- Создаем назначение
  INSERT INTO project_assignments (project_id, user_id, role, assigned_by, is_active, assigned_at)
  VALUES (p_project_id, p_user_id, p_role, p_assigned_by, TRUE, NOW());

  -- Создаем уведомление для пользователя
  INSERT INTO notifications (user_id, type, title, message, related_id)
  VALUES (
    p_user_id,
    'project_assigned',
    'Назначение на проект',
    'Вы назначены на проект с ролью: ' || p_role,
    p_project_id
  );

  RETURN TRUE; -- Успешно
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Тест функции
-- SELECT assign_user_to_project(1, 5, 'engineer', 4); -- TRUE = успех

-- Функция 2: Удалить пользователя из проекта
CREATE OR REPLACE FUNCTION unassign_user_from_project(
  p_project_id INTEGER,
  p_user_id INTEGER,
  p_role VARCHAR
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE project_assignments
  SET is_active = FALSE
  WHERE project_id = p_project_id
    AND user_id = p_user_id
    AND role = p_role
    AND is_active = TRUE;

  -- Создаем уведомление
  INSERT INTO notifications (user_id, type, title, message, related_id)
  VALUES (
    p_user_id,
    'project_unassigned',
    'Отзыв из проекта',
    'Вы отозваны из проекта',
    p_project_id
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция 3: Создать проект с автоматическим назначением ГИПа
CREATE OR REPLACE FUNCTION create_project_with_gip(
  p_name TEXT,
  p_code TEXT,
  p_gip_user_id INTEGER,
  p_depts INTEGER[] DEFAULT '{}',
  p_status VARCHAR DEFAULT 'active'
)
RETURNS INTEGER AS $$
DECLARE
  v_project_id INTEGER;
BEGIN
  -- Создаем проект
  INSERT INTO projects (name, code, gip_id, depts, status, created_at)
  VALUES (p_name, p_code, (SELECT supabase_uid FROM app_users WHERE id = p_gip_user_id), p_depts, p_status, NOW())
  RETURNING id INTO v_project_id;

  -- Автоматически назначаем ГИПа
  INSERT INTO project_assignments (project_id, user_id, role, assigned_by, is_active, assigned_at)
  VALUES (v_project_id, p_gip_user_id, 'gip', p_gip_user_id, TRUE, NOW());

  RETURN v_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Использование функций:**
```sql
-- Назначить инженера на проект
SELECT assign_user_to_project(1, 5, 'engineer', 4);

-- Отозвать из проекта
SELECT unassign_user_from_project(1, 5, 'engineer');

-- Создать проект с ГИПом
SELECT create_project_with_gip('Новый проект', 'NP-001', 4, ARRAY[3, 6]);
```

---

### Приоритет 5: Исправить RLS для project_assignments

**Проблема:** Нет проверок RLS для назначения пользователей

**Исправление:**
```sql
-- Удаляем старые политики
DROP POLICY IF EXISTS "Users can view assignments" ON project_assignments;

-- Создаем правильную политику
CREATE POLICY "Users can view project assignments they are involved in"
ON project_assignments FOR SELECT
USING (
  -- Видеть назначения где ты участник
  user_id = (SELECT id FROM app_users WHERE supabase_uid = auth.uid()) OR
  -- Видеть назначения на своих проектах
  project_id IN (
    SELECT p.id
    FROM projects p
    WHERE p.gip_id = (SELECT id FROM app_users WHERE supabase_uid = auth.uid())
  ) OR
  -- Администратор
  (SELECT role FROM app_users WHERE supabase_uid = auth.uid()) = 'admin'
);

-- Только ГИП или admin могут назначать
CREATE POLICY "Only GIP or admin can assign users"
ON project_assignments FOR INSERT
WITH CHECK (
  -- ГИП назначает на свои проекты
  project_id IN (
    SELECT p.id
    FROM projects p
    WHERE p.gip_id = (SELECT id FROM app_users WHERE supabase_uid = auth.uid())
  ) OR
  -- Администратор
  (SELECT role FROM app_users WHERE supabase_uid = auth.uid()) = 'admin'
);

-- Только назначивший или admin может обновить
CREATE POLICY "Only assigner or admin can update assignments"
ON project_assignments FOR UPDATE
USING (
  assigned_by = (SELECT id FROM app_users WHERE supabase_uid = auth.uid()) OR
  (SELECT role FROM app_users WHERE supabase_uid = auth.uid()) = 'admin'
);
```

---

## 🔵 НИЗКИЙ ПРИОРИТЕТ (улучшения)

### Приоритет 6: Добавить валидацию в API/Backend

**Цель:** Проверять данные до отправки в базу

**Что добавить:**
- Валидация обязательных полей
- Проверка прав перед операциями
- Логирование всех операций

---

### Приоритет 7: Создать автоматические триггеры

**Цель:** Автоматизировать рутинные операции

**Примеры:**
- Автоматическое назначение ГИПа при создании проекта
- Автоматическое уведомление при назначении
- Обновление updated_at при изменениях

```sql
-- Триггер: Автоматическое назначение ГИПа
CREATE OR REPLACE FUNCTION auto_assign_gip_on_project_create()
RETURNS TRIGGER AS $$
BEGIN
  -- Назначаем создателя проекта как ГИПа
  INSERT INTO project_assignments (project_id, user_id, role, assigned_by, is_active, assigned_at)
  SELECT
    NEW.id,
    au.id,
    'gip',
    au.id,
    TRUE,
    NOW()
  FROM app_users au
  WHERE au.supabase_uid = NEW.gip_id::text
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_assign_gip ON projects;
CREATE TRIGGER trigger_auto_assign_gip
AFTER INSERT ON projects
FOR EACH ROW
EXECUTE FUNCTION auto_assign_gip_on_project_create();
```

---

### Приоритет 8: Оптимизировать производительность

**Цель:** Улучшить скорость запросов

**Что сделать:**
- Добавить индексы на часто используемые поля
- Оптимизировать сложные запросы
- Кешировать результаты

```sql
-- Добавить индексы
CREATE INDEX idx_projects_gip_id ON projects(gip_id);
CREATE INDEX idx_project_assignments_project_id ON project_assignments(project_id);
CREATE INDEX idx_project_assignments_user_id ON project_assignments(user_id);
CREATE INDEX idx_project_assignments_active ON project_assignments(is_active) WHERE is_active = TRUE;
```

---

## 📋 Порядок выполнения

### День 1 (СРОЧНО):
1. ✅ **Приоритет 1:** Исправить RLS изоляцию (~10 минут)
2. ✅ **Приоритет 2:** Создать назначения для проектов (~10 минут)
3. ✅ **Приоритет 3:** Исправить поле deadline (~5 минут)
4. ✅ **Тест:** Повторно запустить `test_enghub_permissions.py`

### День 2:
5. ✅ **Приоритет 4:** Создать функции для назначения (~15 минут)
6. ✅ **Приоритет 5:** Исправить RLS для project_assignments (~10 минут)
7. ✅ **Тест:** Запустить `test_enghub_workflow.py`

### День 3 (опционально):
8. ✅ **Приоритет 6:** Добавить валидацию в API
9. ✅ **Приоритет 7:** Создать триггеры
10. ✅ **Приоритет 8:** Оптимизировать производительность

---

## ✅ Проверка после каждого шага

После выполнения каждого шага:

```bash
# 1. Перезагрузить тесты прав доступа
cd /tmp && python3 test_enghub_permissions.py

# 2. Проверить результаты
cat /tmp/enghub-test-report.md

# 3. Проверить изоляцию
# GIP должен видеть только свои проекты
# Начальник должен видеть только назначенные
```

---

## 📊 Критерии успеха

Система считается исправленной, когда:

✅ ГИП1 видит только свои 3 проекта
✅ ГИП2 видит только свой 1 проект
✅ Начальник видит только назначенные проекты
✅ Инженер видит только назначенные проекты
✅ ГИП может создавать проекты
✅ Назначения созданы для всех проектов
✅ Уведомления работают

---

## 🚨 Если что-то не работает

### Если после исправления RLS все еще видят все проекты:
1. Проверьте, что назначения созданы
2. Проверьте, что политика применилась
3. Проверьте, что users supabase_uid совпадают с project_assignments user_id

### Если не удается создать проект:
1. Проверьте, что deadline nullable
2. Проверьте, что все NOT NULL поля передаются
3. Проверьте логи Supabase (Dashboard → Logs)

### Если назначения не работают:
1. Проверьте, что таблица project_assignments не пуста
2. Проверьте RLS политики для project_assignments
3. Проверьте, что is_active = TRUE

---

## 📞 Поддержка

Если возникнут проблемы:
1. Проверьте файлы логов в `/tmp/`
2. Проверьте отчеты тестирования
3. Обратитесь к файлу `/tmp/enghub-final-audit-report.md`

---

**План составлен:** 14.05.2026
**Ожидаемое время выполнения:** 1-2 часа для критических приоритетов
**Статус:** ✅ Готов к выполнению
