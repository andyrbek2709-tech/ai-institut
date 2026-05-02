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
