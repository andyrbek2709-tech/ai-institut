// In-memory state for dialog contexts.
// Key: chatId (string), Value: { messages, files, lang, flagShown, updatedAt }

const conversations = new Map();
const TTL_MS = 60 * 60 * 1000; // 60 minutes — intake briefs can take a while

export function getContext(chatId) {
  const key = String(chatId);
  const entry = conversations.get(key);
  if (!entry) return null;
  if (Date.now() - entry.updatedAt > TTL_MS) {
    conversations.delete(key);
    return null;
  }
  return entry;
}

export function setContext(chatId, ctxData) {
  const key = String(chatId);
  conversations.set(key, { ...ctxData, updatedAt: Date.now() });
}

export function clearContext(chatId) {
  conversations.delete(String(chatId));
}

export function addFile(chatId, fileUrl) {
  const key = String(chatId);
  const entry = conversations.get(key) || { messages: [], files: [] };
  entry.files = [...(entry.files || []), fileUrl];
  entry.updatedAt = Date.now();
  conversations.set(key, entry);
}

export function setLang(chatId, lang) {
  const key = String(chatId);
  const entry = conversations.get(key) || { messages: [], files: [] };
  const langChanged = entry.lang !== lang;
  entry.lang = lang;
  // When the language changes (or is set for the first time) — show the flag
  // on the next reply.
  if (langChanged) entry.flagShown = false;
  entry.updatedAt = Date.now();
  conversations.set(key, entry);
}

export function consumeFlag(chatId) {
  const key = String(chatId);
  const entry = conversations.get(key);
  if (!entry) return false;
  if (entry.flagShown) return false;
  entry.flagShown = true;
  entry.updatedAt = Date.now();
  conversations.set(key, entry);
  return true;
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of conversations) {
    if (now - entry.updatedAt > TTL_MS) {
      conversations.delete(key);
    }
  }
}, 5 * 60 * 1000);
