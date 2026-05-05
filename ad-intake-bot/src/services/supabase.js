import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ─── Conversations ───────────────────────────────────────────────────────────

/** Активный диалог по chat_id клиента (приват). */
export async function getActiveConversationByChatId(telegramChatId) {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, telegram_user_id, history, files, lang, metadata, status, updated_at")
    .eq("telegram_chat_id", String(telegramChatId))
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (/column|does not exist/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  return data || null;
}

/** Последняя беседа по chat_id (любой status) — для /transcript chat … */
export async function getLatestConversationByTelegramChatId(telegramChatId) {
  const tid = String(telegramChatId);
  const { data, error } = await supabase
    .from("conversations")
    .select("id, telegram_user_id, history, files, lang, metadata, status, updated_at, telegram_chat_id")
    .eq("telegram_chat_id", tid)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (/column|does not exist/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  return data || null;
}

/** Полная история messages[] по id беседы (голос уже как текст в user). */
export async function getConversationFullHistory(conversationId) {
  if (!conversationId) return null;
  const { data, error } = await supabase
    .from("conversations")
    .select("id, telegram_user_id, history, files, lang, metadata, status, updated_at, telegram_chat_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) {
    if (/column|does not exist/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return {
    ...data,
    history: Array.isArray(data.history) ? data.history : [],
  };
}

export async function upsertConversation({ telegramUserId, telegramChatId, history, files = [], lang = null, status = "active", metadata = null, lastUserMessageAt = null }) {
  // Find active conversation for this chat
  const { data: existing } = await supabase
    .from("conversations")
    .select("id, metadata")
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
    if (metadata && typeof metadata === "object") {
      const existingMeta = existing.metadata && typeof existing.metadata === "object" ? existing.metadata : {};
      const merged = { ...existingMeta, ...metadata };
      // followups[] — лог отправленных напоминаний; сохраняем, если caller не передал явно.
      if (metadata.followups === undefined && Array.isArray(existingMeta.followups)) {
        merged.followups = existingMeta.followups;
      }
      update.metadata = merged;
    }
    if (lastUserMessageAt) update.last_user_message_at = lastUserMessageAt;
    const { data, error } = await supabase
      .from("conversations")
      .update(update)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) {
      // Если колонки metadata / last_user_message_at ещё нет в БД — повторим без них, не валим бот.
      const cleaned = { ...update };
      let dropped = false;
      if (/metadata/.test(error.message) && cleaned.metadata) { delete cleaned.metadata; dropped = true; }
      if (/last_user_message_at/.test(error.message) && cleaned.last_user_message_at) { delete cleaned.last_user_message_at; dropped = true; }
      if (dropped) {
        const retry = await supabase.from("conversations").update(cleaned).eq("id", existing.id).select().single();
        if (retry.error) throw new Error(`Conversation update failed: ${retry.error.message}`);
        return retry.data;
      }
      throw new Error(`Conversation update failed: ${error.message}`);
    }
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
  if (metadata && typeof metadata === "object") insert.metadata = metadata;
  if (lastUserMessageAt) insert.last_user_message_at = lastUserMessageAt;
  const { data, error } = await supabase
    .from("conversations")
    .insert(insert)
    .select()
    .single();
  if (error) {
    const cleaned = { ...insert };
    let dropped = false;
    if (/metadata/.test(error.message) && cleaned.metadata) { delete cleaned.metadata; dropped = true; }
    if (/last_user_message_at/.test(error.message) && cleaned.last_user_message_at) { delete cleaned.last_user_message_at; dropped = true; }
    if (dropped) {
      const retry = await supabase.from("conversations").insert(cleaned).select().single();
      if (retry.error) throw new Error(`Conversation insert failed: ${retry.error.message}`);
      return retry.data;
    }
    throw new Error(`Conversation insert failed: ${error.message}`);
  }
  return data;
}

export async function completeConversation(conversationId) {
  const { error } = await supabase
    .from("conversations")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) throw new Error(`Conversation complete failed: ${error.message}`);
}

// ─── Follow-up scheduler helpers ─────────────────────────────────────────────
//
// Активные диалоги с last_user_message_at <= cutoff. Сам шедулер фильтрует уровень
// и интервал в JS — здесь только грубая выборка, чтобы не тянуть всю таблицу.

export async function getActiveConversationsForFollowup(cutoffISO) {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, telegram_chat_id, telegram_user_id, lang, status, metadata, last_user_message_at, updated_at")
    .eq("status", "active")
    .not("last_user_message_at", "is", null)
    .lte("last_user_message_at", cutoffISO)
    .order("last_user_message_at", { ascending: true })
    .limit(200);
  if (error) {
    // Если колонки last_user_message_at ещё нет — просто молчим, чтобы scheduler не падал.
    if (/last_user_message_at/.test(error.message)) return [];
    throw new Error(`Followup query failed: ${error.message}`);
  }
  return data || [];
}

// Записываем в metadata новый followup_level и пушим запись в metadata.followups[].
export async function updateConversationFollowup(conversationId, { level, sentAt, prevMetadata = {} }) {
  const followups = Array.isArray(prevMetadata.followups) ? prevMetadata.followups.slice() : [];
  followups.push({ level, sent_at: sentAt });
  const newMeta = { ...prevMetadata, followup_level: level, followups };
  const { error } = await supabase
    .from("conversations")
    .update({ metadata: newMeta, updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) throw new Error(`Followup metadata update failed: ${error.message}`);
}

// Проверка: есть ли по этому диалогу уже lead с assigned_to / closed / rejected — тогда не дёргаем клиента.
export async function getLeadStateForConversation(conversationId) {
  const { data, error } = await supabase
    .from("leads")
    .select("id, status, assigned_to")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    // Если таблицы leads нет (старый деплой) — считаем что лида нет.
    if (/leads/.test(error.message)) return null;
    throw new Error(`Lead state query failed: ${error.message}`);
  }
  return data || null;
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

/** Сводка для /stats: диалоги по статусу, заказы, топ услуг (до 8000 строк каждой таблицы). */
export async function getAnalyticsSnapshot() {
  const { data: conv, error: e1 } = await supabase.from("conversations").select("status").limit(8000);
  if (e1) throw new Error(e1.message);
  const { data: ord, error: e2 } = await supabase.from("orders").select("status,service_type").limit(8000);
  if (e2) throw new Error(e2.message);
  const byConv = {};
  for (const r of conv || []) {
    const s = r.status || "unknown";
    byConv[s] = (byConv[s] || 0) + 1;
  }
  const byOrd = {};
  const byService = {};
  for (const r of ord || []) {
    const st = r.status || "unknown";
    byOrd[st] = (byOrd[st] || 0) + 1;
    const svc = r.service_type || "—";
    byService[svc] = (byService[svc] || 0) + 1;
  }
  const topServices = Object.entries(byService)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const iso = dayStart.toISOString();
  const { count: ordersTodayUtc, error: e3 } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .gte("created_at", iso);
  if (e3) throw new Error(e3.message);
  const { count: convTodayUtc, error: e4 } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .gte("created_at", iso);
  if (e4) throw new Error(e4.message);

  return {
    conversationsByStatus: byConv,
    ordersByStatus: byOrd,
    ordersTotal: (ord || []).length,
    conversationsTotal: (conv || []).length,
    topServices,
    ordersTodayUtc: ordersTodayUtc ?? 0,
    conversationsCreatedTodayUtc: convTodayUtc ?? 0,
  };
}
