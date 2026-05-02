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
