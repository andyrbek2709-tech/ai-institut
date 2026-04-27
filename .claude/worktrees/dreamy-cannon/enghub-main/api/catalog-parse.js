const pdfParse = require('pdf-parse');

function parseCatalog(text = '') {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const codeRe = /(\d{3}-\d{3}-\d{4})\s+(.+)/;
  const unitRe = /\b(шт|м|м2|м3|кг|компл|л|пм|упак)\b/i;
  const stdRe = /\b(ГОСТ|ТУ|СТО|СП)\b[^\n]*/i;

  const sections = [];
  let curSection = { name: 'Общий раздел', groups: [] };
  let curGroup = { name: 'Без группы', items: [] };
  curSection.groups.push(curGroup);
  sections.push(curSection);

  for (const ln of lines) {
    if (/^(РАЗДЕЛ|SECTION)\b/i.test(ln)) {
      curSection = { name: ln, groups: [] };
      curGroup = { name: 'Без группы', items: [] };
      curSection.groups.push(curGroup);
      sections.push(curSection);
      continue;
    }
    if (/^(ГРУППА|GROUP)\b/i.test(ln)) {
      curGroup = { name: ln, items: [] };
      curSection.groups.push(curGroup);
      continue;
    }
    const m = ln.match(codeRe);
    if (!m) continue;
    const code = m[1];
    const name = (m[2] || '').trim();
    const u = ln.match(unitRe);
    const s = ln.match(stdRe);
    curGroup.items.push({
      code,
      name,
      unit: u ? u[0] : '',
      standard: s ? s[0] : '',
    });
  }

  const cleaned = sections
    .map((s) => ({
      name: s.name,
      groups: s.groups.filter((g) => g.items.length > 0),
    }))
    .filter((s) => s.groups.length > 0);

  return cleaned;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ ok: true, name: 'catalog-parse', method: 'POST' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const fileBase64 = req.body?.file_base64;
    if (!fileBase64) return res.status(400).json({ error: 'file_base64 required' });

    const buf = Buffer.from(String(fileBase64), 'base64');
    const parsed = await pdfParse(buf).catch(() => ({ text: '' }));
    const text = String(parsed?.text || '').trim();
    if (!text) {
      return res.status(200).json({ sections: [], warning: 'Не удалось извлечь текст из PDF' });
    }

    const sections = parseCatalog(text);
    return res.status(200).json({ sections });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
};
