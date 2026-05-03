/**
 * Роли пользователя: только по whitelist Telegram user id.
 * Если MANAGER_TELEGRAM_USER_IDS не задан — для совместимости со старым деплоем:
 * считаем «менеджером отправителя» только проверку в контексте группы (см. routing в handlers).
 */

const cache = { ids: null, raw: null };

function parseIds() {
  const raw = (process.env.MANAGER_TELEGRAM_USER_IDS || "").trim();
  if (cache.raw === raw && cache.ids) return cache.ids;
  cache.raw = raw;
  if (!raw) {
    cache.ids = new Set();
    return cache.ids;
  }
  cache.ids = new Set(
    raw
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => String(parseInt(s, 10)))
      .filter((s) => s !== "NaN")
  );
  return cache.ids;
}

export function hasManagerUserAllowlist() {
  return parseIds().size > 0;
}

/** userId — number или string */
export function isManagerUserId(userId) {
  if (userId == null) return false;
  return parseIds().has(String(userId));
}
