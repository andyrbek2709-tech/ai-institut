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
