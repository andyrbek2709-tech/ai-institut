-- Migration 019: Seed default departments
-- Seeds Engineering, Design, Management if departments table is empty

INSERT INTO public.departments (name, description, is_archived)
SELECT name, description, false
FROM (VALUES
  ('Engineering', 'Инженерный отдел', false),
  ('Design', 'Отдел проектирования', false),
  ('Management', 'Отдел управления', false)
) AS v(name, description, is_archived)
WHERE NOT EXISTS (SELECT 1 FROM public.departments LIMIT 1);
