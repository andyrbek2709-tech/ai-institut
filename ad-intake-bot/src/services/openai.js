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
 */
export async function chat(messages, lang = "ru") {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: buildSystemPrompt(lang) }, ...messages],
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
