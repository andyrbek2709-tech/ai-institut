-- Normative docs knowledge base
CREATE TABLE IF NOT EXISTS public.normative_docs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  file_type   text,
  file_path   text NOT NULL,
  status      text NOT NULL DEFAULT 'pending',  -- pending | processing | ready | error
  error_text  text,
  chunks_count int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Chunks with embeddings for vector search
CREATE TABLE IF NOT EXISTS public.normative_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id      uuid NOT NULL REFERENCES public.normative_docs(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  content     text NOT NULL,
  embedding   vector(1536),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS normative_chunks_doc_id_idx ON public.normative_chunks(doc_id);
CREATE INDEX IF NOT EXISTS normative_chunks_embedding_idx ON public.normative_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- RLS
ALTER TABLE public.normative_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.normative_chunks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='normative_docs' AND policyname='normative_docs_select') THEN
    CREATE POLICY normative_docs_select ON public.normative_docs FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='normative_docs' AND policyname='normative_docs_delete') THEN
    CREATE POLICY normative_docs_delete ON public.normative_docs FOR DELETE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='normative_chunks' AND policyname='normative_chunks_select') THEN
    CREATE POLICY normative_chunks_select ON public.normative_chunks FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Vector search RPC
CREATE OR REPLACE FUNCTION public.search_normative_chunks(
  query_embedding vector(1536),
  match_count     int DEFAULT 10,
  min_similarity  float DEFAULT 0.3
)
RETURNS TABLE(
  id          uuid,
  doc_id      uuid,
  doc_name    text,
  chunk_index int,
  content     text,
  similarity  float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id, c.doc_id, d.name AS doc_name, c.chunk_index, c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.normative_chunks c
  JOIN public.normative_docs d ON d.id = c.doc_id
  WHERE c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) >= min_similarity
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
