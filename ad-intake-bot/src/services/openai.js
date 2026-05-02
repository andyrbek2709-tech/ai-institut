import OpenAI from "openai";
import { buildSystemPrompt, SAVE_ORDER_FUNCTION } from "../bot/prompts.js";
import { SERVICE_TYPES } from "../bot/scenarios.js";
import { EXTRACT_SYSTEM, buildExtractUserMessage } from "../bot/extractPrompt.js";
import { normalizeToSchema, makeEmptyOrder } from "../bot/orderSchema.js";
import { ASSIST_SYSTEM, buildAssistUserMessage } from "../bot/managerAssistPrompt.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TOOLS = [{ type: "function", function: SAVE_ORDER_FUNCTION }];

/**
 * Send message to OpenAI with tool calling.
 * Returns either { type: "text", content: string } or { type: "function", args: object }
 *
 * @param {Array} messages
 * @param {string} lang  "ru" | "kk" | "en"
 * @param {object} extras { collected, currentStep, serviceCode, currentQuestion }
 */
export async function chat(messages, lang = "ru", extras = {}) {
  const trimmed = messages.length > 20 ? messages.slice(-20) : messages;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: buildSystemPrompt(lang, extras) }, ...trimmed],
    tools: TOOLS,
    tool_choice: "auto",
    temperature: 0.4,
  });

  const msg = response.choices[0].message;

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const call = msg.tool_calls[0];
    if (call.function.name === "save_order") {
      return {
        type: "function",
        args: JSON.parse(call.function.arguments),
      };
    }
  }

  return { type: "text", content: msg.content };
}

/**
 * Detect language. Returns "ru" | "kk" | "en". Falls back to "ru".
 */
export async function detectLang(text) {
  if (!text || !text.trim()) return "ru";
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            'Determine the language of the user message. Reply with exactly one of three codes and nothing else: "ru" (Russian), "kk" (Kazakh), "en" (English). Only the code.',
        },
        { role: "user", content: text.slice(0, 500) },
      ],
      temperature: 0,
      max_tokens: 4,
    });
    const raw = (response.choices[0].message.content || "").trim().toLowerCase();
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
 * LLM-classify service_type when keyword match fails.
 * Returns one of SERVICE_TYPES, or null if uncertain.
 */
export async function classifyServiceTypeLLM(text) {
  if (!text || !text.trim()) return null;
  const codes = SERVICE_TYPES.join("|");
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
    const raw = (response.choices[0].message.content || "").trim().toLowerCase();
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
      model: "gpt-4o-mini",
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
    return (response.choices[0].message.content || "").trim() || null;
  } catch (err) {
    console.error("Vision describeImage failed:", err.message);
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
      model: "gpt-4o-mini",
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
    const raw = response.choices[0].message.content || "{}";
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
      model: "gpt-4o-mini",
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
    const raw = response.choices[0].message.content || "{}";
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
 * Merge delta в существующий orderData по правилам:
 *  - null/undefined в delta — пропускаем (не затираем)
 *  - files: append (de-dup), всегда массив
 *  - boolean — обновляется всегда (явно сказано true/false)
 *  - existing пустое → берём delta
 *  - delta более длинная (точнее) → берём delta
 *
 * Никогда не бросает; возвращает новый объект.
 */
export function mergeData(existing = {}, delta = {}) {
  const base = existing && typeof existing === "object" ? existing : {};
  const merged = { ...makeEmptyOrder(), ...base };
  if (!delta || typeof delta !== "object") return merged;

  for (const [k, v] of Object.entries(delta)) {
    if (v === null || v === undefined) continue;

    if (k === "files" && Array.isArray(v)) {
      const prev = Array.isArray(merged.files) ? merged.files : [];
      const seen = new Set(prev);
      const append = [];
      for (const f of v) {
        if (typeof f !== "string") continue;
        if (seen.has(f)) continue;
        seen.add(f);
        append.push(f);
      }
      merged.files = [...prev, ...append];
      continue;
    }

    if (typeof v === "boolean") {
      merged[k] = v;
      continue;
    }

    const existingVal = merged[k];
    if (existingVal === null || existingVal === undefined || existingVal === "") {
      merged[k] = v;
      continue;
    }

    // Более длинное / точное значение — берём.
    if (String(v).length > String(existingVal).length) {
      merged[k] = v;
      continue;
    }

    // Иначе оставляем существующее.
  }
  return merged;
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
      model: "gpt-4o-mini",
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
    const txt = response.choices?.[0]?.message?.content?.trim();
    if (!txt) return null;
    // Срезаем кавычки если LLM их всё-таки добавил.
    return txt.replace(/^["«]|["»]$/g, "").trim();
  } catch (err) {
    console.error("assistManagerReply failed:", err.message);
    return null;
  }
}
