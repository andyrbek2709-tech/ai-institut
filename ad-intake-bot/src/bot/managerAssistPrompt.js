// Промт для AI-ассистента менеджера: предлагает короткий дружелюбный ответ
// клиенту по последнему сообщению, на языке клиента (ru/kk/en).
//
// На вход: orderData (что мы уже знаем о заявке), последние ~10 сообщений
// диалога, lang, lastUserMessage. На выход: 1-3 коротких предложения
// готового текста ответа клиенту от лица менеджера.

const LANG_NAME = {
  ru: "русском",
  kk: "казахском",
  en: "English",
};

const LANG_INSTRUCTION = {
  ru: "Отвечай на русском языке.",
  kk: "Қазақ тілінде жауап бер.",
  en: "Reply in English.",
};

export const ASSIST_SYSTEM = `Ты — менеджер рекламного агентства.
Сформулируй короткий (1–3 предложения), дружелюбный и по делу ответ клиенту
на его последнее сообщение. Учитывай тип услуги и уже собранные данные.

Стиль:
- Тёплый, человечный, без канцелярита и без шаблонных «здравствуйте, спасибо за обращение».
- Если уместно — задай ОДИН уточняющий вопрос (только если без него никак).
- Не обещай сроки, цены или скидки, если их нет в данных.
- Не выдумывай факты. Если данных мало — мягко уточни.
- Без эмодзи (кроме случаев, когда они уже есть в стиле диалога).
- Без подписи и без префикса «Менеджер:» — это уже добавит интерфейс.

Верни ТОЛЬКО текст ответа клиенту, без кавычек и без пояснений.`;

/**
 * @param {object} p
 * @param {object} p.orderData
 * @param {Array<{role:string, content:string}>} p.history
 * @param {string} p.lang  "ru" | "kk" | "en"
 * @param {string} p.lastUserMessage
 * @returns {string}
 */
export function buildAssistUserMessage({ orderData = {}, history = [], lang = "ru", lastUserMessage = "" }) {
  const langName = LANG_NAME[lang] || LANG_NAME.ru;
  const langInstr = LANG_INSTRUCTION[lang] || LANG_INSTRUCTION.ru;

  const compact = {};
  for (const [k, v] of Object.entries(orderData || {})) {
    if (v == null) continue;
    if (typeof v === "string" && !v.trim()) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    compact[k] = v;
  }

  const recent = (history || [])
    .slice(-10)
    .map((m) => {
      const role = m.role === "user"
        ? "Клиент"
        : m.role === "manager"
          ? "Менеджер"
          : "Бот";
      return `${role}: ${m.content}`;
    })
    .join("\n");

  return [
    `Язык клиента: ${langName}. ${langInstr}`,
    "",
    `Что мы уже знаем о заявке (JSON):\n${JSON.stringify(compact, null, 2)}`,
    "",
    `Последние сообщения диалога:\n${recent || "(пусто)"}`,
    "",
    `Последнее сообщение клиента:\n${lastUserMessage || "(нет)"}`,
    "",
    "Сформулируй короткий ответ клиенту (1–3 предложения).",
  ].join("\n");
}
