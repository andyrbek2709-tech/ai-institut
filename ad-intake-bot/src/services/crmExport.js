/**
 * Внешняя CRM: один POST на URL из env (Bitrix incoming webhook, n8n, amo через прокси и т.д.).
 * CRM_WEBHOOK_URL или BITRIX24_INCOMING_WEBHOOK — если пусто, вызов no-op.
 */
export async function pushLeadToExternalCrm(payload) {
  const url = (process.env.CRM_WEBHOOK_URL || process.env.BITRIX24_INCOMING_WEBHOOK || "").trim();
  if (!url) {
    return { skipped: true, reason: "no CRM_WEBHOOK_URL" };
  }
  const body = {
    source: "ad-intake-bot",
    ...payload,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`CRM webhook HTTP ${res.status} ${t.slice(0, 200)}`);
  }
  return { ok: true };
}
