/**
 * Режим «ответить клиенту» после кнопки «Уточнить».
 * Ключ: telegram user id менеджера (кто нажал кнопку).
 * Одно следующее сообщение (текст / голос / фото и т.д.) → клиенту, затем режим сбрасывается.
 * Голос: распознаётся → клиенту уходит текст (префикс «Менеджер:»).
 */

const relay = new Map();
const TTL_MS = 15 * 60 * 1000;

function gc() {
  const now = Date.now();
  for (const [k, v] of relay) {
    if (now - v.createdAt > TTL_MS) relay.delete(k);
  }
}

setInterval(gc, 60 * 1000);

export function setManagerReplyMode(managerUserId, leadId) {
  relay.set(String(managerUserId), {
    leadId: Number(leadId),
    createdAt: Date.now(),
  });
}

export function getManagerReplyMode(managerUserId) {
  gc();
  const e = relay.get(String(managerUserId));
  if (!e) return null;
  if (Date.now() - e.createdAt > TTL_MS) {
    relay.delete(String(managerUserId));
    return null;
  }
  return e;
}

/** Сбросить после успешной отправки (или отмены). */
export function clearManagerReplyMode(managerUserId) {
  relay.delete(String(managerUserId));
}
