import { getLeadById, mergeLeadData } from "../services/leads.js";
import { getManagerChatId } from "../config/tenants.js";

/**
 * Задержка напоминания менеджеру «лид всё ещё новый» (мс).
 * 0 = отключено. По умолчанию 5 минут.
 */
function nudgeDelayMs() {
  const raw = String(process.env.MANAGER_LEAD_ACTION_NUDGE_MS ?? "").trim();
  if (raw === "0") return 0;
  const n = parseInt(raw, 10);
  if (Number.isFinite(n) && n >= 0) return n;
  return 5 * 60 * 1000;
}

/**
 * После появления нового лида: через N минут, если статус всё ещё `new`,
 * одно напоминание в чат менеджеров (не дублируем, флаг в lead.data).
 */
export function scheduleManagerLeadActionNudge(bot, leadId) {
  const delay = nudgeDelayMs();
  if (!leadId || !bot || delay <= 0) return;

  setTimeout(async () => {
    try {
      const lead = await getLeadById(leadId);
      if (lead.status !== "new") return;
      const d = lead.data && typeof lead.data === "object" && !Array.isArray(lead.data) ? lead.data : {};
      if (d.manager_action_nudge_sent) return;

      const text = [
        `⏰ Напоминание: лид #${leadId} всё ещё со статусом «новый».`,
        `Нажмите у карточки «🎯 Взять», «✗ Отклонить», «💬 Уточнить» или «✓ Закрыть» — так видно, что заявка в работе и не потерялась.`,
        `Открыть карточку: /leads ${leadId}`,
      ].join("\n");

      await bot.telegram.sendMessage(getManagerChatId(), text);
      await mergeLeadData(leadId, {
        manager_action_nudge_sent: true,
        manager_action_nudge_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("[managerLeadNudge]", leadId, e.message);
    }
  }, delay);
}
