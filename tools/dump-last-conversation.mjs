/**
 * Печатает последний (по updated_at) диалог из conversations.history в читаемом виде.
 * Нужны SUPABASE_URL и SUPABASE_KEY (service role) в окружении или в .env рядом с запуском.
 *
 *   node scripts/dump-last-conversation.mjs
 *   node scripts/dump-last-conversation.mjs 123456789   # фильтр по telegram_chat_id
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;
const filterChatId = process.argv[2]?.trim();

if (!url || !key) {
  console.error("Задайте SUPABASE_URL и SUPABASE_KEY (например через .env в ad-intake-bot/).");
  process.exit(1);
}

const supabase = createClient(url, key);

let q = supabase
  .from("conversations")
  .select("id, telegram_chat_id, telegram_user_id, status, lang, updated_at, history")
  .order("updated_at", { ascending: false })
  .limit(1);

if (filterChatId) {
  q = supabase
    .from("conversations")
    .select("id, telegram_chat_id, telegram_user_id, status, lang, updated_at, history")
    .eq("telegram_chat_id", String(filterChatId))
    .order("updated_at", { ascending: false })
    .limit(1);
}

const { data, error } = await q.maybeSingle();

if (error) {
  console.error(error.message);
  process.exit(1);
}
if (!data) {
  console.error(filterChatId ? "Диалог с таким chat_id не найден." : "Таблица conversations пуста или нет доступа.");
  process.exit(1);
}

console.log("— meta —");
console.log(JSON.stringify({ id: data.id, telegram_chat_id: data.telegram_chat_id, status: data.status, lang: data.lang, updated_at: data.updated_at }, null, 2));
console.log("\n— transcript —\n");

const hist = Array.isArray(data.history) ? data.history : [];
for (const m of hist) {
  const role = m.role || "?";
  const ts = m.ts || "";
  const content = String(m.content ?? "").replace(/\r\n/g, "\n");
  console.log(`[${ts}] ${role}:`);
  console.log(content);
  console.log("");
}
