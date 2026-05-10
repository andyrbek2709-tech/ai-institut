// POST /api/assignment          — загрузить/заменить задание на проектирование
// GET  /api/assignment?project_id=X  — получить текущее задание + разделы
// GET  /api/assignment?project_id=X&sections_only=1  — только разделы (для агента)
// GET  /api/assignment?project_id=X&discipline=ЭС    — разделы по дисциплине

const { requireAuth, hasProjectAccess, getAdmin, handleCors, readJsonBody, adminHeaders, SURL, SERVICE_KEY } = require('./_admin');

// Карта дисциплин по ключевым словам в заголовке раздела
const DISCIPLINE_MAP = [
  { kw: ['электротехн', 'электроснабж', 'заземлен'], disc: 'ЭС' },
  { kw: ['кипиа', 'кип', 'автоматиз', 'асутп', 'приборы'], disc: 'КИПиА' },
  { kw: ['природоохр', 'экологич', 'окружающ'], disc: 'ООС' },
  { kw: ['организац', 'строительств', 'пос'], disc: 'ПОС' },
  { kw: ['сметн', 'стоимост', 'ведомост', 'нцс'], disc: 'Смета' },
  { kw: ['пожар'], disc: 'ПБ' },
  { kw: ['промышленн', 'безопасност', 'гигиен', 'охран'], disc: 'ПромБ' },
  { kw: ['конструктив', 'объёмно', 'объемно', 'планировоч'], disc: 'КР' },
  { kw: ['состав', 'оформлен', 'документац', 'передач'], disc: 'ОПД' },
  { kw: ['корроз'], disc: 'АКЗ' },
];

function detectDiscipline(title = '') {
  const t = title.toLowerCase();
  for (const { kw, disc } of DISCIPLINE_MAP) {
    if (kw.some(k => t.includes(k))) return disc;
  }
  return null;
}

// Парсим текст ТЗ на разделы. Формат: "<число> <Заголовок>\n<текст до следующего номера>"
function parseSections(text) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  // Ищем строки вида "^\d+\s+[А-ЯA-Z]..." — начало раздела
  const headerRe = /^(\d{1,2})\s{1,4}([А-ЯA-ZЁ][^\n]{3,80})$/;

  let current = null;
  let buf = [];

  const flush = () => {
    if (current) {
      const secText = buf.join('\n').trim();
      if (secText.length > 10) {
        sections.push({
          section_number: current.num,
          section_title: current.title,
          section_text: secText,
          discipline: detectDiscipline(current.title),
        });
      }
    }
    buf = [];
  };

  for (const line of lines) {
    const m = line.match(headerRe);
    if (m) {
      // Проверяем что это реально новый пронумерованный раздел (не мусор)
      const num = parseInt(m[1]);
      if (num >= 1 && num <= 60) {
        flush();
        current = { num, title: m[2].trim() };
        continue;
      }
    }
    buf.push(line);
  }
  flush();
  return sections;
}

const BUCKET = 'project-assignments';

async function ensureBucket() {
  // Создаём bucket если нет
  await fetch(`${SURL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  });
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const auth = await requireAuth(req, res);
  if (!auth) return;

  // ─── GET: получить задание ────────────────────────────────────────────────
  if (req.method === 'GET') {
    const qs = new URL(req.url, 'http://x').searchParams;
    const projectId = qs.get('project_id');
    if (!projectId) return res.status(400).json({ error: 'project_id обязателен' });

    const ok = await hasProjectAccess(auth.user, projectId);
    if (!ok) return res.status(403).json({ error: 'Нет доступа к проекту' });

    const sb = getAdmin();
    const { data: pa, error: paErr } = await sb
      .from('project_assignments')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_current', true)
      .maybeSingle();

    if (paErr) return res.status(500).json({ error: paErr.message });
    if (!pa) return res.status(404).json({ error: 'Задание не загружено' });

    const sectionsOnly = qs.get('sections_only') === '1';
    const discipline = qs.get('discipline');

    let secQ = sb.from('assignment_sections').select('*').eq('assignment_id', pa.id).order('section_number');
    if (discipline) secQ = secQ.eq('discipline', discipline);
    const { data: sections } = await secQ;

    if (sectionsOnly) return res.status(200).json({ sections: sections || [] });

    // Генерируем signed URL для PDF
    let signedUrl = null;
    if (pa.storage_path) {
      const r = await fetch(`${SURL}/storage/v1/object/sign/${BUCKET}/${pa.storage_path}`, {
        method: 'POST',
        headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 3600 }),
      });
      if (r.ok) {
        const j = await r.json();
        signedUrl = `${SURL}/storage/v1${j.signedURL}`;
      }
    }

    return res.status(200).json({ assignment: { ...pa, signed_url: signedUrl }, sections: sections || [] });
  }

  // ─── POST: загрузить/заменить задание ────────────────────────────────────
  if (req.method === 'POST') {
    if (!['admin', 'gip'].some(r => (auth.user.role || '').toLowerCase().includes(r))) {
      return res.status(403).json({ error: 'Только ГИП или admin могут загружать задание' });
    }

    // Multipart — читаем через raw буфер
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);

    // Получаем boundary
    const ct = req.headers['content-type'] || '';
    const boundaryMatch = ct.match(/boundary=(.+)$/);
    if (!boundaryMatch) return res.status(400).json({ error: 'Нужен multipart/form-data' });
    const boundary = '--' + boundaryMatch[1];

    // Простой multipart парсер для полей + одного файла
    const parts = rawBody.toString('binary').split(boundary);
    let projectId, notes, fileBuffer, fileName, mimeType;

    for (const part of parts) {
      if (!part.includes('Content-Disposition')) continue;
      const [headerSection, ...bodyParts] = part.split('\r\n\r\n');
      const body = bodyParts.join('\r\n\r\n').replace(/\r\n--$/, '').replace(/--$/, '');
      const nameMatch = headerSection.match(/name="([^"]+)"/);
      const filenameMatch = headerSection.match(/filename="([^"]+)"/);
      if (!nameMatch) continue;
      const fieldName = nameMatch[1];
      if (filenameMatch) {
        fileName = filenameMatch[1];
        mimeType = (headerSection.match(/Content-Type:\s*([^\r\n]+)/) || [])[1] || 'application/pdf';
        fileBuffer = Buffer.from(body, 'binary');
      } else {
        const val = body.trim();
        if (fieldName === 'project_id') projectId = val;
        if (fieldName === 'notes') notes = val;
      }
    }

    if (!projectId) return res.status(400).json({ error: 'project_id обязателен' });
    if (!fileBuffer || !fileName) return res.status(400).json({ error: 'PDF файл обязателен' });

    const ok = await hasProjectAccess(auth.user, projectId);
    if (!ok) return res.status(403).json({ error: 'Нет доступа к проекту' });

    const sb = getAdmin();

    // Определяем версию
    const { data: existing } = await sb
      .from('project_assignments')
      .select('version')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    const newVersion = existing ? existing.version + 1 : 1;

    // Снимаем is_current=false со старых версий
    await sb.from('project_assignments').update({ is_current: false }).eq('project_id', projectId);

    // Загружаем PDF в storage
    await ensureBucket();
    const storagePath = `${projectId}/v${newVersion}/${fileName}`;
    const uploadResp = await fetch(`${SURL}/storage/v1/object/${BUCKET}/${storagePath}`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': mimeType || 'application/pdf' },
      body: fileBuffer,
    });
    if (!uploadResp.ok) {
      const txt = await uploadResp.text();
      return res.status(500).json({ error: 'Ошибка загрузки файла: ' + txt });
    }

    // Извлекаем текст из PDF через pdf-parse
    let fullText = '';
    let sections = [];
    try {
      const pdfParse = require('pdf-parse');
      const parsed = await pdfParse(fileBuffer);
      fullText = parsed.text || '';
      sections = parseSections(fullText);
    } catch (e) {
      console.error('pdf-parse error:', e.message);
    }

    // Сохраняем запись задания
    const { data: pa, error: paErr } = await sb
      .from('project_assignments')
      .insert({
        project_id: projectId,
        version: newVersion,
        is_current: true,
        file_name: fileName,
        storage_path: storagePath,
        full_text: fullText,
        uploaded_by: auth.user.id,
        notes: notes || null,
      })
      .select()
      .single();

    if (paErr) return res.status(500).json({ error: paErr.message });

    // Сохраняем разделы
    if (sections.length > 0) {
      await sb.from('assignment_sections').insert(
        sections.map(s => ({ ...s, assignment_id: pa.id }))
      );
    }

    return res.status(201).json({
      ok: true,
      assignment_id: pa.id,
      version: newVersion,
      sections_parsed: sections.length,
      file_name: fileName,
    });
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(405).json({ error: 'Method not allowed' });
};
