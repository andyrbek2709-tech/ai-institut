-- ============================================================================
-- ENG HUB - Исправление прав доступа (RLS Политики)
-- ============================================================================
-- Выполните этот скрипт в Supabase Dashboard → SQL Editor
-- ============================================================================

-- ============================================================================
-- ЧАСТЬ 1: Создание недостающих таблиц для функционала
-- ============================================================================

-- Таблица назначений на проект
CREATE TABLE IF NOT EXISTS project_assignments (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('gip', 'lead', 'engineer')),
  assigned_by INTEGER REFERENCES app_users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(project_id, user_id, is_active)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_project_assignments_project_id ON project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_user_id ON project_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_active ON project_assignments(is_active) WHERE is_active = TRUE;

-- Таблица заданий
CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_by INTEGER REFERENCES app_users(id),
  assigned_to INTEGER REFERENCES app_users(id),
  status VARCHAR(50) DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'archived')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_project_id ON assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_to ON assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);

-- Таблица документов проекта
CREATE TABLE IF NOT EXISTS project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type VARCHAR(100),
  file_size BIGINT,
  uploaded_by INTEGER REFERENCES app_users(id),
  ocr_status VARCHAR(50) DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'ready', 'error')),
  ocr_content TEXT,
  ocr_error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_documents_project_id ON project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_uploaded_by ON project_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_project_documents_ocr_status ON project_documents(ocr_status);

-- Таблица уведомлений
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'project_assigned', 'task_assigned', 'task_updated',
    'doc_uploaded', 'doc_ready', 'doc_error',
    'project_archived', 'comment_added'
  )),
  title TEXT NOT NULL,
  message TEXT,
  related_id INTEGER, -- project_id, task_id, doc_id, comment_id
  related_type VARCHAR(20), -- 'project', 'task', 'doc', 'comment'
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================================
-- ЧАСТЬ 2: Исправление RLS для существующих таблиц
-- ============================================================================

-- Включаем RLS если отключен
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE normative_docs ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики (будут пересозданы)
DROP POLICY IF EXISTS "Users can view all projects" ON projects;
DROP POLICY IF EXISTS "Users can insert projects" ON projects;
DROP POLICY IF EXISTS "Users can update projects" ON projects;
DROP POLICY IF EXISTS "Users can delete projects" ON projects;

DROP POLICY IF EXISTS "Users can view all app_users" ON app_users;
DROP POLICY IF EXISTS "Users can insert app_users" ON app_users;
DROP POLICY IF EXISTS "Users can update app_users" ON app_users;

-- ============================================================================
-- ЧАСТЬ 3: RLS для projects (проекты)
-- ============================================================================

-- Чтение проектов: только свои или назначенные
CREATE POLICY "Users can view their own or assigned projects"
ON projects FOR SELECT
USING (
  -- Создатель проекта (ГИП)
  gip_id = auth.uid()::int OR
  -- Назначен на проект через project_assignments
  id IN (
    SELECT project_id
    FROM project_assignments
    WHERE user_id = auth.uid()::int AND is_active = TRUE
  ) OR
  -- Администратор
  (SELECT role FROM app_users WHERE id = auth.uid()::int) = 'admin'
);

-- Создание проектов: только ГИП и admin
CREATE POLICY "GIPs and admins can create projects"
ON projects FOR INSERT
WITH CHECK (
  (SELECT role FROM app_users WHERE id = auth.uid()::int) IN ('gip', 'admin')
);

-- Обновление проектов: только создатель (ГИП) или admin
CREATE POLICY "Project owners and admins can update projects"
ON projects FOR UPDATE
USING (
  gip_id = auth.uid()::int OR
  (SELECT role FROM app_users WHERE id = auth.uid()::int) = 'admin'
);

-- Удаление проектов: только создатель (ГИП) или admin
CREATE POLICY "Project owners and admins can delete projects"
ON projects FOR DELETE
USING (
  gip_id = auth.uid()::int OR
  (SELECT role FROM app_users WHERE id = auth.uid()::int) = 'admin'
);

-- ============================================================================
-- ЧАСТЬ 4: RLS для app_users (пользователи)
-- ============================================================================

-- Чтение пользователей: все могут читать, admin видит все детали
CREATE POLICY "Authenticated users can view app_users"
ON app_users FOR SELECT
USING (TRUE);

-- Вставка пользователей: только admin
CREATE POLICY "Admins can insert users"
ON app_users FOR INSERT
WITH CHECK (
  (SELECT role FROM app_users WHERE id = auth.uid()::int) = 'admin'
);

-- Обновление пользователей: только admin или свой аккаунт
CREATE POLICY "Admins or owner can update users"
ON app_users FOR UPDATE
USING (
  id = auth.uid()::int OR
  (SELECT role FROM app_users WHERE id = auth.uid()::int) = 'admin'
);

-- ============================================================================
-- ЧАСТЬ 5: RLS для departments (отделы)
-- ============================================================================

-- Чтение отделов: все
CREATE POLICY "Authenticated users can view departments"
ON departments FOR SELECT
USING (TRUE);

-- ============================================================================
-- ЧАСТЬ 6: RLS для normative_docs (нормативные документы)
-- ============================================================================

-- Чтение документов: все (глобальная база знаний)
CREATE POLICY "Authenticated users can view normative_docs"
ON normative_docs FOR SELECT
USING (TRUE);

-- ============================================================================
-- ЧАСТЬ 7: RLS для новых таблиц
-- ============================================================================

-- project_assignments
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project assignments they are part of"
ON project_assignments FOR SELECT
USING (
  user_id = auth.uid()::int OR
  (SELECT role FROM app_users WHERE id = auth.uid()::int) = 'admin'
);

CREATE POLICY "Admins and leads can insert assignments"
ON project_assignments FOR INSERT
WITH CHECK (
  (SELECT role FROM app_users WHERE id = auth.uid()::int) IN ('admin', 'lead', 'gip')
);

-- assignments
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their assignments"
ON assignments FOR SELECT
USING (
  assigned_to = auth.uid()::int OR
  project_id IN (
    SELECT project_id
    FROM project_assignments
    WHERE user_id = auth.uid()::int AND is_active = TRUE
  ) OR
  (SELECT role FROM app_users WHERE id = auth.uid()::int) = 'admin'
);

CREATE POLICY "Users can update their assignments"
ON assignments FOR UPDATE
USING (
  assigned_to = auth.uid()::int OR
  assigned_by = auth.uid()::int OR
  (SELECT role FROM app_users WHERE id = auth.uid()::int) = 'admin'
);

-- project_documents
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view documents in their projects"
ON project_documents FOR SELECT
USING (
  project_id IN (
    SELECT project_id
    FROM project_assignments
    WHERE user_id = auth.uid()::int AND is_active = TRUE
  ) OR
  gip_id IN (
    SELECT id
    FROM projects p
    WHERE p.id = project_documents.project_id AND p.gip_id = auth.uid()::int
  ) OR
  (SELECT role FROM app_users WHERE id = auth.uid()::int) = 'admin'
);

CREATE POLICY "Users can upload documents to their projects"
ON project_documents FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT project_id
    FROM project_assignments
    WHERE user_id = auth.uid()::int AND is_active = TRUE
  ) OR
  gip_id = auth.uid()::int OR
  (SELECT role FROM app_users WHERE id = auth.uid()::int) = 'admin'
);

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
USING (
  user_id = auth.uid()::int
);

CREATE POLICY "System can create notifications"
ON notifications FOR INSERT
WITH CHECK (TRUE);

CREATE POLICY "Users can mark their notifications as read"
ON notifications FOR UPDATE
USING (
  user_id = auth.uid()::int
);

-- ============================================================================
-- ЧАСТЬ 8: Миграция существующих данных
-- ============================================================================

-- Создаем назначения для существующих проектов
-- Предполагаем, что ГИП должен быть назначен как GIP
INSERT INTO project_assignments (project_id, user_id, role, assigned_by, is_active)
SELECT
  p.id as project_id,
  p.gip_id as user_id,
  'gip' as role,
  p.gip_id as assigned_by,
  TRUE as is_active
FROM projects p
WHERE NOT EXISTS (
  SELECT 1
  FROM project_assignments pa
  WHERE pa.project_id = p.id AND pa.user_id = p.gip_id AND pa.role = 'gip'
);

-- Если у проекта есть departments в массиве depts, назначаем начальников
INSERT INTO project_assignments (project_id, user_id, role, assigned_by, is_active)
SELECT DISTINCT
  p.id as project_id,
  d.head_id as user_id,
  'lead' as role,
  p.gip_id as assigned_by,
  TRUE as is_active
FROM projects p
CROSS JOIN LATERAL unnest(p.depts) AS dept_id
JOIN departments d ON d.id = dept_id::int
WHERE d.head_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM project_assignments pa
    WHERE pa.project_id = p.id AND pa.user_id = d.head_id
  );

-- ============================================================================
-- ЧАСТЬ 9: Триггер для updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_documents_updated_at BEFORE UPDATE ON project_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ЧАСТЬ 10: Функции для удобной работы
-- ============================================================================

-- Функция назначения пользователя на проект
CREATE OR REPLACE FUNCTION assign_user_to_project(
  p_project_id INTEGER,
  p_user_id INTEGER,
  p_role VARCHAR, -- 'gip', 'lead', 'engineer'
  p_assigned_by INTEGER
)
RETURNS project_assignments AS $$
DECLARE
  v_assignment project_assignments;
  v_user_role VARCHAR;
BEGIN
  -- Проверяем права
  v_user_role := (SELECT role FROM app_users WHERE id = p_assigned_by);

  IF v_user_role NOT IN ('admin', 'gip', 'lead') THEN
    RAISE EXCEPTION 'Недостаточно прав для назначения';
  END IF;

  -- Проверяем, что проект существует
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = p_project_id) THEN
    RAISE EXCEPTION 'Проект не найден';
  END IF;

  -- Если роль = 'lead', проверяем что назначает ГИП проекта
  IF p_role = 'lead' THEN
    IF v_user_role = 'gip' THEN
      IF (SELECT gip_id FROM projects WHERE id = p_project_id) != p_assigned_by THEN
        RAISE EXCEPTION 'Только создатель проекта может назначать начальников отделов';
      END IF;
    END IF;
  END IF;

  -- Если роль = 'engineer', проверяем что назначает начальник отдела
  IF p_role = 'engineer' THEN
    IF v_user_role != 'lead' AND v_user_role != 'admin' THEN
      RAISE EXCEPTION 'Только начальник отдела или админ может назначать инженеров';
    END IF;
  END IF;

  -- Деактивируем старые назначения
  UPDATE project_assignments
  SET is_active = FALSE
  WHERE project_id = p_project_id AND user_id = p_user_id AND is_active = TRUE;

  -- Создаем новое назначение
  INSERT INTO project_assignments (project_id, user_id, role, assigned_by, is_active)
  VALUES (p_project_id, p_user_id, p_role, p_assigned_by, TRUE)
  RETURNING * INTO v_assignment;

  RETURN v_assignment;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ЧАСТЬ 11: Создание уведомления
-- ============================================================================

CREATE OR REPLACE FUNCTION create_notification(
  p_user_id INTEGER,
  p_type VARCHAR,
  p_title TEXT,
  p_message TEXT DEFAULT NULL,
  p_related_id INTEGER DEFAULT NULL,
  p_related_type VARCHAR DEFAULT NULL
)
RETURNS notifications AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
  VALUES (p_user_id, p_type, p_title, p_message, p_related_id, p_related_type)
  RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ЧАСТЬ 12: Триггеры для автоматических уведомлений
-- ============================================================================

-- Уведомление при назначении на проект
CREATE OR REPLACE FUNCTION notify_project_assignment()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_notification(
    NEW.user_id,
    'project_assigned',
    'Вас назначили на проект',
    'Вас назначили на проект: ' || (SELECT name FROM projects WHERE id = NEW.project_id),
    NEW.project_id,
    'project'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_assignment_notification
AFTER INSERT ON project_assignments
FOR EACH ROW
WHEN (NEW.is_active = TRUE)
EXECUTE FUNCTION notify_project_assignment();

-- ============================================================================
-- ЧАСТЬ 13: Функция для получения проектов пользователя
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_projects()
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  code TEXT,
  status VARCHAR,
  progress INTEGER,
  deadline TIMESTAMP,
  role_in_project VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.code,
    p.status,
    p.progress,
    p.deadline,
    pa.role as role_in_project
  FROM projects p
  JOIN project_assignments pa ON pa.project_id = p.id
  WHERE pa.user_id = auth.uid()::int AND pa.is_active = TRUE
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- КОНЕЦ СКРИПТА
-- ============================================================================

-- Сообщение о выполнении
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'RLS политики успешно обновлены!';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Созданы таблицы:';
  RAISE NOTICE '  - project_assignments (назначения)';
  RAISE NOTICE '  - assignments (задания)';
  RAISE NOTICE '  - project_documents (документы)';
  RAISE NOTICE '  - notifications (уведомления)';
  RAISE NOTICE '';
  RAISE NOTICE 'Обновлены RLS:';
  RAISE NOTICE '  - projects (проекты)';
  RAISE NOTICE '  - app_users (пользователи)';
  RAISE NOTICE '  - departments (отделы)';
  RAISE NOTICE '  - normative_docs (нормативные документы)';
  RAISE NOTICE '';
  RAISE NOTICE 'Созданы функции:';
  RAISE NOTICE '  - assign_user_to_project()';
  RAISE NOTICE '  - create_notification()';
  RAISE NOTICE '  - get_user_projects()';
  RAISE NOTICE '';
  RAISE NOTICE 'Права доступа:';
  RAISE NOTICE '  - ГИП видит только свои проекты';
  RAISE NOTICE '  - Начальник видит только назначенные проекты';
  RAISE NOTICE '  - Инженер видит только назначенные проекты';
  RAISE NOTICE '  - Изоляция между проектами работает';
  RAISE NOTICE '===========================================';
END $$;
