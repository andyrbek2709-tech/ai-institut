// Сервис knowledge_base: CRUD + поиск.
// Используется командой /teach (запись) и командой /knowledge (просмотр/удаление).
// На следующем шаге searchKnowledge() будет дёргаться из processUserMessage,
// чтобы подмешивать релевантные записи в системный промт ответа клиенту.

import { supabase } from "./supabase.js";

const VALID_CATEGORIES = new Set(["material", "service", "rule", "price", "tip"]);

function normalizeCategory(cat) {
  const c = String(cat || "").toLowerCase().trim();
  return VALID_CATEGORIES.has(c) ? c : "tip";
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => String(t || "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 5);
}

function normalizePrice(price) {
  if (price === null || price === undefined || price === "") return null;
  const n = Number(price);
  return Number.isFinite(n) ? n : null;
}

/**
 * Добавить запись.
 * @param {object} args
 * @param {string} args.category   material|service|rule|price|tip
 * @param {string} args.name
 * @param {number|null} args.price
 * @param {string} args.description
 * @param {string[]} args.tags
 * @param {number|string|null} args.createdByChatId
 */
export async function addKnowledge({ category, name, price = null, description, tags = [], createdByChatId = null }) {
  const row = {
    category: normalizeCategory(category),
    name: String(name || "").slice(0, 200).trim() || "(без названия)",
    price: normalizePrice(price),
    description: String(description || "").slice(0, 4000).trim() || "(пусто)",
    tags: normalizeTags(tags),
    created_by_chat_id: createdByChatId ? Number(createdByChatId) : null,
  };

  const { data, error } = await supabase
    .from("knowledge_base")
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(`KB insert failed: ${error.message}`);
  return data;
}

/**
 * Список записей (по умолчанию — последние 20).
 * @param {object} args
 * @param {string=} args.category
 * @param {number=} args.limit
 */
export async function listKnowledge({ category = null, limit = 20 } = {}) {
  let q = supabase
    .from("knowledge_base")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (category && VALID_CATEGORIES.has(category)) q = q.eq("category", category);

  const { data, error } = await q;
  if (error) throw new Error(`KB list failed: ${error.message}`);
  return data || [];
}

/**
 * Получить одну запись.
 */
export async function getKnowledgeById(id) {
  const { data, error } = await supabase
    .from("knowledge_base")
    .select("*")
    .eq("id", Number(id))
    .maybeSingle();
  if (error) throw new Error(`KB get failed: ${error.message}`);
  return data || null;
}

/**
 * Удалить запись (полное удаление, не soft-delete).
 */
export async function deleteKnowledge(id) {
  const { error } = await supabase
    .from("knowledge_base")
    .delete()
    .eq("id", Number(id));
  if (error) throw new Error(`KB delete failed: ${error.message}`);
}

/**
 * Поиск по полнотекстовому индексу + по тегам.
 * Используется на следующем шаге для подмешивания знаний в ответ клиенту.
 *
 * @param {string} query
 * @param {number} limit
 */
export async function searchKnowledge(query, limit = 5) {
  const q = String(query || "").trim();
  if (!q) return [];

  // 1) Полнотекстовый поиск по name+description.
  // websearch_to_tsquery терпим к произвольному вводу клиента.
  const { data: ftData, error: ftErr } = await supabase
    .from("knowledge_base")
    .select("*")
    .textSearch("kb_search_text", q, { type: "websearch", config: "russian" })
    .limit(limit);

  if (!ftErr && ftData && ftData.length) return ftData;

  // 2) Фолбэк: по тегам (overlap) — если введены 1-2 слова.
  const tokens = q
    .toLowerCase()
    .split(/[\s,;.!?()«»"]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .slice(0, 5);
  if (!tokens.length) return [];

  const { data: tagData, error: tagErr } = await supabase
    .from("knowledge_base")
    .select("*")
    .overlaps("tags", tokens)
    .limit(limit);
  if (tagErr) return [];
  return tagData || [];
}

export const KB_CATEGORIES = ["material", "service", "rule", "price", "tip"];
