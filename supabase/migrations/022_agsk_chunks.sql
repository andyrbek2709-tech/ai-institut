-- 022_agsk_chunks.sql
-- AGSK Engineering AI Platform — chunk storage, embeddings, retrieval
-- Table 1: agsk_chunks        — chunk content + vector(1536) embeddings
-- Table 2: agsk_feedback      — per-chunk relevance feedback
-- Table 3: agsk_embedding_cache — content hash → embedding dedup
-- Table 4: agsk_retrieval_logs  — query audit trail
-- Indexes: HNSW vector, GIN tsvector, metadata b-tree
-- RLS: org-scoped isolation
-- RPC: agsk_vector_search, agsk_bm25_search, agsk_hybrid_search

-- Requires: pgvector extension (enabled in 001_rag_setup.sql)
-- Requires: agsk_standards table (migration 021)

-- ═══════════════════════════════════════════════════════════════════════
-- 1. CHUNKS TABLE
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agsk_chunks (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_id          uuid        NOT NULL REFERENCES agsk_standards(id) ON DELETE CASCADE,
  org_id               uuid        NOT NULL,

  -- Chunk content
  content              text        NOT NULL,
  content_tokens       integer,

  -- Vector embedding (OpenAI text-embedding-3-small = 1536 dims, locked)
  embedding            vector(1536),

  -- Section hierarchy metadata (e.g. ['4', '4.2', '4.2.1'])
  section_path         text[]      NOT NULL DEFAULT '{}',
  section_title        text,
  subsection_title     text,

  -- Page metadata
  page_start           integer,
  page_end             integer,

  -- Citation metadata — FIXED SCHEMA (architecture locked, do NOT change)
  citation_document    text,        -- "API 5L 2018"
  citation_standard    text,        -- "API 5L"
  citation_section     text,        -- "3.4.2"
  citation_page        integer,
  citation_version     text,        -- "2018"
  citation_confidence  float       NOT NULL DEFAULT 1.0
                         CHECK (citation_confidence BETWEEN 0.0 AND 1.0),

  -- Chunk position within document
  chunk_index          integer     NOT NULL,
  total_chunks         integer,

  -- Full-text search column (generated, kept in sync automatically)
  content_tsv          tsvector    GENERATED ALWAYS AS
                         (to_tsvector('english', content)) STORED,

  -- Versioning
  chunk_version        integer     NOT NULL DEFAULT 1,

  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. FEEDBACK TABLE
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agsk_feedback (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id             uuid        REFERENCES agsk_chunks(id) ON DELETE SET NULL,
  standard_id          uuid        REFERENCES agsk_standards(id) ON DELETE SET NULL,
  user_id              uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id               uuid,

  -- Feedback data
  query_text           text        NOT NULL,
  relevance_score      integer     CHECK (relevance_score BETWEEN 1 AND 5),
  was_cited            boolean     NOT NULL DEFAULT false,
  retrieval_rank       integer,
  retrieval_type       text        CHECK (retrieval_type IN ('vector','bm25','hybrid')),

  -- Free-form notes
  notes                text,

  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 3. EMBEDDING CACHE (avoid re-embedding identical text across orgs)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agsk_embedding_cache (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash         text        NOT NULL UNIQUE,  -- SHA-256 of content
  embedding            vector(1536) NOT NULL,
  model                text        NOT NULL DEFAULT 'text-embedding-3-small',
  hit_count            integer     NOT NULL DEFAULT 1,
  created_at           timestamptz NOT NULL DEFAULT now(),
  last_used_at         timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 4. RETRIEVAL AUDIT LOG
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agsk_retrieval_logs (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id                 uuid,
  query_text             text        NOT NULL,
  retrieval_type         text        CHECK (retrieval_type IN ('vector','bm25','hybrid')),
  result_count           integer,
  latency_ms             integer,
  embedding_cache_hit    boolean     NOT NULL DEFAULT false,
  discipline_filter      text,
  standard_code_filter   text,
  retrieved_chunk_ids    uuid[],
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 5. INDEXES
-- ═══════════════════════════════════════════════════════════════════════

-- HNSW vector index — better recall/latency tradeoff than IVFFlat for <500k docs
-- m=16: connectivity parameter; ef_construction=64: build-time accuracy
CREATE INDEX IF NOT EXISTS agsk_chunks_embedding_hnsw_idx
  ON agsk_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- BM25 full-text search (GIN on generated tsvector column)
CREATE INDEX IF NOT EXISTS agsk_chunks_content_tsv_gin_idx
  ON agsk_chunks
  USING gin (content_tsv);

-- Metadata indexes
CREATE INDEX IF NOT EXISTS agsk_chunks_standard_id_idx      ON agsk_chunks(standard_id);
CREATE INDEX IF NOT EXISTS agsk_chunks_org_id_idx           ON agsk_chunks(org_id);
CREATE INDEX IF NOT EXISTS agsk_chunks_org_standard_idx     ON agsk_chunks(org_id, standard_id);
CREATE INDEX IF NOT EXISTS agsk_chunks_citation_std_idx     ON agsk_chunks(citation_standard);
CREATE INDEX IF NOT EXISTS agsk_chunks_section_path_gin_idx ON agsk_chunks USING gin(section_path);

CREATE INDEX IF NOT EXISTS agsk_feedback_chunk_id_idx       ON agsk_feedback(chunk_id);
CREATE INDEX IF NOT EXISTS agsk_feedback_user_id_idx        ON agsk_feedback(user_id);
CREATE INDEX IF NOT EXISTS agsk_feedback_org_id_idx         ON agsk_feedback(org_id);

CREATE INDEX IF NOT EXISTS agsk_cache_hash_idx              ON agsk_embedding_cache(content_hash);
CREATE INDEX IF NOT EXISTS agsk_cache_last_used_idx         ON agsk_embedding_cache(last_used_at DESC);

CREATE INDEX IF NOT EXISTS agsk_logs_org_id_idx             ON agsk_retrieval_logs(org_id);
CREATE INDEX IF NOT EXISTS agsk_logs_user_id_idx            ON agsk_retrieval_logs(user_id);
CREATE INDEX IF NOT EXISTS agsk_logs_created_at_idx         ON agsk_retrieval_logs(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- 6. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE agsk_chunks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE agsk_feedback        ENABLE ROW LEVEL SECURITY;
ALTER TABLE agsk_embedding_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE agsk_retrieval_logs  ENABLE ROW LEVEL SECURITY;

-- Chunks: org isolation (service_role bypasses RLS for ingestion writes)
DROP POLICY IF EXISTS "agsk_chunks_select" ON agsk_chunks;
CREATE POLICY "agsk_chunks_select" ON agsk_chunks
  FOR SELECT
  USING (
    public.auth_is_admin()
    OR org_id IN (
      SELECT org_id FROM app_users WHERE supabase_uid = auth.uid()
    )
  );

DROP POLICY IF EXISTS "agsk_chunks_insert" ON agsk_chunks;
CREATE POLICY "agsk_chunks_insert" ON agsk_chunks
  FOR INSERT
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "agsk_chunks_delete" ON agsk_chunks;
CREATE POLICY "agsk_chunks_delete" ON agsk_chunks
  FOR DELETE
  USING (public.auth_is_admin());

-- Feedback: any authenticated user can submit for their org
DROP POLICY IF EXISTS "agsk_feedback_select" ON agsk_feedback;
CREATE POLICY "agsk_feedback_select" ON agsk_feedback
  FOR SELECT
  USING (
    public.auth_is_admin()
    OR user_id = auth.uid()
    OR org_id IN (
      SELECT org_id FROM app_users WHERE supabase_uid = auth.uid()
    )
  );

DROP POLICY IF EXISTS "agsk_feedback_insert" ON agsk_feedback;
CREATE POLICY "agsk_feedback_insert" ON agsk_feedback
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Embedding cache: read by any authenticated, write by service_role only
DROP POLICY IF EXISTS "agsk_cache_select" ON agsk_embedding_cache;
CREATE POLICY "agsk_cache_select" ON agsk_embedding_cache
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "agsk_cache_insert" ON agsk_embedding_cache;
CREATE POLICY "agsk_cache_insert" ON agsk_embedding_cache
  FOR INSERT
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "agsk_cache_update" ON agsk_embedding_cache;
CREATE POLICY "agsk_cache_update" ON agsk_embedding_cache
  FOR UPDATE
  USING (public.auth_is_admin());

-- Retrieval logs: users see their own, admin sees all
DROP POLICY IF EXISTS "agsk_logs_select" ON agsk_retrieval_logs;
CREATE POLICY "agsk_logs_select" ON agsk_retrieval_logs
  FOR SELECT
  USING (
    public.auth_is_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "agsk_logs_insert" ON agsk_retrieval_logs;
CREATE POLICY "agsk_logs_insert" ON agsk_retrieval_logs
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════════════
-- 7. RPC FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 7.1 Pure vector similarity search ───────────────────────────────

CREATE OR REPLACE FUNCTION agsk_vector_search(
  p_query_embedding    vector(1536),
  p_org_id             uuid,
  p_match_count        int     DEFAULT 20,
  p_discipline         text    DEFAULT NULL,
  p_standard_code      text    DEFAULT NULL,
  p_min_similarity     float   DEFAULT 0.5
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
  similarity           float
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
    (1 - (c.embedding <=> p_query_embedding))::float AS similarity
  FROM agsk_chunks c
  JOIN agsk_standards s ON c.standard_id = s.id
  WHERE c.org_id = p_org_id
    AND c.embedding IS NOT NULL
    AND s.status = 'ready'
    AND (p_discipline    IS NULL OR s.discipline    = p_discipline)
    AND (p_standard_code IS NULL OR s.standard_code = p_standard_code)
    AND (1 - (c.embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;

-- ─── 7.2 BM25 full-text search ───────────────────────────────────────

CREATE OR REPLACE FUNCTION agsk_bm25_search(
  p_query_text         text,
  p_org_id             uuid,
  p_match_count        int     DEFAULT 20,
  p_discipline         text    DEFAULT NULL,
  p_standard_code      text    DEFAULT NULL
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
  bm25_rank            float
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
    ts_rank_cd(c.content_tsv, plainto_tsquery('english', p_query_text))::float AS bm25_rank
  FROM agsk_chunks c
  JOIN agsk_standards s ON c.standard_id = s.id
  WHERE c.org_id = p_org_id
    AND s.status = 'ready'
    AND c.content_tsv @@ plainto_tsquery('english', p_query_text)
    AND (p_discipline    IS NULL OR s.discipline    = p_discipline)
    AND (p_standard_code IS NULL OR s.standard_code = p_standard_code)
  ORDER BY bm25_rank DESC
  LIMIT p_match_count;
$$;

-- ─── 7.3 Hybrid retrieval with Reciprocal Rank Fusion ────────────────
--
-- RRF score = Σ weight_i / (k + rank_i)  where k=60 (standard RRF constant)
-- vector_weight=0.7, bm25_weight=0.3 (locked per architecture decision)
-- Both lists capped at 50 candidates before fusion to bound complexity.

CREATE OR REPLACE FUNCTION agsk_hybrid_search(
  p_query_embedding    vector(1536),
  p_query_text         text,
  p_org_id             uuid,
  p_match_count        int     DEFAULT 5,
  p_vector_weight      float   DEFAULT 0.7,
  p_bm25_weight        float   DEFAULT 0.3,
  p_discipline         text    DEFAULT NULL,
  p_standard_code      text    DEFAULT NULL
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
  bm25_rank            integer
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH base_chunks AS (
    -- Pre-filter to org + status for both sub-queries
    SELECT c.id
    FROM agsk_chunks c
    JOIN agsk_standards s ON c.standard_id = s.id
    WHERE c.org_id = p_org_id
      AND s.status = 'ready'
      AND (p_discipline    IS NULL OR s.discipline    = p_discipline)
      AND (p_standard_code IS NULL OR s.standard_code = p_standard_code)
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
    r.bm25_rank
  FROM rrf r
  JOIN agsk_chunks c ON c.id = r.id
  ORDER BY r.rrf_score DESC
  LIMIT p_match_count;
$$;

-- ─── 7.4 Upsert embedding cache entry ────────────────────────────────

CREATE OR REPLACE FUNCTION agsk_upsert_embedding_cache(
  p_content_hash   text,
  p_embedding      vector(1536),
  p_model          text DEFAULT 'text-embedding-3-small'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO agsk_embedding_cache (content_hash, embedding, model)
  VALUES (p_content_hash, p_embedding, p_model)
  ON CONFLICT (content_hash)
  DO UPDATE SET
    hit_count    = agsk_embedding_cache.hit_count + 1,
    last_used_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
