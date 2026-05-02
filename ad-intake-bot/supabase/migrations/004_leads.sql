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
