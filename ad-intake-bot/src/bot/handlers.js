import { chat, detectLang, describeImage, extractPartialBrief } from "../services/openai.js";
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

const MANAGER_CHAT_ID = String(process.env.MANAGER_CHAT_ID);

let _bot = null;

export function registerHandlers(bot) {
  _bot = bot;

  bot.start(handleStart);

  // Manager-only commands (registered before bot.on("text") — Telegraf runs middleware in order)
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
  // NOTE: manager guard removed — when manager tests the bot in their own chat,
  // plain text MUST trigger the dialog. Manager-specific actions are commands
  // (/new, /active, /today) and inline buttons — those are routed before bot.on("text").
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
    await ctx.reply(`🎙 ${text}`);
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
      // Largest photo size last
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

    // Vision: if image, ask GPT-4o-mini to describe it.
    let vision = null;
    if (isImage) {
      try {
        await ctx.sendChatAction("typing");
        // Download bytes and pass as data URL — avoids leaking bot token to OpenAI
        // and works regardless of Telegram CDN policy.
        const dataUrl = await fetchAsDataUrl(link.href, mime || "image/jpeg");
        vision = await describeImage(dataUrl, lang);
      } catch (err) {
        console.error("Vision fetch/describe error:", err.message);
      }
    }

    const visionPart = vision ? ` | vision: "${vision.replace(/"/g, "'")}"` : "";
    const systemNote = `[файл прикреплён: ${link.href}${visionPart}${caption ? ` | подпись: ${caption}` : ""}]`;

    // Continue dialog with file context as a system-like user message
    const message = caption ? `${caption}\n\n${systemNote}` : systemNote;
    await ctx.reply(`Принял ${label} 👍`);
    await processUserMessage(ctx, message);
  } catch (err) {
    console.error("File error:", err.message);
    await ctx.reply("Не получилось загрузить файл. Попробуйте ещё раз 🙏");
  }
}

// Helper: download a URL and return a base64 data URL (used for OpenAI Vision).
async function fetchAsDataUrl(url, mime = "image/jpeg") {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  return `data:${mime};base64,${buf.toString("base64")}`;
}

// ─── Core LLM loop ───────────────────────────────────────────────────────────

// Determine which field to collect next based on what's already known.
function determineNextStep(collected = {}) {
  if (!collected || typeof collected !== "object") return null;

  const has = (k) => {
    const v = collected[k];
    return v != null && String(v).trim() !== "";
  };

  if (!has("service_type")) return "service_type";

  const st = String(collected.service_type || "").toLowerCase();
  const isSignage = /(вывеск|нар(уж|ыж)|баннер|outdoor|sign|жарнам|маңдайш|bilbord|билборд)/i.test(st);

  if (isSignage) {
    if (!has("location")) return "location";
    if (!has("size")) return "size";
    if (!has("content") && !has("description")) return "content";
    if (!has("design")) return "design";
    if (!has("deadline")) return "deadline";
    if (!has("contact")) return "contact";
    return "confirm";
  }

  if (!has("description")) return "description";
  if (!has("deadline")) return "deadline";
  if (!has("contact")) return "contact";
  return "confirm";
}

// Split a bot reply into [reaction, mainQuestion] using "||" delimiter.
// If the reply has no "||", returns [text] as a single message.
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

// Validate contact value: must be 5+ chars AND contain at least one of:
// digit (phone), "@" (handle/email), or "." (email).
// "этот / здесь / тут / Telegram / здесь в телеге" → invalid (signal: substitute later).
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

async function processUserMessage(ctx, userMessage) {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;

  let entry = getContext(chatId) || { messages: [], files: [], lang: null, flagShown: false };
  entry.messages = [...entry.messages, { role: "user", content: userMessage }];

  // Detect language: if not yet set, detect from first message; otherwise
  // re-detect on every text turn so we can react if the client switches.
  const isFileNote = /^\[файл прикреплён:/.test(userMessage);
  let lang = entry.lang;
  if (!isFileNote) {
    try {
      const detected = await detectLang(userMessage);
      if (!entry.lang || entry.lang !== detected) {
        // Switch language (or set initial)
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

    // Build runtime context: extract partial brief + determine next step.
    // Skip extraction on the very first turn (saves a call).
    let collected = {};
    let currentStep = null;
    if (entry.messages.length >= 2) {
      try {
        collected = await extractPartialBrief(entry.messages);
      } catch (err) {
        console.error("extractPartialBrief threw:", err.message);
      }
      // If files have been attached — design field is "есть макет" by default.
      if ((entry.files || []).length > 0 && !collected.design) {
        collected.design = "есть макет";
      }
      currentStep = determineNextStep(collected);
    }

    // Last 10 messages for the LLM (in addition to system prompt).
    const lastMsgs = entry.messages.slice(-10);

    const result = await chat(lastMsgs, lang, { collected, currentStep });

    if (result.type === "function") {
      // LLM confirmed all collected — save the order
      await finalizeOrder(ctx, entry, result.args);
      return;
    }

    let reply = result.content || "...";

    // Prefix flag on the first reply of a new language (not on every message —
    // would be too noisy).
    const meta = getLangMeta(lang);
    const flagShown = consumeFlag(chatId);

    // Split reply into [reaction, mainQuestion] using "||".
    const parts = splitReply(reply);

    // Save the assistant's full reply (joined) to history for LLM continuity.
    entry.messages = [...entry.messages, { role: "assistant", content: parts.join(" ") }];
    setContext(chatId, entry);

    // Persist running conversation snapshot to Supabase (best-effort)
    upsertConversation({
      telegramUserId: userId,
      telegramChatId: chatId,
      history: entry.messages,
      files: entry.files,
      lang,
      status: "active",
    }).catch((err) => console.error("Conversation upsert failed:", err.message));

    // Send as separate Telegram messages with a small delay (more human feel).
    if (parts.length === 2) {
      const first = flagShown ? `${meta.flag} ${parts[0]}` : parts[0];
      await ctx.reply(first);
      await sleep(420);
      await ctx.sendChatAction("typing").catch(() => {});
      await sleep(80);
      await ctx.reply(parts[1]);
    } else {
      const single = flagShown ? `${meta.flag} ${parts[0]}` : parts[0];
      await ctx.reply(single);
    }
  } catch (err) {
    console.error("LLM error:", err.message);
    await ctx.reply("Что-то пошло не так на моей стороне. Попробуйте ещё раз через минуту 🙏");
  }
}

// Build telegram-fallback contact string for the user when contact is ambiguous.
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

  // ─── Contact validation / fallback ──────────────────────────────────────
  // If contact is empty / placeholder ("этот", "тут", "Telegram") — substitute
  // user's @username or tg://user?id=. If still missing AND clearly invalid —
  // re-ask once instead of saving.
  const fallback = buildTelegramFallbackContact(ctx);
  if (isPlaceholderContact(args.contact) || (!args.contact && fallback)) {
    if (fallback) args.contact = fallback;
  }
  if (!isValidContact(args.contact)) {
    if (fallback) {
      args.contact = fallback;
    } else {
      // Re-ask once; do NOT save an invalid order.
      const reask = CONTACT_REASK[lang] || CONTACT_REASK.ru;
      await ctx.reply(reask);
      // Drop the LLM's tentative save_order from history so it can re-ask cleanly.
      return;
    }
  }

  try {
    // Save conversation as completed first to get id
    const conversation = await upsertConversation({
      telegramUserId: userId,
      telegramChatId: chatId,
      history: entry.messages,
      files: entry.files,
      lang,
      status: "completed",
    });

    const order = await saveOrder({
      conversationId: conversation.id,
      telegramUserId: userId,
      telegramChatId: chatId,
      data: args,
      files: entry.files,
      lang,
    });

    await completeConversation(conversation.id);
    clearContext(chatId);

    // Confirm to client (in their language)
    const short = order.id.substring(0, 8);
    const confirm = {
      ru: `✅ Заявка №${short} принята!\n\nМенеджер свяжется с вами в ближайшее время.\nЕсли что-то добавить — просто напишите.`,
      kk: `✅ №${short} өтінім қабылданды!\n\nМенеджер жақын арада сізбен байланысады.\nҚосымша мәлімет болса — жазыңыз.`,
      en: `✅ Request #${short} accepted!\n\nA manager will get back to you shortly.\nIf you'd like to add anything — just send a message.`,
    }[lang] || `✅ Заявка №${short} принята!`;
    await ctx.reply(confirm);

    // Forward to manager
    await notifyManager(ctx, order, lang);
  } catch (err) {
    console.error("Finalize error:", err.message);
    await ctx.reply("Заявку записал, но возникла техническая ошибка при сохранении. Менеджер всё равно увидит ваше обращение.");
    // Best-effort: tell manager raw
    try {
      await _bot.telegram.sendMessage(
        MANAGER_CHAT_ID,
        `⚠️ Ошибка сохранения заявки от @${ctx.from?.username || ctx.from?.id}: ${err.message}\n\nДанные:\n${JSON.stringify(args, null, 2)}`
      );
    } catch { /* ignore */ }
  }
}

async function notifyManager(ctx, order, lang = "ru") {
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

  // Forward attached files
  for (const url of order.files || []) {
    await _bot.telegram.sendMessage(MANAGER_CHAT_ID, `📎 ${url}`).catch(() => {});
  }
}

// ─── Manager callbacks (accept/reject) ───────────────────────────────────────

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
