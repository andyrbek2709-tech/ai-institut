/**
 * Multi-tenant: один процесс / один BOT_TOKEN, разные менеджерские чаты по username бота.
 * TENANTS_JSON пример:
 * {"my_agency_bot":{"manager_chat_id":"-1001234567890"},"other_bot":{"manager_chat_id":"-1009876543210"}}
 * Ключ — username бота без @ (как в Telegram API). Спец-ключ "*" или "default" — fallback.
 */
let _botUsername = null;

export function setBotUsernameForTenants(username) {
  _botUsername = (username || "").replace(/^@/, "").trim().toLowerCase() || null;
}

export function getManagerChatId() {
  const fallback = String(process.env.MANAGER_CHAT_ID || "");
  const raw = process.env.TENANTS_JSON;
  if (!raw || !_botUsername) return fallback;
  try {
    const j = JSON.parse(raw);
    const row = j[_botUsername] || j["*"] || j.default;
    if (row && (row.manager_chat_id != null || row.MANAGER_CHAT_ID != null)) {
      return String(row.manager_chat_id ?? row.MANAGER_CHAT_ID);
    }
  } catch (e) {
    console.error("[tenants] TENANTS_JSON:", e.message);
  }
  return fallback;
}
