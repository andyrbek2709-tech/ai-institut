// Сервис knowledge_items: CRUD + RAG (embedding + FTS fallback).
// Команды /teach (запись) и /knowledge (просмотр/удаление).
// Поиск: vector RPC через openai.matchKnowledgeItemsByEmbedding, затем search_doc.

import { supabase } from "./supabase.js";
import { matchKnowledgeItemsByEmbedding } from "./openai.js";

const VALID_TYPES = new Set(["material", "service", "rule", "price", "tip"]);

function normalizeType(cat) {
  const c = String(cat || "").toLowerCase().trim();
  return VALID_TYPES.has(c) ? c : "tip";
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => String(t || "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizePrice(price) {
  if (price === null || price === undefined || price === "") return null;
  const n = Number(price);
  return Number.isFinite(n) ? n : null;
}

/**
 * Добавить запись в knowledge_items.
 * @param {object} args
 * @param {string} args.category   material|service|rule|price|tip → type
 * @param {string} args.name       → title
 * @param {number|null} args.price → в structured_data если не передано structured_data
 * @param {string} args.description → content
 * @param {string[]} args.tags     → в structured_data.tags
 * @param {object} [args.structured_data]  полный JSON от extractKnowledge
 * @param {number[]|null} [args.embedding] вектор 1536 или null
 * @param {string} [args.source]   text|voice|file
 * @param {number|string|null} args.createdByChatId
 */
export async function addKnowledge({
  category,
  name,
  price = null,
  description,
  tags = [],
  structured_data: structuredIn = null,
  embedding = null,
  source = "text",
  createdByChatId = null,
}) {
  const type = normalizeType(category);
  const title = String(name || "").slice(0, 200).trim() || "(без названия)";
  const content = String(description || "").slice(0, 8000).trim() || "(пусто)";
  let structured_data =
    structuredIn && typeof structuredIn === "object" && !Array.isArray(structuredIn)
      ? { ...structuredIn }
      : {};
  const p = normalizePrice(price);
  if (p !== null && structured_data.price == null) structured_data.price = p;
  const nt = normalizeTags(tags);
  if (nt.length && !Array.isArray(structured_data.tags)) structured_data.tags = nt;

  const row = {
    type,
    title,
    content,
    structured_data,
    embedding,
    source: ["text", "voice", "file"].includes(source) ? source : "text",
    created_by_chat_id: createdByChatId ? Number(createdByChatId) : null,
  };

  const { data, error } = await supabase.from("knowledge_items").insert(row).select().single();
  if (error) throw new Error(`knowledge_items insert failed: ${error.message}`);
  return data;
}

export async function listKnowledge({ category = null, limit = 20 } = {}) {
  let q = supabase.from("knowledge_items").select("*").order("created_at", { ascending: false }).limit(limit);
  if (category && VALID_TYPES.has(category)) q = q.eq("type", category);

  const { data, error } = await q;
  if (error) throw new Error(`knowledge_items list failed: ${error.message}`);
  return data || [];
}

export async function getKnowledgeById(id) {
  const { data, error } = await supabase
    .from("knowledge_items")
    .select("*")
    .eq("id", Number(id))
    .maybeSingle();
  if (error) throw new Error(`knowledge_items get failed: ${error.message}`);
  return data || null;
}

export async function deleteKnowledge(id) {
  const { error } = await supabase.from("knowledge_items").delete().eq("id", Number(id));
  if (error) throw new Error(`knowledge_items delete failed: ${error.message}`);
}

/**
 * RAG: сначала top-N по embedding, иначе полнотекст по search_doc.
 */
export async function searchKnowledge(query, limit = 5) {
  const q = String(query || "").trim();
  if (!q) return [];

  try {
    const vec = await matchKnowledgeItemsByEmbedding(q, limit);
    if (vec.length) return vec;
  } catch (err) {
    console.warn("searchKnowledge vector:", err.message);
  }

  const { data: ftData, error: ftErr } = await supabase
    .from("knowledge_items")
    .select("*")
    .textSearch("search_doc", q, { type: "websearch", config: "russian" })
    .limit(limit);

  if (!ftErr && ftData && ftData.length) return ftData;

  const tokens = q
    .toLowerCase()
    .split(/[\s,;.!?()«»"]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .slice(0, 3);
  if (!tokens.length) return [];

  const t0 = tokens[0].replace(/%/g, "");
  const { data: likeData, error: likeErr } = await supabase
    .from("knowledge_items")
    .select("*")
    .or(`title.ilike.%${t0}%,content.ilike.%${t0}%`)
    .limit(limit);
  if (!likeErr && likeData?.length) return likeData;
  return [];
}

export const KB_CATEGORIES = ["material", "service", "rule", "price", "tip"];
