import {
  chat,
  detectLang,
  describeImage,
  classifyImageForIntake,
  extractPartialBrief,
  classifyServiceTypeLLM,
  extractData,
  mergeData,
  missingRequiredFields,
  assistManagerReply,
  extractTeachStructured,
  generateProposal,
  estimatePriceHint,
} from "../services/openai.js";
import { transcribeVoice } from "../services/whisper.js";
import {
  upsertConversation,
  completeConversation,
  saveOrder,
  getOrderById,
  updateOrderStatus,
  getOrdersByStatus,
  getOrdersToday,
  getAnalyticsSnapshot,
  getActiveConversationByChatId,
} from "../services/supabase.js";
import {
  createLead,
  getLeadById,
  updateLead,
  getLeadsByStatus,
  getLeadsByTier,
  getLeadsSummary,
  getConversationHistoryForLead,
  appendConversationMessage,
  calcLeadScore,
  scoreBadge,
} from "../services/leads.js";
import {
  getContext,
  setContext,
  clearContext,
  addFile,
  setLang,
  consumeFlag,
  setAssistDraft,
  getAssistDraft,
  deleteAssistDraft,
  setProposalDraft,
  getProposalDraft,
  deleteProposalDraft,
  setManagerState,
  getManagerState,
  clearManagerState,
} from "../utils/state.js";
import {
  addKnowledge,
  listKnowledge,
  deleteKnowledge,
  getKnowledgeById,
  searchKnowledge,
  KB_CATEGORIES,
} from "../services/knowledgeBase.js";
import { getLangMeta, CONTACT_REASK } from "./prompts.js";
import {
  keywordClassify,
  normalizeServiceType,
  carryOverFields,
  nextStepFor,
  SCENARIOS,
} from "./scenarios.js";
import { getQuestion } from "./questions.js";
import {
  makeEmptyOrder,
  normalizeToSchema,
  REQUIRED_FIELDS,
} from "./orderSchema.js";
import { buildKnowledgeContext } from "./promptContext.js";
import { shouldTriggerUpsell, buildUpsellPromptBlock, UPSELL_MAP } from "./upsell.js";
import { getManagerChatId } from "../config/tenants.js";
import { exportLeadToAllIntegrations } from "../services/crmExport.js";
import { extractTextFromPdfBuffer } from "../services/fileExtract.js";
import { ORDER_TEMPLATES, getTemplateById } from "./templatesCatalog.js";
import { isManagerUserId, hasManagerUserAllowlist } from "../config/roles.js";
import {
  setManagerReplyMode,
  getManagerReplyMode,
  clearManagerReplyMode,
} from "../utils/managerRelay.js";
import {
  ensureIntake,
  extractServicesQueueFromText,
  orderCarryForward,
  resetServiceSlotFields,
  snapshotForService,
  formatClientBrief,
  isAffirmative,
} from "./intakeHelpers.js";

let _bot = null;

/** Доступ к менеджерским slash-командам. */
function managerCommandAllowed(ctx) {
  const fromId = ctx.from?.id;
  if (fromId == null) return false;
  if (hasManagerUserAllowlist()) return isManagerUserId(fromId);
  return String(ctx.chat?.id) === getManagerChatId();
}

// In-memory state для clarify-flow: ждём ответа менеджера на ForceReply.
// key = managerChatId (string), value = { leadId, promptMessageId }
const pendingClarify = new Map();

// In-memory state для proposal-flow: менеджер жмёт «✏️ Изменить» у КП —
// перехватываем его следующее сообщение (reply на ForceReply).
// key = managerChatId (string), value = { leadId, promptMessageId }
const pendingProposalEdit = new Map();

export function registerHandlers(bot) {
  _bot = bot;

  bot.start(handleStart);

  // Manager-only commands (по whitelist user id или legacy: канал группы менеджеров).
  const ownerOnly = (fn) => async (ctx) => {
    if (!managerCommandAllowed(ctx)) return;
    return fn(ctx);
  };
  bot.command("new", ownerOnly((ctx) => handleOwnerList(ctx, "new", "🆕 Новые заявки")));
  bot.command("active", ownerOnly((ctx) => handleOwnerList(ctx, "in_progress", "🔄 В работе")));
  bot.command("today", ownerOnly(handleOwnerToday));
  bot.command("leads", ownerOnly(handleLeadsCommand));
  bot.command("reply", ownerOnly(handleReplyCommand));
  bot.command("assist", ownerOnly(handleAssistCommand));
  bot.command("proposal", ownerOnly(handleProposalCommand));
  bot.command("stats", ownerOnly(handleOwnerStats));
  bot.command("templates", handleTemplatesCommand);
  bot.command("teach", ownerOnly(handleTeachCommand));
  bot.command("knowledge", ownerOnly(handleKnowledgeCommand));
  bot.command("help", handleHelp);
  bot.command("reset", handleReset);

  bot.on("text", handleText);
  bot.on("voice", handleVoice);
  bot.on("audio", handleVoice);
  bot.on("photo", handleFile);
  bot.on("document", handleFile);
  bot.on("callback_query", handleCallback);
}

function isManagerOperationsChat(ctx) {
  return String(ctx.chat?.id) === getManagerChatId();
}

function isClientPrivateChat(ctx) {
  return ctx.chat?.type === "private";
}

function intakeMetadata(entry) {
  if (!entry) return {};
  const intake = ensureIntake(entry);
  return {
    order: entry.orderData || null,
    service_code: entry.serviceCode || null,
    intake_state: {
      servicesQueue: intake.servicesQueue,
      idx: intake.idx,
      perService: intake.perService,
    },
    pending_finalize: entry.pendingFinalize || null,
  };
}

async function hydrateClientContextFromDb(chatId) {
  try {
    const conv = await getActiveConversationByChatId(chatId);
    if (!conv || !Array.isArray(conv.history) || conv.history.length === 0) return null;
    const meta = conv.metadata || {};
    const row = {
      messages: [...conv.history],
      files: conv.files || [],
      lang: conv.lang || null,
      flagShown: true,
      serviceCode: meta.service_code || null,
      orderData: makeEmptyOrder(),
      upsellShown: false,
      pendingFinalize: meta.pending_finalize || null,
    };
    if (meta.order && typeof meta.order === "object") {
      row.orderData = mergeData(makeEmptyOrder(), meta.order);
    }
    ensureIntake(row);
    if (meta.intake_state && typeof meta.intake_state === "object") {
      if (Array.isArray(meta.intake_state.servicesQueue))
        row.intake.servicesQueue = meta.intake_state.servicesQueue;
      if (Number.isInteger(meta.intake_state.idx)) row.intake.idx = meta.intake_state.idx;
      if (meta.intake_state.perService && typeof meta.intake_state.perService === "object")
        row.intake.perService = { ...meta.intake_state.perService };
    }
    if (meta.service_code) row.serviceCode = meta.service_code;
    setContext(chatId, row);
    return row;
  } catch (e) {
    console.error("[hydrate]", e.message);
    return null;
  }
}

/**
 * Режим relay: одно сообщение менеджера → клиенту (копия медиа как есть).
 */
async function tryManagerRelayForward(ctx) {
  const rel = getManagerReplyMode(ctx.from.id);
  if (!rel || !managerCommandAllowed(ctx)) return false;
  try {
    const lead = await getLeadById(rel.leadId);
    if (!lead?.telegram_chat_id) {
      await ctx.reply(`Лид #${rel.leadId} не найден или без chat_id клиента.`);
      clearManagerReplyMode(ctx.from.id);
      return true;
    }
    const to = String(lead.telegram_chat_id);
    const mid = ctx.message?.message_id;
    if (mid) {
      await ctx.telegram.copyMessage(to, ctx.chat.id, mid);
    }
    if (lead.conversation_id && ctx.message?.text) {
      await appendConversationMessage(lead.conversation_id, "manager", ctx.message.text);
    }
    if (lead.status === "new") {
      await updateLead(rel.leadId, { status: "in_progress", assigned_to: Number(ctx.from.id) });
    }
    clearManagerReplyMode(ctx.from.id);
    await ctx.reply(`✓ Сообщение передано клиенту (лид #${rel.leadId}).`);
  } catch (e) {
    console.error("[relay]", e.message);
    await ctx.reply(`Не удалось переслать: ${e.message}`);
    clearManagerReplyMode(ctx.from.id);
  }
  return true;
}

// ─── /start, /help, /reset ───────────────────────────────────────────────────

export async function handleStart(ctx) {
  const chat = ctx.chat;
  if ((chat?.type === "group" || chat?.type === "supergroup") && isManagerOperationsChat(ctx)) {
    if (managerCommandAllowed(ctx)) await ctx.reply("Команды менеджера: /leads, /stats, /reply …");
    return;
  }
  if (chat?.type === "private" && managerCommandAllowed(ctx) && hasManagerUserAllowlist()) {
    await ctx.reply("Вы в списке менеджеров: intake тут отключён. Используйте /leads, /stats в рабочем чате или сюда те же команды.");
    return;
  }

  try {
    const restored = await hydrateClientContextFromDb(chat.id);
    if (
      restored &&
      Array.isArray(restored.messages) &&
      restored.messages.length >= 2 &&
      !restored.pendingFinalize
    ) {
      await ctx.reply(
        "У вас уже есть незавершённый заказ — продолжим с того же места.\n" +
          "Если нужно начать с чистого листа — отправьте /reset.\n\n" +
          "Коротко допишите или уточните, что нужно."
      );
      return;
    }
  } catch { /* ignore */ }

  clearContext(ctx.chat.id);
  await ctx.reply(
    "👋 Сәлеметсіз бе!\n" +
      "Қалаған тіліңізде жаза беріңіз — сол тілде жауап беремін.\n" +
      "Жарнамаға тапсырыс беруге көмектесемін. Не керек екенін айтыңыз — мәтінмен, дауыспен немесе макетті/фотоны жіберіңіз.\n\n" +
      "—\n\n" +
      "👋 Здравствуйте!\n" +
      "Пишите на любом удобном языке — отвечу на нём же.\n" +
      "Помогу оформить заказ на рекламу — текстом, голосом или с макетом/фото.\n\n" +
      "Шаблоны: /templates"
  );
}

async function handleHelp(ctx) {
  const mgr = isManagerOperationsChat(ctx) || (isClientPrivateChat(ctx) && managerCommandAllowed(ctx) && hasManagerUserAllowlist());
  const lines = [
    "📖 Команды",
    "",
    "/start — начать новый заказ",
    "/reset — сбросить текущий диалог",
    "/help — помощь",
    "/templates — шаблоны типовых заказов (кнопки)",
    "",
    "Можно писать текстом, наговаривать голосом или присылать макеты (в т.ч. PDF — бот вытащит текст, если он в слое).",
  ];
  if (mgr) {
    lines.push("", "Менеджер: /stats — сводка по диалогам и заказам в БД.");
  }
  await ctx.reply(lines.join("\n"));
}

async function handleReset(ctx) {
  clearContext(ctx.chat.id);
  clearManagerReplyMode(ctx.from.id);
  if (String(ctx.chat?.id) === getManagerChatId()) clearManagerState(ctx.chat.id);
  if (isClientPrivateChat(ctx))
    upsertConversation({
      telegramUserId: ctx.from.id,
      telegramChatId: ctx.chat.id,
      history: [],
      files: [],
      lang: null,
      status: "active",
      metadata: { order: null, intake_state: { servicesQueue: [], idx: 0, perService: {} }, pending_finalize: null },
    }).catch(() => {});
  await ctx.reply("Окей, начнём заново. Расскажите, что нужно сделать — можно сразу несколько позиций через «и».");
}

// ─── Text / Voice / Files ────────────────────────────────────────────────────

async function maybeResolvePendingBrief(ctx, userMessage) {
  if (!isClientPrivateChat(ctx)) return false;

  let entry = getContext(ctx.chat.id);
  if (!entry) {
    await hydrateClientContextFromDb(ctx.chat.id).catch(() => {});
    entry = getContext(ctx.chat.id);
  }
  const pf = entry?.pendingFinalize;
  if (!pf || typeof pf !== "object") return false;

  const lang = entry.lang || "ru";

  if (!isAffirmative(lang, userMessage)) {
    entry.pendingFinalize = null;
    setContext(ctx.chat.id, entry);
    upsertConversation({
      telegramUserId: ctx.from.id,
      telegramChatId: ctx.chat.id,
      history: entry.messages,
      files: entry.files,
      lang,
      status: "active",
      metadata: intakeMetadata(entry),
      lastUserMessageAt: new Date().toISOString(),
    }).catch(() => {});
    return false;
  }

  entry.messages = [...(entry.messages || []), { role: "user", content: userMessage }];
  entry.pendingFinalize = null;
  setContext(ctx.chat.id, entry);
  await finalizeOrder(ctx, entry, pf.args || {}, pf.finalizeOpts || {});
  return true;
}

export async function handleText(ctx) {
  const userMessage = ctx.message.text?.trim();
  if (!userMessage) return;

  const chat = ctx.chat;
  const inMgrGroup =
    (chat?.type === "group" || chat?.type === "supergroup") && isManagerOperationsChat(ctx);

  if (inMgrGroup) {
    if (await maybeHandleManagerTeachInput(ctx, userMessage)) return;
    const pc = pendingClarify.get(getManagerChatId());
    const replyToId = ctx.message?.reply_to_message?.message_id;
    if (pc && replyToId && replyToId === pc.promptMessageId) {
      pendingClarify.delete(getManagerChatId());
      await sendManagerReplyToClient(ctx, pc.leadId, userMessage);
      return;
    }
    const pe = pendingProposalEdit.get(getManagerChatId());
    const replyToId2 = ctx.message?.reply_to_message?.message_id;
    if (pe && replyToId2 && replyToId2 === pe.promptMessageId) {
      pendingProposalEdit.delete(getManagerChatId());
      await sendManagerProposalToClient(ctx, pe.leadId, userMessage);
      return;
    }
    if (await tryManagerRelayForward(ctx)) return;
    return;
  }

  if (isClientPrivateChat(ctx) && managerCommandAllowed(ctx) && hasManagerUserAllowlist()) {
    if (await maybeHandleManagerTeachInput(ctx, userMessage)) return;
    if (await tryManagerRelayForward(ctx)) return;
    await ctx.reply(
      "Вы менеджер — сбор заказов в этом чате отключён. После «Уточнить» пришлите одно сообщение для клиента, либо /leads, /reply …"
    );
    return;
  }

  if (await maybeHandleManagerTeachInput(ctx, userMessage)) return;

  if (!getContext(ctx.chat.id)) await hydrateClientContextFromDb(ctx.chat.id).catch(() => {});

  if (await maybeResolvePendingBrief(ctx, userMessage)) return;

  await processUserMessage(ctx, userMessage);
}

export async function handleVoice(ctx) {
  try {
    const chat = ctx.chat;
    const inMgrGroup =
      (chat?.type === "group" || chat?.type === "supergroup") && isManagerOperationsChat(ctx);
    const privMgr =
      isClientPrivateChat(ctx) && managerCommandAllowed(ctx) && hasManagerUserAllowlist();

    if (inMgrGroup || privMgr) {
      if (await tryManagerRelayForward(ctx)) return;
    }

    await ctx.sendChatAction("typing");
    const existing = getContext(ctx.chat.id);
    const text = await transcribeVoice(ctx, existing?.lang);
    if (!text) {
      await ctx.reply("Не получилось распознать голос, попробуйте ещё раз или напишите текстом.");
      return;
    }

    if (inMgrGroup) {
      if (await maybeHandleManagerTeachInput(ctx, text)) return;
      return;
    }

    if (privMgr) {
      if (await maybeHandleManagerTeachInput(ctx, text)) return;
      await ctx.reply("Здесь голосом заявки не собираем — /leads или /reply как текстом.");
      return;
    }

    if (!getContext(ctx.chat.id)) await hydrateClientContextFromDb(ctx.chat.id).catch(() => {});

    if (await maybeResolvePendingBrief(ctx, text)) return;

    await processUserMessage(ctx, text);
  } catch (err) {
    console.error("Voice error:", err.message);
    await ctx.reply("Не получилось обработать голос. Напишите текстом, пожалуйста.");
  }
}

export async function handleFile(ctx) {
  try {
    const chat = ctx.chat;
    const inMgrGroup =
      (chat?.type === "group" || chat?.type === "supergroup") && isManagerOperationsChat(ctx);
    const privMgr =
      isClientPrivateChat(ctx) && managerCommandAllowed(ctx) && hasManagerUserAllowlist();

    if (inMgrGroup || privMgr) {
      if (await tryManagerRelayForward(ctx)) return;
    }
    if (inMgrGroup) return;
    if (privMgr) {
      await ctx.reply("Файлы к заявке не через этот чат — операторский канал используйте «Уточнить» или /reply.");
      return;
    }

    if (!getContext(ctx.chat.id)) await hydrateClientContextFromDb(ctx.chat.id).catch(() => {});

    let fileId, label, isImage = false, mime = null;
    if (ctx.message.photo) {
      const photos = ctx.message.photo;
      fileId = photos[photos.length - 1].file_id;
      label = "фото";
      isImage = true;
      mime = "image/jpeg";
    } else if (ctx.message.document) {
      fileId = ctx.message.document.file_id;
      label = ctx.message.document.file_name || "документ";
      mime = ctx.message.document.mime_type || null;
      if (mime && mime.startsWith("image/")) isImage = true;
    } else {
      return;
    }

    const link = await ctx.telegram.getFileLink(fileId);
    addFile(ctx.chat.id, link.href);

    const caption = ctx.message.caption?.trim();
    let existing = getContext(ctx.chat.id);
    let lang = existing?.lang || "ru";

    const lowerName = (label || "").toLowerCase();
    const mimeStr = (mime || "").toLowerCase();
    const isPdf = mimeStr === "application/pdf" || lowerName.endsWith(".pdf");
    const isPsdAi =
      /\.(psd|ai|eps)$/i.test(lowerName) ||
      mimeStr.includes("postscript") ||
      mimeStr === "image/vnd.adobe.photoshop";

    let pdfText = "";
    if (ctx.message.document && isPdf && !isImage) {
      try {
        await ctx.sendChatAction("typing");
        const resp = await fetch(link.href);
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          pdfText = await extractTextFromPdfBuffer(buf);
        }
      } catch (err) {
        console.error("PDF extract:", err.message);
      }
    }

    // Подмешиваем файл в формальный orderData: files += url;
    // design = "есть макет" если ещё не задан явно.
    if (existing) {
      const cur = existing.orderData || makeEmptyOrder();
      const fileDelta = { files: [link.href] };
      if (!cur.design) fileDelta.design = "есть макет";
      existing.orderData = mergeData(cur, fileDelta);
      setContext(ctx.chat.id, existing);
      console.log(`[orderData/file] chat=${ctx.chat.id} files=${existing.orderData.files.length} design=${existing.orderData.design}`);
    }

    let vision = null;
    let imageIntent = "";
    if (isImage) {
      try {
        await ctx.sendChatAction("typing");
        const dataUrl = await fetchAsDataUrl(link.href, mime || "image/jpeg");

        try {
          const cls = await classifyImageForIntake(dataUrl, lang);
          const kind = cls?.kind || "unclear";
          imageIntent = ` | image_kind: "${kind}"`;
          if (kind === "casual_photo") {
            const casualMsg = {
              ru: "Похоже на обычное фото, не чертёж. Хотите опереться на него как на референс или лучше прислать отдельно логотип/готовый макет?",
              kk: "Кәделігі фото сияқты көрінеді. Оны негіз ретінде пайдаланамыз ба әлде логотип/макетті бөлек жіберіп тұрған жөн бе?",
              en: "This looks like a casual photo rather than artwork. Want to use it as a loose reference—or send a proper logo/mockup?",
            };
            await ctx.reply(casualMsg[lang] || casualMsg.ru).catch(() => {});
          }
        } catch (e) {
          console.warn("[cls image]", e.message);
        }

        vision = await describeImage(dataUrl, lang);
      } catch (err) {
        console.error("Vision fetch/describe error:", err.message);
      }
    }

    const visionPart = vision ? ` | vision: "${vision.replace(/"/g, "'")}"` : "";
    let pdfPart = "";
    if (pdfText) {
      pdfPart = ` | pdf_excerpt: "${pdfText.slice(0, 4000).replace(/"/g, "'")}"`;
    } else if (isPdf && !isImage) {
      pdfPart = ` | pdf_text_empty: yes (скан или графический PDF без слоя текста)`;
      await ctx
        .reply(
          "Этот PDF без текстового слоя (часто так у сканов). Если можно — пара строк текстом или фото того, что напечатать."
        )
        .catch(() => {});
    } else if (isPsdAi) {
      pdfPart = " | note: \"PSD/AI/EPS — автоматический разбор недоступен; файл в заявке\"";
    }
    const systemNote =
      `[файл прикреплён: ${link.href}${visionPart}${imageIntent}${pdfPart}` +
      (caption ? ` | подпись: ${caption}` : "");

    const message = caption ? `${caption}\n\n${systemNote}` : systemNote;
    const ack = {
      ru: label === "фото" ? "Увидела картинку, учитываю её в описании заказа." : "Файл получила, уже в вашей заявке.",
      kk: label === "фото" ? "Суретті көрдім, тапсырыста ескере аламын." : "Файл қабылдадым.",
      en: label === "фото" ? "Got the image — I’ll fold it into the brief." : "File received and attached.",
    };
    await ctx.reply(ack[lang] || ack.ru);
    await processUserMessage(ctx, message);
  } catch (err) {
    console.error("File error:", err.message);
    await ctx.reply("Не получилось загрузить файл. Попробуйте ещё раз 🙏");
  }
}

async function fetchAsDataUrl(url, mime = "image/jpeg") {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  return `data:${mime};base64,${buf.toString("base64")}`;
}

// ─── Service-type classifier (kw match → LLM fallback) ───────────────────────

async function resolveServiceCode({ collected, allMessagesText }) {
  // 1) Если LLM уже извлёк service_type — нормализуем по ключевым словам.
  if (collected && collected.service_type) {
    const k = keywordClassify(collected.service_type) || normalizeServiceType(collected.service_type);
    if (k) return k;
  }
  // 2) Keyword-match на полном тексте диалога (быстро, бесплатно).
  const kw = keywordClassify(allMessagesText);
  if (kw) return kw;
  // 3) LLM fallback (gpt-4o-mini, дёшево). Может вернуть null — тогда останется не определён.
  try {
    const llm = await classifyServiceTypeLLM(allMessagesText);
    if (llm) return llm;
  } catch (err) {
    console.error("classifyServiceTypeLLM threw:", err.message);
  }
  return null;
}

// ─── Reply helpers ───────────────────────────────────────────────────────────

function splitReply(text) {
  if (!text) return [];
  const idx = text.indexOf("||");
  if (idx === -1) return [text.trim()];
  const reaction = text.substring(0, idx).trim();
  const main = text.substring(idx + 2).trim();
  if (!reaction) return [main];
  if (!main) return [reaction];
  return [reaction, main];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isValidContact(contact) {
  if (!contact) return false;
  const c = String(contact).trim();
  if (c.length < 5) return false;
  return /\d/.test(c) || c.includes("@") || c.includes(".");
}

function isPlaceholderContact(contact) {
  if (!contact) return false;
  const c = String(contact).toLowerCase().trim();
  return /^(этот|тут|здесь|сюда|telegram|тг|телег|осында|осы жерде|here|in telegram|telegram-да)\b/.test(c)
      || c === "telegram"
      || c === "telegram-да"
      || c === "осы telegram"
      || c === "this telegram";
}

// ─── Core LLM loop ───────────────────────────────────────────────────────────

async function processUserMessage(ctx, userMessage) {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;

  let entry = getContext(chatId) || {
    messages: [],
    files: [],
    lang: null,
    flagShown: false,
    serviceCode: null,
    orderData: makeEmptyOrder(),
    upsellShown: false,
  };
  if (!entry.orderData) entry.orderData = makeEmptyOrder();
  if (typeof entry.upsellShown !== "boolean") entry.upsellShown = false;
  entry.messages = [...entry.messages, { role: "user", content: userMessage }];

  const intake = ensureIntake(entry);
  const nonFileUserMsgs = entry.messages.filter(
    (m) => m.role === "user" && !String(m.content || "").startsWith("[файл прикреплён:")
  ).length;
  if (nonFileUserMsgs <= 3 && intake.servicesQueue.length === 0 && !entry.pendingFinalize) {
    const rawQ = extractServicesQueueFromText(userMessage.replace(/\[файл прикреплён:[\s\S]*/gi, ""));
    if (rawQ.length >= 2) {
      intake.servicesQueue = rawQ;
      intake.idx = 0;
      intake.perService = {};
      entry.serviceCode = rawQ[0];
      entry.orderData.type = rawQ[0];
    }
  }

  // Detect language
  const isFileNote = /^\[файл прикреплён:/.test(userMessage);
  let lang = entry.lang;
  if (!isFileNote) {
    try {
      const detected = await detectLang(userMessage);
      if (!entry.lang || entry.lang !== detected) {
        entry.lang = detected;
        entry.flagShown = false;
      }
      lang = entry.lang;
    } catch (err) {
      console.error("detectLang error:", err.message);
    }
  }
  if (!lang) lang = "ru";
  entry.lang = lang;
  setContext(chatId, entry);
  setLang(chatId, lang);

  try {
    await ctx.sendChatAction("typing");

    // ─── Extract partial brief + classify service type ─────────────────────
    let collected = {};
    let currentStep = null;
    let currentQuestion = null;
    let serviceCode = entry.serviceCode || null;

    if (entry.messages.length >= 2) {
      try {
        collected = await extractPartialBrief(entry.messages);
      } catch (err) {
        console.error("extractPartialBrief threw:", err.message);
      }
      // Если есть прикреплённые файлы — design = "есть макет".
      if ((entry.files || []).length > 0 && !collected.design) {
        collected.design = "есть макет";
      }

      // ─── Formal structured extraction (extractData → mergeData) ─────
      console.log(`[processUserMessage] chat=${chatId} userMessage=`, JSON.stringify(String(userMessage).slice(0, 200)));
      try {
        const delta = await extractData(userMessage, entry.orderData, lang);
        const before = entry.orderData;
        entry.orderData = mergeData(entry.orderData, delta);
        console.log(`[orderData] chat=${chatId} merged=`, JSON.stringify(entry.orderData));
        // Подмешиваем legacy-collected (LLM-вызов выше) — нормализуем и сольём.
        const collectedNormalized = normalizeToSchema(collected);
        entry.orderData = mergeData(entry.orderData, collectedNormalized);
      } catch (err) {
        console.error("extractData/mergeData failed:", err.message);
      }

      // Classify / re-classify
      const userText = entry.messages
        .filter((m) => m.role === "user")
        .map((m) => m.content || "")
        .join(" ")
        .slice(0, 4000);
      const newCode = await resolveServiceCode({ collected, allMessagesText: userText });

      if (newCode && newCode !== serviceCode) {
        if (serviceCode) {
          // Сменился тип — переносим общие поля, остальное обнуляем (LLM соберёт заново).
          const carry = carryOverFields(collected);
          collected = { ...carry };
        }
        serviceCode = newCode;
      }
      entry.serviceCode = serviceCode;
      if (intake.servicesQueue.length) {
        const forced = intake.servicesQueue[intake.idx];
        if (forced) {
          serviceCode = forced;
          entry.serviceCode = forced;
        }
      }

      // Перезатираем service_type в collected на нормализованный код,
      // чтобы UI/save_order писали единообразно ("вывеска" / "баннер" / ...).
      if (serviceCode) collected.service_type = serviceCode;

      currentStep = nextStepFor(collected, serviceCode);
      currentQuestion = getQuestion(lang, currentStep);
    }

    setContext(chatId, entry);

    const lastMsgs = entry.messages.slice(-10);

    // RAG-lite: подмешиваем релевантные записи knowledge_base в system prompt.
    // Дёшево: один Supabase-запрос (full-text + tags fallback). Если 0 — "" и flow без изменений.
    let knowledgeContext = "";
    try {
      knowledgeContext = await buildKnowledgeContext({
        lastUserMessage: userMessage,
        orderData: entry.orderData,
        lang,
      });
      if (knowledgeContext) {
        console.log(
          `[knowledgeContext] chat=${chatId} added ${knowledgeContext.split("\n").length} lines`
        );
      }
    } catch (err) {
      console.error("buildKnowledgeContext failed:", err.message);
    }

    // ─── Upsell / cross-sell trigger ────────────────────────────
    // Один раз за диалог, после того как тип услуги определён и
    // собрано минимум 2 поля сценария — мягко предлагаем доп.услуги.
    let upsellPromptBlock = "";
    let upsellAboutToShow = false;
    try {
      const scenarioSteps = serviceCode ? (SCENARIOS[serviceCode] || []) : [];
      upsellAboutToShow = shouldTriggerUpsell({
        serviceCode,
        orderData: entry.orderData,
        upsellShown: entry.upsellShown,
        scenarioSteps,
        currentStep,
      });
      if (upsellAboutToShow) {
        upsellPromptBlock = buildUpsellPromptBlock(serviceCode, lang) || "";
        console.log(`[upsell] chat=${chatId} trigger service=${serviceCode} step=${currentStep}`);
      }
    } catch (err) {
      console.error("upsell trigger failed:", err.message);
    }

    const result = await chat(lastMsgs, lang, {
      collected,
      currentStep,
      serviceCode,
      currentQuestion,
      knowledgeContext,
      upsellPromptBlock,
    });

    if (result.type === "function") {
      if (result.args && serviceCode) {
        const norm = normalizeServiceType(result.args.service_type) || serviceCode;
        result.args.service_type = norm;
      }
      const stopped = await interceptSaveOrderIntent(
        ctx,
        entry,
        chatId,
        userId,
        lang,
        result.args || {},
        serviceCode
      );
      if (stopped) return;
    }

    let reply = result.content || "...";

    // Если в этой реплике мы попросили LLM произнести upsell — фиксируем флаг.
    if (upsellAboutToShow) {
      entry.upsellShown = true;
    }

    const meta = getLangMeta(lang);
    const flagShown = consumeFlag(chatId);

    const parts = splitReply(reply);

    entry.messages = [...entry.messages, { role: "assistant", content: parts.join(" ") }];
    setContext(chatId, entry);

    upsertConversation({
      telegramUserId: userId,
      telegramChatId: chatId,
      history: entry.messages,
      files: entry.files,
      lang,
      status: "active",
      metadata: intakeMetadata(entry),
      lastUserMessageAt: new Date().toISOString(),
    }).catch((err) => console.error("Conversation upsert failed:", err.message));

    if (parts.length === 2) {
      const first = parts[0];
      await ctx.reply(first);
      await sleep(420);
      await ctx.sendChatAction("typing").catch(() => {});
      await sleep(80);
      await ctx.reply(parts[1]);
    } else {
      const single = parts[0];
      await ctx.reply(single);
    }
  } catch (err) {
    console.error("LLM error:", err.message);
    await ctx.reply("Что-то пошло не так на моей стороне. Попробуйте ещё раз через минуту 🙏");
  }
}

// ─── Finalize ────────────────────────────────────────────────────────────────

function buildTelegramFallbackContact(ctx) {
  const u = ctx.from?.username;
  if (u) return `@${u}`;
  const id = ctx.from?.id;
  if (id) return `tg://user?id=${id}`;
  return null;
}

/** Аргументы save_order после объединения нескольких услуг. */
function buildComboArgsFromSnapshots(toolArgs, snapshots) {
  if (!snapshots?.length) return { ...(toolArgs || {}) };
  const primary = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const multi = snapshots.length > 1;
  return {
    ...primary,
    ...(toolArgs || {}),
    service_type: multi ? "другое" : primary.service_type || primary.type || toolArgs?.service_type,
    description: multi
      ? snapshots
          .map(
            (s) =>
              `${s.service_type || s.type || "—"}: ${s.description || s.content || "—"}`.trim()
          )
          .join(" · ")
      : toolArgs?.description || primary.description || primary.content,
    deadline: last.deadline || toolArgs?.deadline || primary.deadline,
    contact: last.contact || toolArgs?.contact || primary.contact,
    multi_services: snapshots,
  };
}

function mergeSnapshotsOrderData(snaps) {
  if (!snaps?.length) return makeEmptyOrder();
  let acc = makeEmptyOrder();
  for (const s of snaps) {
    acc = mergeData(acc, mergeData(makeEmptyOrder(), normalizeToSchema(s)));
  }
  acc.multi_services = snaps;
  acc.description = snaps
    .map((s) => `${s.service_type || s.type}: ${s.description || s.content || ""}`.trim())
    .join(" · ");
  acc.type =
    snaps.length > 1 ? "другое" : (snaps[0].service_type || snaps[0].type || acc.type);
  return acc;
}

/** Для валидации перед сохранением: берём обязательные поля с любой позиции мультизаказа. */
function crossFieldsForMultiFinalize(snaps, od, args) {
  const pick = (getter) => {
    for (let i = snaps.length - 1; i >= 0; i--) {
      const v = getter(snaps[i]);
      if (v != null && String(v).trim()) return v;
    }
    return null;
  };
  return {
    type: od.type || args.service_type || (snaps.length > 1 ? "другое" : pick((s) => s.type || s.service_type)),
    size: od.size || args.size || pick((s) => s.size),
    deadline: od.deadline || args.deadline || pick((s) => s.deadline),
    contact: od.contact || args.contact || pick((s) => s.contact),
  };
}

/**
 * После вызова save_order у LLM: валидация, мультислоты, показ финального брифа клиенту (без лида до «да»).
 */
async function interceptSaveOrderIntent(
  ctx,
  entry,
  chatId,
  userId,
  lang,
  rawArgs,
  serviceCodeFromCtx
) {
  const intake = ensureIntake(entry);
  const args = { ...(rawArgs || {}) };

  if (serviceCodeFromCtx) {
    args.service_type = normalizeServiceType(args.service_type) || serviceCodeFromCtx;
  }

  const mergedFlat = snapshotForService(entry.orderData, args);
  const curCode =
    normalizeServiceType(args.service_type) || entry.serviceCode || mergedFlat.type || "другое";

  const merged = { ...mergedFlat, type: mergedFlat.type || curCode };

  const cross = {
    type: merged.type || curCode,
    size: merged.size || args.size,
    deadline: merged.deadline || args.deadline,
    contact: merged.contact || args.contact,
  };

  const missing = missingRequiredFields(cross, REQUIRED_FIELDS);
  const missingNoContact = missing.filter((f) => f !== "contact");
  if (missingNoContact.length > 0) {
    const first = missingNoContact[0];
    const stepKey = first === "type" ? "service_type" : first;
    const q = getQuestion(lang, stepKey) || getQuestion(lang, "service_type");
    if (q) await ctx.reply(q);
    return true;
  }

  let contact = args.contact;
  const fallback = buildTelegramFallbackContact(ctx);
  if (isPlaceholderContact(contact) || (!contact && fallback)) {
    contact = fallback || contact;
  }
  args.contact = contact;
  merged.contact = contact;

  if (!isValidContact(contact)) {
    if (fallback && !contact) args.contact = fallback;
    contact = args.contact;
  }
  if (!isValidContact(contact)) {
    await ctx.reply(CONTACT_REASK[lang] || CONTACT_REASK.ru);
    return true;
  }

  const queue = intake.servicesQueue;

  /** Клиент уже ответил «да» текстом после брифа от LLM — не дублируем программный бриф, сразу в лид. */
  const last = entry.messages[entry.messages.length - 1];
  const userJustAffirmed =
    last?.role === "user" && isAffirmative(lang, String(last.content || "").trim());
  if (userJustAffirmed && queue.length < 2) {
    const singleSnap = {
      ...merged,
      type: curCode,
      service_type: curCode,
      contact: args.contact,
    };
    const comboArgs = buildComboArgsFromSnapshots(args, [singleSnap]);
    await finalizeOrder(ctx, entry, comboArgs, { multiServiceSnapshots: [singleSnap] });
    return true;
  }

  const persistAfter = async (briefTextLine) => {
    setContext(chatId, entry);
    await ctx.reply(briefTextLine).catch(() => {});
    upsertConversation({
      telegramUserId: userId,
      telegramChatId: chatId,
      history: entry.messages,
      files: entry.files,
      lang,
      status: "active",
      metadata: intakeMetadata(entry),
      lastUserMessageAt: new Date().toISOString(),
    }).catch((e) => console.error("[upsert]", e.message));
  };

  if (queue.length >= 2) {
    const slotKey = queue[intake.idx] || curCode;
    const slotSnap = {
      ...merged,
      type: slotKey,
      service_type: slotKey,
      contact: args.contact,
    };
    intake.perService[slotKey] = slotSnap;

    if (intake.idx < queue.length - 1) {
      intake.idx += 1;
      const nextCode = queue[intake.idx];
      entry.serviceCode = nextCode;
      entry.orderData = resetServiceSlotFields(orderCarryForward(slotSnap));
      entry.orderData.type = nextCode;
      const trRu = `Одну позицию («${slotKey}») сохранила — перехожу к «${nextCode}». По ней начнём с объёма или с того, что на печати?`;
      const tr = {
        ru: trRu,
        kk: `Бір бөлікті («${slotKey}») жаздым — келесі «${nextCode}»: көлем ме, өлшем ме, немесе басылымда не болуы керек?`,
        en: `Saved «${slotKey}». Now «${nextCode}» — start with qty/size or artwork?`,
      }[lang] || trRu;
      entry.messages = [...entry.messages, { role: "assistant", content: tr }];
      setContext(chatId, entry);
      await ctx.reply(tr);
      upsertConversation({
        telegramUserId: userId,
        telegramChatId: chatId,
        history: entry.messages,
        files: entry.files,
        lang,
        status: "active",
        metadata: intakeMetadata(entry),
        lastUserMessageAt: new Date().toISOString(),
      }).catch((e) => console.error("[upsert]", e.message));
      return true;
    }

    const snapshots = queue.map((code) => ({
      ...(intake.perService[code] || {}),
      type: code,
      service_type: code,
    }));

    const comboArgs = buildComboArgsFromSnapshots(args, snapshots);
    /** Не просим третье «да» сводным брифом — лиды сразу после последней услуги. */
    entry.pendingFinalize = null;
    setContext(chatId, entry);
    upsertConversation({
      telegramUserId: userId,
      telegramChatId: chatId,
      history: entry.messages,
      files: entry.files,
      lang,
      status: "active",
      metadata: intakeMetadata(entry),
      lastUserMessageAt: new Date().toISOString(),
    }).catch((e) => console.error("[upsert]", e.message));
    await finalizeOrder(ctx, entry, comboArgs, { multiServiceSnapshots: snapshots });
    return true;
  }

  const singleSnap = {
    ...merged,
    type: curCode,
    service_type: curCode,
    contact: args.contact,
  };
  const comboArgs = buildComboArgsFromSnapshots(args, [singleSnap]);
  const briefText = formatClientBrief(lang, [singleSnap]);

  entry.pendingFinalize = {
    args: comboArgs,
    finalizeOpts: { multiServiceSnapshots: [singleSnap] },
  };
  entry.messages = [...entry.messages, { role: "assistant", content: briefText }];
  await persistAfter(briefText);
  return true;
}

async function finalizeOrder(ctx, entry, rawArgs, finalizeOpts = {}) {
  const args = { ...(rawArgs || {}) };
  const snaps = finalizeOpts.multiServiceSnapshots;
  const aggregatedOrder = snaps?.length
    ? mergeSnapshotsOrderData(snaps)
    : mergeData(makeEmptyOrder(), entry.orderData || {});
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const lang = entry.lang || "ru";

  // ─── Final required-fields validation (formal schema source-of-truth) ─────
  try {
    const od = aggregatedOrder || {};
    const cross = snaps?.length
      ? crossFieldsForMultiFinalize(snaps, od, args)
      : {
          type: od.type || args.service_type || null,
          size: od.size || args.size || null,
          deadline: od.deadline || args.deadline || null,
          contact: od.contact || args.contact || null,
        };
    const missing = missingRequiredFields(cross, REQUIRED_FIELDS);
    // contact обработаем ниже (есть отдельная reask-логика)
    const missingNoContact = missing.filter((f) => f !== "contact");
    if (missingNoContact.length > 0) {
      const first = missingNoContact[0];
      const stepKey = first === "type" ? "service_type" : first;
      const q = getQuestion(lang, stepKey) || getQuestion(lang, "service_type");
      if (q) {
        console.log(`[finalize/validate] chat=${chatId} missing=${missingNoContact.join(",")} ask=${stepKey}`);
        await ctx.reply(q);
        return;
      }
    }
  } catch (err) {
    console.error("Required-fields validation threw:", err.message);
  }

  const fallback = buildTelegramFallbackContact(ctx);
  if (isPlaceholderContact(args.contact) || (!args.contact && fallback)) {
    if (fallback) args.contact = fallback;
  }
  if (!isValidContact(args.contact)) {
    if (fallback) {
      args.contact = fallback;
    } else {
      const reask = CONTACT_REASK[lang] || CONTACT_REASK.ru;
      await ctx.reply(reask);
      return;
    }
  }

  try {
    const conversation = await upsertConversation({
      telegramUserId: userId,
      telegramChatId: chatId,
      history: entry.messages,
      files: entry.files,
      lang,
      status: "completed",
      metadata: {
        order: aggregatedOrder || null,
        intake_state: { servicesQueue: [], idx: 0, perService: {} },
        pending_finalize: null,
      },
    });

    const enrichedArgs = {
      ...args,
      order_data: aggregatedOrder || null,
      multi_services: snaps || args.multi_services,
    };
    console.log(`[finalize] chat=${chatId} args=`, JSON.stringify(enrichedArgs), "agg=", JSON.stringify(aggregatedOrder));
    const order = await saveOrder({
      conversationId: conversation.id,
      telegramUserId: userId,
      telegramChatId: chatId,
      data: enrichedArgs,
      files: entry.files,
      lang,
    });

    // ─── CRM: создаём лида со score ────────────────────────────────────────
    let lead = null;
    try {
      const score = calcLeadScore({ orderData: aggregatedOrder, files: entry.files });
      lead = await createLead({
        conversationId: conversation.id,
        orderId: order.id,
        telegramUserId: userId,
        telegramChatId: chatId,
        data: {
          ...(aggregatedOrder || {}),
          order_id: order.id,
          lang,
          username: ctx.from?.username || null,
          multi_services: snaps || null,
        },
        leadScore: score,
      });
      console.log(`[lead] created id=${lead.id} score=${score} order=${order.id.substring(0,8)}`);
    } catch (err) {
      console.error("Lead creation failed:", err.message);
    }

    const orderDataSnapshot = { ...(aggregatedOrder || makeEmptyOrder()) };

    await completeConversation(conversation.id);
    clearContext(chatId);

    const short = order.id.substring(0, 8);
    const confirm = {
      ru: `✅ Заявка №${short} принята!\n\nМенеджер свяжется с вами в ближайшее время.\nЕсли что-то добавить — просто напишите.`,
      kk: `✅ №${short} өтінім қабылданды!\n\nМенеджер жақын арада сізбен байланысады.\nҚосымша мәлімет болса — жазыңыз.`,
      en: `✅ Request #${short} accepted!\n\nA manager will get back to you shortly.\nIf you'd like to add anything — just send a message.`,
    }[lang] || `✅ Заявка №${short} принята!`;
    await ctx.reply(confirm);

    try {
      const kc = await buildKnowledgeContext({
        lastUserMessage: "",
        orderData: orderDataSnapshot,
        lang,
      });
      const hint = await estimatePriceHint(orderDataSnapshot, lang, kc);
      if (hint && hint.length > 15) {
        await ctx.reply(`💡 Ориентир по бюджету (не оферта): ${hint}`);
      }
    } catch (e) {
      console.error("[estimatePriceHint]", e.message);
    }

    await notifyManager(ctx, order, lang, enrichedArgs, lead, orderDataSnapshot);
  } catch (err) {
    console.error("Finalize error:", err.message);
    await ctx.reply("Заявку записал, но возникла техническая ошибка при сохранении. Менеджер всё равно увидит ваше обращение.");
    try {
      await _bot.telegram.sendMessage(
        getManagerChatId(),
        `⚠️ Ошибка сохранения заявки от @${ctx.from?.username || ctx.from?.id}: ${err.message}\n\nДанные:\n${JSON.stringify(args, null, 2)}`
      );
    } catch { /* ignore */ }
  }
}

async function notifyManager(ctx, order, lang = "ru", rawArgs = {}, lead = null, orderData = null) {
  const username = ctx.from?.username ? `@${ctx.from.username}` : `id:${ctx.from?.id}`;
  const meta = getLangMeta(lang);
  const score = lead?.lead_score ?? 50;
  const badge = scoreBadge(score);
  const headerId = lead ? `#${lead.id}` : `№${order.id.substring(0, 8)}`;

  const rawJson = order?.json_data;
  const multiSnap =
    rawArgs.multi_services ||
    orderData?.multi_services ||
    (Array.isArray(rawJson?.multi_services) ? rawJson.multi_services : null);

  const lines = [
    `🆕 Новый лид ${headerId} [${meta.badge}] ${badge} (${score})`,
    ``,
    `🎯 Услуга: ${order.service_type || "—"}`,
    `📝 ${order.description || "—"}`,
  ];
  if (Array.isArray(multiSnap) && multiSnap.length > 1) {
    lines.push("", `🧩 Позиций в заявке: ${multiSnap.length}`);
    multiSnap.forEach((s, i) => {
      lines.push(`  ${i + 1}) ${s.service_type || s.type || "—"} — ${s.description || s.content || "…"}`);
    });
    lines.push("");
  }
  if (order.size) lines.push(`📐 Размер: ${order.size}`);
  if (order.quantity) lines.push(`🔢 Кол-во: ${order.quantity}`);
  const extras = [
    ["📍 Где",     rawArgs.location],
    ["💡 Подсветка", rawArgs.lighting],
    ["🏷 Использование", rawArgs.where_use],
    ["⚪ Форма",    rawArgs.shape],
    ["✨ Материал", rawArgs.material],
    ["👕 Размеры",  rawArgs.sizes],
    ["🖨 Технология", rawArgs.print_type],
    ["📄 Бумага",   rawArgs.paper_type],
    ["🎁 Изделие",  rawArgs.item],
    ["🎨 Содержание", rawArgs.content],
    ["🖼 Макет",    rawArgs.design],
  ];
  for (const [label, val] of extras) {
    if (val && String(val).trim()) lines.push(`${label}: ${val}`);
  }
  // Допуслуги (upsell/cross-sell): orderData.extras → "➕ Допы: ...".
  // Если orderData не передали (на всякий случай) — fallback на rawArgs.extras / order.extras.
  const extrasArr =
    (orderData && Array.isArray(orderData.extras) && orderData.extras) ||
    (Array.isArray(rawArgs.extras) && rawArgs.extras) ||
    (Array.isArray(order.extras) && order.extras) ||
    [];
  if (extrasArr.length > 0) {
    const labels = extrasArr.map((id) => {
      // Если id из UPSELL_MAP — заменим на ru-метку, иначе оставим как есть.
      for (const opts of Object.values(UPSELL_MAP)) {
        const found = opts.find((o) => o.id === id);
        if (found) return found.label;
      }
      return String(id);
    });
    lines.push(`➕ Допы: ${labels.join(", ")}`);
  }
  lines.push(`📅 Срок: ${order.deadline || "—"}`);
  if (order.budget) lines.push(`💰 Бюджет: ${order.budget}`);
  lines.push(`📞 Контакт: ${order.contact || "—"}`);
  if (order.notes) lines.push(`✏️ ${order.notes}`);
  lines.push(``, `👤 От: ${username}`);
  if (order.files?.length) lines.push(`📎 Файлов: ${order.files.length}`);

  // Если лид не создался — fallback на старые order-кнопки.
  const keyboard = lead ? {
    inline_keyboard: [
      [
        { text: "🎯 Взять",    callback_data: `lead:take:${lead.id}` },
        { text: "💬 Уточнить", callback_data: `lead:clarify:${lead.id}` },
        { text: "📄 КП",       callback_data: `lead:proposal:${lead.id}` },
      ],
      [
        { text: "✓ Закрыть",   callback_data: `lead:close:${lead.id}` },
        { text: "✗ Отклонить", callback_data: `lead:reject:${lead.id}` },
      ],
    ],
  } : {
    inline_keyboard: [[
      { text: "✅ Принять",   callback_data: `accept:${order.id}` },
      { text: "❌ Отклонить", callback_data: `reject:${order.id}` },
    ]],
  };

  await _bot.telegram.sendMessage(getManagerChatId(), lines.join("\n"), { reply_markup: keyboard });

  for (const url of order.files || []) {
    await _bot.telegram.sendMessage(getManagerChatId(), `📎 ${url}`).catch(() => {});
  }

  if (lead) {
    try {
      const crm = await exportLeadToAllIntegrations({
        lead_id: lead.id,
        order_id: order.id,
        service_type: order.service_type,
        description: order.description,
        contact: order.contact,
        username: ctx.from?.username || null,
        lang,
        telegram_chat_id: String(ctx.chat?.id),
        files: order.files || [],
      });
      if (crm.errors?.length) {
        console.error("[crm]", crm.errors.join("; "));
        await _bot.telegram.sendMessage(getManagerChatId(), `⚠️ CRM: ${crm.errors.join("; ")}`).catch(() => {});
      }
    } catch (e) {
      console.error("[crm export]", e.message);
      await _bot.telegram.sendMessage(getManagerChatId(), `⚠️ CRM export: ${e.message}`).catch(() => {});
    }
  }
}

async function handleOwnerStats(ctx) {
  try {
    const snap = await getAnalyticsSnapshot();
    const cLines = Object.entries(snap.conversationsByStatus).map(([k, v]) => `  ${k}: ${v}`);
    const oLines = Object.entries(snap.ordersByStatus).map(([k, v]) => `  ${k}: ${v}`);
    const top = snap.topServices.map(([s, n]) => `  ${s}: ${n}`).join("\n");
    await ctx.reply(
      [
        "📊 Сводка (до 8000 строк / таблица)",
        "",
        `Сегодня (UTC с 00:00): заказов ${snap.ordersTodayUtc}, новых диалогов ${snap.conversationsCreatedTodayUtc}`,
        "",
        "Диалоги:",
        ...cLines,
        "",
        "Заказы:",
        ...oLines,
        "",
        `Всего заказов: ${snap.ordersTotal} · диалогов: ${snap.conversationsTotal}`,
        "",
        "Топ услуг:",
        top || "  —",
      ].join("\n")
    );
  } catch (e) {
    await ctx.reply(`Ошибка /stats: ${e.message}`);
  }
}

async function handleTemplatesCommand(ctx) {
  if (String(ctx.chat?.id) === getManagerChatId()) return;
  if (isClientPrivateChat(ctx) && managerCommandAllowed(ctx) && hasManagerUserAllowlist()) return;
  const keyboard = {
    inline_keyboard: ORDER_TEMPLATES.map((t) => [{ text: t.title, callback_data: `tpl:${t.id}` }]),
  };
  await ctx.reply("Шаблон — черновик полей заявки. Потом всё можно изменить текстом 👇", { reply_markup: keyboard });
}

async function handleTemplatePick(ctx, data) {
  if (String(ctx.callbackQuery.message.chat.id) === getManagerChatId()) {
    await ctx.answerCbQuery("Шаблоны — в чате с ботом как клиент").catch(() => {});
    return;
  }
  const id = data.slice(4);
  const tpl = getTemplateById(id);
  await ctx.answerCbQuery(tpl ? "Ок" : "Нет такого").catch(() => {});
  if (!tpl) return;
  const chatId = ctx.callbackQuery.message.chat.id;
  let entry = getContext(chatId) || {
    messages: [],
    files: [],
    lang: "ru",
    flagShown: false,
    serviceCode: null,
    orderData: makeEmptyOrder(),
    upsellShown: false,
  };
  if (!entry.orderData) entry.orderData = makeEmptyOrder();
  entry.orderData = mergeData(entry.orderData, normalizeToSchema(tpl.preset));
  entry.messages = [...(entry.messages || []), { role: "user", content: `[шаблон: ${tpl.id}]` }];
  setContext(chatId, entry);
  await ctx.reply(`Шаблон «${tpl.title}» подставлен. Дополните срок, контакт и детали.`);
}

// ─── Manager callbacks ───────────────────────────────────────────────────────

async function handleCallback(ctx) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  if (data.startsWith("tpl:")) {
    return handleTemplatePick(ctx, data);
  }

  const chatId = String(ctx.callbackQuery.message?.chat?.id);
  if (chatId !== getManagerChatId()) {
    await ctx.answerCbQuery("Только менеджер").catch(() => {});
    return;
  }
  if (!managerCommandAllowed(ctx)) {
    await ctx.answerCbQuery("Нужны права менеджера").catch(() => {});
    return;
  }

  // Manager-Assist callbacks: assist:send:<leadId>:<msgId>, assist:edit:<leadId>, assist:cancel:<msgId>
  if (data.startsWith("assist:")) {
    return handleAssistCallback(ctx, data, chatId);
  }

  // Proposal callbacks: proposal:send:<leadId>:<msgId>, proposal:edit:<leadId>, proposal:cancel:<msgId>
  if (data.startsWith("proposal:")) {
    return handleProposalCallback(ctx, data, chatId);
  }

  // Lead-callbacks: lead:take:N, lead:clarify:N, lead:close:N, lead:reject:N, lead:open:N, lead:proposal:N
  if (data.startsWith("lead:")) {
    return handleLeadCallback(ctx, data, chatId);
  }

  // Knowledge-base callbacks: kb:delete:N
  if (data.startsWith("kb:")) {
    return handleKbCallback(ctx, data, chatId);
  }

  // Legacy order-callbacks: accept:UUID, reject:UUID
  const [action, id] = data.split(":");
  if (!id) return;

  try {
    const msgId = ctx.callbackQuery.message.message_id;
    await ctx.answerCbQuery();

    if (action === "accept") {
      const order = await getOrderById(id);
      await updateOrderStatus(id, "in_progress");
      await ctx.telegram.editMessageReplyMarkup(chatId, msgId, undefined, { inline_keyboard: [] });
      await ctx.telegram.sendMessage(chatId, `✅ Заявка ${id.substring(0, 8)} принята.`);
      if (order.telegram_chat_id) {
        await ctx.telegram.sendMessage(
          order.telegram_chat_id,
          "Заявка принята в работу ✅\nС вами скоро свяжется менеджер для уточнения деталей 📞"
        ).catch(() => {});
      }
    } else if (action === "reject") {
      const order = await getOrderById(id);
      await updateOrderStatus(id, "rejected");
      await ctx.telegram.editMessageReplyMarkup(chatId, msgId, undefined, { inline_keyboard: [] });
      await ctx.telegram.sendMessage(chatId, `❌ Заявка ${id.substring(0, 8)} отклонена.`);
      if (order.telegram_chat_id) {
        await ctx.telegram.sendMessage(
          order.telegram_chat_id,
          "К сожалению, по вашему запросу мы не сможем помочь. Спасибо за обращение!"
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.error("Callback error:", err.message);
    await ctx.answerCbQuery("Ошибка").catch(() => {});
  }
}

// ─── Lead callbacks (CRM в Telegram) ─────────────────────────────────────────

async function handleLeadCallback(ctx, data, chatId) {
  const [, action, leadIdStr] = data.split(":");
  const leadId = parseInt(leadIdStr, 10);
  if (!leadId || !action) {
    await ctx.answerCbQuery("Неверные данные").catch(() => {});
    return;
  }

  const msgId = ctx.callbackQuery.message?.message_id;

  try {
    let lead;
    try {
      lead = await getLeadById(leadId);
    } catch (e) {
      await ctx.answerCbQuery("Лид не найден").catch(() => {});
      return;
    }

    if (action === "take") {
      await updateLead(leadId, { status: "in_progress", assigned_to: Number(ctx.from.id) });
      await ctx.answerCbQuery("Взято в работу").catch(() => {});
      if (msgId) {
        await ctx.telegram.editMessageReplyMarkup(chatId, msgId, undefined, {
          inline_keyboard: [
            [{ text: "💬 Уточнить",   callback_data: `lead:clarify:${leadId}` }],
            [
              { text: "✓ Закрыть",   callback_data: `lead:close:${leadId}` },
              { text: "✗ Отклонить", callback_data: `lead:reject:${leadId}` },
            ],
          ],
        }).catch(() => {});
      }
      await ctx.telegram.sendMessage(chatId,
        `🎯 Вы взяли заявку #${leadId} в работу.\n` +
        `Можете писать клиенту через бота: /reply ${leadId} <текст>`
      );
      return;
    }

    if (action === "clarify") {
      await ctx.answerCbQuery().catch(() => {});
      setManagerReplyMode(ctx.from.id, leadId);
      await ctx.telegram.sendMessage(
        chatId,
        `💬 Ответ клиенту по лиду #${leadId}.\nОдно следующее сообщение (текст, голос или фото) будет переслано клиенту, затем режим выключится.\nПодсказка: AI-черновик — команда /assist ${leadId}`
      );
      return;
    }

    if (action === "proposal") {
      await ctx.answerCbQuery("Генерирую КП…").catch(() => {});
      await proposeProposalDraft(ctx, leadId, lead);
      return;
    }

    if (action === "close") {
      await updateLead(leadId, { status: "closed" });
      await ctx.answerCbQuery("Закрыто").catch(() => {});
      if (msgId) await ctx.telegram.editMessageReplyMarkup(chatId, msgId, undefined, { inline_keyboard: [] }).catch(() => {});
      await ctx.telegram.sendMessage(chatId, `✓ Заявка #${leadId} закрыта.`);
      const cLang = lead.data?.lang || "ru";
      const closedMsg = {
        ru: "Спасибо за обращение! Заявка обработана ✅",
        kk: "Хабарласқаныңызға рахмет! Өтінім өңделді ✅",
        en: "Thank you! Your request has been handled ✅",
      }[cLang] || "Спасибо за обращение! Заявка обработана ✅";
      if (lead.telegram_chat_id) {
        await ctx.telegram.sendMessage(String(lead.telegram_chat_id), closedMsg).catch(() => {});
      }
      return;
    }

    if (action === "reject") {
      await updateLead(leadId, { status: "rejected" });
      await ctx.answerCbQuery("Отклонено").catch(() => {});
      if (msgId) await ctx.telegram.editMessageReplyMarkup(chatId, msgId, undefined, { inline_keyboard: [] }).catch(() => {});
      await ctx.telegram.sendMessage(chatId, `✗ Заявка #${leadId} отклонена.`);
      const cLang = lead.data?.lang || "ru";
      const rejectedMsg = {
        ru: "К сожалению, по вашему запросу мы не сможем помочь. Спасибо за обращение!",
        kk: "Өкінішке орай, сіздің сұранысыңыз бойынша көмектесе алмаймыз. Хабарласқаныңызға рахмет!",
        en: "Unfortunately, we can't help with your request. Thanks for reaching out!",
      }[cLang] || "К сожалению, по вашему запросу мы не сможем помочь.";
      if (lead.telegram_chat_id) {
        await ctx.telegram.sendMessage(String(lead.telegram_chat_id), rejectedMsg).catch(() => {});
      }
      return;
    }

    if (action === "open") {
      await ctx.answerCbQuery().catch(() => {});
      await sendLeadDetail(ctx, leadId);
      return;
    }

    await ctx.answerCbQuery("Неизвестное действие").catch(() => {});
  } catch (err) {
    console.error("Lead callback error:", err.message);
    await ctx.answerCbQuery(`Ошибка: ${err.message}`).catch(() => {});
  }
}

// ─── Manager → Client reply (через /reply N <текст> или clarify ForceReply) ──

async function sendManagerReplyToClient(ctx, leadId, text) {
  try {
    const lead = await getLeadById(leadId);
    if (!lead) {
      await ctx.reply(`Лид #${leadId} не найден.`);
      return;
    }
    if (!lead.telegram_chat_id) {
      await ctx.reply(`У лида #${leadId} нет chat_id клиента.`);
      return;
    }

    const cLang = lead.data?.lang || "ru";
    const prefix = { ru: "Менеджер:", kk: "Менеджер:", en: "Manager:" }[cLang] || "Менеджер:";
    const msg = `${prefix} ${text}`;

    await _bot.telegram.sendMessage(String(lead.telegram_chat_id), msg);

    if (lead.conversation_id) {
      await appendConversationMessage(lead.conversation_id, "manager", text);
    }

    if (lead.status === "new") {
      await updateLead(leadId, { status: "in_progress", assigned_to: Number(ctx.from.id) });
    }

    await ctx.reply(`✓ Отправлено клиенту по лиду #${leadId}.`);
  } catch (err) {
    console.error("sendManagerReplyToClient error:", err.message);
    await ctx.reply(`Ошибка отправки: ${err.message}`);
  }
}

async function handleReplyCommand(ctx) {
  const raw = (ctx.message?.text || "").replace(/^\/reply(@\w+)?\s*/, "").trim();
  const m = raw.match(/^(\d+)\s+([\s\S]+)$/);
  if (!m) {
    await ctx.reply("Использование: /reply <ID лида> <текст>\nПример: /reply 12 Здравствуйте! Уточните, пожалуйста, размер.");
    return;
  }
  const leadId = parseInt(m[1], 10);
  const text = m[2].trim();
  await sendManagerReplyToClient(ctx, leadId, text);
}

// ─── /leads command ──────────────────────────────────────────────────────────

async function handleLeadsCommand(ctx) {
  const raw = (ctx.message?.text || "").replace(/^\/leads(@\w+)?/, "").trim();
  const parts = raw ? raw.split(/\s+/) : [];

  if (parts.length === 0) return sendLeadsSummary(ctx);

  const arg = parts[0].toLowerCase();
  if (/^\d+$/.test(arg)) return sendLeadDetail(ctx, parseInt(arg, 10));
  if (arg === "new" || arg === "in_progress" || arg === "closed" || arg === "rejected") {
    return sendLeadsListByStatus(ctx, arg);
  }
  if (arg === "hot" || arg === "warm" || arg === "cold") {
    return sendLeadsListByTier(ctx, arg);
  }
  await ctx.reply([
    "Использование:",
    "/leads — сводка",
    "/leads new — новые",
    "/leads in_progress — в работе",
    "/leads hot|warm|cold — по score",
    "/leads <ID> — детали",
  ].join("\n"));
}

async function sendLeadsSummary(ctx) {
  try {
    const s = await getLeadsSummary();
    const lines = [
      `📊 Лиды — сводка`,
      ``,
      `Всего: ${s.total}  •  активных: ${s.active}`,
      ``,
      `🆕 new: ${s.by_status.new}`,
      `🔄 in_progress: ${s.by_status.in_progress}`,
      `✓ closed: ${s.by_status.closed}`,
      `✗ rejected: ${s.by_status.rejected}`,
      ``,
      `🔥 HOT: ${s.by_tier.hot}`,
      `🟡 WARM: ${s.by_tier.warm}`,
      `🔵 COLD: ${s.by_tier.cold}`,
      ``,
      `Команды: /leads new, /leads in_progress, /leads hot, /leads <ID>`,
    ];
    await ctx.reply(lines.join("\n"));
  } catch (err) {
    await ctx.reply(`Ошибка сводки: ${err.message}`);
  }
}

function leadShortLine(lead) {
  const badge = scoreBadge(lead.lead_score ?? 50);
  const cLang = (lead.data?.lang || "ru").toUpperCase();
  const desc = String(lead.data?.description || lead.data?.type || "—").slice(0, 60);
  const deadline = lead.data?.deadline || "—";
  return `#${lead.id} ${badge} [${cLang}] ${desc} • срок: ${deadline}`;
}

async function sendLeadsListByStatus(ctx, status) {
  try {
    const leads = await getLeadsByStatus(status, 10);
    if (!leads.length) {
      await ctx.reply(`Лидов со статусом «${status}» нет.`);
      return;
    }
    for (const lead of leads) {
      const line = leadShortLine(lead);
      await ctx.reply(line, {
        reply_markup: {
          inline_keyboard: [[{ text: "Открыть", callback_data: `lead:open:${lead.id}` }]],
        },
      });
    }
  } catch (err) {
    await ctx.reply(`Ошибка: ${err.message}`);
  }
}

async function sendLeadsListByTier(ctx, tier) {
  try {
    const leads = await getLeadsByTier(tier, 10);
    if (!leads.length) {
      await ctx.reply(`Активных лидов уровня «${tier}» нет.`);
      return;
    }
    for (const lead of leads) {
      const line = leadShortLine(lead);
      await ctx.reply(line, {
        reply_markup: {
          inline_keyboard: [[{ text: "Открыть", callback_data: `lead:open:${lead.id}` }]],
        },
      });
    }
  } catch (err) {
    await ctx.reply(`Ошибка: ${err.message}`);
  }
}

async function sendLeadDetail(ctx, leadId) {
  try {
    const lead = await getLeadById(leadId);
    if (!lead) {
      await ctx.reply(`Лид #${leadId} не найден.`);
      return;
    }
    const score = lead.lead_score ?? 50;
    const badge = scoreBadge(score);
    const cLang = (lead.data?.lang || "ru").toUpperCase();
    const d = lead.data || {};

    const head = [
      `📋 Лид #${lead.id} ${badge} (${score}) [${cLang}]`,
      `Статус: ${lead.status}${lead.assigned_to ? ` • назначен: ${lead.assigned_to}` : ""}`,
      `Создан: ${new Date(lead.created_at).toISOString().slice(0, 16).replace("T", " ")}`,
    ];

    const fields = [
      ["🎯 Тип",        d.type],
      ["📝 Описание",   d.description],
      ["📐 Размер",     d.size],
      ["🔢 Кол-во",     d.quantity],
      ["📍 Где",        d.location],
      ["💡 Подсветка",  d.lighting],
      ["🏷 Использование", d.where_use],
      ["⚪ Форма",      d.shape],
      ["✨ Материал",   d.material],
      ["👕 Размеры",    d.sizes],
      ["🖨 Технология", d.print_type],
      ["📄 Бумага",     d.paper_type],
      ["🎁 Изделие",    d.item],
      ["🎨 Содержание", d.content],
      ["🖼 Макет",      d.design],
      ["📅 Срок",       d.deadline],
      ["💰 Бюджет",     d.budget],
      ["📞 Контакт",    d.contact],
    ].filter(([, v]) => v && String(v).trim());

    const lines = [
      ...head,
      "",
      ...fields.map(([k, v]) => `${k}: ${v}`),
    ];
    if (Array.isArray(d.files) && d.files.length) lines.push(`📎 Файлов: ${d.files.length}`);

    const kbRows = [];
    if (lead.status === "new") {
      kbRows.push([{ text: "🎯 Взять в работу", callback_data: `lead:take:${lead.id}` }]);
    }
    if (lead.status === "new" || lead.status === "in_progress") {
      kbRows.push([{ text: "💬 Уточнить", callback_data: `lead:clarify:${lead.id}` }]);
      kbRows.push([
        { text: "✓ Закрыть",   callback_data: `lead:close:${lead.id}` },
        { text: "✗ Отклонить", callback_data: `lead:reject:${lead.id}` },
      ]);
    }

    await ctx.reply(lines.join("\n"), kbRows.length ? { reply_markup: { inline_keyboard: kbRows } } : {});

    if (lead.conversation_id) {
      const { history } = await getConversationHistoryForLead(lead.conversation_id, 10);
      if (history && history.length) {
        const histLines = ["💬 Последние сообщения:"];
        for (const m of history) {
          const role = m.role === "assistant" ? "🤖" : (m.role === "manager" ? "👤" : "👥");
          const txt = String(m.content || "").slice(0, 200).replace(/\n+/g, " ");
          histLines.push(`${role} ${txt}`);
        }
        await ctx.reply(histLines.join("\n"));
      }
    }
  } catch (err) {
    await ctx.reply(`Ошибка: ${err.message}`);
  }
}

// ─── Manager-only listings (legacy /new, /active, /today) ────────────────────

async function handleOwnerList(ctx, status, title) {
  try {
    const orders = await getOrdersByStatus(status);
    if (!orders.length) { await ctx.reply(`${title}: нет заявок.`); return; }
    const lines = orders.map(o =>
      `🆔 ${o.id.substring(0, 8)} | ${o.service_type || "?"} | ${(o.description || "").substring(0, 40)} | ${o.contact || "?"}`
    );
    await ctx.reply(`${title}:\n\n${lines.join("\n")}`);
  } catch (err) {
    console.error("Owner list error:", err.message);
    await ctx.reply(`Ошибка: ${err.message}`);
  }
}

async function handleOwnerToday(ctx) {
  try {
    const orders = await getOrdersToday();
    if (!orders.length) { await ctx.reply("За сегодня заявок нет."); return; }
    const lines = orders.map(o =>
      `🆔 ${o.id.substring(0, 8)} | ${o.service_type || "?"} | ${o.status}`
    );
    await ctx.reply(`За сегодня (${orders.length}):\n\n${lines.join("\n")}`);
  } catch (err) {
    console.error("Today error:", err.message);
    await ctx.reply(`Ошибка: ${err.message}`);
  }
}

// ─── Manager Assist (AI-помощник: предлагает текст ответа клиенту) ───────────

/**
 * Достать последнее сообщение клиента из истории разговора (role === "user").
 */
function lastClientMessage(history) {
  if (!Array.isArray(history)) return "";
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m && m.role === "user" && m.content) return String(m.content);
  }
  // Fallback — последнее любое
  const last = history[history.length - 1];
  return last && last.content ? String(last.content) : "";
}

/**
 * Сгенерировать AI-предложение и отправить менеджеру с кнопками
 * [✉ Отправить] [✏️ Изменить] [✗ Отмена].
 *
 * @param {*} ctx — Telegraf ctx
 * @param {number} leadId
 * @param {object} [leadPreloaded] — если уже подгружен, не дёргаем БД повторно
 */
async function proposeAssistReply(ctx, leadId, leadPreloaded = null) {
  try {
    const lead = leadPreloaded || (await getLeadById(leadId));
    if (!lead) {
      await ctx.telegram.sendMessage(getManagerChatId(), `Лид #${leadId} не найден.`).catch(() => {});
      return;
    }

    // lead.data — это плоский объект с полями orderData (type/size/contact/...) + lang/order_id/username
    const orderData = lead.data || {};
    let history = [];
    let lang = lead.data?.lang || "ru";
    if (lead.conversation_id) {
      const h = await getConversationHistoryForLead(lead.conversation_id, 10);
      history = Array.isArray(h?.history) ? h.history : [];
      if (h?.lang) lang = h.lang;
    }
    const lastUserMessage = lastClientMessage(history);

    const text = await assistManagerReply({
      orderData,
      history,
      lang,
      lastUserMessage,
    });

    if (!text) {
      await ctx.telegram.sendMessage(
        getManagerChatId(),
        `⚠️ Не удалось сгенерировать вариант ответа для лида #${leadId}. ` +
        `Можно написать вручную: /reply ${leadId} <текст>`
      ).catch(() => {});
      return;
    }

    // Пока msgId не известен — отправим без кнопок, потом отредактируем
    // (чтобы вшить в callback_data сам msgId, а не накапливать вторичный поиск).
    // Шаг 1: шлём с временным разметом без msgId — кнопки edit/cancel уже работают.
    const sent = await ctx.telegram.sendMessage(
      getManagerChatId(),
      `💡 Вариант ответа клиенту #${leadId}:\n\n«${text}»`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✉ Отправить",  callback_data: `assist:send:${leadId}:0` },
              { text: "✏️ Изменить",  callback_data: `assist:edit:${leadId}` },
              { text: "✗ Отмена",     callback_data: `assist:cancel:0` },
            ],
          ],
        },
      }
    );

    // Сохраняем драфт по msgId (то, что прилетит в send-callback).
    const msgId = sent.message_id;
    setAssistDraft(msgId, { leadId, text, lang });

    // Шаг 2: пере-приклеиваем кнопки с актуальным msgId, чтобы send брал draft по нему.
    await ctx.telegram.editMessageReplyMarkup(getManagerChatId(), msgId, undefined, {
      inline_keyboard: [
        [
          { text: "✉ Отправить",  callback_data: `assist:send:${leadId}:${msgId}` },
          { text: "✏️ Изменить",  callback_data: `assist:edit:${leadId}` },
          { text: "✗ Отмена",     callback_data: `assist:cancel:${msgId}` },
        ],
      ],
    }).catch(() => {});
  } catch (err) {
    console.error("proposeAssistReply error:", err.message);
    await ctx.telegram.sendMessage(getManagerChatId(), `⚠️ Ошибка ассистента: ${err.message}`).catch(() => {});
  }
}

/**
 * Обработка assist:* callback'ов.
 * Форматы:
 *   assist:send:<leadId>:<msgId>  — отправить сохранённый текст клиенту
 *   assist:edit:<leadId>          — открыть ForceReply, менеджер пишет свой текст
 *   assist:cancel:<msgId>         — отбой, удалить кнопки и draft
 */
async function handleAssistCallback(ctx, data, chatId) {
  const parts = data.split(":");
  const action = parts[1];
  const msgId = ctx.callbackQuery.message?.message_id;

  try {
    if (action === "send") {
      const leadId = parseInt(parts[2], 10);
      const draftMsgId = parseInt(parts[3], 10) || msgId;
      const draft = getAssistDraft(draftMsgId);
      if (!draft || draft.leadId !== leadId) {
        await ctx.answerCbQuery("Черновик устарел. Сгенерируйте заново.").catch(() => {});
        if (msgId) {
          await ctx.telegram.editMessageReplyMarkup(chatId, msgId, undefined, { inline_keyboard: [] }).catch(() => {});
        }
        return;
      }
      await sendManagerReplyToClient(ctx, leadId, draft.text);
      deleteAssistDraft(draftMsgId);
      await ctx.answerCbQuery("Отправлено клиенту").catch(() => {});
      if (msgId) {
        await ctx.telegram.editMessageReplyMarkup(chatId, msgId, undefined, { inline_keyboard: [] }).catch(() => {});
      }
      return;
    }

    if (action === "edit") {
      const leadId = parseInt(parts[2], 10);
      // Снимаем кнопки у предложения, чтобы не зависало.
      if (msgId) {
        await ctx.telegram.editMessageReplyMarkup(chatId, msgId, undefined, { inline_keyboard: [] }).catch(() => {});
        deleteAssistDraft(msgId);
      }
      const sent = await ctx.telegram.sendMessage(
        chatId,
        `✏️ Введите свой вариант ответа клиенту по заявке #${leadId}:`,
        { reply_markup: { force_reply: true, selective: true } }
      );
      pendingClarify.set(getManagerChatId(), { leadId, promptMessageId: sent.message_id });
      await ctx.answerCbQuery("Ответьте на это сообщение").catch(() => {});
      return;
    }

    if (action === "cancel") {
      const draftMsgId = parseInt(parts[2], 10) || msgId;
      if (draftMsgId) deleteAssistDraft(draftMsgId);
      if (msgId) {
        await ctx.telegram.editMessageReplyMarkup(chatId, msgId, undefined, { inline_keyboard: [] }).catch(() => {});
      }
      await ctx.answerCbQuery("Отменено").catch(() => {});
      return;
    }

    await ctx.answerCbQuery("Неизвестное действие").catch(() => {});
  } catch (err) {
    console.error("handleAssistCallback error:", err.message);
    await ctx.answerCbQuery(`Ошибка: ${err.message}`).catch(() => {});
  }
}

/**
 * /assist <leadId> — менеджер вручную просит AI предложить ответ.
 */
async function handleAssistCommand(ctx) {
  const raw = (ctx.message?.text || "").replace(/^\/assist(@\w+)?\s*/, "").trim();
  const m = raw.match(/^(\d+)\s*$/);
  if (!m) {
    await ctx.reply("Использование: /assist <ID лида>\nПример: /assist 12");
    return;
  }
  const leadId = parseInt(m[1], 10);
  await proposeAssistReply(ctx, leadId);
}

// ─── Knowledge base: /teach, /knowledge, kb:delete ───────────────────────────
//
// Менеджер обучает бота — пишет «материал/услуга/правило/цена/совет», LLM
// извлекает структуру, бот сохраняет в knowledge_base. Команды доступны
// ТОЛЬКО менеджеру (защита через ownerOnly при регистрации).

function kbCategoryLabel(cat) {
  switch (cat) {
    case "material": return "📦 материал";
    case "service":  return "🛠 услуга";
    case "rule":     return "📋 правило";
    case "price":    return "💰 цена";
    case "tip":      return "💡 совет";
    default:         return cat || "—";
  }
}

function kbFormatLine(rec) {
  const head = `#${rec.id} ${kbCategoryLabel(rec.category)} ${rec.name}`;
  const price = rec.price !== null && rec.price !== undefined ? ` — ${Number(rec.price).toLocaleString("ru-RU")} ₸` : "";
  const desc = rec.description ? ` — ${String(rec.description).slice(0, 60)}${rec.description.length > 60 ? "…" : ""}` : "";
  return `${head}${price}${desc}`;
}

async function handleTeachCommand(ctx) {
  setManagerState(ctx.chat.id, "awaiting_teach_input");
  await ctx.reply(
    "🧠 Жду текст для базы знаний (категория автоматом). Можно несколько строк, можно голосовым.\n\n" +
    "Например: «Холст 380 г/м² для широкоформатной печати, цена 2500 тг/м², хорошо для билбордов и баннеров на улице».\n\n" +
    "Чтобы отменить — /reset."
  );
}

async function handleKnowledgeCommand(ctx) {
  // /knowledge или /knowledge <category>
  const text = ctx.message?.text?.trim() || "";
  const parts = text.split(/\s+/);
  const filter = parts[1] && KB_CATEGORIES.includes(parts[1].toLowerCase()) ? parts[1].toLowerCase() : null;

  let records;
  try {
    records = await listKnowledge({ category: filter, limit: 20 });
  } catch (err) {
    console.error("listKnowledge failed:", err.message);
    await ctx.reply(`❌ Ошибка чтения базы знаний: ${err.message}`);
    return;
  }

  if (!records.length) {
    await ctx.reply(
      filter
        ? `📚 База знаний (${kbCategoryLabel(filter)}) пуста. Добавьте через /teach.`
        : "📚 База знаний пуста. Добавьте через /teach."
    );
    return;
  }

  const header = filter
    ? `📚 База знаний — ${kbCategoryLabel(filter)} (последние ${records.length})`
    : `📚 База знаний (последние ${records.length})\nФильтры: /knowledge material | service | rule | price | tip`;
  await ctx.reply(header);

  // Каждую запись — отдельным сообщением с кнопкой Удалить.
  for (const rec of records) {
    await ctx.telegram.sendMessage(ctx.chat.id, kbFormatLine(rec), {
      reply_markup: {
        inline_keyboard: [[{ text: "🗑 Удалить", callback_data: `kb:delete:${rec.id}` }]],
      },
    }).catch((e) => console.error("kb list send failed:", e.message));
  }
}

/**
 * Если менеджер в состоянии awaiting_teach_input — обрабатываем входящий
 * текст/транскрипт как заметку для базы знаний и возвращаем true.
 * Иначе возвращаем false (пусть идёт обычная диалоговая логика).
 */
async function maybeHandleManagerTeachInput(ctx, text) {
  if (String(ctx.chat?.id) !== getManagerChatId()) return false;
  const ms = getManagerState(ctx.chat.id);
  if (!ms || ms.state !== "awaiting_teach_input") return false;

  // Сразу гасим состояние — даже если упадёт, не зацикливаемся.
  clearManagerState(ctx.chat.id);

  await ctx.sendChatAction("typing").catch(() => {});

  let extracted;
  try {
    extracted = await extractTeachStructured(text);
  } catch (err) {
    console.error("extractTeachStructured threw:", err.message);
    await ctx.reply(`❌ Не получилось разобрать заметку: ${err.message}`);
    return true;
  }

  if (!extracted) {
    await ctx.reply("❌ Не получилось извлечь структуру из заметки. Попробуйте сформулировать конкретнее.");
    return true;
  }

  let saved;
  try {
    saved = await addKnowledge({
      category: extracted.category,
      name: extracted.name,
      price: extracted.price,
      description: extracted.description,
      tags: extracted.tags,
      createdByChatId: ctx.chat.id,
    });
  } catch (err) {
    console.error("addKnowledge failed:", err.message);
    await ctx.reply(`❌ Ошибка сохранения: ${err.message}`);
    return true;
  }

  const tagsLine = (saved.tags || []).length ? `\n🏷 ${saved.tags.join(", ")}` : "";
  const priceLine = saved.price !== null && saved.price !== undefined
    ? `\n💰 ${Number(saved.price).toLocaleString("ru-RU")} ₸`
    : "";
  await ctx.reply(
    `Сохранил 👍 [${kbCategoryLabel(saved.category)}] ${saved.name}${priceLine}${tagsLine}\n\n` +
    `📝 ${saved.description}\n\n` +
    `id #${saved.id} — удалить: /knowledge`
  );
  return true;
}

async function handleKbCallback(ctx, data, chatId) {
  const parts = data.split(":"); // kb:delete:<id>
  const action = parts[1];
  const id = parseInt(parts[2], 10);
  const msgId = ctx.callbackQuery.message?.message_id;

  if (!action || !id) {
    await ctx.answerCbQuery("Неверные данные").catch(() => {});
    return;
  }

  if (action === "delete") {
    try {
      const rec = await getKnowledgeById(id);
      if (!rec) {
        await ctx.answerCbQuery("Уже удалено").catch(() => {});
        if (msgId) await ctx.telegram.editMessageReplyMarkup(chatId, msgId, undefined, { inline_keyboard: [] }).catch(() => {});
        return;
      }
      await deleteKnowledge(id);
      await ctx.answerCbQuery("Удалено").catch(() => {});
      if (msgId) {
        await ctx.telegram.editMessageText(
          chatId,
          msgId,
          undefined,
          `🗑 #${rec.id} ${kbCategoryLabel(rec.category)} ${rec.name} — удалено`,
          { reply_markup: { inline_keyboard: [] } }
        ).catch(async () => {
          await ctx.telegram.editMessageReplyMarkup(chatId, msgId, undefined, { inline_keyboard: [] }).catch(() => {});
        });
      }
    } catch (err) {
      console.error("kb delete failed:", err.message);
      await ctx.answerCbQuery(`Ошибка: ${err.message}`).catch(() => {});
    }
    return;
  }

  await ctx.answerCbQuery("Неизвестное действие").catch(() => {});
}

// ─── Commercial Proposal (КП) ────────────────────────────────────────────────
//
// /proposal <leadId>           — менеджер вручную просит сгенерировать КП
// callback lead:proposal:<id>  — кнопка «📄 КП» в уведомлении о новом лиде
// callback proposal:send|edit|cancel — действия с draft'ом КП
//
// Ничего НЕ отправляется клиенту автоматически — только после нажатия «✉ Отправить».

/**
 * Сгенерировать КП и предложить менеджеру в чат с кнопками Send/Edit/Cancel.
 * draft сохраняется в proposalDrafts(msgId) с TTL 30 мин.
 */
async function proposeProposalDraft(ctx, leadId, leadPreloaded = null) {
  try {
    const lead = leadPreloaded || (await getLeadById(leadId));
    if (!lead) {
      await ctx.telegram.sendMessage(getManagerChatId(), `Лид #${leadId} не найден.`).catch(() => {});
      return;
    }

    const orderData = lead.data || {};
    let history = [];
    let lang = lead.data?.lang || "ru";
    if (lead.conversation_id) {
      const h = await getConversationHistoryForLead(lead.conversation_id, 10);
      history = Array.isArray(h?.history) ? h.history : [];
      if (h?.lang) lang = h.lang;
    }
    const lastUserMessage = lastClientMessage(history);

    // RAG-lite: knowledge_base context — для подстановки цен/материалов как ориентир.
    let knowledgeContext = "";
    try {
      knowledgeContext = await buildKnowledgeContext({
        lastUserMessage: lastUserMessage || orderData?.description || orderData?.type || "",
        orderData,
        lang,
      });
    } catch (err) {
      console.error("[proposal] buildKnowledgeContext failed:", err.message);
    }

    const text = await generateProposal({ orderData, history, lang, knowledgeContext });

    if (!text) {
      await ctx.telegram.sendMessage(
        getManagerChatId(),
        `⚠️ Не удалось сгенерировать КП для лида #${leadId}.\n` +
        `Можно сгенерировать заново: /proposal ${leadId}`
      ).catch(() => {});
      return;
    }

    // Шаг 1: отправить с временным разметом, msgId ещё не известен.
    const sent = await ctx.telegram.sendMessage(
      getManagerChatId(),
      `💼 КП для лида #${leadId}:\n\n«${text}»`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✉ Отправить клиенту", callback_data: `proposal:send:${leadId}:0` },
              { text: "✏️ Изменить",         callback_data: `proposal:edit:${leadId}` },
              { text: "✗ Отмена",            callback_data: `proposal:cancel:0` },
            ],
          ],
        },
      }
    );

    const msgId = sent.message_id;
    setProposalDraft(msgId, { leadId, text, lang });

    // Шаг 2: переприклеить кнопки с актуальным msgId, чтобы send/cancel брали draft по нему.
    await ctx.telegram.editMessageReplyMarkup(getManagerChatId(), msgId, undefined, {
      inline_keyboard: [
        [
          { text: "✉ Отправить клиенту", callback_data: `proposal:send:${leadId}:${msgId}` },
          { text: "✏️ Изменить",         callback_data: `proposal:edit:${leadId}` },
          { text: "✗ Отмена",            callback_data: `proposal:cancel:${msgId}` },
        ],
      ],
    }).catch(() => {});
  } catch (err) {
    console.error("proposeProposalDraft error:", err.message);
    await ctx.telegram.sendMessage(getManagerChatId(), `⚠️ Ошибка генерации КП: ${err.message}`).catch(() => {});
  }
}

/**
 * Обработка proposal:* callback'ов.
 *   proposal:send:<leadId>:<msgId>  — отправить draft клиенту
 *   proposal:edit:<leadId>          — открыть ForceReply, менеджер пишет свой текст КП
 *   proposal:cancel:<msgId>         — отбой, удалить кнопки и draft
 */
async function handleProposalCallback(ctx, data, chatId) {
  const parts = data.split(":");
  const action = parts[1];
  const msgId = ctx.callbackQuery.message?.message_id;

  try {
    if (action === "send") {
      const leadId = parseInt(parts[2], 10);
      const draftMsgId = parseInt(parts[3], 10) || msgId;
      const draft = getProposalDraft(draftMsgId);
      if (!draft || draft.leadId !== leadId) {
        await ctx.answerCbQuery("Черновик устарел. Сгенерируйте КП заново.").catch(() => {});
        if (msgId) {
          await ctx.telegram.editMessageReplyMarkup(chatId, msgId, undefined, { inline_keyboard: [] }).catch(() => {});
        }
        return;
      }
      await sendManagerProposalToClient(ctx, leadId, draft.text);
      deleteProposalDraft(draftMsgId);
      await ctx.answerCbQuery("КП отправлено клиенту").catch(() => {});
      if (msgId) {
        await ctx.telegram.editMessageReplyMarkup(chatId, msgId, undefined, { inline_keyboard: [] }).catch(() => {});
      }
      return;
    }

    if (action === "edit") {
      const leadId = parseInt(parts[2], 10);
      // Снять кнопки у предложения, чтобы не зависало.
      if (msgId) {
        await ctx.telegram.editMessageReplyMarkup(chatId, msgId, undefined, { inline_keyboard: [] }).catch(() => {});
        deleteProposalDraft(msgId);
      }
      const sent = await ctx.telegram.sendMessage(
        chatId,
        `✏️ Введите свой вариант КП для клиента по лиду #${leadId}:`,
        { reply_markup: { force_reply: true, selective: true } }
      );
      pendingProposalEdit.set(getManagerChatId(), { leadId, promptMessageId: sent.message_id });
      await ctx.answerCbQuery("Ответьте на это сообщение").catch(() => {});
      return;
    }

    if (action === "cancel") {
      const draftMsgId = parseInt(parts[2], 10) || msgId;
      if (draftMsgId) deleteProposalDraft(draftMsgId);
      if (msgId) {
        await ctx.telegram.editMessageReplyMarkup(chatId, msgId, undefined, { inline_keyboard: [] }).catch(() => {});
      }
      await ctx.answerCbQuery("Отменено").catch(() => {});
      return;
    }

    await ctx.answerCbQuery("Неизвестное действие").catch(() => {});
  } catch (err) {
    console.error("handleProposalCallback error:", err.message);
    await ctx.answerCbQuery(`Ошибка: ${err.message}`).catch(() => {});
  }
}

/**
 * /proposal <leadId> — менеджер запрашивает генерацию КП.
 */
async function handleProposalCommand(ctx) {
  const raw = (ctx.message?.text || "").replace(/^\/proposal(@\w+)?\s*/, "").trim();
  const m = raw.match(/^(\d+)\s*$/);
  if (!m) {
    await ctx.reply("Использование: /proposal <ID лида>\nПример: /proposal 12");
    return;
  }
  const leadId = parseInt(m[1], 10);
  await proposeProposalDraft(ctx, leadId);
}

/**
 * Отправить КП клиенту от имени менеджера (после нажатия «✉ Отправить» или ручного edit).
 * Дописывает в conversation history, переводит лид в in_progress если был new.
 */
async function sendManagerProposalToClient(ctx, leadId, proposalText) {
  try {
    const lead = await getLeadById(leadId);
    if (!lead) {
      await ctx.reply(`Лид #${leadId} не найден.`);
      return;
    }
    if (!lead.telegram_chat_id) {
      await ctx.reply(`У лида #${leadId} нет chat_id клиента.`);
      return;
    }

    const cLang = lead.data?.lang || "ru";
    const header = {
      ru: "💼 Коммерческое предложение:",
      kk: "💼 Коммерциялық ұсыныс:",
      en: "💼 Commercial proposal:",
    }[cLang] || "💼 Коммерческое предложение:";

    const msg = `${header}\n\n${proposalText}`;
    await _bot.telegram.sendMessage(String(lead.telegram_chat_id), msg);

    if (lead.conversation_id) {
      await appendConversationMessage(lead.conversation_id, "manager", `[КП] ${proposalText}`);
    }

    if (lead.status === "new") {
      await updateLead(leadId, { status: "in_progress", assigned_to: Number(ctx.from.id) });
    }

    await ctx.reply(`✓ КП отправлено клиенту по лиду #${leadId}.`);
  } catch (err) {
    console.error("sendManagerProposalToClient error:", err.message);
    await ctx.reply(`Ошибка отправки КП: ${err.message}`);
  }
}
