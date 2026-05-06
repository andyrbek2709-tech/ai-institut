// POST /api/storage-sign-url
// body: { storage_path: string, expiresIn?: number, bucket?: 'project-files' | 'normative-docs' }
// Возвращает signed URL.
// Для project-files: storage_path должен начинаться с {projectId}/ → проверка доступа к проекту.
// Для normative-docs: подпись доступна любому аутентифицированному пользователю (нормативка читаема всем).

const { SURL, SERVICE_KEY, requireAuth, hasProjectAccess, handleCors, readJsonBody } = require('./_admin');

const ALLOWED_BUCKETS = new Set(['project-files', 'normative-docs']);
const DEFAULT_BUCKET = 'project-files';

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  let body;
  try { body = await readJsonBody(req); }
  catch (e) { return res.status(400).json({ error: 'Invalid JSON body' }); }

  const path = String(body?.storage_path || '').trim();
  const expiresIn = Math.min(Number(body?.expiresIn) || 3600, 24 * 3600);
  const bucket = String(body?.bucket || DEFAULT_BUCKET);
  if (!path) return res.status(400).json({ error: 'storage_path обязателен' });
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return res.status(400).json({ error: `bucket не разрешён: ${bucket}` });
  }

  // Для project-files — проверка доступа к проекту по первому сегменту.
  if (bucket === 'project-files') {
    const m = path.match(/^(\d+)\//);
    if (!m) return res.status(400).json({ error: 'storage_path должен начинаться с /{projectId}/' });
    const projectId = m[1];
    const ok = await hasProjectAccess(auth.user, projectId);
    if (!ok) return res.status(403).json({ error: 'Нет доступа к файлам этого проекта' });
  }
  // normative-docs: любой auth'd, потому что это публичная нормативка.

  try {
    const r = await fetch(`${SURL}/storage/v1/object/sign/${bucket}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      return res.status(r.status).json({ error: txt || `HTTP ${r.status}` });
    }
    const j = await r.json().catch(() => ({}));
    const signed = j?.signedURL || j?.signedUrl;
    if (!signed) return res.status(500).json({ error: 'Не получили signed URL' });
    const fullUrl = signed.startsWith('http') ? signed : `${SURL}/storage/v1${signed}`;
    return res.status(200).json({ signed_url: fullUrl });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
};
