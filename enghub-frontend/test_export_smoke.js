const path = require('path');
const ExcelJS = require('exceljs');

// Bypass auth by faking Supabase verification — we want to verify the Excel
// pipeline with real template and the new defined-names logic.
const helpers = require('./api/_spec_helpers.js');
const origVerify = helpers.verifyUserAndProfile;
helpers.verifyUserAndProfile = async () => ({
  ok: true,
  user: { id: 1, email: 'test@x', role: 'admin', dept_id: 1 },
  adminHeaders: {},
});
helpers.checkProjectAccess = async () => ({ ok: true });
helpers.matchItemsAgainstCatalog = async (items) => items.map((it, i) => ({
  ...it,
  _from_catalog: i % 2 === 0,
  _catalog_id: i % 2 === 0 ? 100 + i : null,
}));

require.cache[require.resolve('./api/_spec_helpers.js')].exports = helpers;

const handler = require('./api/spec-export.js');

const req = {
  method: 'POST',
  headers: { authorization: 'Bearer fake' },
  body: {
    project_id: 1,
    project: { id: 1, code: 'P-01', name: 'Тест проект' },
    stamp: { project_code: 'P-01', object_name: 'OBJ', system_name: 'SYS', stage: 'РП', author: 'Иванов', checker: 'Петров', date: '2026-04-26' },
    items: [
      { name: 'Кран шаровой DN50', type: 'ГОСТ 21345', code: '111-222-3333', factory: 'Завод-1', unit: 'шт', qty: 2 },
      { name: 'Труба стальная 57x3.5', type: 'ГОСТ 8732', code: '222-333-4444', unit: 'м', qty: 100, item_id: 555 },
      { name: 'Бетон В25', code: '333-444-5555', unit: '', qty: 5 },
    ],
  },
};

let outBuf = null;
const res = {
  setHeader: () => {},
  status: function (s) { this._s = s; return this; },
  json: function (j) { console.log('RESP json:', JSON.stringify(j)); return this; },
  send: function (b) { outBuf = b; console.log('RESP buffer bytes:', b.length); return this; },
};

handler(req, res).then(async () => {
  if (!outBuf) {
    console.error('No buffer returned');
    process.exit(1);
  }
  // Parse the resulting xlsx and verify stamp cells got populated.
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(outBuf);
  const sh = wb.worksheets[0];
  // Check stamp cells based on STAMP_FIELDS positions.
  const checks = [
    { name: 'project_code', row: 34, col: 17, expectIncludes: 'P-01' },
    { name: 'object_name',  row: 36, col: 17, expectIncludes: 'OBJ' },
    { name: 'developer',    row: 39, col: 12, expectIncludes: 'Иванов' },
    { name: 'checker',      row: 40, col: 12, expectIncludes: 'Петров' },
    { name: 'sheet_no',     row: 40, col: 23, expectIncludes: '1' },
  ];
  for (const c of checks) {
    const v = String(sh.getCell(c.row, c.col).value || '');
    const ok = v.includes(c.expectIncludes);
    console.log(ok ? '  OK' : '  FAIL', c.name, '=', JSON.stringify(v));
  }
  // Check item rows: 3 written, last is "manual" (odd index in our mock).
  const itemNames = [4, 5, 6].map(r => String(sh.getCell(r, 8).value || ''));
  console.log('Item names rows 4-6:', itemNames);
  // Check note column markers.
  const notes = [4, 5, 6].map(r => String(sh.getCell(r, 22).value || ''));
  console.log('Notes rows 4-6:', notes);
  // Restore
  helpers.verifyUserAndProfile = origVerify;
}).catch(e => { console.error('ERROR:', e); process.exit(1); });
