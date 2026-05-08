-- 023_agsk_version_isolation.sql
-- AGSK Production Hardening Phase
-- 1. Strict version isolation: revision tracking, supersession chain, conflict detection
-- 2. Corpus governance: approved standards registry, provenance, license tracking
-- 3. Ingestion audit: validation events table
-- 4. Updated RPC: agsk_hybrid_search_v2 with strict version filtering
-- 5. Conflict detection RPC: agsk_detect_version_conflicts

-- ═══════════════════════════════════════════════════════════════════════
-- 1. EXTEND agsk_standards WITH VERSION ISOLATION FIELDS
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE agsk_standards
  ADD COLUMN IF NOT EXISTS revision          text,          -- e.g. "Rev.4", "2nd Ed"
  ADD COLUMN IF NOT EXISTS effective_date    date,          -- when the revision became effective
  ADD COLUMN IF NOT EXISTS withdrawal_date   date,          -- when superseded/withdrawn
  ADD COLUMN IF NOT EXISTS superseded_by     uuid           -- FK → agsk_standards(id) of newer version
                             REFERENCES agsk_standards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_latest_revision boolean        NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS version_key       text;          -- canonical "CODE:YEAR:REV" for dedup

-- Computed version_key constraint: unique per org
CREATE UNIQUE INDEX IF NOT EXISTS agsk_standards_version_key_org_idx
  ON agsk_standards(org_id, version_key)
  WHERE version_key IS NOT NULL AND status != 'superseded';

-- Index for version chain lookups
CREATE INDEX IF NOT EXISTS agsk_standards_superseded_by_idx ON agsk_standards(superseded_by);
CREATE INDEX IF NOT EXISTS agsk_standards_code_year_idx     ON agsk_standards(standard_code, year);
CREATE INDEX IF NOT EXISTS agsk_standards_is_latest_idx     ON agsk_standards(is_latest_revision, org_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. CORPUS GOVERNANCE TABLE
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agsk_corpus_policy (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_code      text        NOT NULL,
  org_id             uuid,                    -- NULL = global policy

  -- Approval status
  approval_status    text        NOT NULL DEFAULT 'approved'
                       CHECK (approval_status IN ('approved','pending_review','rejected','conditional')),
  approved_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at        timestamptz,

  -- Revision policy
  revision_policy    text        NOT NULL DEFAULT 'latest_only'
                       CHECK (revision_policy IN (
                         'latest_only',       -- only most recent revision allowed
                         'any_revision',      -- any revision acceptable
                         'pinned',            -- only specified revision
                         'min_year'           -- must be >= min_year
                       )),
  min_year           integer,                 -- for 'min_year' policy
  pinned_version     text,                    -- for 'pinned' policy (e.g. "2018")

  -- Discipline categorization
  discipline         text,
  subdiscipline      text,

  -- License / IP tracking
  license_type       text        CHECK (license_type IN (
                       'proprietary','open_access','org_license','public_domain','fair_use'
                     )),
  license_holder     text,        -- e.g. "ASME International"
  license_notes      text,
  requires_access_control boolean NOT NULL DEFAULT true,

  -- Provenance
  source_url         text,
  source_description text,
  acquisition_date   date,
  acquisition_notes  text,

  -- Metadata
  priority_tier      integer     NOT NULL DEFAULT 2  -- 1=critical, 2=standard, 3=supplementary
                       CHECK (priority_tier BETWEEN 1 AND 3),
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS agsk_corpus_policy_code_org_idx
  ON agsk_corpus_policy(standard_code, COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS agsk_corpus_policy_org_idx        ON agsk_corpus_policy(org_id);
CREATE INDEX IF NOT EXISTS agsk_corpus_policy_status_idx     ON agsk_corpus_policy(approval_status);
CREATE INDEX IF NOT EXISTS agsk_corpus_policy_discipline_idx ON agsk_corpus_policy(discipline);
CREATE INDEX IF NOT EXISTS agsk_corpus_policy_tier_idx       ON agsk_corpus_policy(priority_tier);

ALTER TABLE agsk_corpus_policy ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER agsk_corpus_policy_set_updated_at
  BEFORE UPDATE ON agsk_corpus_policy FOR EACH ROW EXECUTE FUNCTION agsk_set_updated_at();

DROP POLICY IF EXISTS "agsk_corpus_policy_select" ON agsk_corpus_policy;
CREATE POLICY "agsk_corpus_policy_select" ON agsk_corpus_policy
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "agsk_corpus_policy_insert" ON agsk_corpus_policy;
CREATE POLICY "agsk_corpus_policy_insert" ON agsk_corpus_policy
  FOR INSERT WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "agsk_corpus_policy_update" ON agsk_corpus_policy;
CREATE POLICY "agsk_corpus_policy_update" ON agsk_corpus_policy
  FOR UPDATE USING (public.auth_is_admin());

-- ═══════════════════════════════════════════════════════════════════════
-- 3. INGESTION VALIDATION AUDIT TABLE
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agsk_ingestion_validation (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_id       uuid        REFERENCES agsk_standards(id) ON DELETE CASCADE,
  job_id            uuid        REFERENCES agsk_ingestion_jobs(id) ON DELETE SET NULL,
  org_id            uuid,

  -- Validation result
  validation_status text        NOT NULL
                      CHECK (validation_status IN ('passed','failed','warning','skipped')),
  policy_violation  text,        -- which policy rule was violated (if failed)
  conflict_type     text        CHECK (conflict_type IN (
                      'version_conflict','duplicate_standard','unapproved_source',
                      'license_violation','revision_policy_violation','unknown'
                    )),
  conflict_with_id  uuid        REFERENCES agsk_standards(id) ON DELETE SET NULL,

  -- Validation details
  checks_run        text[]      NOT NULL DEFAULT '{}',
  checks_failed     text[]      NOT NULL DEFAULT '{}',
  warnings          text[]      NOT NULL DEFAULT '{}',
  details           jsonb       NOT NULL DEFAULT '{}',

  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agsk_validation_standard_idx ON agsk_ingestion_validation(standard_id);
CREATE INDEX IF NOT EXISTS agsk_validation_status_idx   ON agsk_ingestion_validation(validation_status);
CREATE INDEX IF NOT EXISTS agsk_validation_org_idx      ON agsk_ingestion_validation(org_id);

ALTER TABLE agsk_ingestion_validation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agsk_validation_select" ON agsk_ingestion_validation;
CREATE POLICY "agsk_validation_select" ON agsk_ingestion_validation
  FOR SELECT USING (
    public.auth_is_admin()
    OR org_id IN (SELECT org_id FROM app_users WHERE supabase_uid = auth.uid())
  );

DROP POLICY IF EXISTS "agsk_validation_insert" ON agsk_ingestion_validation;
CREATE POLICY "agsk_validation_insert" ON agsk_ingestion_validation
  FOR INSERT WITH CHECK (public.auth_is_admin());

-- ═══════════════════════════════════════════════════════════════════════
-- 4. RERANKER FEEDBACK TABLE (tracks reranker effectiveness)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agsk_reranker_logs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  retrieval_log_id    uuid        REFERENCES agsk_retrieval_logs(id) ON DELETE SET NULL,
  org_id              uuid,
  query_text          text        NOT NULL,

  -- Reranker type used
  reranker_type       text        NOT NULL
                        CHECK (reranker_type IN ('jina','cohere','cosine_fallback','none')),
  model               text,        -- e.g. "jina-reranker-v2-base-multilingual"

  -- Performance
  pre_rerank_count    integer,
  post_rerank_count   integer,
  latency_ms          integer,
  api_available       boolean     NOT NULL DEFAULT true,

  -- Precision delta (computed async via feedback)
  precision_pre       float,      -- Precision@5 before reranking
  precision_post      float,      -- Precision@5 after reranking

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agsk_reranker_logs_org_idx  ON agsk_reranker_logs(org_id);
CREATE INDEX IF NOT EXISTS agsk_reranker_logs_type_idx ON agsk_reranker_logs(reranker_type);
CREATE INDEX IF NOT EXISTS agsk_reranker_logs_ts_idx   ON agsk_reranker_logs(created_at DESC);

ALTER TABLE agsk_reranker_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agsk_reranker_logs_select" ON agsk_reranker_logs;
CREATE POLICY "agsk_reranker_logs_select" ON agsk_reranker_logs
  FOR SELECT USING (public.auth_is_admin());

DROP POLICY IF EXISTS "agsk_reranker_logs_insert" ON agsk_reranker_logs;
CREATE POLICY "agsk_reranker_logs_insert" ON agsk_reranker_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════════════
-- 5. RPC: VERSION CONFLICT DETECTION
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION agsk_detect_version_conflicts(
  p_org_id        uuid,
  p_standard_code text,
  p_year          integer DEFAULT NULL,
  p_version       text    DEFAULT NULL
)
RETURNS TABLE (
  conflict_type   text,
  existing_id     uuid,
  existing_code   text,
  existing_year   integer,
  existing_version text,
  existing_status text,
  severity        text    -- 'error' | 'warning'
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  -- Detect exact duplicate (same code + year + version)
  SELECT
    'exact_duplicate'::text      AS conflict_type,
    s.id                         AS existing_id,
    s.standard_code              AS existing_code,
    s.year                       AS existing_year,
    s.version                    AS existing_version,
    s.status                     AS existing_status,
    'error'::text                AS severity
  FROM agsk_standards s
  WHERE s.org_id       = p_org_id
    AND s.standard_code = p_standard_code
    AND s.status NOT IN ('failed', 'superseded')
    AND (p_year    IS NULL OR s.year    = p_year)
    AND (p_version IS NULL OR s.version = p_version)

  UNION ALL

  -- Detect older version still active (when newer is being ingested)
  SELECT
    'older_version_active'::text AS conflict_type,
    s.id,
    s.standard_code,
    s.year,
    s.version,
    s.status,
    'warning'::text
  FROM agsk_standards s
  WHERE s.org_id       = p_org_id
    AND s.standard_code = p_standard_code
    AND s.status        = 'ready'
    AND s.is_latest_revision = true
    AND p_year IS NOT NULL
    AND s.year < p_year

  UNION ALL

  -- Detect API/ASME specific revision collisions (code prefix collision)
  SELECT
    'code_prefix_collision'::text AS conflict_type,
    s.id,
    s.standard_code,
    s.year,
    s.version,
    s.status,
    'warning'::text
  FROM agsk_standards s
  WHERE s.org_id = p_org_id
    AND s.standard_code LIKE (LEFT(p_standard_code, 6) || '%')
    AND s.standard_code != p_standard_code
    AND s.status = 'ready'

  ORDER BY severity DESC, existing_year DESC;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 6. RPC: HYBRID SEARCH V2 — with strict version isolation
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION agsk_hybrid_search_v2(
  p_query_embedding    vector(1536),
  p_query_text         text,
  p_org_id             uuid,
  p_match_count        int     DEFAULT 20,  -- returns top-20 for reranker
  p_vector_weight      float   DEFAULT 0.7,
  p_bm25_weight        float   DEFAULT 0.3,
  p_discipline         text    DEFAULT NULL,
  p_standard_code      text    DEFAULT NULL,
  p_version_year       integer DEFAULT NULL,  -- strict year filter
  p_version_exact      text    DEFAULT NULL,  -- strict version string filter
  p_latest_only        boolean DEFAULT true   -- only most-recent revision per standard
)
RETURNS TABLE (
  id                   uuid,
  standard_id          uuid,
  content              text,
  section_path         text[],
  section_title        text,
  page_start           integer,
  citation_document    text,
  citation_standard    text,
  citation_section     text,
  citation_page        integer,
  citation_version     text,
  citation_confidence  float,
  rrf_score            float,
  vector_rank          integer,
  bm25_rank            integer,
  standard_year        integer,
  standard_revision    text,
  is_latest_revision   boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH eligible_standards AS (
    -- Version-aware pre-filter: only standards that pass version policy
    SELECT s.id
    FROM agsk_standards s
    WHERE s.org_id = p_org_id
      AND s.status = 'ready'
      AND (p_discipline    IS NULL OR s.discipline    = p_discipline)
      AND (p_standard_code IS NULL OR s.standard_code = p_standard_code)
      AND (p_version_year  IS NULL OR s.year          = p_version_year)
      AND (p_version_exact IS NULL OR s.version       = p_version_exact)
      AND (NOT p_latest_only OR s.is_latest_revision  = true)
  ),
  base_chunks AS (
    SELECT c.id
    FROM agsk_chunks c
    WHERE c.standard_id IN (SELECT id FROM eligible_standards)
      AND c.org_id = p_org_id
  ),
  vector_ranked AS (
    SELECT
      c.id,
      ROW_NUMBER() OVER (ORDER BY c.embedding <=> p_query_embedding) AS rank
    FROM agsk_chunks c
    WHERE c.id IN (SELECT id FROM base_chunks)
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> p_query_embedding
    LIMIT 50
  ),
  bm25_ranked AS (
    SELECT
      c.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(c.content_tsv, plainto_tsquery('english', p_query_text)) DESC
      ) AS rank
    FROM agsk_chunks c
    WHERE c.id IN (SELECT id FROM base_chunks)
      AND c.content_tsv @@ plainto_tsquery('english', p_query_text)
    ORDER BY ts_rank_cd(c.content_tsv, plainto_tsquery('english', p_query_text)) DESC
    LIMIT 50
  ),
  rrf AS (
    SELECT
      COALESCE(vr.id, br.id) AS id,
      COALESCE(vr.rank, 1000)::integer AS vector_rank,
      COALESCE(br.rank, 1000)::integer AS bm25_rank,
      (
        p_vector_weight * (1.0 / (60.0 + COALESCE(vr.rank, 1000))) +
        p_bm25_weight   * (1.0 / (60.0 + COALESCE(br.rank, 1000)))
      )::float AS rrf_score
    FROM vector_ranked vr
    FULL OUTER JOIN bm25_ranked br ON vr.id = br.id
  )
  SELECT
    c.id,
    c.standard_id,
    c.content,
    c.section_path,
    c.section_title,
    c.page_start,
    c.citation_document,
    c.citation_standard,
    c.citation_section,
    c.citation_page,
    c.citation_version,
    c.citation_confidence,
    r.rrf_score,
    r.vector_rank,
    r.bm25_rank,
    s.year                  AS standard_year,
    s.revision              AS standard_revision,
    s.is_latest_revision
  FROM rrf r
  JOIN agsk_chunks c    ON c.id = r.id
  JOIN agsk_standards s ON s.id = c.standard_id
  ORDER BY r.rrf_score DESC
  LIMIT p_match_count;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 7. RPC: MARK STANDARD AS SUPERSEDED (safe version rotation)
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION agsk_supersede_standard(
  p_old_standard_id uuid,
  p_new_standard_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Mark old version as superseded
  UPDATE agsk_standards
  SET status             = 'superseded',
      superseded_by      = p_new_standard_id,
      is_latest_revision = false,
      withdrawal_date    = CURRENT_DATE
  WHERE id = p_old_standard_id;

  -- Ensure new version is flagged as latest
  UPDATE agsk_standards
  SET is_latest_revision = true
  WHERE id = p_new_standard_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 8. SEED GLOBAL CORPUS POLICY (Tier 1 Priority Standards)
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO agsk_corpus_policy
  (standard_code, approval_status, revision_policy, discipline,
   license_type, license_holder, priority_tier, notes)
VALUES
  -- Pipeline standards (Tier 1 — CRITICAL)
  ('API 5L',       'approved', 'latest_only', 'pipeline',    'org_license', 'API',  1, 'Line pipe specification — primary standard'),
  ('API 1104',     'approved', 'latest_only', 'welding',     'org_license', 'API',  1, 'Welding of pipelines and related facilities'),
  ('ASME B31.4',   'approved', 'latest_only', 'pipeline',    'org_license', 'ASME', 1, 'Liquid transportation systems for hydrocarbons'),
  ('ASME B31.8',   'approved', 'latest_only', 'pipeline',    'org_license', 'ASME', 1, 'Gas transmission and distribution piping'),
  ('ASME B31.3',   'approved', 'latest_only', 'pipeline',    'org_license', 'ASME', 1, 'Process piping'),
  -- Corrosion standards (Tier 1)
  ('NACE MR0175',  'approved', 'latest_only', 'corrosion',   'org_license', 'AMPP', 1, 'Sulfide stress cracking resistant materials'),
  ('NACE SP0169',  'approved', 'latest_only', 'corrosion',   'org_license', 'AMPP', 1, 'Control of external corrosion on underground pipelines'),
  -- Russian/Kazakh standards (Tier 1)
  ('ГОСТ 20295',   'approved', 'any_revision','pipeline',    'public_domain','ГОСТ', 1, 'Steel pipes for mainline pipelines'),
  ('СТ РК ISO 3183','approved','latest_only', 'pipeline',    'public_domain','КазСтандарт', 1, 'Petroleum and natural gas industries — steel pipe'),
  -- Structural (Tier 2)
  ('ASME B31.1',   'approved', 'latest_only', 'mechanical',  'org_license', 'ASME', 2, 'Power piping'),
  ('ASME Section IX','approved','latest_only','welding',     'org_license', 'ASME', 2, 'Welding, brazing, and fusing qualifications'),
  ('AWS D1.1',     'approved', 'latest_only', 'welding',     'org_license', 'AWS',  2, 'Structural welding code — steel'),
  ('ISO 3183',     'approved', 'latest_only', 'pipeline',    'org_license', 'ISO',  2, 'Steel tubes for use as casing/tubing/drill pipe'),
  -- Safety (Tier 2)
  ('OSHA 1910',    'approved', 'any_revision','general',     'public_domain','OSHA', 2, 'General industry standards'),
  ('NFPA 58',      'approved', 'latest_only', 'fire_safety', 'org_license', 'NFPA', 2, 'Liquefied petroleum gas code'),
  -- Supplementary (Tier 3)
  ('ASTM A106',    'approved', 'latest_only', 'mechanical',  'org_license', 'ASTM', 3, 'Seamless carbon steel pipe for high-temperature service'),
  ('ASTM A333',    'approved', 'latest_only', 'mechanical',  'org_license', 'ASTM', 3, 'Seamless and welded steel pipe for low-temperature'),
  ('DNV-ST-F101',  'approved', 'latest_only', 'pipeline',    'org_license', 'DNV',  3, 'Submarine pipeline systems'),
  ('BS 7910',      'approved', 'latest_only', 'structural',  'org_license', 'BSI',  3, 'Fitness for service assessment')
ON CONFLICT DO NOTHING;
