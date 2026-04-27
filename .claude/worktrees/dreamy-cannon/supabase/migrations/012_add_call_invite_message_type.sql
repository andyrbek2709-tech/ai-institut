-- Allow 'call_invite' as a valid message type.
-- The original constraint only covered: text, call_start, file, system, comment.
-- Conference room invite feature requires storing call_invite messages.

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_domain_chk;
ALTER TABLE messages ADD CONSTRAINT messages_type_domain_chk
  CHECK (type = ANY (ARRAY[
    'text'::text,
    'call_start'::text,
    'call_invite'::text,
    'file'::text,
    'system'::text,
    'comment'::text
  ]));
