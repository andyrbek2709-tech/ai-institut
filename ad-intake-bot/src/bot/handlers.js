import { chat, detectLang } from "../services/openai.js";
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
import { getLangMeta } from "./prompts.js";

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
    "👋 Здравствуйте! Сәлеметсіз бе! Hello!\n\n" +
    "Пишите на любом удобном языке — отвечу на нём же.\n\n" +
    "Я помогу оформить заказ на рекламу. Расскажите что нужно — " +
    "текстом, голосом или пришлите макет/фото."
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
    let fileId, label;
    if (ctx.message.photo) {
      // Largest photo size last
      const photos = ctx.message.photo;
      fileId = photos[photos.length - 1].file_id;
      label = "фото";
    } else if (ctx.message.document) {
      fileId = ctx.message.document.file_id;
      label = ctx.message.document.file_name || "документ";
    } else {
      return;
    }

    const link = await ctx.telegram.getFileLink(fileId);
    addFile(ctx.chat.id, link.href);

    const caption = ctx.message.caption?.trim();
    const systemNote = `[файл прикреплён: ${link.href}${caption ? ` | подпись: ${caption}` : ""}]`;

    // Continue dialog with file context as a system-like user message
    const message = caption ? `${caption}\n\n${systemNote}` : systemNote;
    await ctx.reply(`Принял ${label} 👍`);
    await processUserMessage(ctx, message);
  } catch (err) {
    console.error("File error:", err.message);
    await ctx.reply("Не получилось загрузить файл. Попробуйте ещё раз 🙏");
  }
}

// ─── Core LLM loop ───────────────────────────────────────────────────────────

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
    const result = await chat(entry.messages, lang);

    if (result.type === "function") {
      // LLM confirmed all collected — save the order
      await finalizeOrder(ctx, entry, result.args);
      return;
    }

    let reply = result.content || "...";

    // Prefix flag on the first reply of a new language (not on every message —
    // would be too noisy).
    const meta = getLangMeta(lang);
    if (consumeFlag(chatId)) {
      reply = `${meta.flag} ${reply}`;
    }

    entry.messages = [...entry.messages, { role: "assistant", content: reply }];
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

    await ctx.reply(reply);
  } catch (err) {
    console.error("LLM error:", err.message);
    await ctx.reply("Что-то пошло не так на моей стороне. Попробуйте ещё раз через минуту 🙏");
  }
}

async function finalizeOrder(ctx, entry, args) {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const lang = entry.lang || "ru";

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
