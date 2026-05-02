import { chat, detectLang, describeImage, extractPartialBrief, classifyServiceTypeLLM, extractData, mergeData, missingRequiredFields, assistManagerReply, extractTeachStructured } from "../services/openai.js";
import { transcribeVoice } from "../services/whisper.js";
import {
  upsertConversation,
  completeConversation,
  saveOrder,
  getOrderById,
  updateOrderStatus,
  getOrdersByStatus,
  getOrdersToday,
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
  setManagerState,
  getManagerState,
  clearManagerState,
} from "../utils/state.js";
import {
  addKnowledge,
  listKnowledge,
  deleteKnowledge,
  getKnowledgeById,
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
import { makeEmptyOrder, normalizeToSchema, REQUIRED_FIELDS } from "./orderSchema.js";

const MANAGER_CHAT_ID = String(process.env.MANAGER_CHAT_ID);

let _bot = null;

// In-memory state для clarify-flow: ждём ответа менеджера на ForceReply.
// key = managerChatId (string), value = { leadId, promptMessageId }
const pendingClarify = new Map();

export function registerHandlers(bot) {
  _bot = bot;

  bot.start(handleStart);

  // Manager-only commands
  const ownerOnly = (fn) => (ctx) => {
    if (String(ctx.chat?.id) !== MANAGER_CHAT_ID) return;
    return fn(ctx);
  };
  bot.command("new", ownerOnly((ctx) => handleOwnerList(ctx, "new", "🆕 Новые заявки")));
  bot.command("active", ownerOnly((ctx) => handleOwnerList(ctx, "in_progress", "🔄 В работе")));
  bot.command("today", ownerOnly(handleOwnerToday));
  bot.command("leads", ownerOnly(handleLeadsCommand));
  bot.command("reply", ownerOnly(handleReplyCommand));
  bot.command("assist", ownerOnly(handleAssistCommand));
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

// ─── /start, /help, /reset ───────────────────────────────────────────────────

export async function handleStart(ctx) {
  clearContext(ctx.chat.id);
  await ctx.reply(
    "👋 Сәлеметсіз бе!\n" +
    "Қалаған тіліңізде жаза беріңіз — сол тілде жауап беремін.\n" +
    "Жарнамаға тапсырыс беруге көмектесемін. Не керек екенін айтыңыз — мәтінмен, дауыспен немесе макетті/фотоны жіберіңіз.\n\n" +
    "—\n\n" +
    "👋 Здравствуйте!\n" +
    "Пишите на любом удобном языке — отвечу на нём же.\n" +
    "Я помогу оформить заказ на рекламу. Расскажите что нужно — текстом, голосом или пришлите макет/фото."
  );
}

async function handleHelp(ctx) {
  await ctx.reply([
    "📖 Команды",
    "",
    "/start — начать новый заказ",
    "/reset — сбросить текущий диалог",
    "/help — помощь",
    "",
    "Можно писать текстом, наговаривать голосом или присылать макеты.",
  ].join("\n"));
}

async function handleReset(ctx) {
  clearContext(ctx.chat.id);
  if (String(ctx.chat?.id) === MANAGER_CHAT_ID) clearManagerState(ctx.chat.id);
  await ctx.reply("Окей, начнём заново 🔄\n\nРасскажите, что за заказ?");
}

// ─── Text / Voice / Files ────────────────────────────────────────────────────

export async function handleText(ctx) {
  const userMessage = ctx.message.text?.trim();
  if (!userMessage) return;

  // ─── Manager teach-mode: ждём заметку для knowledge_base ───────────────
  if (await maybeHandleManagerTeachInput(ctx, userMessage)) return;

  // ─── Clarify-flow: менеджер ответил на ForceReply от lead:clarify ──────
  if (String(ctx.chat?.id) === MANAGER_CHAT_ID) {
    const pc = pendingClarify.get(MANAGER_CHAT_ID);
    const replyToId = ctx.message?.reply_to_message?.message_id;
    if (pc && replyToId && replyToId === pc.promptMessageId) {
      pendingClarify.delete(MANAGER_CHAT_ID);
      await sendManagerReplyToClient(ctx, pc.leadId, userMessage);
      return;
    }
  }

  await processUserMessage(ctx, userMessage);
}

export async function handleVoice(ctx) {
  try {
    await ctx.sendChatAction("typing");
    const existing = getContext(ctx.chat.id);
    const text = await transcribeVoice(ctx, existing?.lang);
    if (!text) {
      await ctx.reply("Не получилось распознать голос, попробуйте ещё раз или напишите текстом 🙏");
      return;
    }

    // ─── Manager teach-mode: голосовая заметка для knowledge_base ─────────
    if (await maybeHandleManagerTeachInput(ctx, text)) return;

    // (voice echo removed — speak content directly)
    await processUserMessage(ctx, text);
  } catch (err) {
    console.error("Voice error:", err.message);
    await ctx.reply("Не получилось обработать голос. Напишите текстом, пожалуйста 🙏");
  }
}

export async function handleFile(ctx) {
  try {
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
    const existing = getContext(ctx.chat.id);
    const lang = existing?.lang || "ru";

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
    if (isImage) {
      try {
        await ctx.sendChatAction("typing");
        const dataUrl = await fetchAsDataUrl(link.href, mime || "image/jpeg");
        vision = await describeImage(dataUrl, lang);
      } catch (err) {
        console.error("Vision fetch/describe error:", err.message);
      }
    }

    const visionPart = vision ? ` | vision: "${vision.replace(/"/g, "'")}"` : "";
    const systemNote = `[файл прикреплён: ${link.href}${visionPart}${caption ? ` | подпись: ${caption}` : ""}]`;

    const message = caption ? `${caption}\n\n${systemNote}` : systemNote;
    await ctx.reply(`Принял ${label} 👍`);
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
  };
  if (!entry.orderData) entry.orderData = makeEmptyOrder();
  entry.messages = [...entry.messages, { role: "user", content: userMessage }];

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

      // Перезатираем service_type в collected на нормализованный код,
      // чтобы UI/save_order писали единообразно ("вывеска" / "баннер" / ...).
      if (serviceCode) collected.service_type = serviceCode;

      currentStep = nextStepFor(collected, serviceCode);
      currentQuestion = getQuestion(lang, currentStep);
    }

    setContext(chatId, entry);

    const lastMsgs = entry.messages.slice(-10);

    const result = await chat(lastMsgs, lang, {
      collected,
      currentStep,
      serviceCode,
      currentQuestion,
    });

    if (result.type === "function") {
      // Если LLM вызвал save_order, но service_type у него «сырой» — нормализуем.
      if (result.args && serviceCode) {
        const norm = normalizeServiceType(result.args.service_type) || serviceCode;
        result.args.service_type = norm;
      }
      await finalizeOrder(ctx, entry, result.args);
      return;
    }

    let reply = result.content || "...";

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
      metadata: { order: entry.orderData || null, followup_level: 0 },
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

async function finalizeOrder(ctx, entry, args) {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const lang = entry.lang || "ru";

  // ─── Final required-fields validation (formal schema source-of-truth) ─────
  // entry.orderData собран через extractData/mergeData по ходу диалога.
  // Если LLM вызвал save_order, но обязательные поля пустые — задаём вопрос
  // на нужном языке вместо сохранения.
  try {
    const od = entry.orderData || {};
    // Если LLM в args что-то прислал, а в orderData этого ещё нет — подмешаем,
    // чтобы валидатор увидел свежие данные (LLM иногда extract'ит быстрее, чем extractData).
    const cross = {
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
      metadata: { order: entry.orderData || null },
    });

    // Подмешиваем формальный orderData в args — попадёт в orders.json_data.
    const enrichedArgs = { ...args, order_data: entry.orderData || null };
    console.log(`[finalize] chat=${chatId} args=`, JSON.stringify(args), "orderData=", JSON.stringify(entry.orderData));
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
      const score = calcLeadScore({ orderData: entry.orderData, files: entry.files });
      lead = await createLead({
        conversationId: conversation.id,
        orderId: order.id,
        telegramUserId: userId,
        telegramChatId: chatId,
        data: { ...(entry.orderData || {}), order_id: order.id, lang, username: ctx.from?.username || null },
        leadScore: score,
      });
      console.log(`[lead] created id=${lead.id} score=${score} order=${order.id.substring(0,8)}`);
    } catch (err) {
      console.error("Lead creation failed:", err.message);
    }

    await completeConversation(conversation.id);
    clearContext(chatId);

    const short = order.id.substring(0, 8);
    const confirm = {
      ru: `✅ Заявка №${short} принята!\n\nМенеджер свяжется с вами в ближайшее время.\nЕсли что-то добавить — просто напишите.`,
      kk: `✅ №${short} өтінім қабылданды!\n\nМенеджер жақын арада сізбен байланысады.\nҚосымша мәлімет болса — жазыңыз.`,
      en: `✅ Request #${short} accepted!\n\nA manager will get back to you shortly.\nIf you'd like to add anything — just send a message.`,
    }[lang] || `✅ Заявка №${short} принята!`;
    await ctx.reply(confirm);

    await notifyManager(ctx, order, lang, args, lead);
  } catch (err) {
    console.error("Finalize error:", err.message);
    await ctx.reply("Заявку записал, но возникла техническая ошибка при сохранении. Менеджер всё равно увидит ваше обращение.");
    try {
      await _bot.telegram.sendMessage(
        MANAGER_CHAT_ID,
        `⚠️ Ошибка сохранения заявки от @${ctx.from?.username || ctx.from?.id}: ${err.message}\n\nДанные:\n${JSON.stringify(args, null, 2)}`
      );
    } catch { /* ignore */ }
  }
}

async function notifyManager(ctx, order, lang = "ru", rawArgs = {}, lead = null) {
  const username = ctx.from?.username ? `@${ctx.from.username}` : `id:${ctx.from?.id}`;
  const meta = getLangMeta(lang);
  const score = lead?.lead_score ?? 50;
  const badge = scoreBadge(score);
  const headerId = lead ? `#${lead.id}` : `№${order.id.substring(0, 8)}`;

  const lines = [
    `🆕 Новый лид ${headerId} [${meta.badge}] ${badge} (${score})`,
    ``,
    `🎯 Услуга: ${order.service_type || "—"}`,
    `📝 ${order.description || "—"}`,
  ];
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
  lines.push(`📅 Срок: ${order.deadline || "—"}`);
  if (order.budget) lines.push(`💰 Бюджет: ${order.budget}`);
  lines.push(`📞 Контакт: ${order.contact || "—"}`);
  if (order.notes) lines.push(`✏️ ${order.notes}`);
  lines.push(``, `👤 От: ${username}`);
  if (order.files?.length) lines.push(`📎 Файлов: ${order.files.length}`);

  // Если лид не создался — fallback на старые order-кнопки.
  const keyboard = lead ? {
    inline_keyboard: [
      [{ text: "🎯 Взять в работу", callback_data: `lead:take:${lead.id}` }],
      [{ text: "💬 Уточнить",       callback_data: `lead:clarify:${lead.id}` }],
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

  await _bot.telegram.sendMessage(MANAGER_CHAT_ID, lines.join("\n"), { reply_markup: keyboard });

  for (const url of order.files || []) {
    await _bot.telegram.sendMessage(MANAGER_CHAT_ID, `📎 ${url}`).catch(() => {});
  }
}

// ─── Manager callbacks ───────────────────────────────────────────────────────

async function handleCallback(ctx) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const chatId = String(ctx.callbackQuery.message?.chat?.id);
  if (chatId !== MANAGER_CHAT_ID) {
    await ctx.answerCbQuery("Только менеджер").catch(() => {});
    return;
  }

  // Manager-Assist callbacks: assist:send:<leadId>:<msgId>, assist:edit:<leadId>, assist:cancel:<msgId>
  if (data.startsWith("assist:")) {
    return handleAssistCallback(ctx, data, chatId);
  }

  // Lead-callbacks: lead:take:N, lead:clarify:N, lead:close:N, lead:reject:N, lead:open:N
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
      await ctx.answerCbQuery("Готовлю вариант ответа…").catch(() => {});
      await proposeAssistReply(ctx, leadId, lead);
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
      await ctx.telegram.sendMessage(MANAGER_CHAT_ID, `Лид #${leadId} не найден.`).catch(() => {});
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
        MANAGER_CHAT_ID,
        `⚠️ Не удалось сгенерировать вариант ответа для лида #${leadId}. ` +
        `Можно написать вручную: /reply ${leadId} <текст>`
      ).catch(() => {});
      return;
    }

    // Пока msgId не известен — отправим без кнопок, потом отредактируем
    // (чтобы вшить в callback_data сам msgId, а не накапливать вторичный поиск).
    // Шаг 1: шлём с временным разметом без msgId — кнопки edit/cancel уже работают.
    const sent = await ctx.telegram.sendMessage(
      MANAGER_CHAT_ID,
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
    await ctx.telegram.editMessageReplyMarkup(MANAGER_CHAT_ID, msgId, undefined, {
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
    await ctx.telegram.sendMessage(MANAGER_CHAT_ID, `⚠️ Ошибка ассистента: ${err.message}`).catch(() => {});
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
      pendingClarify.set(MANAGER_CHAT_ID, { leadId, promptMessageId: sent.message_id });
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
  if (String(ctx.chat?.id) !== MANAGER_CHAT_ID) return false;
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
