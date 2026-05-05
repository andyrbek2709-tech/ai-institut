/**
 * Печатает полный лог conversations.history в консоль (для Cursor / отладки).
 * Использует тот же SUPABASE_URL / SUPABASE_KEY, что и бот (отдельный проект только под бота).
 *
 *   node scripts/export-conversation-by-lead.mjs 42
 *   node scripts/export-conversation-by-lead.mjs chat 123456789
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error("Нужны SUPABASE_URL и SUPABASE_KEY в .env (каталог ad-intake-bot).");
  process.exit(1);
}

const supabase = createClient(url, key);

const a = process.argv[2];
const b = process.argv[3];

function formatHistory(history) {
  const h = Array.isArray(history) ? history : [];
  if (!h.length) return "(история пустая)\n";
  const lines = [];
  for (let i = 0; i < h.length; i++) {
    const m = h[i];
    const role = String(m?.role || "?");
    const ts = m?.ts ? String(m.ts).replace("T", " ").slice(0, 19) : "";
    const c = String(m?.content ?? "").trim() || "—";
    lines.push(`[${i + 1}] ${role}${ts ? " " + ts : ""}:\n${c}`);
  }
  return lines.join("\n\n---\n\n");
}

if (a === "chat" && b) {
  const { data: conv, error } = await supabase
    .from("conversations")
    .select("id, telegram_chat_id, status, lang, updated_at, history")
    .eq("telegram_chat_id", String(b))
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  if (!conv) {
    console.error("Беседа не найдена.");
    process.exit(1);
  }
  console.log("— meta —");
  console.log(JSON.stringify({ id: conv.id, telegram_chat_id: conv.telegram_chat_id, status: conv.status, lang: conv.lang, updated_at: conv.updated_at }, null, 2));
  console.log("\n— transcript —\n");
  console.log(formatHistory(conv.history));
  process.exit(0);
}

const leadId = parseInt(a, 10);
if (!Number.isFinite(leadId)) {
  console.error("Использование:\n  node scripts/export-conversation-by-lead.mjs <lead_id>\n  node scripts/export-conversation-by-lead.mjs chat <telegram_chat_id>");
  process.exit(1);
}

const { data: lead, error: e1 } = await supabase
  .from("leads")
  .select("id, conversation_id, telegram_chat_id, status, created_at")
  .eq("id", leadId)
  .maybeSingle();
if (e1) {
  console.error(e1.message);
  process.exit(1);
}
if (!lead) {
  console.error(`Лид #${leadId} не найден.`);
  process.exit(1);
}
if (!lead.conversation_id) {
  console.error("У лида нет conversation_id.");
  process.exit(1);
}

const { data: conv, error: e2 } = await supabase
  .from("conversations")
  .select("id, telegram_chat_id, status, lang, updated_at, history")
  .eq("id", lead.conversation_id)
  .maybeSingle();
if (e2) {
  console.error(e2.message);
  process.exit(1);
}
if (!conv) {
  console.error("Беседа не найдена.");
  process.exit(1);
}

console.log("— meta —");
console.log(JSON.stringify({ lead_id: lead.id, conversation_id: conv.id, lead_status: lead.status, conv_status: conv.status, telegram_chat_id: lead.telegram_chat_id }, null, 2));
console.log("\n— transcript —\n");
console.log(formatHistory(conv.history));
