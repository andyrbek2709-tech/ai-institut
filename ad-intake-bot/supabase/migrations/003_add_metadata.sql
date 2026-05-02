-- 003_add_metadata.sql
-- Adds JSONB metadata to conversations to persist live orderData snapshot per dialog.
-- Safe to re-run.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS conversations_metadata_gin_idx
  ON conversations USING GIN (metadata);
