// src/bot/followup.js — Авто-напоминания клиенту, который замолчал.
//
// Запускается из index.js при старте бота: startFollowupScheduler(bot, supabase).
// Каждые 60 сек просыпается, выбирает active-диалоги с last_user_message_at <= now-30min
// и решает по metadata.followup_level — слать или нет:
//
//   level 0  + ≥30 мин   → шлём 1-е напоминание, level=1
//   level 1  + ≥24 ч      → шлём 2-е, level=2
//   level 2  + ≥72 ч      → шлём 3-е финальное, level=3
//   level 3              → больше не дёргаем
//
// Не отправляем, если: conversation status ≠ 'active', есть lead со status closed/rejected
// или с assigned_to (взяли в работу).

import {
  getActiveConversationsForFollowup,
  updateConversationFollowup,
  getLeadStateForConversation,
} from "../services/supabase.js";

const TICK_MS = 60_000;
const MIN_30 = 30 * 60 * 1000;
const HOURS_24 = 24 * 60 * 60 * 1000;
const HOURS_72 = 72 * 60 * 60 * 1000;

const TEXTS = {
  1: {
    ru: "Напомню о вашем заказе 👋 Если удобно — можем продолжить",
    kk: "Тапсырысыңызды еске саламын 👋 Қолайлы болса — жалғастырамыз",
    en: "Just a friendly reminder about your order 👋 We can continue when convenient",
  },
  2: {
    ru: "Вы не успели ответить 👍 Готовы продолжить, когда вам удобно",
    kk: "Жауап беруге үлгермедіңіз 👍 Қашан қолайлы болса, жалғастыруға дайынбыз",
    en: "You haven't replied yet 👍 We're ready to continue whenever you are",
  },
  3: {
    ru: "Если заказ ещё актуален — напишите 👍 Мы всегда на связи",
    kk: "Тапсырыс әлі де өзекті болса — жазыңыз 👍 Біз әрқашан байланыстамыз",
    en: "If the order is still relevant — drop us a line 👍 We're always here",
  },
};

function pickText(level, lang) {
  const block = TEXTS[level] || TEXTS[1];
  return block[lang] || block.ru;
}

// Решает, какой уровень нужно отправить (или null, если рано / уже всё отправили).
function decideLevel(currentLevel, ageMs) {
  if (currentLevel === 0 && ageMs >= MIN_30) return 1;
  if (currentLevel === 1 && ageMs >= HOURS_24) return 2;
  if (currentLevel === 2 && ageMs >= HOURS_72) return 3;
  return null;
}

async function processOne(bot, row, now) {
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const currentLevel = Number.isInteger(meta.followup_level) ? meta.followup_level : 0;
  if (currentLevel >= 3) return;

  const lastAt = row.last_user_message_at ? new Date(row.last_user_message_at).getTime() : null;
  if (!lastAt) return;
  const ageMs = now - lastAt;

  const nextLevel = decideLevel(currentLevel, ageMs);
  if (!nextLevel) return;

  // Не дёргаем, если по диалогу уже есть закрытый/отклонённый lead или менеджер взял в работу.
  let lead = null;
  try {
    lead = await getLeadStateForConversation(row.id);
  } catch (e) {
    console.error("[followup] lead check failed:", e.message);
    return;
  }
  if (lead) {
    if (lead.status === "closed" || lead.status === "rejected") return;
    if (lead.assigned_to) return;
  }

  const lang = row.lang || "ru";
  const text = pickText(nextLevel, lang);
  const chatId = row.telegram_chat_id;

  try {
    await bot.telegram.sendMessage(chatId, text);
  } catch (e) {
    // Клиент мог удалить чат / заблокировать бота. Просто фиксируем уровень, чтобы не долбить.
    console.error(`[followup] sendMessage to ${chatId} failed: ${e.message}`);
  }

  try {
    await updateConversationFollowup(row.id, {
      level: nextLevel,
      sentAt: new Date(now).toISOString(),
      prevMetadata: meta,
    });
    console.log(`[followup] sent level=${nextLevel} lang=${lang} chat=${chatId}`);
  } catch (e) {
    console.error("[followup] meta update failed:", e.message);
  }
}

async function tick(bot) {
  const now = Date.now();
  // cutoff = самое ранее сообщение, по которому ещё может потребоваться 1-й уровень.
  const cutoffISO = new Date(now - MIN_30).toISOString();
  let rows = [];
  try {
    rows = await getActiveConversationsForFollowup(cutoffISO);
  } catch (e) {
    console.error("[followup] query failed:", e.message);
    return;
  }
  if (!rows.length) return;

  for (const row of rows) {
    try {
      await processOne(bot, row, now);
    } catch (e) {
      console.error(`[followup] processOne failed for conv=${row.id}:`, e.message);
    }
  }
}

export function startFollowupScheduler(bot) {
  if (!bot || !bot.telegram) {
    console.warn("[followup] bot is not ready, scheduler not started");
    return null;
  }
  const handle = setInterval(() => {
    tick(bot).catch((e) => console.error("[followup] tick crashed:", e.message));
  }, TICK_MS);
  // Первый прогон отложим на 10 секунд после старта — пусть бот успеет подняться.
  setTimeout(() => {
    tick(bot).catch((e) => console.error("[followup] first tick crashed:", e.message));
  }, 10_000);
  console.log(`[followup] scheduler started, tick every ${TICK_MS / 1000}s`);
  return handle;
}

export const __test__ = { decideLevel, pickText, TEXTS, MIN_30, HOURS_24, HOURS_72 };
