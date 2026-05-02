// In-memory state for dialog contexts.
// Key: chatId (string), Value: { messages: Array, files: Array<string>, updatedAt: number }

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

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of conversations) {
    if (now - entry.updatedAt > TTL_MS) {
      conversations.delete(key);
    }
  }
}, 5 * 60 * 1000);
