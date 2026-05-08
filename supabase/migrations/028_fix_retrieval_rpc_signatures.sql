-- 028_fix_retrieval_rpc_signatures.sql
-- CRITICAL FIX: Align RPC function signatures with backend handler calls
--
-- Problem: Backend handler (agsk.ts) calls RPC with parameter names that don't exist:
--   - Calls p_query but RPC expects p_query_text
--   - Calls p_limit but RPC expects p_match_count
--   - Calls p_version_latest_only but RPC expects p_latest_only
--   - Calls agsk_vector_search_v2 / agsk_bm25_search_v2 but they don't exist
--
-- Solution: Create all three _v2 functions with exact parameters handler uses

-- ═══════════════════════════════════════════════════════════════════════
-- 1. REPLACE agsk_hybrid_search_v2 with EXACT handler signature
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION agsk_hybrid_search_v2(
  p_query              text,           -- handler sends p_query, not p_query_text
  p_query_embedding    vector(1536),
  p_org_id             uuid,
  p_limit              int DEFAULT 5,  -- handler sends p_limit, not p_match_count
  p_vector_weight      float DEFAULT 0.7,
  p_bm25_weight        float DEFAULT 0.3,
  p_discipline         text DEFAULT NULL,
  p_standard_code      text DEFAULT NULL,
  p_version_year       integer DEFAULT NULL,
  p_version_latest_only boolean DEFAULT true  -- handler sends this param
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
      AND (NOT p_version_latest_only OR s.is_latest_revision = true)
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
        ORDER BY ts_rank_cd(c.content_tsv, plainto_tsquery('english', p_query)) DESC
      ) AS rank
    FROM agsk_chunks c
    WHERE c.id IN (SELECT id FROM base_chunks)
      AND c.content_tsv @@ plainto_tsquery('english', p_query)
    ORDER BY ts_rank_cd(c.content_tsv, plainto_tsquery('english', p_query)) DESC
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
  LIMIT p_limit;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. CREATE agsk_vector_search_v2 — vector-only with version filtering
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION agsk_vector_search_v2(
  p_query_embedding    vector(1536),
  p_org_id             uuid,
  p_limit              int DEFAULT 5,
  p_discipline         text DEFAULT NULL,
  p_standard_code      text DEFAULT NULL,
  p_version_year       integer DEFAULT NULL,
  p_version_latest_only boolean DEFAULT true,
  p_min_similarity     float DEFAULT 0.5
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
  similarity           float,
  standard_year        integer,
  standard_revision    text,
  is_latest_revision   boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
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
    (1 - (c.embedding <=> p_query_embedding))::float AS similarity,
    s.year                  AS standard_year,
    s.revision              AS standard_revision,
    s.is_latest_revision
  FROM agsk_chunks c
  JOIN agsk_standards s ON c.standard_id = s.id
  WHERE c.org_id = p_org_id
    AND c.embedding IS NOT NULL
    AND s.status = 'ready'
    AND (p_discipline    IS NULL OR s.discipline    = p_discipline)
    AND (p_standard_code IS NULL OR s.standard_code = p_standard_code)
    AND (p_version_year  IS NULL OR s.year          = p_version_year)
    AND (NOT p_version_latest_only OR s.is_latest_revision = true)
    AND (1 - (c.embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT p_limit;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. CREATE agsk_bm25_search_v2 — BM25 full-text with version filtering
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION agsk_bm25_search_v2(
  p_query              text,
  p_org_id             uuid,
  p_limit              int DEFAULT 5,
  p_discipline         text DEFAULT NULL,
  p_standard_code      text DEFAULT NULL,
  p_version_year       integer DEFAULT NULL,
  p_version_latest_only boolean DEFAULT true
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
  bm25_rank            float,
  standard_year        integer,
  standard_revision    text,
  is_latest_revision   boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
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
    ts_rank_cd(c.content_tsv, plainto_tsquery('english', p_query))::float AS bm25_rank,
    s.year                  AS standard_year,
    s.revision              AS standard_revision,
    s.is_latest_revision
  FROM agsk_chunks c
  JOIN agsk_standards s ON c.standard_id = s.id
  WHERE c.org_id = p_org_id
    AND s.status = 'ready'
    AND c.content_tsv @@ plainto_tsquery('english', p_query)
    AND (p_discipline    IS NULL OR s.discipline    = p_discipline)
    AND (p_standard_code IS NULL OR s.standard_code = p_standard_code)
    AND (p_version_year  IS NULL OR s.year          = p_version_year)
    AND (NOT p_version_latest_only OR s.is_latest_revision = true)
  ORDER BY bm25_rank DESC
  LIMIT p_limit;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════

-- List all defined retrieval RPC functions
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'agsk_%search%'
ORDER BY routine_name;
