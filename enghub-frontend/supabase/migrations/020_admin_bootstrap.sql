-- 020_admin_bootstrap.sql — bootstrap админа в app_users + защита helper от NULL.
-- ПРИМЕНЕНО на prod через Supabase MCP 2026-04-30.
--
-- Регрессия после 019_rls_hardening + service_role rotation:
-- admin@enghub.com логинился, но `auth_app_user_role()` возвращал NULL,
-- т.к. CASE-выражение со спец-кейсом для admin@ был ВНУТРИ
-- `SELECT ... FROM app_users WHERE email = ...` — а админа в app_users не было,
-- поэтому SELECT возвращал 0 строк и результатом был NULL.
-- Симптом: AdminPanel пуст, admin не видел проекты/задачи (RLS-политики
-- проверяли auth_is_admin() → false).
--
-- Фикс: 1) вставляем профиль admin в app_users; 2) переписываем helper
-- так чтобы спец-кейс работал даже без записи в app_users.

-- 1. Bootstrap admin profile (idempotent)
INSERT INTO public.app_users (email, full_name, role, dept_id, supabase_uid)
VALUES ('admin@enghub.com', 'Admin', 'admin', NULL, '877e0ce5-8687-46e1-b7d9-762b3742ed4d')
ON CONFLICT (email) DO UPDATE
  SET role = 'admin',
      supabase_uid = EXCLUDED.supabase_uid;

-- 2. Defensive rewrite: спец-кейс admin@enghub.com снаружи SELECT.
CREATE OR REPLACE FUNCTION public.auth_app_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.auth_app_user_email() = 'admin@enghub.com' THEN 'admin'
    ELSE COALESCE(
      (SELECT lower(coalesce(role, '')) FROM app_users WHERE email = public.auth_app_user_email() LIMIT 1),
      ''
    )
  END
$$;
