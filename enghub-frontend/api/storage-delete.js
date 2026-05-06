// POST /api/storage-delete  (используем POST вместо DELETE для совместимости с body)
// body: { storage_path: string }
// Удаляет объект из bucket project-files.
// Проверка: пользователь должен иметь доступ к проекту (по первому сегменту пути).
// Удалять может: admin, gip, lead отдела, owner файла (engineer с задачей этого проекта).

const { SURL, SERVICE_KEY, requireAuth, hasProjectAccess, handleCors, readJsonBody } = require('./_admin');

const STORAGE_BUCKET = 'project-files';

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  let body;
  try { body = await readJsonBody(req); }
  catch (e) { return res.status(400).json({ error: 'Invalid JSON body' }); }

  const path = String(body?.storage_path || '').trim();
  if (!path) return res.status(400).json({ error: 'storage_path обязателен' });

  const m = path.match(/^(\d+)\//);
  if (!m) return res.status(400).json({ error: 'storage_path должен начинаться с /{projectId}/' });
  const projectId = m[1];

  const ok = await hasProjectAccess(auth.user, projectId);
  if (!ok) return res.status(403).json({ error: 'Нет доступа к этому проекту' });

  try {
    const r = await fetch(`${SURL}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
    });
    if (!r.ok && r.status !== 404) {
      const txt = await r.text().catch(() => '');
      return res.status(r.status).json({ error: txt || `HTTP ${r.status}` });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
};
