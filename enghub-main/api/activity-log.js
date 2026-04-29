// GET /api/activity-log?project_id=123&limit=30
// Возвращает activity_log для проекта. Только аутентифицированный пользователь
// с доступом к проекту (admin/gip/lead отдела/engineer с задачей).

const { SURL, adminHeaders, requireAuth, hasProjectAccess, handleCors } = require('./_admin');

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  const projectId = req.query?.project_id;
  const limit = Math.min(Number(req.query?.limit) || 30, 100);
  if (!projectId) {
    return res.status(400).json({ error: 'project_id обязателен' });
  }

  const ok = await hasProjectAccess(auth.user, projectId);
  if (!ok) return res.status(403).json({ error: 'Нет доступа к этому проекту' });

  try {
    const r = await fetch(
      `${SURL}/rest/v1/activity_log?project_id=eq.${encodeURIComponent(projectId)}&select=*&order=created_at.desc&limit=${limit}`,
      { headers: adminHeaders() }
    );
    const data = await r.json().catch(() => []);
    return res.status(200).json(Array.isArray(data) ? data : []);
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
};
