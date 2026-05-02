import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ─── Conversations ───────────────────────────────────────────────────────────

export async function upsertConversation({ telegramUserId, telegramChatId, history, files = [], lang = null, status = "active" }) {
  // Find active conversation for this chat
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("telegram_chat_id", String(telegramChatId))
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const update = {
      history,
      files,
      status,
      updated_at: new Date().toISOString(),
    };
    if (lang) update.lang = lang;
    const { data, error } = await supabase
      .from("conversations")
      .update(update)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(`Conversation update failed: ${error.message}`);
    return data;
  }

  const insert = {
    telegram_user_id: String(telegramUserId),
    telegram_chat_id: String(telegramChatId),
    history,
    files,
    status,
  };
  if (lang) insert.lang = lang;
  const { data, error } = await supabase
    .from("conversations")
    .insert(insert)
    .select()
    .single();
  if (error) throw new Error(`Conversation insert failed: ${error.message}`);
  return data;
}

export async function completeConversation(conversationId) {
  const { error } = await supabase
    .from("conversations")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) throw new Error(`Conversation complete failed: ${error.message}`);
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function saveOrder({ conversationId, telegramUserId, telegramChatId, data, files = [], lang = null }) {
  const row = {
    conversation_id: conversationId || null,
    telegram_user_id: String(telegramUserId),
    telegram_chat_id: String(telegramChatId),
    json_data: { ...data, lang: lang || data.lang || null },
    service_type: data.service_type || null,
    description: data.description || null,
    size: data.size || null,
    quantity: data.quantity || null,
    deadline: data.deadline || null,
    budget: data.budget || null,
    contact: data.contact || null,
    notes: data.notes || null,
    files: files.length ? files : (data.files || []),
    status: "new",
  };
  if (lang) row.lang = lang;

  const { data: order, error } = await supabase
    .from("orders")
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(`Order insert failed: ${error.message}`);
  return order;
}

export async function getOrderById(id) {
  const { data, error } = await supabase.from("orders").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateOrderStatus(id, status) {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw new Error(`Order status update failed: ${error.message}`);
}

export async function getOrdersByStatus(status, limit = 20) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getOrdersToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .gte("created_at", today.toISOString())
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}
