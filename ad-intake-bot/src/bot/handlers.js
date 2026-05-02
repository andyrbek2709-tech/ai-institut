import { chat } from "../services/openai.js";
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
import { getContext, setContext, clearContext, addFile } from "../utils/state.js";

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
    "Здравствуйте! 👋\n\n" +
    "Я помогу оформить заказ на рекламу.\n" +
    "Расскажите, что нужно — текстом, голосом или пришлите макет/фото.\n\n" +
    "Я задам пару уточнений и передам бриф менеджеру."
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
  if (String(ctx.chat?.id) === MANAGER_CHAT_ID) {
    // Manager's plain text in own chat: ignore by default to avoid LLM noise
    return;
  }
  const userMessage = ctx.message.text?.trim();
  if (!userMessage) return;
  await processUserMessage(ctx, userMessage);
}

export async function handleVoice(ctx) {
  if (String(ctx.chat?.id) === MANAGER_CHAT_ID) return;
  try {
    await ctx.sendChatAction("typing");
    const text = await transcribeVoice(ctx);
    if (!text) {
      await ctx.reply("Не получилось распознать голос, попробуйте ещё раз или напишите текстом 🙏");
      return;
    }
    await ctx.reply(`🎙 Слышу: ${text}`);
    await processUserMessage(ctx, text);
  } catch (err) {
    console.error("Voice error:", err.message);
    await ctx.reply("Не получилось обработать голос. Напишите текстом, пожалуйста 🙏");
  }
}

export async function handleFile(ctx) {
  if (String(ctx.chat?.id) === MANAGER_CHAT_ID) return;
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

  let entry = getContext(chatId) || { messages: [], files: [] };
  entry.messages = [...entry.messages, { role: "user", content: userMessage }];

  try {
    await ctx.sendChatAction("typing");
    const result = await chat(entry.messages);

    if (result.type === "function") {
      // LLM confirmed all collected — save the order
      await finalizeOrder(ctx, entry, result.args);
      return;
    }

    const reply = result.content || "...";
    entry.messages = [...entry.messages, { role: "assistant", content: reply }];
    setContext(chatId, entry);

    // Persist running conversation snapshot to Supabase (best-effort)
    upsertConversation({
      telegramUserId: userId,
      telegramChatId: chatId,
      history: entry.messages,
      files: entry.files,
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

  try {
    // Save conversation as completed first to get id
    const conversation = await upsertConversation({
      telegramUserId: userId,
      telegramChatId: chatId,
      history: entry.messages,
      files: entry.files,
      status: "completed",
    });

    const order = await saveOrder({
      conversationId: conversation.id,
      telegramUserId: userId,
      telegramChatId: chatId,
      data: args,
      files: entry.files,
    });

    await completeConversation(conversation.id);
    clearContext(chatId);

    // Confirm to client
    const short = order.id.substring(0, 8);
    await ctx.reply(
      `✅ Заявка №${short} принята!\n\n` +
      "Менеджер свяжется с вами в ближайшее время.\n" +
      "Если что-то добавить — просто напишите."
    );

    // Forward to manager
    await notifyManager(ctx, order);
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

async function notifyManager(ctx, order) {
  const username = ctx.from?.username ? `@${ctx.from.username}` : `id:${ctx.from?.id}`;
  const lines = [
    `🆕 Новая заявка №${order.id.substring(0, 8)}`,
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
