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
