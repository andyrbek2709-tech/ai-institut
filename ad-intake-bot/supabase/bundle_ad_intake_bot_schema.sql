-- =============================================================================
-- Ad Intake Bot — полная схема для НОВОГО пустого проекта Supabase
-- Project ref (пример): pbxzxwskhuzaojphkeet → https://pbxzxwskhuzaojphkeet.supabase.co
--
-- Выполнить ОДИН раз: Dashboard → SQL Editor → New query → вставить весь файл → Run.
-- Повторный запуск может упасть на CREATE POLICY — тогда только на чистой БД.
-- =============================================================================

-- ─── 001_init.sql ───────────────────────────────────────────────────────────

-- Ad Intake Bot — initial schema
-- Run in Supabase SQL editor (or via supabase CLI) on a fresh project.

-- ─── Conversations ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  telegram_chat_id TEXT NOT NULL,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  files JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_chat_active_idx
  ON conversations (telegram_chat_id, status);
CREATE INDEX IF NOT EXISTS conversations_created_at_idx
  ON conversations (created_at DESC);

-- ─── Orders ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  telegram_user_id TEXT,
  telegram_chat_id TEXT,
  json_data JSONB NOT NULL,
  service_type TEXT,
  description TEXT,
  size TEXT,
  quantity TEXT,
  deadline TEXT,
  budget TEXT,
  contact TEXT,
  notes TEXT,
  files JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_progress', 'done', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_chat_idx ON orders (telegram_chat_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on conversations"
  ON conversations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on orders"
  ON orders FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─── 002_add_lang.sql ───────────────────────────────────────────────────────

-- Adds language code to conversations and orders.
-- Codes used by the bot: 'ru' | 'kk' | 'en'.

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lang TEXT;
ALTER TABLE orders        ADD COLUMN IF NOT EXISTS lang TEXT;

CREATE INDEX IF NOT EXISTS orders_lang_idx ON orders (lang);

-- ─── 003_add_metadata.sql ───────────────────────────────────────────────────

-- 003_add_metadata.sql
-- Adds JSONB metadata to conversations to persist live orderData snapshot per dialog.
-- Safe to re-run.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS conversations_metadata_gin_idx
  ON conversations USING GIN (metadata);

-- ─── 004_leads.sql ───────────────────────────────────────────────────────────

-- 004_leads.sql — In-Telegram CRM: leads table
-- Каждая завершённая заявка (orders) превращается в lead с lead_score и статусом.
-- Менеджер ведёт лидов через команды /leads и inline-кнопки.

CREATE TABLE IF NOT EXISTS leads (
  id BIGSERIAL PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  telegram_user_id BIGINT NOT NULL,
  telegram_chat_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','closed','rejected')),
  lead_score INT DEFAULT 50 CHECK (lead_score BETWEEN 0 AND 100),
  assigned_to BIGINT,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
CREATE INDEX IF NOT EXISTS leads_assigned_idx ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS leads_created_idx ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS leads_score_idx ON leads(lead_score DESC);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON leads;
CREATE POLICY "service_role_all" ON leads FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 005_followup.sql ─────────────────────────────────────────────────────────

-- 005_followup.sql — Auto follow-up reminders
-- Adds last_user_message_at для отслеживания тишины клиента.
-- metadata.followup_level и metadata.followups[] уже хранятся в существующей JSONB metadata.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS last_user_message_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS conversations_last_user_message_at_idx
  ON conversations (last_user_message_at DESC);

-- Бэкфил для уже существующих активных диалогов: считаем последнюю активность за updated_at,
-- чтобы scheduler не послал второе/третье напоминание сразу после деплоя.
UPDATE conversations
   SET last_user_message_at = updated_at
 WHERE last_user_message_at IS NULL
   AND status = 'active';

-- ─── 006_knowledge_base.sql ─────────────────────────────────────────────────

-- 006: knowledge_base
-- Менеджер обучает бота через /teach: материалы, услуги, правила, цены, советы.
-- Записи используются (на следующем шаге) при ответе клиенту.

CREATE TABLE IF NOT EXISTS knowledge_base (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,                  -- 'material' | 'service' | 'rule' | 'price' | 'tip'
  name TEXT NOT NULL,                      -- короткое имя (2-5 слов)
  price NUMERIC,                           -- цена в тенге, если применимо
  description TEXT NOT NULL,               -- полное описание
  tags TEXT[] DEFAULT '{}',                -- ключевые слова для поиска
  created_by_chat_id BIGINT,               -- chat_id менеджера, который добавил
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kb_category_idx ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS kb_tags_gin    ON knowledge_base USING gin(tags);
CREATE INDEX IF NOT EXISTS kb_search_text ON knowledge_base USING gin (to_tsvector('russian', name || ' ' || description));

ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='knowledge_base' AND policyname='service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY "service_role_all" ON knowledge_base FOR ALL TO service_role USING (true)';
  END IF;
END $$;

-- ─── 007_knowledge_items.sql ────────────────────────────────────────────────

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

-- =============================================================================
-- Готово. Проверка: select tablename from pg_tables where schemaname = 'public'
--   order by tablename;  → conversations, knowledge_base, knowledge_items, leads, orders
-- =============================================================================
