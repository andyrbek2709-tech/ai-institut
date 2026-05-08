-- 021_agsk_standards.sql
-- AGSK Engineering AI Platform — core metadata tables
-- Single-tenant: org_id stored without FK (no organizations table in this schema).
--                Kept for future multi-tenancy expansion.
-- Applied to prod: 2026-05-08 (Supabase project inachjylaqelysiwtsux)

CREATE TABLE IF NOT EXISTS agsk_standards (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid,
  uploaded_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  standard_code        text        NOT NULL,
  title                text        NOT NULL,
  version              text,
  year                 integer,
  language             text        NOT NULL DEFAULT 'en',

  discipline           text        CHECK (discipline IN (
                         'pipeline','structural','mechanical',
                         'electrical','welding','corrosion',
                         'fire_safety','general'
                       )),
  organization         text,
  keywords             text[],

  file_path            text,
  file_size_bytes      bigint,
  page_count           integer,
  storage_bucket       text        DEFAULT 'agsk-standards',

  status               text        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','processing','ready','failed','superseded')),
  error_message        text,
  chunks_count         integer     DEFAULT 0,
  metadata             jsonb       NOT NULL DEFAULT '{}',

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agsk_ingestion_jobs (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_id          uuid        NOT NULL REFERENCES agsk_standards(id) ON DELETE CASCADE,
  org_id               uuid,

  status               text        NOT NULL DEFAULT 'queued'
                         CHECK (status IN (
                           'queued','parsing','chunking','embedding',
                           'indexing','done','failed','cancelled'
                         )),
  progress_pct         integer     NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  chunks_total         integer     NOT NULL DEFAULT 0,
  chunks_done          integer     NOT NULL DEFAULT 0,
  embeddings_cached    integer     NOT NULL DEFAULT 0,
  worker_id            text,
  error_message        text,
  retry_count          integer     NOT NULL DEFAULT 0,
  started_at           timestamptz,
  finished_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION agsk_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS agsk_standards_set_updated_at ON agsk_standards;
CREATE TRIGGER agsk_standards_set_updated_at
  BEFORE UPDATE ON agsk_standards FOR EACH ROW EXECUTE FUNCTION agsk_set_updated_at();

DROP TRIGGER IF EXISTS agsk_ingestion_jobs_set_updated_at ON agsk_ingestion_jobs;
CREATE TRIGGER agsk_ingestion_jobs_set_updated_at
  BEFORE UPDATE ON agsk_ingestion_jobs FOR EACH ROW EXECUTE FUNCTION agsk_set_updated_at();

CREATE INDEX IF NOT EXISTS agsk_standards_org_id_idx        ON agsk_standards(org_id);
CREATE INDEX IF NOT EXISTS agsk_standards_status_idx        ON agsk_standards(status);
CREATE INDEX IF NOT EXISTS agsk_standards_code_idx          ON agsk_standards(standard_code);
CREATE INDEX IF NOT EXISTS agsk_standards_discipline_idx    ON agsk_standards(discipline);
CREATE INDEX IF NOT EXISTS agsk_standards_keywords_gin_idx  ON agsk_standards USING gin(keywords);

CREATE INDEX IF NOT EXISTS agsk_jobs_standard_id_idx        ON agsk_ingestion_jobs(standard_id);
CREATE INDEX IF NOT EXISTS agsk_jobs_status_idx             ON agsk_ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS agsk_jobs_created_at_idx         ON agsk_ingestion_jobs(created_at DESC);

ALTER TABLE agsk_standards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE agsk_ingestion_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agsk_standards_select" ON agsk_standards;
CREATE POLICY "agsk_standards_select" ON agsk_standards
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "agsk_standards_insert" ON agsk_standards;
CREATE POLICY "agsk_standards_insert" ON agsk_standards
  FOR INSERT WITH CHECK (public.auth_is_admin_or_gip());

DROP POLICY IF EXISTS "agsk_standards_update" ON agsk_standards;
CREATE POLICY "agsk_standards_update" ON agsk_standards
  FOR UPDATE
  USING (public.auth_is_admin() OR uploaded_by = auth.uid())
  WITH CHECK (public.auth_is_admin() OR uploaded_by = auth.uid());

DROP POLICY IF EXISTS "agsk_standards_delete" ON agsk_standards;
CREATE POLICY "agsk_standards_delete" ON agsk_standards
  FOR DELETE USING (public.auth_is_admin());

DROP POLICY IF EXISTS "agsk_jobs_select" ON agsk_ingestion_jobs;
CREATE POLICY "agsk_jobs_select" ON agsk_ingestion_jobs
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "agsk_jobs_insert" ON agsk_ingestion_jobs;
CREATE POLICY "agsk_jobs_insert" ON agsk_ingestion_jobs
  FOR INSERT WITH CHECK (public.auth_is_admin_or_gip());

DROP POLICY IF EXISTS "agsk_jobs_update" ON agsk_ingestion_jobs;
CREATE POLICY "agsk_jobs_update" ON agsk_ingestion_jobs
  FOR UPDATE USING (public.auth_is_admin_or_gip());
