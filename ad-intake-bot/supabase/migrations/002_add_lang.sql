-- Adds language code to conversations and orders.
-- Codes used by the bot: 'ru' | 'kk' | 'en'.

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lang TEXT;
ALTER TABLE orders        ADD COLUMN IF NOT EXISTS lang TEXT;

CREATE INDEX IF NOT EXISTS orders_lang_idx ON orders (lang);
