-- 007: knowledge_items — RAG-слой (структура + embedding pgvector).
-- Таблица knowledge_base (006) не удаляется; новый код пишет в knowledge_items.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_items (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('price', 'material', 'rule', 'service', 'tip')),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  structured_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1536),
  source TEXT NOT NULL CHECK (source IN ('text', 'voice', 'file')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_chat_id BIGINT,
  search_doc tsvector GENERATED ALWAYS AS (
    to_tsvector('russian', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) STORED
);

CREATE INDEX IF NOT EXISTS knowledge_items_type_idx ON knowledge_items(type);
CREATE INDEX IF NOT EXISTS knowledge_items_created_idx ON knowledge_items(created_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_items_search_doc_idx ON knowledge_items USING gin (search_doc);

CREATE OR REPLACE FUNCTION match_knowledge_items(
  query_embedding vector(1536),
  match_count int DEFAULT 3
)
RETURNS SETOF knowledge_items
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM knowledge_items
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 25);
$$;

ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'knowledge_items' AND policyname = 'service_role_all_ki'
  ) THEN
    CREATE POLICY "service_role_all_ki" ON knowledge_items FOR ALL TO service_role USING (true);
  END IF;
END $$;
