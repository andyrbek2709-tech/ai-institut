import { SERVICE_TYPES, keywordClassify, normalizeServiceType } from "./scenarios.js";
import { makeEmptyOrder, PORTABLE_FIELDS, mergeData, normalizeToSchema } from "./orderSchema.js";

export function emptyIntakeState() {
  return {
    /** @type {string[]} */
    servicesQueue: [],
    /** индекс текущей услуги в очереди */
    idx: 0,
    /** @type {Record<string, object>} слоты услуга → частичный снимок заказа */
    perService: {},
  };
}

/** Нормализует поле intake в записи диалога. */
export function ensureIntake(entry) {
  if (!entry.intake || typeof entry.intake !== "object") entry.intake = emptyIntakeState();
  if (!Array.isArray(entry.intake.servicesQueue)) entry.intake.servicesQueue = [];
  if (typeof entry.intake.idx !== "number" || entry.intake.idx < 0) entry.intake.idx = 0;
  if (!entry.intake.perService || typeof entry.intake.perService !== "object") entry.intake.perService = {};
  return entry.intake;
}

/**
 * JS `\b` не работает с кириллицей — старые регэкспы никогда не матчили «да».
 * Считаем подтверждением только целое сообщение (или фраза + пунктуация/эмодзи),
 * чтобы «да, но визитки 300» не уходило в финализацию.
 */
const AFFIRM_PHRASES = {
  ru: [
    "да",
    "ага",
    "верно",
    "всё верно",
    "все верно",
    "окей",
    "ок",
    "подтверждаю",
    "согласен",
    "согласна",
    "подходит",
    "давай так",
  ],
  kk: ["иә", "жа", "рас", "болады", "рахмет сонда", "келісемін"],
  en: ["yes", "yep", "yeah", "ok", "okay", "sure", "confirmed", "looks good", "correct"],
};

/** Одно общее множество: язык диалога часто один, а клиент подтверждает другим (`lang` ошибочен или смешивает языки). */
const ALL_AFFIRM_PHRASES = [...new Set(Object.values(AFFIRM_PHRASES).flat())].sort(
  (a, b) => b.length - a.length
);

function normalizeAffirmMessage(text) {
  return String(text || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/^[\s👍👌✅]+/gu, "")
    .replace(/[\s.,!?;:…"""''„«»\-—]+$/gu, "")
    .trim();
}

function isAffirmPhraseMatch(t, phrase) {
  if (t === phrase) return true;
  if (!t.startsWith(phrase)) return false;
  const rest = t.slice(phrase.length).trim();
  if (!rest) return true;
  return /^[\s.,!?;:…"""''„«»\-—👍👌✅♥]+$/u.test(rest);
}

/** @param {string} _lang сохранён для совместимости вызовов; список фраз языконезависимый (ru|kk|en). */
export function isAffirmative(_lang, text) {
  const raw = String(text || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
  if (!raw) return false;
  if (/^\+1(?:$|[\s.,!?👍✅])/u.test(raw)) return true;
  const t = normalizeAffirmMessage(text);
  if (!t) return false;
  for (const phrase of ALL_AFFIRM_PHRASES) {
    if (isAffirmPhraseMatch(t, phrase)) return true;
  }
  return false;
}

/** Грубо: несколько услуг из фразы «наклейки и футболки». */
export function extractServicesQueueFromText(text) {
  if (!text || !text.trim()) return [];
  const parts = String(text).split(/\s+(?:и|\+|,)\s+|(?:,)\s*/i).map((x) => x.trim()).filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const chunk of parts) {
    let code = keywordClassify(chunk);
    if (!code) {
      const n = normalizeServiceType(chunk);
      if (n && SERVICE_TYPES.includes(n)) code = n;
    }
    if (code && !seen.has(code)) {
      seen.add(code);
      out.push(code);
    }
  }
  return out.length >= 2 ? out : [];
}

/**
 * Ложный мультисервис: «вводная фраза, баннер» по запятой → ["другое","баннер"].
 * Если фактический тип диалога уже совпадает с единственной конкретной услугой в очереди —
 * сбрасываем очередь, чтобы «да» ушло в обычный finalize одной заявки.
 *
 * @param {{ servicesQueue: string[], idx: number, perService: object }} intake
 * @param {(string|null|undefined)[]} primaryCandidates — curCode, entry.serviceCode, merged.type, …
 * @returns {boolean} true если очередь сброшена
 */
export function tryCollapseSpuriousOtherPlusServiceQueue(intake, primaryCandidates) {
  const q = intake?.servicesQueue;
  if (!Array.isArray(q) || q.length !== 2) return false;
  if (!q.includes("другое")) return false;
  const concrete = q.find((c) => c !== "другое" && SERVICE_TYPES.includes(c));
  if (!concrete || concrete === "другое") return false;
  const prim = (primaryCandidates || [])
    .map((c) => normalizeServiceType(c) || (c && String(c).trim()) || null)
    .find((c) => c && c !== "другое" && SERVICE_TYPES.includes(c));
  if (!prim || prim !== concrete) return false;
  intake.servicesQueue = [];
  intake.idx = 0;
  intake.perService = {};
  return true;
}

/** Сбрасываем поля, специфичные для предыдущей позиции — иначе объём/размер «прилипают» к следующей услуге. */
const SERVICE_SLOT_RESET_KEYS = [
  "size",
  "sizes",
  "quantity",
  "content",
  "lighting",
  "where_use",
  "shape",
  "material",
  "print_type",
  "paper_type",
  "item",
  "needs_measurement",
];

export function resetServiceSlotFields(order) {
  const o = order && typeof order === "object" ? { ...order } : makeEmptyOrder();
  for (const k of SERVICE_SLOT_RESET_KEYS) {
    if (k === "needs_measurement") o[k] = false;
    else o[k] = null;
  }
  o.extras = [];
  return o;
}

/** Перенос между услугами: дедлайн, контакт, общее описание, бюджет, макет, файлы. */
export function orderCarryForward(prevOrder) {
  const base = makeEmptyOrder();
  if (!prevOrder || typeof prevOrder !== "object") return base;
  for (const f of PORTABLE_FIELDS) {
    const v = prevOrder[f];
    if (v != null && (typeof v !== "string" || v.trim())) base[f] = v;
  }
  if (Array.isArray(prevOrder.files) && prevOrder.files.length) {
    base.files = [...prevOrder.files];
  }
  return base;
}

/** Объединяет args LLM и orderData для снимка по текущей услуге. */
export function snapshotForService(orderData, args) {
  const normArgs = normalizeToSchema(args || {});
  return mergeData(mergeData(makeEmptyOrder(), orderData || makeEmptyOrder()), normArgs);
}

/** Текст брифа для клиента перед подтверждением (одна или несколько услуг). */
export function formatClientBrief(lang, payloads) {
  const list = Array.isArray(payloads) ? payloads : [payloads];
  const hdr = {
    ru: "📋 Проверьте заявку:",
    kk: "📋 Өтінімді тексеріңіз:",
    en: "📋 Please confirm your request:",
  }[lang] || "📋 Проверьте заявку:";
  const lines = [hdr, ""];
  let i = 0;
  for (const od of list) {
    i += 1;
    const title = list.length > 1 ? `#${i} ` : "";
    lines.push(`${title}${od.type || od.service_type || "—"}`.trim());
    if (od.description) lines.push(`📝 ${od.description}`);
    if (od.content) lines.push(`🎯 ${od.content}`);
    if (od.size) lines.push(`📐 ${od.size}`);
    if (od.quantity) lines.push(`🔢 ${od.quantity}`);
    if (od.deadline) lines.push(`📅 ${od.deadline}`);
    if (od.contact) lines.push(`📞 ${od.contact}`);
    if (od.budget) lines.push(`💰 ${od.budget}`);
    lines.push("");
  }
  const footer = {
    ru: 'Если всё так — напишите «да». Если что-то не так — поправьте одним сообщением.',
    kk: 'Дұрыс болса — «иә» жазыңыз. Түзету болса — бір хабарлама менен жазыңыз.',
    en: 'If everything is correct — reply «yes». If not — fix it in one message.',
  }[lang] || 'Если всё так — напишите «да».';
  lines.push(footer);
  return lines.join("\n").trim();
}
