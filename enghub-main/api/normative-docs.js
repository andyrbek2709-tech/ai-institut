// /api/normative-docs — server-side CRUD для нормативных документов.
//   GET    ?ilike=foo                          → поиск нормативных чанков (text)
//   POST   { action: 'upload_init', name, file_type, file_path, overwrite_id? }
//          → INSERT в normative_docs (после прямой загрузки файла в Storage)
//   POST   { action: 'vectorize', doc_id }
//          → запускает функцию vectorize-doc (server-side вызов)
//   POST   { action: 'delete', id }
//          → удаляет запись normative_docs (Storage-файл удаляется отдельно через /api/storage-delete)
//
// Все операции требуют auth. Запись/удаление — только для admin/gip.

const { SURL, SERVICE_KEY, adminHeaders, requireAuth, handleCors, readJsonBody } = require('./_admin');

function isAdminOrGip(profile) {
  const role = String(profile?.role || '').toLowerCase();
  return role === 'admin' || role.includes('gip') || role.includes('гип');
}

async function handleUploadInit(req, res, body) {
  const { name, file_type, file_path, overwrite_id } = body || {};
  if (!name || !file_path) return res.status(400).json({ error: 'name, file_path обязательны' });

  if (overwrite_id) {
    await fetch(`${SURL}/rest/v1/normative_docs?id=eq.${encodeURIComponent(overwrite_id)}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    }).catch(() => null);
  }

  const r = await fetch(`${SURL}/rest/v1/normative_docs`, {
    method: 'POST',
    headers: { ...adminHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({
      name,
      file_type: file_type || 'application/octet-stream',
      file_path,
      status: 'pending',
    }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) return res.status(r.status).json({ error: (j && (j.message || j.error)) || `HTTP ${r.status}` });
  const row = Array.isArray(j) ? j[0] : j;
  return res.status(201).json(row);
}

async function handleVectorize(req, res, body) {
  const { doc_id } = body || {};
  if (!doc_id) return res.status(400).json({ error: 'doc_id обязателен' });
  // Edge function vectorize-doc вызывается с service_role ключом
  fetch(`${SURL}/functions/v1/vectorize-doc`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc_id }),
  }).catch(() => null);
  return res.status(202).json({ ok: true, message: 'Векторизация запущена' });
}

async function handleDelete(req, res, body) {
  const { id } = body || {};
  if (!id) return res.status(400).json({ error: 'id обязателен' });
  const r = await fetch(`${SURL}/rest/v1/normative_docs?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  });
  if (!r.ok && r.status !== 404) {
    const txt = await r.text().catch(() => '');
    return res.status(r.status).json({ error: txt || `HTTP ${r.status}` });
  }
  return res.status(200).json({ ok: true });
}

async function handleSearch(req, res, query) {
  const q = String(query || '').trim();
  if (!q) return res.status(400).json({ error: 'query обязателен' });
  const enc = encodeURIComponent(`*${q}*`);
  const r = await fetch(
    `${SURL}/rest/v1/normative_chunks?content=ilike.${enc}&select=id,doc_id,doc_name,content&limit=100`,
    { headers: adminHeaders() }
  );
  const data = await r.json().catch(() => []);
  return res.status(200).json(Array.isArray(data) ? data : []);
}

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;

  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (req.method === 'GET') {
    return handleSearch(req, res, req.query?.ilike);
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body;
  try { body = await readJsonBody(req); }
  catch (e) { return res.status(400).json({ error: 'Invalid JSON body' }); }

  const action = body?.action;

  // Read action разрешён всем; write — только admin/gip
  if (action !== 'search' && !isAdminOrGip(auth.user)) {
    return res.status(403).json({ error: 'Только администратор или ГИП могут изменять нормативные документы' });
  }

  switch (action) {
    case 'upload_init': return handleUploadInit(req, res, body);
    case 'vectorize':   return handleVectorize(req, res, body);
    case 'delete':      return handleDelete(req, res, body);
    case 'search':      return handleSearch(req, res, body?.query);
    default: return res.status(400).json({ error: 'Unknown action. Allowed: upload_init, vectorize, delete, search' });
  }
};
