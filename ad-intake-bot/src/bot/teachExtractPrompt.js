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
