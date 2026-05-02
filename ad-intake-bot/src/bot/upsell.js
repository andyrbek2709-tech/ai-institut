// Карта upsell / cross-sell.
// Предложение мягкое, максимум 3 опции, мультиязычные подписи (ru/kk/en).
// id используется в orderData.extras (массив id).

export const UPSELL_MAP = {
  "вывеска": [
    { id: "lighting",      label: "подсветка",            label_kk: "жарықтандыру",     label_en: "lighting" },
    { id: "mount",         label: "монтаж",               label_kk: "орнату",           label_en: "mounting" },
    { id: "design",        label: "разработка дизайна",   label_kk: "дизайн әзірлеу",   label_en: "design service" },
  ],
  "баннер": [
    { id: "eyelets",       label: "люверсы",              label_kk: "люверстер",        label_en: "eyelets" },
    { id: "reinforcement", label: "усиление краёв",       label_kk: "жиектерді күшейту", label_en: "edge reinforcement" },
  ],
  "наклейки": [
    { id: "lamination",    label: "ламинация",            label_kk: "ламинация",        label_en: "lamination" },
    { id: "cutting",       label: "фигурная вырубка",     label_kk: "фигуралы кесу",    label_en: "die-cut shape" },
  ],
  "футболки": [
    { id: "embroidery",    label: "вышивка",              label_kk: "кесте тігу",       label_en: "embroidery" },
    { id: "packaging",     label: "упаковка",             label_kk: "қаптама",          label_en: "gift packaging" },
  ],
  "полиграфия": [
    { id: "lamination",    label: "ламинация",            label_kk: "ламинация",        label_en: "lamination" },
    { id: "foiling",       label: "тиснение фольгой",     label_kk: "фольга бедерлеу",  label_en: "foil stamping" },
    { id: "spot_uv",       label: "выборочный лак",       label_kk: "таңдамалы лак",    label_en: "spot UV" },
  ],
  "сувенирка": [
    { id: "logo",          label: "нанесение логотипа",   label_kk: "логотип салу",     label_en: "logo print" },
    { id: "gift_pack",     label: "подарочная упаковка",  label_kk: "сыйлық қаптама",   label_en: "gift packaging" },
  ],
};

// Локализованное имя типа услуги в нужной форме (для шаблона "Кстати, к {type} ...").
const SERVICE_NAME_LOCALIZED = {
  "вывеска":    { ru: "вывеске",    kk: "маңдайшаға",     en: "signs" },
  "баннер":     { ru: "баннеру",    kk: "баннерге",       en: "banners" },
  "наклейки":   { ru: "наклейкам",  kk: "жапсырмаларға",  en: "stickers" },
  "футболки":   { ru: "футболкам",  kk: "футболкаларға",  en: "t-shirts" },
  "полиграфия": { ru: "полиграфии", kk: "полиграфияға",   en: "printed materials" },
  "сувенирка":  { ru: "сувенирке",  kk: "кәдесыйға",      en: "branded merch" },
};

// Какие опции предложить (макс 3) для данного service_type.
export function getUpsellOptions(serviceCode, max = 3) {
  const list = UPSELL_MAP[serviceCode] || [];
  return list.slice(0, max);
}

// Локализованная подпись опции.
export function localizedLabel(option, lang = "ru") {
  if (!option) return "";
  if (lang === "kk") return option.label_kk || option.label;
  if (lang === "en") return option.label_en || option.label;
  return option.label;
}

// Локализованное имя сервиса в форме, естественной для фразы.
export function localizedServiceName(serviceCode, lang = "ru") {
  const map = SERVICE_NAME_LOCALIZED[serviceCode];
  if (!map) return serviceCode || "";
  return map[lang] || map.ru;
}

// Готовая мягкая фраза-предложение (используется как fallback и хинт для LLM).
export function buildUpsellPhrase(serviceCode, lang = "ru") {
  const opts = getUpsellOptions(serviceCode);
  if (opts.length === 0) return null;
  const list = opts.map((o) => localizedLabel(o, lang)).join(", ");
  const name = localizedServiceName(serviceCode, lang);
  if (lang === "kk") {
    return `Айтпақшы, ${name} көбіне қосады: ${list}. Осыдан керек нәрсе бар ма?`;
  }
  if (lang === "en") {
    return `By the way, with ${name} people often add: ${list}. Want any of these?`;
  }
  return `Кстати, к ${name} часто ещё добавляют: ${list}. Нужно что-то из этого?`;
}

// Подсчёт заполненных полей сценария (без contact и deadline — это «общие»).
export function countScenarioFieldsFilled(orderData, scenarioSteps) {
  if (!orderData || !Array.isArray(scenarioSteps)) return 0;
  let n = 0;
  for (const step of scenarioSteps) {
    if (step === "contact" || step === "deadline") continue;
    const v = orderData[step];
    if (v == null) continue;
    if (typeof v === "string" && !v.trim()) continue;
    if (typeof v === "boolean" && v === false) continue;
    n++;
  }
  return n;
}

// Должен ли сейчас сработать upsell.
// Условия: serviceCode известен, ещё не показывали, и собрано ≥ minFilled полей сценария
// ЛИБО мы уже на этапе confirm и extras пуст.
export function shouldTriggerUpsell({
  serviceCode,
  orderData,
  upsellShown,
  scenarioSteps,
  currentStep,
  minFilled = 2,
} = {}) {
  if (upsellShown) return false;
  if (!serviceCode) return false;
  if (!UPSELL_MAP[serviceCode]) return false;
  const filled = countScenarioFieldsFilled(orderData, scenarioSteps);
  const hasExtras = Array.isArray(orderData?.extras) && orderData.extras.length > 0;
  if (currentStep === "confirm" && !hasExtras) return true;
  return filled >= minFilled;
}

// Хинт-блок для system prompt (вкладывается в buildSystemPrompt при триггере).
// LLM сам перефразирует под контекст и стиль; фраза-fallback — buildUpsellPhrase.
export function buildUpsellPromptBlock(serviceCode, lang = "ru") {
  const opts = getUpsellOptions(serviceCode);
  if (opts.length === 0) return "";
  const list = opts.map((o) => localizedLabel(o, lang)).join(", ");
  const name = localizedServiceName(serviceCode, lang);
  const phrase = buildUpsellPhrase(serviceCode, lang) || "";
  const headers = {
    ru: "ПРЕДЛОЖИ ДОПОЛНИТЕЛЬНЫЕ УСЛУГИ (один раз, мягко):",
    kk: "ҚОСЫМША ҚЫЗМЕТТЕРДІ ҰСЫН (бір рет, жұмсақ түрде):",
    en: "OFFER ADD-ON SERVICES (once, softly):",
  };
  const body = {
    ru:
      `Сейчас уместно предложить клиенту дополнительные услуги к "${name}": ${list}.\n` +
      `В этой реплике замени обычный следующий вопрос мягким предложением вида:\n` +
      `  "${phrase}"\n` +
      `Не дави, не перечисляй больше 3 опций. Если клиент согласится — он назовёт нужное, ` +
      `система сама запишет это в поле extras. Не задавай других вопросов в этой реплике.`,
    kk:
      `Қазір клиентке "${name}" қызметіне қосымша ұсынған жөн: ${list}.\n` +
      `Осы жауапта әдеттегі келесі сұрақтың орнына жұмсақ ұсыныс жаз:\n` +
      `  "${phrase}"\n` +
      `Мәжбүрлеме, 3-тен көп нұсқа берме. Клиент келіссе — атап өтеді, жүйе extras-қа жазады. ` +
      `Осы жауапта басқа сұрақ қойма.`,
    en:
      `Now is a good time to offer add-ons for "${name}": ${list}.\n` +
      `In this reply, replace the usual next question with a soft offer like:\n` +
      `  "${phrase}"\n` +
      `Don't push, don't list more than 3 options. If the client agrees — they'll name the items, ` +
      `the system will record them in the extras field. Don't ask any other questions in this reply.`,
  };
  return [headers[lang] || headers.ru, body[lang] || body.ru].join("\n");
}
