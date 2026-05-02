import OpenAI from "openai";
import { buildSystemPrompt, SAVE_ORDER_FUNCTION } from "../bot/prompts.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TOOLS = [{ type: "function", function: SAVE_ORDER_FUNCTION }];

/**
 * Send message to OpenAI with tool calling.
 * Returns either { type: "text", content: string } or { type: "function", args: object }
 *
 * @param {Array} messages - dialog messages
 * @param {string} lang - detected user language code: "ru" | "kk" | "en"
 * @param {object} extras - optional runtime context: { collected, currentStep }
 */
export async function chat(messages, lang = "ru", extras = {}) {
  // Trim history sent to LLM to last 20 messages (safety against runaway context).
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
 * Detect language of a message. Returns one of: "ru" | "kk" | "en".
 * Falls back to "ru" on error.
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
 * Describe an image using OpenAI Vision (gpt-4o-mini accepts image_url).
 * Used to give the LLM context about uploaded photos/mockups.
 *
 * @param {string} imageUrl - public URL or data URL of the image
 * @param {string} lang - user language for the description (ru/kk/en)
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
 * Returns a small JSON with fields like service_type, location, size, content,
 * design, deadline, contact, etc. Empty/unknown fields are omitted.
 *
 * Cheap call (low max_tokens, JSON mode). Used only when there are enough
 * messages to extract from.
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
            'service_type, description, location, size, quantity, content, design, deadline, budget, contact. ' +
            'Omit fields that the client has not stated. Do NOT invent values. ' +
            'For "design": value "есть макет" if the client attached a mockup/photo/sketch (look for [файл прикреплён] or vision: "...макет..."), otherwise "нужен макет" only if explicitly said. ' +
            'Output strictly a single JSON object with no extra text.',
        },
        { role: "user", content: transcript },
      ],
      temperature: 0,
      max_tokens: 250,
      response_format: { type: "json_object" },
    });
    const raw = response.choices[0].message.content || "{}";
    const parsed = JSON.parse(raw);
    // Drop empty/null fields just in case.
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
