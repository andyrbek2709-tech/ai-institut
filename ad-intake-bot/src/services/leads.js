import { supabase } from "./supabase.js";

// ─── Lead score heuristic ────────────────────────────────────────────────────
//
// • Все обязательные поля заполнены: +30
// • Дедлайн < 7 дней:  +20  (HOT urgency)
// • Дедлайн 7–30 дней: +10  (WARM urgency)
// • Бюджет указан:     +15
// • Контакт качественный (телефон/email): +10
// • Файлы прикреплены: +10
//
// HOT  = score ≥ 70
// WARM = 40–69
// COLD = < 40

const REQUIRED_FOR_SCORE = ["type", "description", "size", "deadline", "contact"];

export function calcLeadScore({ orderData, files = [] } = {}) {
  let score = 0;
  const od = orderData || {};

  // 1) Полнота обязательных полей
  const allFilled = REQUIRED_FOR_SCORE.every((f) => {
    const v = od[f];
    return v !== null && v !== undefined && String(v).trim().length > 0;
  });
  if (allFilled) score += 30;

  // 2) Срочность дедлайна
  const days = parseDeadlineDays(od.deadline);
  if (days !== null) {
    if (days < 7) score += 20;
    else if (days <= 30) score += 10;
  }

  // 3) Бюджет
  if (od.budget && String(od.budget).trim()) score += 15;

  // 4) Качество контакта (телефон/email)
  if (isQualityContact(od.contact)) score += 10;

  // 5) Файлы
  const filesCount = (files && files.length) || (od.files && od.files.length) || 0;
  if (filesCount > 0) score += 10;

  return Math.max(0, Math.min(100, score));
}

function parseDeadlineDays(deadline) {
  if (!deadline) return null;
  const s = String(deadline).toLowerCase().trim();

  // Срочно / ASAP / сегодня
  if (/(срочн|asap|сегодня|шұғыл|today|now)/.test(s)) return 0;
  // Завтра / tomorrow / ертең
  if (/(завтра|ертең|tomorrow)/.test(s)) return 1;
  // 2 недели / две недели / two weeks
  if (/(2\s*нед|две\s*нед|екі\s*апта|2\s*weeks?|two\s*weeks?)/.test(s)) return 14;
  // Неделя / апта / week
  if (/(недел|апта|week)/.test(s)) return 7;
  // Месяц / month / ай
  if (/(месяц|month|\b1\s*ай|бір\s*ай)/.test(s)) return 30;
  // "5 дней" / "5 days" / "10 күн"
  const mNum = s.match(/(\d+)\s*(дн|дней|day|days|күн)/);
  if (mNum) return parseInt(mNum[1], 10);
  // ISO / DD.MM
  const dm = s.match(/(\d{1,2})[\.\-/](\d{1,2})(?:[\.\-/](\d{2,4}))?/);
  if (dm) {
    const now = new Date();
    const day = parseInt(dm[1], 10);
    const mon = parseInt(dm[2], 10) - 1;
    const yr = dm[3] ? (dm[3].length === 2 ? 2000 + parseInt(dm[3], 10) : parseInt(dm[3], 10)) : now.getFullYear();
    const target = new Date(yr, mon, day);
    if (!dm[3] && target < now) target.setFullYear(target.getFullYear() + 1);
    const diff = Math.round((target - now) / 86400000);
    if (diff >= 0 && diff < 365) return diff;
  }
  return null;
}

function isQualityContact(contact) {
  if (!contact) return false;
  const s = String(contact);
  // Телефон: 7+ цифр подряд, опционально +
  if (/\+?\d[\d\s\-()]{6,}/.test(s)) return true;
  // Email
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(s)) return true;
  return false;
}

export function scoreBadge(score) {
  if (score >= 70) return "🔥 HOT";
  if (score >= 40) return "🟡 WARM";
  return "🔵 COLD";
}

export function scoreTier(score) {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createLead({ conversationId, orderId, telegramUserId, telegramChatId, data, leadScore }) {
  const row = {
    conversation_id: conversationId || null,
    order_id: orderId || null,
    telegram_user_id: Number(telegramUserId),
    telegram_chat_id: Number(telegramChatId),
    data: data || {},
    lead_score: typeof leadScore === "number" ? leadScore : 50,
    status: "new",
  };
  const { data: lead, error } = await supabase.from("leads").insert(row).select().single();
  if (error) throw new Error(`Lead insert failed: ${error.message}`);
  return lead;
}

export async function getActiveLeadByChatId(telegramChatId) {
  if (!telegramChatId && telegramChatId !== 0) return null;
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("telegram_chat_id", Number(telegramChatId))
    .in("status", ["new", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("getActiveLeadByChatId error:", error.message);
    return null;
  }
  return data || null;
}

export async function getLeadById(id) {
  const { data, error } = await supabase.from("leads").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateLead(id, patch) {
  const update = { ...patch, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("leads").update(update).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

/** Поверхностное слияние в `leads.data` (JSONB), без потери остальных ключей. */
export async function mergeLeadData(leadId, partial) {
  const lead = await getLeadById(leadId);
  const prev = lead.data && typeof lead.data === "object" && !Array.isArray(lead.data) ? lead.data : {};
  const data = { ...prev, ...partial };
  return updateLead(leadId, { data });
}

export async function getLeadsByStatus(status, limit = 10) {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getLeadsByTier(tier, limit = 10) {
  let min = 0, max = 39;
  if (tier === "hot") { min = 70; max = 100; }
  else if (tier === "warm") { min = 40; max = 69; }

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .gte("lead_score", min)
    .lte("lead_score", max)
    .in("status", ["new", "in_progress"])
    .order("lead_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getLeadsSummary() {
  const { data, error } = await supabase.from("leads").select("id,status,lead_score");
  if (error) throw new Error(error.message);
  const rows = data || [];
  const summary = {
    total: rows.length,
    active: 0,
    by_status: { new: 0, in_progress: 0, closed: 0, rejected: 0 },
    by_tier: { hot: 0, warm: 0, cold: 0 },
  };
  for (const r of rows) {
    summary.by_status[r.status] = (summary.by_status[r.status] || 0) + 1;
    if (r.status === "new" || r.status === "in_progress") {
      summary.active++;
      summary.by_tier[scoreTier(r.lead_score ?? 50)]++;
    }
  }
  return summary;
}

export async function getConversationHistoryForLead(conversationId, limit = 10) {
  if (!conversationId) return [];
  const { data, error } = await supabase
    .from("conversations")
    .select("history,lang")
    .eq("id", conversationId)
    .single();
  if (error) return { history: [], lang: null };
  const history = Array.isArray(data?.history) ? data.history.slice(-limit) : [];
  return { history, lang: data?.lang || null };
}

export async function appendConversationMessage(conversationId, role, content) {
  if (!conversationId) return;
  try {
    const { data: conv, error: e1 } = await supabase
      .from("conversations")
      .select("history")
      .eq("id", conversationId)
      .single();
    if (e1) return;
    const history = Array.isArray(conv?.history) ? conv.history : [];
    history.push({ role, content, ts: new Date().toISOString() });
    await supabase
      .from("conversations")
      .update({ history, updated_at: new Date().toISOString() })
      .eq("id", conversationId);
  } catch (err) {
    console.error("appendConversationMessage failed:", err.message);
  }
}
