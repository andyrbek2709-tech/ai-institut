// Маршруты диалога по типу услуги.
// Каждый сценарий — упорядоченный список шагов; nextStep — первый незаполненный.
//
// Общие шаги: deadline, contact — есть везде; description тоже общий.
// Остальные специфичны для категории.

export const SERVICE_TYPES = [
  "вывеска",
  "баннер",
  "наклейки",
  "футболки",
  "полиграфия",
  "сувенирка",
  "другое",
];

export const SCENARIOS = {
  "вывеска": [
    "location",   // на улице или внутри?
    "size",       // примерный размер?
    "content",    // что должно быть написано/изображено?
    "design",     // есть макет или делаем?
    "lighting",   // нужна подсветка?
    "deadline",
    "contact",
  ],
  "баннер": [
    "size",
    "where_use",  // где будет использоваться?
    "content",
    "design",
    "quantity",
    "deadline",
    "contact",
  ],
  "наклейки": [
    "quantity",
    "size",
    "shape",      // форма: круг/квадрат?
    "material",   // глянец/мат?
    "design",
    "deadline",
    "contact",
  ],
  "футболки": [
    "quantity",
    "sizes",      // S, M, L
    "print_type", // печать или вышивка?
    "design",
    "deadline",
    "contact",
  ],
  "полиграфия": [
    "type",       // визитки/листовки/буклет?
    "quantity",
    "size",
    "paper_type",
    "design",
    "deadline",
    "contact",
  ],
  "сувенирка": [
    "item",       // что именно (ручки/кружки/блокноты)?
    "quantity",
    "design",
    "deadline",
    "contact",
  ],
  "другое": [
    "description",
    "quantity",
    "deadline",
    "contact",
  ],
};

// Простой keyword-классификатор.
// Возвращает один из SERVICE_TYPES, либо null если не уверены.
export function keywordClassify(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();

  // Порядок важен — сначала более специфичные.
  // Внимание: плюрал genitive русского ('визиток', 'наклеек', 'футболок', 'кружек', 'ручек')
  // меняет корень — поэтому добавляем альтернативные формы.
  const rules = [
    { code: "полиграфия", re: /(визитк|визиток|листовк|листовок|буклет|флаер|листочек|полиграф|brochure|business[\s-]?card|leaflet|flyer)/i },
    { code: "вывеска",    re: /(вывеск|вывесок|маңдайш|signboard|signage|\bsign\b|fasad|фасад)/i },
    { code: "баннер",     re: /(баннер|banner|растяжк|растяжек|плакат)/i },
    { code: "наклейки",   re: /(наклейк|наклеек|стикер|sticker|жапсырма)/i },
    { code: "футболки",   re: /(футболк|футболок|майк|t-?shirt|tshirt|\bполо\b|худи|свитшот)/i },
    { code: "сувенирка",  re: /(сувенир|souvenir|кружк|кружек|ручк[аиу]|ручек|блокнот|кепк|кепок|брелок|брелк|термос|пакет с лого|merch)/i },
  ];

  for (const r of rules) {
    if (r.re.test(t)) return r.code;
  }
  return null;
}

// Нормализовать service_type, который пришёл от LLM (он может быть на любом языке).
// Возвращает один из SERVICE_TYPES или "другое".
export function normalizeServiceType(rawServiceType) {
  if (!rawServiceType) return null;
  const k = keywordClassify(rawServiceType);
  if (k) return k;
  return "другое";
}

// Шаги, значения которых имеет смысл переносить при смене типа услуги
// (общие штуки — клиенту обидно повторяться).
const PORTABLE_FIELDS = [
  "deadline",
  "contact",
  "description",
  "budget",
  "design", // если уже прислал макет — это не зависит от типа
];

export function carryOverFields(prevCollected) {
  if (!prevCollected) return {};
  const out = {};
  for (const f of PORTABLE_FIELDS) {
    if (prevCollected[f] != null && String(prevCollected[f]).trim() !== "") {
      out[f] = prevCollected[f];
    }
  }
  return out;
}

// Понять, какой шаг просить дальше для данного service_type.
// collected — то что уже известно (after extractPartialBrief).
// service — нормализованный код или null.
export function nextStepFor(collected = {}, service = null) {
  // Если типа ещё нет — собираем его в первую очередь.
  if (!service) return "service_type";

  const has = (k) => {
    const v = collected[k];
    return v != null && String(v).trim() !== "";
  };

  const steps = SCENARIOS[service] || SCENARIOS["другое"];
  for (const step of steps) {
    // Для "другое" description ≈ content — не дублируем.
    if (step === "description" && (has("description") || has("content"))) continue;
    if (!has(step)) return step;
  }
  return "confirm";
}
