// RAG-lite: формирование контекстного блока БАЗЫ ЗНАНИЙ для system prompt.
// Используется в processUserMessage перед вызовом chat() — подмешивает в промт
// до 3 релевантных записей из knowledge_items (pgvector + FTS fallback в searchKnowledge).
// Если 0 результатов — возвращаем "" и обычный flow не меняется.

import { searchKnowledge } from "../services/knowledgeBase.js";

const HEADERS = {
  ru: {
    title: "Дополнительные знания (база агентства; ориентиры, не жёсткие обязательства):",
    footer:
      'Используй эти данные как РЕКОМЕНДАЦИИ. Формулировки типа: ' +
      '«Обычно такие работы идут от ~X тенге» / «Для этого случая мы используем материал Y». ' +
      'НЕ перегружай — упоминай только если уместно. ' +
      'Если релевантность сомнительна или данных нет — не опирайся на блок. ' +
      'Если в записях нет точного ответа — не выдумывай цены, иди дальше по сценарию.',
  },
  kk: {
    title: "Қосымша білім (агенттік базасы; бағдар ретінде, қатаң міндеттеме емес):",
    footer:
      'Бұл деректерді ҰСЫНЫСТАР ретінде пайдалан. ' +
      '«Әдетте мұндай жұмыстар ~X теңгеден басталады» / «Бұл жағдайда Y материалын қолданамыз» сияқты тіркестер. ' +
      'Шамадан тыс жүктеме — тек орынды болса ғана айт. ' +
      'Сәйкестік күмәнді немесе дерек жоқ болса — бұл блокқа сенбе. ' +
      'Жазбаларда нақты жауап болмаса — бағаны ойдан шығарма, сценарий бойынша жалғастыр.',
  },
  en: {
    title: "Additional knowledge (agency base; guidelines, not rigid obligations):",
    footer:
      'Treat this as RECOMMENDATIONS. ' +
      "Use phrasings like 'Such work typically starts from ~X tenge' / 'For this case we use material Y'. " +
      'Do NOT overload — mention only when relevant. ' +
      'If relevance is doubtful or data is missing — do not rely on this block. ' +
      "If the records don't have a precise answer — don't invent prices, continue with the scenario.",
  },
};

const CATEGORY_LABEL = {
  ru: { material: "материал", service: "услуга", rule: "правило", price: "цена", tip: "совет" },
  kk: { material: "материал", service: "қызмет", rule: "ереже", price: "баға", tip: "кеңес" },
  en: { material: "material", service: "service", rule: "rule", price: "price", tip: "tip" },
};

function categoryLabel(cat, lang) {
  const map = CATEGORY_LABEL[lang] || CATEGORY_LABEL.ru;
  return map[cat] || cat || (lang === "en" ? "note" : "запись");
}

function priceStr(price, lang) {
  if (price == null || price === "") return "";
  const cur = lang === "en" ? "tenge" : "тг";
  return ` — ${price} ${cur}`;
}

// Собираем поисковую строку из последнего сообщения клиента + полей заказа.
// Чистим [файл прикреплён: ...] заметки, чтобы они не доминировали в индексе.
function buildQuery({ lastUserMessage, orderData }) {
  const parts = [];
  if (lastUserMessage && typeof lastUserMessage === "string") {
    const cleaned = lastUserMessage.replace(/\[файл прикреплён:[^\]]*\]/gi, "").trim();
    if (cleaned) parts.push(cleaned.slice(0, 400));
  }
  if (orderData && typeof orderData === "object") {
    if (orderData.type) parts.push(String(orderData.type));
    if (orderData.service_type && orderData.service_type !== orderData.type) {
      parts.push(String(orderData.service_type));
    }
    if (orderData.description) parts.push(String(orderData.description).slice(0, 200));
  }
  return parts.join(" ").trim();
}

/**
 * Сформировать контекстный блок БАЗЫ ЗНАНИЙ для подмешивания в system prompt.
 * Возвращает строку, готовую к конкатенации, или "" если ничего релевантного нет.
 *
 * @param {object} args
 * @param {string} args.lastUserMessage — последнее сообщение клиента
 * @param {object} args.orderData       — текущий orderData (см. ORDER_SCHEMA)
 * @param {string} args.lang            — "ru" | "kk" | "en"
 * @returns {Promise<string>}
 */
export async function buildKnowledgeContext({ lastUserMessage, orderData = {}, lang = "ru" } = {}) {
  const query = buildQuery({ lastUserMessage, orderData });
  if (!query) return "";

  let results = [];
  try {
    results = await searchKnowledge(query, 3);
  } catch (err) {
    console.error("buildKnowledgeContext: searchKnowledge failed:", err.message);
    return "";
  }
  if (!Array.isArray(results) || results.length === 0) return "";

  const h = HEADERS[lang] || HEADERS.ru;
  const lines = [h.title];

  results.slice(0, 3).forEach((row, idx) => {
    const typ = row.type || row.category;
    const cat = categoryLabel(typ, lang);
    const name =
      String(row.title || row.name || "").trim() || (lang === "en" ? "(no title)" : "(без названия)");
    const sd = row.structured_data && typeof row.structured_data === "object" ? row.structured_data : {};
    const priceNum = sd.price != null ? sd.price : row.price;
    const price = priceStr(priceNum, lang);
    const desc = String(row.content || row.description || "").trim().slice(0, 200);
    lines.push(`[${idx + 1}] ${cat}: ${name}${price}${desc ? " — " + desc : ""}`);
  });

  lines.push("");
  lines.push(h.footer);
  return lines.join("\n");
}
