import OpenAI from "openai";
import { franc } from "franc-min";
import { buildSystemPrompt, SAVE_ORDER_FUNCTION } from "../bot/prompts.js";
import { SERVICE_TYPES } from "../bot/scenarios.js";
import { EXTRACT_SYSTEM, buildExtractUserMessage } from "../bot/extractPrompt.js";
import { normalizeToSchema } from "../bot/orderSchema.js";
export { mergeData } from "../bot/orderSchema.js";
import { ASSIST_SYSTEM, buildAssistUserMessage } from "../bot/managerAssistPrompt.js";
import { PROPOSAL_SYSTEM, buildProposalUserMessage } from "../bot/proposalPrompt.js";
import { TEACH_EXTRACT_SYSTEM, buildTeachExtractUserMessage } from "../bot/teachExtractPrompt.js";

const openai = new OpenAI({
  apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.LLM_BASE_URL || "https://api.deepseek.com",
});
const LLM_MODEL = process.env.LLM_MODEL || "deepseek-v4-flash";

const TOOLS = [{ type: "function", function: SAVE_ORDER_FUNCTION }];

/** Нормализация content из chat.completions (строка / массив частей; DeepSeek иногда отдаёт нестандартно). */
function normalizeAssistantTextContent(msg) {
  if (!msg) return "";
  const c = msg.content;
  if (c == null) return "";
  if (typeof c === "string") return c.trim();
  if (Array.isArray(c)) {
    const parts = [];
    for (const part of c) {
      if (typeof part === "string") parts.push(part);
      else if (part && typeof part === "object" && typeof part.text === "string") parts.push(part.text);
    }
    return parts.join("").trim();
  }
  return String(c).trim();
}

/**
 * История из Supabase может содержать role "manager" (relay после «Уточнить»).
 * Chat Completions принимает только user|assistant|system|tool — иначе провайдер падает.
 */
export function normalizeDialogForLlm(messages) {
  if (!Array.isArray(messages)) return [];
  const out = [];
  for (const m of messages) {
    if (!m) continue;
    const content = String(m.content ?? "").trim();
    if (!content) continue;
    if (m.role === "user" || m.role === "assistant") {
      out.push({ role: m.role, content });
      continue;
    }
    if (m.role === "manager") {
      const looksPrefixed = /^(менеджер|manager)\s*:/i.test(content);
      out.push({
        role: "assistant",
        content: looksPrefixed ? content : `Менеджер: ${content}`,
      });
    }
  }
  return out;
}

/**
 * Send message to OpenAI with tool calling.
 * Returns either { type: "text", content: string } or { type: "function", args: object }
 *
 * @param {Array} messages
 * @param {string} lang  "ru" | "kk" | "en"
 * @param {object} extras { collected, currentStep, serviceCode, currentQuestion, knowledgeContext }
 */
export async function chat(messages, lang = "ru", extras = {}) {
  const slice = messages.length > 20 ? messages.slice(-20) : messages;
  const trimmed = normalizeDialogForLlm(slice);
  if (!trimmed.length) {
    return {
      type: "text",
      content:
        "Извините, не вижу контекста сообщения. Напишите ещё раз коротко, что нужно, или отправьте /start.",
    };
  }

  // Базовый system prompt + (опционально) подмешанный блок БАЗЫ ЗНАНИЙ.
  // knowledgeContext формируется в src/bot/promptContext.js (RAG-lite full-text).
  let systemPrompt = buildSystemPrompt(lang, extras);
  const kb =
    extras && typeof extras.knowledgeContext === "string" ? extras.knowledgeContext.trim() : "";
  if (kb) {
    systemPrompt += "\n\n====================\n" + kb + "\n====================";
  }

  const response = await openai.chat.completions.create({
    model: LLM_MODEL,
    messages: [{ role: "system", content: systemPrompt }, ...trimmed],
    tools: TOOLS,
    tool_choice: "auto",
    temperature: 0.4,
  });

  const msg = response.choices[0].message;

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const call = msg.tool_calls[0];
    const fn = call?.function?.name || call?.name;
    let rawArgs = call?.function?.arguments;
    if (rawArgs == null) rawArgs = "{}";
    if (typeof rawArgs !== "string") {
      try {
        rawArgs = JSON.stringify(rawArgs);
      } catch {
        rawArgs = "{}";
      }
    }
    let args = {};
    try {
      args = JSON.parse(rawArgs || "{}");
    } catch (e) {
      console.error("[chat] save_order JSON parse:", e.message, String(rawArgs).slice(0, 200));
      const fallback = normalizeAssistantTextContent(msg);
      return {
        type: "text",
        content:
          fallback ||
          "Извините, не получилось оформить ответ технически. Напишите, пожалуйста, ещё раз коротко, что нужно.",
      };
    }
    if (fn === "save_order") {
      return { type: "function", args };
    }
  }

  const body = normalizeAssistantTextContent(msg);
  return {
    type: "text",
    content:
      body ||
      "Извините, сейчас не смогла сформулировать ответ. Напишите ещё раз или одним предложением уточните запрос.",
  };
}

const FRANC_TO_BOT_LANG = {
  rus: "ru", bel: "ru", ukr: "ru", mhr: "ru", mkd: "ru", srp: "ru", orv: "ru",
  kaz: "kk", kir: "kk",
  eng: "en", sco: "en", jam: "en",
};

/**
 * Detect language: franc-min на фразах 6–800 символов, иначе / при und — LLM.
 * Returns "ru" | "kk" | "en".
 */
export async function detectLang(text) {
  if (!text || !text.trim()) return "ru";
  const t = text.trim();
  if (t.length >= 6 && t.length <= 800) {
    const iso3 = franc(t, { minLength: 3 });
    if (iso3 && iso3 !== "und") {
      const mapped = FRANC_TO_BOT_LANG[iso3];
      if (mapped) return mapped;
    }
  }
  try {
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        {
          role: "system",
          content:
            'Determine the language of the user message. Reply with exactly one of three codes and nothing else: "ru" (Russian), "kk" (Kazakh), "en" (English). Only the code. If mixed, pick dominant.',
        },
        { role: "user", content: t.slice(0, 500) },
      ],
      temperature: 0,
      max_tokens: 4,
    });
    const raw = normalizeAssistantTextContent(response.choices[0].message).toLowerCase();
    if (raw.startsWith("kk") || raw.startsWith("kz")) return "kk";
    if (raw.startsWith("en")) return "en";
    if (raw.startsWith("ru")) return "ru";
    return "ru";
  } catch (err) {
    console.error("Lang detect failed:", err.message);
    return "ru";
  }
}

/**
 * Ориентировочная вилка цены (KZT) по заявке + база знаний. Короткий абзац для клиента.
 */
export async function estimatePriceHint(orderData = {}, lang = "ru", knowledgeContext = "") {
  const langHint =
    lang === "kk" ? "Қазақ тілінде" : lang === "en" ? "In English" : "По-русски";
  const payload = JSON.stringify(orderData || {}, null, 0).slice(0, 2800);
  const kb = (knowledgeContext || "").trim().slice(0, 4500);
  try {
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        {
          role: "system",
          content:
            `${langHint}: дай ОДИН короткий абзац — ориентировочный диапазон цены в тенге (₸) для типографии/рекламы по заявке. ` +
            "Используй блок знаний как ориентир; если данных мало — скажи что нужны уточнения. Без markdown, без таблиц.",
        },
        { role: "user", content: `База (фрагмент):\n${kb || "(пусто)"}\n\nЗаявка JSON:\n${payload}` },
      ],
      temperature: 0.35,
      max_tokens: 220,
    });
    const txt = normalizeAssistantTextContent(response.choices?.[0]?.message);
    return txt || null;
  } catch (err) {
    console.error("estimatePriceHint failed:", err.message);
    return null;
  }
}

/**
 * LLM-classify service_type when keyword match fails.
 * Returns one of SERVICE_TYPES, or null if uncertain.
 */
export async function classifyServiceTypeLLM(text) {
  if (!text || !text.trim()) return null;
  const codes = SERVICE_TYPES.join("|");
  try {
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        {
          role: "system",
          content:
            'Classify the user message into one of these advertising service categories. ' +
            'Reply with EXACTLY one of the codes (in Russian Cyrillic, lowercase) and nothing else: ' +
            codes + '. ' +
            'If you are NOT confident — reply with the literal word: unknown. ' +
            'Categories meaning:\n' +
            '- вывеска: storefront sign, lightbox, fascia sign\n' +
            '- баннер: banner, vinyl/fabric banner, banner-stand\n' +
            '- наклейки: stickers, decals, vinyl labels\n' +
            '- футболки: t-shirts, polo, hoodies, apparel printing\n' +
            '- полиграфия: business cards, flyers, brochures, leaflets, booklets\n' +
            '- сувенирка: branded gifts (mugs, pens, notebooks, lanyards)\n' +
            '- другое: video, SMM, contextual ads, web design, anything else',
        },
        { role: "user", content: text.slice(0, 600) },
      ],
      temperature: 0,
      max_tokens: 8,
    });
    const raw = normalizeAssistantTextContent(response.choices[0].message).toLowerCase();
    if (SERVICE_TYPES.includes(raw)) return raw;
    if (raw.startsWith("unknown") || raw.startsWith("неизвест")) return null;
    // Иногда LLM может слегка переформулировать — сопоставим стартом
    for (const code of SERVICE_TYPES) {
      if (raw.startsWith(code)) return code;
    }
    return null;
  } catch (err) {
    console.error("classifyServiceTypeLLM failed:", err.message);
    return null;
  }
}

/**
 * Describe an image using OpenAI Vision.
 */
export async function describeImage(imageUrl, lang = "ru") {
  const instruction = {
    ru:
      "Опиши коротко (1-2 предложения) что на изображении в контексте рекламного заказа: " +
      "это макет вывески, готовая вывеска, эскиз, логотип, фото места установки, фото объекта или что-то другое? " +
      "Если видишь явный макет/эскиз/дизайн — обязательно укажи слово 'макет'. Пиши на русском.",
    kk:
      "Жарнама контексінде суретте не бар екенін қысқаша (1-2 сөйлем) сипаттаңыз: " +
      "маңдайша макеті, дайын маңдайша, эскиз, логотип, орнату орнының суреті ме? " +
      "Егер макет/эскиз/дизайн көрсеңіз — міндетті түрде 'макет' сөзін қолданыңыз. Қазақша жазыңыз.",
    en:
      "Briefly describe (1-2 sentences) what's in the image in advertising context: " +
      "is it a sign mockup, finished sign, sketch, logo, installation site photo, or something else? " +
      "If you see an explicit mockup/sketch/design — include the word 'mockup'. Reply in English.",
  }[lang] || "Опиши коротко что на изображении в контексте рекламы.";

  try {
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: instruction },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 200,
    });
    return normalizeAssistantTextContent(response.choices[0].message) || null;
  } catch (err) {
    console.error("Vision describeImage failed:", err.message);
    return null;
  }
}

/**
 * Классификация изображения для intake (не отказ клиенту, а мягкое уточнение).
 * @returns {Promise<{kind:'logo'|'mockup'|'casual_photo'|'unclear', note?: string}|null>}
 */
export async function classifyImageForIntake(imageUrl, lang = "ru") {
  const system = [
    'You classify ONE image for a print/signage agency intake.',
    'Reply with ONLY a JSON object: {"kind":"<one>","note":"<short russian reason>"}',
    'kind must be exactly one of: logo — isolated logo/wordmark;',
    'mockup — artwork ready for printing, layout, sketch;',
    'casual_photo — everyday photo, selfie, unrelated scene, screenshot of chat;',
    'unclear — cannot tell.',
    'Use Russian in "note" only.',
  ].join(" ");

  try {
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: "Classify for advertising brief." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 120,
    });
    const raw = normalizeAssistantTextContent(response.choices?.[0]?.message);
    const j = JSON.parse(raw || "{}");
    const kind = String(j.kind || "unclear");
    const allowed = new Set(["logo", "mockup", "casual_photo", "unclear"]);
    return {
      kind: allowed.has(kind) ? kind : "unclear",
      note: typeof j.note === "string" ? j.note.slice(0, 200) : "",
    };
  } catch (err) {
    console.error("classifyImageForIntake failed:", err.message);
    return null;
  }
}

/**
 * Extract partial brief fields the client has explicitly mentioned in the dialog.
 * Returns a small JSON. Empty/unknown fields are omitted.
 */
export async function extractPartialBrief(messages) {
  if (!Array.isArray(messages) || messages.length < 2) return {};
  const slice = messages.slice(-12);
  const transcript = slice
    .map((m) => `[${m.role}] ${(m.content || "").toString().slice(0, 400)}`)
    .join("\n");

  try {
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        {
          role: "system",
          content:
            'Extract advertising brief fields the CLIENT has explicitly mentioned. ' +
            'Return ONLY a JSON object with any of these fields when known: ' +
            'service_type, description, location, size, quantity, content, design, lighting, ' +
            'where_use, shape, material, sizes, print_type, type, paper_type, item, ' +
            'deadline, budget, contact. ' +
            'Omit fields that the client has not stated. Do NOT invent values. ' +
            'For "design": value "есть макет" if the client attached a mockup/photo/sketch (look for [файл прикреплён] or vision: "...макет..."), otherwise "нужен макет" only if explicitly said. ' +
            'Output strictly a single JSON object with no extra text.',
        },
        { role: "user", content: transcript },
      ],
      temperature: 0,
      max_tokens: 350,
      response_format: { type: "json_object" },
    });
    const raw = normalizeAssistantTextContent(response.choices[0].message) || "{}";
    const parsed = JSON.parse(raw);
    const cleaned = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v == null) continue;
      if (typeof v === "string" && !v.trim()) continue;
      cleaned[k] = v;
    }
    return cleaned;
  } catch (err) {
    console.error("extractPartialBrief failed:", err.message);
    return {};
  }
}

// ─── Formal structured extraction (extractData + mergeData) ──────────────────

/**
 * Извлечь delta-JSON из одного сообщения пользователя.
 * Возвращает только НОВЫЕ или БОЛЕЕ ТОЧНЫЕ поля.
 * Никогда не бросает — на ошибке логирует и возвращает {}.
 *
 * @param {string} userMessage  — последнее сообщение клиента (может содержать [файл прикреплён: URL])
 * @param {object} currentData  — уже собранный orderData (см. ORDER_SCHEMA)
 * @param {string} lang         — "ru" | "kk" | "en" (хинт; промт сам мультиязычный)
 * @returns {Promise<object>} delta
 */
export async function extractData(userMessage, currentData = {}, lang = "ru") {
  if (!userMessage || !String(userMessage).trim()) return {};
  try {
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: EXTRACT_SYSTEM },
        {
          role: "user",
          content: buildExtractUserMessage({
            currentData: stripEmpty(currentData),
            userMessage,
          }),
        },
      ],
      temperature: 0,
      max_tokens: 350,
      response_format: { type: "json_object" },
    });
    const raw = normalizeAssistantTextContent(response.choices[0].message) || "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("extractData: JSON parse failed:", e.message, "raw:", raw);
      return {};
    }
    // Нормализуем legacy-имена (service_type → type) и фильтруем мусор.
    const normalized = normalizeToSchema(parsed);
    const cleaned = {};
    for (const [k, v] of Object.entries(normalized)) {
      if (v == null) continue;
      if (typeof v === "string" && !v.trim()) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      cleaned[k] = v;
    }
    console.log(`[extractData lang=${lang}] delta=`, JSON.stringify(cleaned));
    return cleaned;
  } catch (err) {
    console.error("extractData failed:", err.message);
    return {};
  }
}

// Внутренняя: убирает null/пустые значения для компактного промта.
function stripEmpty(obj) {
  if (!obj || typeof obj !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (typeof v === "string" && !v.trim()) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "boolean" && v === false && k !== "needs_measurement") continue;
    out[k] = v;
  }
  return out;
}

/**
 * Какие из обязательных полей всё ещё пустые.
 */
export function missingRequiredFields(orderData, requiredFields = ["type", "size", "deadline", "contact"]) {
  const missing = [];
  for (const f of requiredFields) {
    const v = orderData?.[f];
    if (v == null || (typeof v === "string" && !v.trim())) missing.push(f);
  }
  return missing;
}

// ─── Manager Assist ───────────────────────────────────────────────────────

/**
 * Сгенерировать предложение текста ответа клиенту от лица менеджера.
 * Возвращает строку (1-3 предложения) или null при ошибке.
 *
 * @param {object} p
 * @param {object} p.orderData
 * @param {Array}  p.history
 * @param {string} p.lang  "ru" | "kk" | "en"
 * @param {string} p.lastUserMessage
 * @returns {Promise<string|null>}
 */
export async function assistManagerReply({ orderData = {}, history = [], lang = "ru", lastUserMessage = "" } = {}) {
  try {
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: ASSIST_SYSTEM },
        {
          role: "user",
          content: buildAssistUserMessage({ orderData, history, lang, lastUserMessage }),
        },
      ],
      temperature: 0.5,
      max_tokens: 220,
    });
    const txt = normalizeAssistantTextContent(response.choices?.[0]?.message);
    if (!txt) return null;
    // Срезаем кавычки если LLM их всё-таки добавил.
    return txt.replace(/^["«]|["»]$/g, "").trim();
  } catch (err) {
    console.error("assistManagerReply failed:", err.message);
    return null;
  }
}

/**
 * Перефразировать черновик менеджера (часто после Whisper) в вежливое сообщение КЛИЕНТУ,
 * без мета-формулировок «скажи клиенту / tell the client».
 */
export async function polishRelayForClient(raw, lang = "ru") {
  const draft = String(raw || "").trim();
  if (!draft) return "";
  const langLabel = lang === "kk" ? "қазақша" : lang === "en" ? "in English" : "по-русски";
  const system = [
    `Rewrite the following manager note into ONE short polite message TO THE CLIENT ${langLabel} (max 3 sentences).`,
    "Rules:",
    "- Use first person plural (we / мы / біз).",
    "- Remove internal instructions: tell the client, say to the client, say that, скажи клиенту, передай клиенту, нужно сказать, etc.",
    "- Do not quote yourself giving instructions; keep only facts useful for the client (dates, constraints, next steps).",
    "- Light politeness (извините/спасибо) only if natural.",
    "- No prefix \"Manager\" / \"Менеджер\".",
    "- Output only the final message body, no labels or quotes.",
  ].join("\n");
  try {
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: draft.slice(0, 1200) },
      ],
      temperature: 0.25,
      max_tokens: 220,
    });
    const out = normalizeAssistantTextContent(response.choices?.[0]?.message)
      .replace(/^["«]|["»]$/g, "")
      .trim();
    return out || draft;
  } catch (err) {
    console.error("polishRelayForClient failed:", err.message);
    return draft;
  }
}

/**
 * Сгенерировать коммерческое предложение (КП) клиенту по данным заявки.
 * Использует knowledge_base context (если передан) как ориентир по ценам/материалам.
 *
 * @param {object} p
 * @param {object} p.orderData
 * @param {Array}  p.history
 * @param {string} p.lang  "ru" | "kk" | "en"
 * @param {string} p.knowledgeContext
 * @returns {Promise<string|null>}
 */
export async function generateProposal({ orderData = {}, history = [], lang = "ru", knowledgeContext = "" } = {}) {
  try {
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: PROPOSAL_SYSTEM },
        {
          role: "user",
          content: buildProposalUserMessage({ orderData, history, lang, knowledgeContext }),
        },
      ],
      temperature: 0.6,
      max_tokens: 600,
    });
    const txt = normalizeAssistantTextContent(response.choices?.[0]?.message);
    if (!txt) return null;
    return txt.replace(/^["«]|["»]$/g, "").trim();
  } catch (err) {
    console.error("generateProposal failed:", err.message);
    return null;
  }
}


/**
 * Извлечь структурированную запись knowledge_base из заметки менеджера.
 * Возвращает {category, name, price, description, tags} либо null при ошибке.
 *
 * @param {string} text  raw text (или транскрипт голосового)
 */
export async function extractTeachStructured(text) {
  if (!text || !text.trim()) return null;
  try {
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: TEACH_EXTRACT_SYSTEM },
        { role: "user", content: buildTeachExtractUserMessage(text) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 500,
    });
    const raw = response.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    // Валидация / нормализация на уровне сервиса knowledgeBase, здесь
    // только базовая защита от мусора.
    const category = String(parsed.category || "").toLowerCase().trim();
    const name = String(parsed.name || "").trim();
    const description = String(parsed.description || "").trim();
    let price = parsed.price;
    if (price === "" || price === undefined) price = null;
    if (price !== null && !Number.isFinite(Number(price))) price = null;
    const tags = Array.isArray(parsed.tags) ? parsed.tags.map((t) => String(t)).filter(Boolean) : [];

    if (!name && !description) return null;
    return {
      category: category || "tip",
      name: name || description.slice(0, 40),
      price: price === null ? null : Number(price),
      description: description || name,
      tags,
    };
  } catch (err) {
    console.error("extractTeachStructured failed:", err.message);
    return null;
  }
}
