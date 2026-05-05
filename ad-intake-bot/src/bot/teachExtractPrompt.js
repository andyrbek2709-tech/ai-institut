// Промт для извлечения структурированной записи в knowledge_base
// из заметки менеджера (текст или транскрипт голосового).
//
// LLM должна вернуть СТРОГО JSON без пояснений:
//   {
//     "category":    "material" | "service" | "rule" | "price" | "tip",
//     "name":        "короткое имя 2-5 слов",
//     "price":       number | null,
//     "description": "полное описание сути",
//     "tags":        ["ключевое", "слово", ...] (до 5)
//   }

export const TEACH_EXTRACT_SYSTEM =
  'Ты извлекаешь структурированные данные из заметки менеджера для базы знаний рекламного агентства. ' +
  'Отвечай СТРОГО валидным JSON без пояснений, без markdown, без обёрток. ' +
  'Поля JSON: ' +
  '- category (string): один из "material", "service", "rule", "price", "tip"; ' +
  '- name (string): короткое имя 2-5 слов; ' +
  '- price (number или null): если в тексте упомянута цена в тенге — число, иначе null; ' +
  '- description (string): полное описание сути из заметки; ' +
  '- tags (array of strings, до 5): ключевые слова для поиска (русские, нижний регистр).';

export function buildTeachExtractUserMessage(text) {
  const safe = String(text || "").slice(0, 4000);
  return `Заметка: «${safe}»\n\nВерни строго JSON.`;
}

/** Извлечение для knowledge_items: type + structured_data + тексты. */
export const KNOWLEDGE_EXTRACT_SYSTEM =
  "Ты извлекаешь структурированное знание из заметки менеджера рекламного агентства для RAG-базы. " +
  "Ответь СТРОГО одним JSON-объектом без markdown и пояснений. Поля:\n" +
  '- type (string): один из "price", "material", "rule", "service", "tip".\n' +
  "- title (string): короткий заголовок 2–8 слов.\n" +
  "- clean_text (string): связное описание для человека и для поиска (до ~1200 символов).\n" +
  "- structured_data (object): машиночитаемые поля — например price (number|null), unit (string), " +
  "tags (string[] до 8), formula (string), assumptions (string[]), currency (string, по умолчанию KZT). " +
  "Любые дополнительные ключи допустимы, если они помогут расчётам.\n" +
  "Не выдумывай цены: если в тексте нет числа — price: null. Если сомневаешься в типе — используй tip.";

export function buildKnowledgeExtractUserMessage(text) {
  const safe = String(text || "").slice(0, 4000);
  return `Заметка менеджера:\n«${safe}»\n\nВерни строго JSON с полями type, title, clean_text, structured_data.`;
}
