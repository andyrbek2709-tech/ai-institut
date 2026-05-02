import { chat, detectLang, describeImage, extractPartialBrief, classifyServiceTypeLLM, extractData, mergeData, missingRequiredFields } from "../services/openai.js";
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
  getContext,
  setContext,
  clearContext,
  addFile,
  setLang,
  consumeFlag,
} from "../utils/state.js";
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
  await ctx.reply("Окей, начнём заново 🔄\n\nРасскажите, что за заказ?");
}

// ─── Text / Voice / Files ────────────────────────────────────────────────────

export async function handleText(ctx) {
  const userMessage = ctx.message.text?.trim();
  if (!userMessage) return;
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
      metadata: { order: entry.orderData || null },
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

    await completeConversation(conversation.id);
    clearContext(chatId);

    const short = order.id.substring(0, 8);
    const confirm = {
      ru: `✅ Заявка №${short} принята!\n\nМенеджер свяжется с вами в ближайшее время.\nЕсли что-то добавить — просто напишите.`,
      kk: `✅ №${short} өтінім қабылданды!\n\nМенеджер жақын арада сізбен байланысады.\nҚосымша мәлімет болса — жазыңыз.`,
      en: `✅ Request #${short} accepted!\n\nA manager will get back to you shortly.\nIf you'd like to add anything — just send a message.`,
    }[lang] || `✅ Заявка №${short} принята!`;
    await ctx.reply(confirm);

    await notifyManager(ctx, order, lang, args);
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

async function notifyManager(ctx, order, lang = "ru", rawArgs = {}) {
  const username = ctx.from?.username ? `@${ctx.from.username}` : `id:${ctx.from?.id}`;
  const meta = getLangMeta(lang);
  const lines = [
    `🆕 Новая заявка №${order.id.substring(0, 8)} [${meta.badge}]`,
    ``,
    `🎯 Услуга: ${order.service_type || "—"}`,
    `📝 ${order.description || "—"}`,
  ];
  if (order.size) lines.push(`📐 Размер: ${order.size}`);
  if (order.quantity) lines.push(`🔢 Кол-во: ${order.quantity}`);
  // Дополнительные поля сценария — если есть в rawArgs (БД их пока не персистит отдельными колонками).
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

  const keyboard = {
    inline_keyboard: [[
      { text: "✅ Принять", callback_data: `accept:${order.id}` },
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
  const [action, id] = data.split(":");
  if (!id) return;

  const chatId = String(ctx.callbackQuery.message?.chat?.id);
  if (chatId !== MANAGER_CHAT_ID) {
    await ctx.answerCbQuery("Только менеджер").catch(() => {});
    return;
  }

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

// ─── Manager-only listings ───────────────────────────────────────────────────

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
