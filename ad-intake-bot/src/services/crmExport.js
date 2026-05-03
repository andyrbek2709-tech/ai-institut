/**
 * Внешняя CRM:
 * 1) Универсальный POST JSON — CRM_WEBHOOK_URL или BITRIX24_INCOMING_WEBHOOK
 * 2) amoCRM REST v4 — AMOCRM_SUBDOMAIN + AMOCRM_ACCESS_TOKEN (Bearer), опционально AMOCRM_PIPELINE_ID
 */

export async function pushLeadToExternalCrm(payload) {
  const url = (process.env.CRM_WEBHOOK_URL || process.env.BITRIX24_INCOMING_WEBHOOK || "").trim();
  if (!url) {
    return { skipped: true, reason: "no webhook URL" };
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

/**
 * Создать сделку в amoCRM (минимальное тело: имя + опционально воронка).
 */
export async function pushLeadToAmoCrm(payload) {
  const sub = (process.env.AMOCRM_SUBDOMAIN || "").trim().replace(/^https?:\/\//i, "").replace(/\.amocrm\.(ru|com)\/?$/i, "");
  const token = (process.env.AMOCRM_ACCESS_TOKEN || "").trim();
  if (!sub || !token) {
    return { skipped: true, reason: "no AMOCRM_SUBDOMAIN or AMOCRM_ACCESS_TOKEN" };
  }
  const baseRaw = (process.env.AMOCRM_BASE_URL || "").trim() || `https://${sub}.amocrm.ru`;
  const base = baseRaw.replace(/\/$/, "");
  const pipelineRaw = (process.env.AMOCRM_PIPELINE_ID || "").trim();
  const pipelineId = pipelineRaw ? Number(pipelineRaw) : null;
  const name = `TG #${payload.lead_id} ${payload.service_type || "заявка"}`.slice(0, 250);
  const leadObj = {
    name,
    ...(pipelineId && Number.isFinite(pipelineId) ? { pipeline_id: pipelineId } : {}),
  };
  const res = await fetch(`${base}/api/v4/leads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([leadObj]),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AmoCRM HTTP ${res.status} ${t.slice(0, 280)}`);
  }
  return { ok: true };
}

/**
 * Все каналы: amo (если env) + webhook (если env). Ошибки собираются, не роняют друг друга.
 * @returns {{ amo: object, webhook: object, errors: string[] }}
 */
export async function exportLeadToAllIntegrations(payload) {
  const errors = [];
  let amo = null;
  let webhook = null;
  try {
    amo = await pushLeadToAmoCrm(payload);
  } catch (e) {
    amo = { error: e.message };
    errors.push(`AmoCRM: ${e.message}`);
  }
  try {
    webhook = await pushLeadToExternalCrm(payload);
  } catch (e) {
    webhook = { error: e.message };
    errors.push(`Webhook: ${e.message}`);
  }
  return { amo, webhook, errors };
}
