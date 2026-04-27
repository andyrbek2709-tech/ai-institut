-- RAG Setup: pgvector + normative_chunks table
-- Выполнить в Supabase Dashboard → SQL Editor

-- 1. Включить расширение pgvector
create extension if not exists vector;

-- 2. Добавить поля статуса и контента в normative_docs
alter table normative_docs
  add column if not exists status text default 'pending',
  add column if not exists content text,
  add column if not exists file_path text;

-- 3. Создать таблицу для хранения чанков с эмбеддингами
create table if not exists normative_chunks (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid references normative_docs(id) on delete cascade,
  doc_name text,
  chunk_index int default 0,
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- 4. Индекс для быстрого векторного поиска (cosine similarity)
create index if not exists normative_chunks_embedding_idx
  on normative_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 5. Функция для семантического поиска
create or replace function search_normative(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  doc_id uuid,
  doc_name text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    nc.id,
    nc.doc_id,
    nc.doc_name,
    nc.content,
    1 - (nc.embedding <=> query_embedding) as similarity
  from normative_chunks nc
  order by nc.embedding <=> query_embedding
  limit match_count;
$$;

-- 6. RLS: все аутентифицированные пользователи могут читать
alter table normative_chunks enable row level security;

create policy "Authenticated users can read chunks"
  on normative_chunks for select
  using (auth.role() = 'authenticated');
