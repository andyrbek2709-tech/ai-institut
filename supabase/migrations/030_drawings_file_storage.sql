-- Add file storage columns to drawings
ALTER TABLE public.drawings
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Use file_url as storage_path (already exists, just document intent)
-- file_url stores: '{project_id}/drawings/{timestamp}_{safe_filename}'

-- RLS policies for drawings (if not exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='drawings' AND policyname='drawings_select'
  ) THEN
    CREATE POLICY drawings_select ON public.drawings FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='drawings' AND policyname='drawings_insert'
  ) THEN
    CREATE POLICY drawings_insert ON public.drawings FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='drawings' AND policyname='drawings_update'
  ) THEN
    CREATE POLICY drawings_update ON public.drawings FOR UPDATE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='drawings' AND policyname='drawings_delete'
  ) THEN
    CREATE POLICY drawings_delete ON public.drawings FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

ALTER TABLE public.drawings ENABLE ROW LEVEL SECURITY;
