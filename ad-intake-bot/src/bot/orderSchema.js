// Формальная схема заказа.
// Базовый "пустой" объект-снимок состояния заказа.
// Расширяется по мере того, как клиент сообщает данные;
// извлечение → mergeData → этот объект.
//
// Ключи синхронизированы со scenarios.js / questions.js / SAVE_ORDER_FUNCTION.
// Важно: ВСЕ поля nullable (null = ещё не известно). files — массив (append-only).

export const ORDER_SCHEMA = {
  type: null,                 // вывеска / баннер / наклейки / футболки / полиграфия / сувенирка / другое
  location: null,             // улица / внутри
  size: null,                 // строка с размером (произвольно)
  needs_measurement: false,   // нужны ли замеры на месте
  content: null,              // что должно быть написано/изображено
  design: null,               // "есть макет" / "нужно сделать"
  lighting: null,             // подсветка для вывески
  where_use: null,            // где будет использоваться (баннер)
  shape: null,                // форма (для наклеек)
  material: null,             // материал
  quantity: null,             // количество
  sizes: null,                // S/M/L (для футболок)
  print_type: null,           // печать / вышивка
  paper_type: null,           // тип бумаги (для полиграфии)
  item: null,                 // что именно (для сувенирки)
  deadline: null,             // срок
  budget: null,               // бюджет
  contact: null,              // контакт
  description: null,          // общее описание (для "другое")
  files: [],                  // ссылки на загруженные файлы
  extras: [],                 // upsell/cross-sell: массив id допуслуг (lighting, mount, ...) или меток
};

// Алиасы legacy-имён, которые встречаются в старом extractPartialBrief
// и в SAVE_ORDER_FUNCTION (service_type вместо type).
export const FIELD_ALIASES = {
  service_type: "type",
};

// Каноническое имя ключа: учитывает алиасы.
export function canonicalField(key) {
  return FIELD_ALIASES[key] || key;
}

// Список обязательных полей для финальной валидации брифа.
// type — что вообще нужно; size — хоть какой-то размер;
// deadline — когда; contact — как связаться.
export const REQUIRED_FIELDS = ["type", "size", "deadline", "contact"];

// Поля, которые имеют смысл переносить при смене типа услуги.
export const PORTABLE_FIELDS = [
  "deadline",
  "contact",
  "description",
  "budget",
  "design",
];

// Пустой снапшот заказа (deep clone, чтобы не делиться ссылкой на массив files).
export function makeEmptyOrder() {
  return {
    ...ORDER_SCHEMA,
    files: [],
    extras: [],
  };
}

// Нормализовать legacy-объект (из extractPartialBrief) → формат ORDER_SCHEMA:
// service_type → type, остальные ключи как есть.
export function normalizeToSchema(raw = {}) {
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    const canon = canonicalField(k);
    if (canon in ORDER_SCHEMA || canon === "type") {
      out[canon] = v;
    }
  }
  return out;
}

/**
 * Merge delta в существующий orderData по правилам:
 *  - null/undefined в delta — пропускаем (не затираем)
 *  - files: append (de-dup), всегда массив
 *  - extras: append (de-dup по lower-case строке)
 *  - boolean — обновляется всегда
 *  - более длинная строка в delta побеждает
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
    if (k === "extras" && Array.isArray(v)) {
      const prev = Array.isArray(merged.extras) ? merged.extras : [];
      const seen = new Set(prev.map((x) => String(x).toLowerCase().trim()));
      const append = [];
      for (const e of v) {
        if (e == null) continue;
        const s = String(e).trim();
        if (!s) continue;
        const low = s.toLowerCase();
        if (seen.has(low)) continue;
        seen.add(low);
        append.push(s);
      }
      merged.extras = [...prev, ...append];
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

    if (String(v).length > String(existingVal).length) {
      merged[k] = v;
      continue;
    }
  }
  return merged;
}
